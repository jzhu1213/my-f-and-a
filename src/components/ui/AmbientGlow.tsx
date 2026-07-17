/**
 * AmbientGlow
 *
 * A decorative, positioned pool of colored light that sits *behind* key UI
 * elements (the daily-allowance hero, the category selection area, tip cards)
 * to give the premium Folio UI a warm, atmospheric depth.
 *
 * It renders one or more large, heavily-blurred radial-gradient `div`s that
 * are absolutely (or fixed) positioned and layered behind content via a
 * negative `z-index`. The glow color is **status-reactive**: it turns soft
 * green when the user is healthy, amber when cautious, orange as they approach
 * the limit, and a gentle red when over budget — plus warm gold for
 * celebrations and a neutral indigo default.
 *
 * The color change animates smoothly (300ms ease) when `status` changes, so
 * the backdrop feels alive without being distracting. The glow is kept subtle
 * (opacity ~0.15–0.3, tuned per `intensity`).
 *
 * The visual treatment lives in `.ambient-glow*` classes in globals.css.
 *
 * Accessibility / performance:
 * - The element is purely decorative: `aria-hidden` and `pointer-events:none`.
 * - `prefers-reduced-motion: reduce` disables the color-transition animation
 *   (the glow becomes static), handled in globals.css.
 * - Only `background`/`opacity` transition; no layout-affecting properties.
 *
 * This is a plain typed wrapper (no hooks), so it stays a server component and
 * can be dropped behind any positioned container.
 */

import type { HTMLAttributes } from 'react'

/**
 * Status that drives the glow color. Mirrors the allowance status values used
 * across the app, with extra `celebration` and `neutral` variants.
 */
export type AmbientGlowStatus =
  | 'healthy'
  | 'caution'
  | 'warning'
  | 'over'
  | 'celebration'
  | 'neutral'

/** Relative footprint of the glow pool. */
export type AmbientGlowSize = 'sm' | 'md' | 'lg' | 'xl'

/** How strongly the glow reads (maps to opacity ~0.15–0.3). */
export type AmbientGlowIntensity = 'subtle' | 'medium' | 'strong'

/**
 * Where the glow is anchored within its positioned parent. `center` fills
 * behind the whole element; the others bias the light toward an edge/corner.
 */
export type AmbientGlowPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface AmbientGlowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'> {
  /** Status that selects the glow color. Defaults to `neutral`. */
  status?: AmbientGlowStatus
  /** Footprint of the glow pool. Defaults to `md`. */
  size?: AmbientGlowSize
  /** Perceived strength (opacity band). Defaults to `subtle`. */
  intensity?: AmbientGlowIntensity
  /** Anchor point within the parent. Defaults to `center`. */
  position?: AmbientGlowPosition
  /**
   * Use `position: fixed` instead of `absolute` (e.g. a viewport-wide glow).
   * Defaults to `false` (absolute — sits within a positioned parent).
   */
  fixed?: boolean
}

/**
 * Glow colors per status, tuned to the warm theme's semantic tokens
 * (--success #4ade80, --warning #fbbf24, --error #f87171, --accent #818cf8).
 * These are the *core* radial-gradient colors; final on-screen strength is
 * governed by the `intensity` opacity band in globals.css.
 */
const STATUS_GLOW_COLORS: Record<AmbientGlowStatus, string> = {
  healthy: 'rgba(74, 222, 128, 0.55)', // --success green
  caution: 'rgba(251, 191, 36, 0.55)', // --warning amber
  warning: 'rgba(251, 146, 60, 0.55)', // urgent orange
  over: 'rgba(248, 113, 113, 0.55)', // --error red (kept gentle via opacity)
  celebration: 'rgba(252, 211, 77, 0.6)', // warm gold
  neutral: 'rgba(129, 140, 248, 0.5)', // --accent indigo
}

export function AmbientGlow({
  status = 'neutral',
  size = 'md',
  intensity = 'subtle',
  position = 'center',
  fixed = false,
  className = '',
  style,
  ...rest
}: AmbientGlowProps) {
  const glowColor = STATUS_GLOW_COLORS[status]

  const classes = [
    'ambient-glow',
    `ambient-glow--${size}`,
    `ambient-glow--${intensity}`,
    `ambient-glow--${position}`,
    fixed ? 'ambient-glow--fixed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      aria-hidden="true"
      className={classes}
      style={{ ...style, ['--ambient-glow-color' as string]: glowColor } as typeof style}
      {...rest}
    >
      <div className="ambient-glow__pool" />
    </div>
  )
}
