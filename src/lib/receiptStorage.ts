/**
 * Receipt photo storage utility for Folio transactions.
 *
 * Handles uploading receipt images to Supabase Storage with:
 * - Client-side image compression (max ~1MB)
 * - Offline fallback via localStorage blob references
 * - Graceful degradation when storage is unavailable
 *
 * Task 130.2
 */

import { supabase } from './supabaseClient'

// ============================================================================
// Constants
// ============================================================================

const BUCKET_NAME = 'receipts'
const MAX_FILE_SIZE = 1024 * 1024 // 1MB after compression
const LOCAL_STORAGE_KEY = 'folio-receipt-queue'
const LOCAL_RECEIPTS_KEY = 'folio-receipts'

// ============================================================================
// Types
// ============================================================================

interface QueuedUpload {
  transactionId: string
  dataUrl: string
  timestamp: string
}

// ============================================================================
// Image compression
// ============================================================================

/**
 * Compress an image file to fit within MAX_FILE_SIZE.
 * Uses canvas downscaling and JPEG quality reduction.
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Scale down if larger than 1200px on longest side
      const maxDim = 1200
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until under size limit
      const qualities = [0.8, 0.6, 0.4, 0.3]
      for (const quality of qualities) {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size <= MAX_FILE_SIZE) {
              resolve(blob)
            }
          },
          'image/jpeg',
          quality
        )
      }

      // Final attempt at lowest quality
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Image compression failed'))
        },
        'image/jpeg',
        0.3
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

// ============================================================================
// Upload / Download
// ============================================================================

/**
 * Upload a receipt image for a transaction.
 * Returns the public URL on success, or null on failure.
 * Falls back to localStorage queue when offline.
 */
export async function uploadReceipt(
  transactionId: string,
  file: File
): Promise<string | null> {
  try {
    const compressed = await compressImage(file)
    const filePath = `${transactionId}.jpg`

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) {
      // Offline or bucket doesn't exist — queue for later
      await queueOfflineUpload(transactionId, file)
      return getLocalReceiptUrl(transactionId)
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    const publicUrl = urlData?.publicUrl ?? null

    // Also save locally for instant access
    if (publicUrl) {
      saveLocalReceiptUrl(transactionId, publicUrl)
    }

    return publicUrl
  } catch {
    // Network error — queue offline
    await queueOfflineUpload(transactionId, file)
    return getLocalReceiptUrl(transactionId)
  }
}

/**
 * Delete a receipt for a transaction from Supabase Storage.
 */
export async function deleteReceipt(transactionId: string): Promise<void> {
  try {
    const filePath = `${transactionId}.jpg`
    await supabase.storage.from(BUCKET_NAME).remove([filePath])
  } catch {
    // Fail silently — receipt may not exist in storage
  }

  // Always clear local reference
  removeLocalReceiptUrl(transactionId)
}

/**
 * Get the receipt URL for a transaction.
 * Checks local storage first for instant access.
 */
export function getReceiptUrl(transactionId: string): string | null {
  return getLocalReceiptUrl(transactionId)
}

// ============================================================================
// Offline queue
// ============================================================================

async function queueOfflineUpload(transactionId: string, file: File): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // Convert to data URL for localStorage persistence
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Save as local preview
    saveLocalReceiptUrl(transactionId, dataUrl)

    // Add to upload queue
    const queue = getUploadQueue()
    const existing = queue.findIndex((q) => q.transactionId === transactionId)
    if (existing >= 0) {
      queue[existing] = { transactionId, dataUrl, timestamp: new Date().toISOString() }
    } else {
      queue.push({ transactionId, dataUrl, timestamp: new Date().toISOString() })
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full or unavailable
  }
}

function getUploadQueue(): QueuedUpload[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Process any queued offline uploads. Call on app mount or network recovery.
 */
export async function processOfflineQueue(): Promise<void> {
  const queue = getUploadQueue()
  if (queue.length === 0) return

  const remaining: QueuedUpload[] = []

  for (const item of queue) {
    try {
      // Convert data URL back to blob
      const response = await fetch(item.dataUrl)
      const blob = await response.blob()
      const filePath = `${item.transactionId}.jpg`

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (error) {
        remaining.push(item)
      } else {
        // Update local URL to public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath)
        if (urlData?.publicUrl) {
          saveLocalReceiptUrl(item.transactionId, urlData.publicUrl)
        }
      }
    } catch {
      remaining.push(item)
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining))
}

// ============================================================================
// Local receipt URL storage
// ============================================================================

function getReceiptMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_RECEIPTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalReceiptUrl(transactionId: string, url: string): void {
  if (typeof window === 'undefined') return
  try {
    const map = getReceiptMap()
    map[transactionId] = url
    localStorage.setItem(LOCAL_RECEIPTS_KEY, JSON.stringify(map))
  } catch {
    // Storage full
  }
}

function getLocalReceiptUrl(transactionId: string): string | null {
  const map = getReceiptMap()
  return map[transactionId] ?? null
}

function removeLocalReceiptUrl(transactionId: string): void {
  if (typeof window === 'undefined') return
  try {
    const map = getReceiptMap()
    delete map[transactionId]
    localStorage.setItem(LOCAL_RECEIPTS_KEY, JSON.stringify(map))
  } catch {
    // Fail silently
  }
}
