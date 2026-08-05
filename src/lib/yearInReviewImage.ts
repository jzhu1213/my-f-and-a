// ============================================================================
// Year in Review — Share Image Renderer (Task 183.1)
// ============================================================================
//
// Renders a warm, soft-purple share card to a PNG blob using an offscreen
// canvas. This is a browser-only side-effecting helper (kept out of the pure
// `yearInReview.ts` so that stays fully deterministic and testable).
//
// The image is generated ONLY when the user explicitly opts in by tapping the
// "Create a share image" button — never automatically. It contains just the
// user's own personal highlights (no comparison to anyone else).
// ============================================================================

import type { YearInReviewData } from '@/types/folio'

/** Whole-dollar display string, e.g. 1234.5 → "$1,235". */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/**
 * Renders the recap into a shareable PNG.
 *
 * @param review - The computed year-in-review data
 * @returns A Promise resolving to a PNG {@link Blob}
 * @throws If a 2D canvas context or blob cannot be produced
 */
export function renderYearInReviewImage(review: YearInReviewData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Portrait card sized for stories/feeds. Device-pixel-ratio scaled for
      // crisp text on high-density displays.
      const width = 1080
      const height = 1350
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      // ── Background: soft purple gradient (matches the warm theme) ─────────
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#1a1a2e')
      bg.addColorStop(1, '#231b3d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // Subtle purple glow near the top for the celebratory feel.
      const glow = ctx.createRadialGradient(width / 2, 320, 60, width / 2, 320, 620)
      glow.addColorStop(0, 'rgba(129, 140, 248, 0.28)')
      glow.addColorStop(1, 'rgba(129, 140, 248, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      const centerX = width / 2
      ctx.textAlign = 'center'
      const font = (size: number, weight = 400) =>
        `${weight} ${size}px 'Inter', system-ui, -apple-system, sans-serif`

      // ── Header ────────────────────────────────────────────────────────────
      ctx.font = '96px sans-serif'
      ctx.fillText('🎉', centerX, 260)

      ctx.fillStyle = '#ffffff'
      ctx.font = font(72, 700)
      ctx.fillText(`${review.year} in Review`, centerX, 380)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.font = font(38, 500)
      ctx.fillText(review.biggestWin.headline, centerX, 456)

      // ── Stat blocks ─────────────────────────────────────────────────────────
      type Row = { emoji: string; label: string; value: string }
      const rows: Row[] = []

      rows.push({
        emoji: '🔥',
        label: 'Best streak',
        value:
          review.bestStreak > 0
            ? `${review.bestStreak} ${review.bestStreak === 1 ? 'day' : 'days'}`
            : 'A fresh start',
      })

      if (review.mostSavedMonth) {
        rows.push({
          emoji: '🌟',
          label: 'Most-saved month',
          value: review.mostSavedMonth.monthLabel,
        })
      }

      if (review.topCategory) {
        rows.push({
          emoji: review.topCategory.emoji,
          label: 'Top category',
          value: review.topCategory.label,
        })
      }

      if (review.totalSaved > 0) {
        rows.push({
          emoji: '💜',
          label: 'Saved this year',
          value: money(review.totalSaved),
        })
      }

      // Draw each row as a translucent rounded panel.
      const panelX = 120
      const panelW = width - panelX * 2
      const panelH = 150
      const gap = 28
      let y = 580

      for (const row of rows) {
        drawRoundedRect(ctx, panelX, y, panelW, panelH, 32)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fill()

        // Emoji
        ctx.textAlign = 'left'
        ctx.font = '68px sans-serif'
        ctx.fillText(row.emoji, panelX + 44, y + panelH / 2 + 24)

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.font = font(32, 500)
        ctx.fillText(row.label.toUpperCase(), panelX + 150, y + 58)

        // Value
        ctx.fillStyle = '#ffffff'
        ctx.font = font(52, 700)
        ctx.fillText(row.value, panelX + 150, y + 116)

        ctx.textAlign = 'center'
        y += panelH + gap
      }

      // ── Footer wordmark ──────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.font = font(34, 600)
      ctx.fillText('Folio', centerX, height - 80)

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to render share image'))
        },
        'image/png'
      )
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to render share image'))
    }
  })
}

/** Traces a rounded rectangle path (caller fills/strokes). */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
