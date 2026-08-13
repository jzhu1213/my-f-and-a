// ============================================================================
// Milestone Card Image Renderer (Task 363.2)
// ============================================================================
//
// Renders branded, warm-purple shareable PNG cards for milestone celebrations:
// goal completion, 30-day streak, and wish list item completion.
//
// Same canvas approach as yearInReviewImage.ts — browser-only, opt-in only.
// No sensitive financial data (no exact account balances). Only the milestone
// achievement and a brief, encouraging stat line.
// ============================================================================

// ============================================================================
// Public Types
// ============================================================================

/** Supported milestone types for shareable cards. */
export type MilestoneCardType = 'goal_complete' | 'streak_30_days' | 'wish_complete'

/** Data needed to render a milestone share card. */
export interface MilestoneCardData {
  /** Which milestone type to render. */
  type: MilestoneCardType
  /** Primary headline — e.g. the goal name, "30-Day Streak!", or the wish item. */
  title: string
  /** Brief stat or context (no sensitive data). e.g. "Saved over 30 days" */
  subtitle?: string
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Milestone-specific config for rendering. */
interface MilestoneTheme {
  emoji: string
  headline: string
  accentColor: string
  glowColor: string
}

function getTheme(type: MilestoneCardType): MilestoneTheme {
  switch (type) {
    case 'goal_complete':
      return {
        emoji: '🎯',
        headline: 'Goal Achieved!',
        accentColor: 'rgba(74, 222, 128, 0.3)',
        glowColor: 'rgba(74, 222, 128, 0.2)',
      }
    case 'streak_30_days':
      return {
        emoji: '🔥',
        headline: '30-Day Streak!',
        accentColor: 'rgba(251, 191, 36, 0.3)',
        glowColor: 'rgba(251, 191, 36, 0.2)',
      }
    case 'wish_complete':
      return {
        emoji: '🌟',
        headline: 'Wish Granted!',
        accentColor: 'rgba(167, 139, 250, 0.3)',
        glowColor: 'rgba(167, 139, 250, 0.25)',
      }
  }
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

/** Word-wraps text and draws centered lines. */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY)
    currentY += lineHeight
  }
  return currentY
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Renders a milestone celebration into a shareable PNG.
 *
 * @param data - The milestone data to render
 * @returns A Promise resolving to a PNG {@link Blob}
 * @throws If a 2D canvas context or blob cannot be produced
 */
export function renderMilestoneCardImage(data: MilestoneCardData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Square card works well for social sharing
      const width = 1080
      const height = 1080
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      const theme = getTheme(data.type)
      const centerX = width / 2
      const font = (size: number, weight = 400) =>
        `${weight} ${size}px 'Inter', system-ui, -apple-system, sans-serif`

      // ── Background: warm purple gradient ──────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#1a1a2e')
      bg.addColorStop(0.5, '#231b3d')
      bg.addColorStop(1, '#1a1a2e')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // Central glow with milestone accent color
      const glow = ctx.createRadialGradient(centerX, height / 2 - 60, 40, centerX, height / 2 - 60, 400)
      glow.addColorStop(0, theme.glowColor)
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      // Secondary purple glow
      const glow2 = ctx.createRadialGradient(centerX, 200, 30, centerX, 200, 300)
      glow2.addColorStop(0, 'rgba(129, 140, 248, 0.15)')
      glow2.addColorStop(1, 'rgba(129, 140, 248, 0)')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, width, height)

      // ── Decorative elements ───────────────────────────────────────────────
      // Accent ring behind the emoji
      ctx.beginPath()
      ctx.arc(centerX, 340, 120, 0, Math.PI * 2)
      ctx.strokeStyle = theme.accentColor
      ctx.lineWidth = 3
      ctx.stroke()

      // Outer softer ring
      ctx.beginPath()
      ctx.arc(centerX, 340, 160, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Small decorative dots
      ctx.beginPath()
      ctx.arc(200, 200, 6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(167, 139, 250, 0.2)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(width - 180, 250, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(129, 140, 248, 0.15)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(250, height - 200, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(167, 139, 250, 0.12)'
      ctx.fill()

      // ── Emoji ─────────────────────────────────────────────────────────────
      ctx.textAlign = 'center'
      ctx.font = '120px sans-serif'
      ctx.fillText(theme.emoji, centerX, 380)

      // ── Headline (milestone type) ─────────────────────────────────────────
      ctx.fillStyle = '#ffffff'
      ctx.font = font(64, 700)
      ctx.fillText(theme.headline, centerX, 520)

      // ── Title (user's goal/wish name) ─────────────────────────────────────
      // Panel background for the title
      const titlePanelY = 570
      const titlePanelH = 160
      const titlePanelX = 120
      const titlePanelW = width - titlePanelX * 2
      drawRoundedRect(ctx, titlePanelX, titlePanelY, titlePanelW, titlePanelH, 28)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Title text (word-wrapped)
      ctx.fillStyle = '#ffffff'
      ctx.font = font(44, 600)
      ctx.textAlign = 'center'
      drawWrappedText(
        ctx,
        data.title,
        centerX,
        titlePanelY + 70,
        titlePanelW - 60,
        54
      )

      // ── Subtitle (brief stat, no sensitive data) ──────────────────────────
      if (data.subtitle) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.font = font(32, 500)
        ctx.textAlign = 'center'
        ctx.fillText(data.subtitle, centerX, 820)
      }

      // ── Footer wordmark ──────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = font(30, 600)
      ctx.textAlign = 'center'
      ctx.fillText('Folio', centerX, height - 60)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.font = font(22, 400)
      ctx.fillText('Your money, your pace', centerX, height - 28)

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to render milestone card'))
        },
        'image/png'
      )
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to render milestone card'))
    }
  })
}
