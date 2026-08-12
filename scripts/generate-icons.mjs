/**
 * Generate PWA icon PNGs from the SVG source.
 *
 * Uses Node's built-in capabilities to create minimal valid PNG files
 * with the Folio brand colors. These serve as installable PWA icons.
 *
 * Run: node scripts/generate-icons.mjs
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

/**
 * Creates a minimal valid PNG file with a solid color.
 * Uses raw PNG format (uncompressed IDAT with zlib stored blocks).
 */
function createPNG(size, bgColor) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = createIHDR(size, size)

  // IDAT chunk - raw pixel data
  const idat = createIDAT(size, size, bgColor)

  // IEND chunk
  const iend = createIEND()

  return Buffer.concat([signature, ihdr, idat, iend])
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13)
  data.writeUInt32BE(width, 0)
  data.writeUInt32BE(height, 4)
  data[8] = 8 // bit depth
  data[9] = 2 // color type: RGB
  data[10] = 0 // compression
  data[11] = 0 // filter
  data[12] = 0 // interlace
  return createChunk('IHDR', data)
}

function createIDAT(width, height, color) {
  const [r, g, b] = color

  // Raw image data: each row has a filter byte (0 = None) + RGB pixels
  const rowSize = 1 + width * 3
  const rawData = Buffer.alloc(rowSize * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize
    rawData[rowOffset] = 0 // filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3

      // Draw a centered rounded square region with the accent color
      // and fill background with the brand dark purple
      const cx = width / 2
      const cy = height / 2
      const innerRadius = width * 0.35
      const dx = Math.abs(x - cx)
      const dy = Math.abs(y - cy)

      // Superellipse approximation for rounded-rect
      const dist = Math.pow(dx / innerRadius, 3) + Math.pow(dy / innerRadius, 3)

      if (dist <= 1) {
        // Accent purple center (#818cf8)
        rawData[pixelOffset] = 0x81
        rawData[pixelOffset + 1] = 0x8c
        rawData[pixelOffset + 2] = 0xf8
      } else {
        // Background (#12121f)
        rawData[pixelOffset] = r
        rawData[pixelOffset + 1] = g
        rawData[pixelOffset + 2] = b
      }
    }
  }

  // Compress using deflate (zlib stored blocks for simplicity)
  const compressed = deflateStored(rawData)
  return createChunk('IDAT', compressed)
}

/**
 * Minimal zlib wrapper with stored (uncompressed) deflate blocks.
 * Not efficient for size but produces valid PNGs without external deps.
 */
function deflateStored(data) {
  const MAX_BLOCK = 65535
  const blocks = []

  // Zlib header: CMF=0x78 (deflate, window 32K), FLG=0x01 (no dict, check bits)
  blocks.push(Buffer.from([0x78, 0x01]))

  let offset = 0
  while (offset < data.length) {
    const remaining = data.length - offset
    const blockSize = Math.min(remaining, MAX_BLOCK)
    const isLast = offset + blockSize >= data.length

    // Stored block header: BFINAL(1 bit) + BTYPE=00(2 bits), then LEN and NLEN
    const header = Buffer.alloc(5)
    header[0] = isLast ? 0x01 : 0x00
    header.writeUInt16LE(blockSize, 1)
    header.writeUInt16LE(blockSize ^ 0xffff, 3)

    blocks.push(header)
    blocks.push(data.subarray(offset, offset + blockSize))
    offset += blockSize
  }

  // Adler-32 checksum (computed in chunks to avoid overflow)
  let a = 1, b = 0
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  const adler = Buffer.alloc(4)
  // Write as big-endian: b in high 16 bits, a in low 16 bits
  adler.writeUInt16BE(b & 0xffff, 0)
  adler.writeUInt16BE(a & 0xffff, 2)
  blocks.push(adler)

  return Buffer.concat(blocks)
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0))
}

function createChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeBuffer = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData), 0)

  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

// Generate icons
const bgColor = [0x12, 0x12, 0x1f] // --bg: #12121f

console.log('Generating icon-192.png...')
writeFileSync(join(publicDir, 'icon-192.png'), createPNG(192, bgColor))

console.log('Generating icon-512.png...')
writeFileSync(join(publicDir, 'icon-512.png'), createPNG(512, bgColor))

console.log('Done! PWA icons generated in public/')
