// ============================================================================
// Year in Review — Share Image Renderer (Task 183.1, enhanced Task 363.1)
// ============================================================================
//
// Renders a warm, soft-purple share card to a PNG blob using an offscreen
// canvas. This is a browser-only side-effecting helper (kept out of the pure
// `yearInReview.ts` so that stays fully deterministic and testable).
//
// The image is generated ONLY when the user explicitly opts in by tapping the
// "Create a share image" button — never automatically. It contains just the
// user's own personal highlights (no comparison to anyone else).
//
// Task 363.1: Added configurable stat selection (users choose what to include),
// "goals completed" as a new stat row, and polished visual treatment with
// decorative accents. No exact balances are exposed — only relative amounts.
// ============================================================================

import type { YearInReviewData } from '@/types/folio'

// ============================================================================
// Public Types
// ============================================================================

/**
 * Options controlling which stats appear on the share card.
 * All default to `true` — the user opts OUT of stats they don't want shared.
 */
export interface ShareCardOptions {
  /** Show the "Best streak" row. */
  showStreak?: boolean
  /** Show the "Most-saved month" row. */
  showMostSavedMonth?: boolean
  /** Show the "Top category" row. */
  showTopCategory?: boolean
  /** Show the "Saved this year" row (relative amount, not a balance). */
  showTotalSaved?: boolean
  /** Show the "Goals completed" row. */
  showGoalsCompleted?: boolean
  /** Number of goals completed this year (provided by caller). */
  goalsCompleted?: number
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Whole-dollar display string, e.g. 1234.5 → "$1,235". */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/** Draws a rounded rectangle path (caller fills/strokes). */
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

/** Draws decorative floating circles for visual polish. */
function drawDecorations(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Top-right accent circle
  ctx.beginPath()
  ctx.arc(width - 80, 120, 60, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(167, 139, 250, 0.12)'
  ctx.fill()

  // Bottom-left accent circle
  ctx.beginPath()
  ctx.arc(100, height - 140, 45, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(129, 140, 248, 0.1)'
  ctx.fill()

  // Small dot cluster top-left
  ctx.beginPath()
  ctx.arc(160, 180, 8, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(167, 139, 250, 0.2)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(190, 160, 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(129, 140, 248, 0.15)'
  ctx.fill()

  // Subtle horizontal line accents
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(120, height - 200)
  ctx.lineTo(width - 120, height - 200)
  ctx.stroke()
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Renders the recap into a shareable PNG with configurable stat selection.
 *
 * @param review - The computed year-in-review data
 * @param options - Optional config controlling which stats to include
 * @returns A Promise resolving to a PNG {@link Blob}
 * @throws If a 2D canvas context or blob cannot be produced
 */
export function renderYearInReviewImage(
  review: YearInReviewData,
  options: ShareCardOptions = {}
): Promise<Blob> {
  const {
    showStreak = true,
    showMostSavedMonth = true,
    showTopCategory = true,
    showTotalSaved = true,
    showGoalsCompleted = true,
    goalsCompleted = 0,
  } = options

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
      bg.addColorStop(0.5, '#231b3d')
      bg.addColorStop(1, '#1a1a2e')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // Subtle purple glow near the top for the celebratory feel.
      const glow = ctx.createRadialGradient(width / 2, 320, 60, width / 2, 320, 620)
      glow.addColorStop(0, 'rgba(129, 140, 248, 0.28)')
      glow.addColorStop(1, 'rgba(129, 140, 248, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      // Second glow near the bottom for depth
      const glow2 = ctx.createRadialGradient(width / 2, height - 300, 40, width / 2, height - 300, 400)
      glow2.addColorStop(0, 'rgba(167, 139, 250, 0.12)')
      glow2.addColorStop(1, 'rgba(167, 139, 250, 0)')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, width, height)

      // ── Decorative elements ───────────────────────────────────────────────
      drawDecorations(ctx, width, height)

      const centerX = width / 2
      ctx.textAlign = 'center'
      const font = (size: number, weight = 400) =>
        `${weight} ${size}px 'Inter', system-ui, -apple-system, sans-serif`

      // ── Header ────────────────────────────────────────────────────────────
      ctx.font = '96px sans-serif'
      ctx.fillText('🎉', centerX, 240)

      ctx.fillStyle = '#ffffff'
      ctx.font = font(72, 700)
      ctx.fillText(`${review.year} in Review`, centerX, 360)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.font = font(36, 500)
      ctx.fillText(review.biggestWin.headline, centerX, 430)

      // ── Stat blocks ─────────────────────────────────────────────────────────
      type Row = { emoji: string; label: string; value: string }
      const rows: Row[] = []

      if (showStreak) {
        rows.push({
          emoji: '🔥',
          label: 'Best streak',
          value:
            review.bestStreak > 0
              ? `${review.bestStreak} ${review.bestStreak === 1 ? 'day' : 'days'}`
              : 'A fresh start',
        })
      }

      if (showMostSavedMonth && review.mostSavedMonth) {
        rows.push({
          emoji: '🌟',
          label: 'Most-saved month',
          value: review.mostSavedMonth.monthLabel,
        })
      }

      if (showTopCategory && review.topCategory) {
        rows.push({
          emoji: review.topCategory.emoji,
          label: 'Top category',
          value: review.topCategory.label,
        })
      }

      if (showTotalSaved && review.totalSaved > 0) {
        rows.push({
          emoji: '💜',
          label: 'Saved this year',
          value: money(review.totalSaved),
        })
      }

      if (showGoalsCompleted && goalsCompleted > 0) {
        rows.push({
          emoji: '🎯',
          label: 'Goals completed',
          value: `${goalsCompleted} ${goalsCompleted === 1 ? 'goal' : 'goals'}`,
        })
      }

      // Dynamic panel sizing: adapt to the number of visible rows
      const panelX = 120
      const panelW = width - panelX * 2
      const maxRows = rows.length
      // Scale panel height based on count to fill available space nicely
      const availableHeight = height - 530 - 120 // Between header and footer
      const gap = 24
      const totalGaps = (maxRows - 1) * gap
      const panelH = maxRows > 0 ? Math.min(150, (availableHeight - totalGaps) / maxRows) : 150
      let y = 520

      for (const row of rows) {
        // Panel background with subtle border
        drawRoundedRect(ctx, panelX, y, panelW, panelH, 28)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Emoji
        ctx.textAlign = 'left'
        ctx.font = '56px sans-serif'
        ctx.fillText(row.emoji, panelX + 40, y + panelH / 2 + 20)

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
        ctx.font = font(28, 600)
        ctx.fillText(row.label.toUpperCase(), panelX + 140, y + panelH / 2 - 14)

        // Value
        ctx.fillStyle = '#ffffff'
        ctx.font = font(44, 700)
        ctx.fillText(row.value, panelX + 140, y + panelH / 2 + 34)

        ctx.textAlign = 'center'
        y += panelH + gap
      }

      // ── Footer wordmark ──────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = font(30, 600)
      ctx.fillText('Folio', centerX, height - 60)

      // Subtle tagline
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.font = font(22, 400)
      ctx.fillText('Your money, your pace', centerX, height - 28)

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
