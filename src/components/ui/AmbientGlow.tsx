'use client'

/**
 * AmbientGlow
 *
 * A decorative, positioned pool of colored light that sits *behind* key UI
 * elements (the daily-allowance hero, the category selection area, tip cards)
 * to give the premium Folio UI a warm, atmospheric depth.
 *
 * Renders a radial gradient from `--gradient-ambient` with a status-reactive
 * color overlay. Enforces a **single-glow-per-viewport** constraint (Req 3.4):
 * at most one glow source renders its gradient at any time within the
 * 390 × 844 CSS px reference viewport. Additional glow-eligible instances
 * render an opaque fallback fill instead.
 *
 * The color change animates smoothly (300ms ease) when `status` changes, so
 * the backdrop feels alive without being distracting.
 *
 * Fallback behavior:
 * - Non-backdrop-filter browsers: renders opaque fill (Req 4.10)
 * - Suppressed glow (viewport constraint): renders opaque fill (Req 3.6)
 *
 * Accessibility / performance:
 * - The element is purely decorative: `aria-hidden` and `pointer-events:none`.
 * - `prefers-reduced-motion: reduce` disables the color-transition animation
 *   (the glow becomes static), handled in globals.css.
 * - Only `background`/`opacity` transition; no layout-affecting properties.
 * - IntersectionObserver tracks viewport visibility for the constraint.
 */

import { useEffect, useId, useRef, useState, type HTMLAttributes } from 'react'
import { useAmbientGlowSafe } from '@/contexts/AmbientGlowContext'

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
  over: 'rgba(251, 182, 182, 0.35)', // muted rose — calm, not alarming
  celebration: 'rgba(252, 211, 77, 0.6)', // warm gold
  neutral: 'rgba(129, 140, 248, 0.5)', // --accent indigo
}

/**
 * Detects backdrop-filter support. Cached after first evaluation.
 * Returns false for browsers that don't support it (Req 4.10).
 */
let _supportsBackdropFilter: boolean | null = null
function supportsBackdropFilter(): boolean {
  if (_supportsBackdropFilter !== null) return _supportsBackdropFilter
  if (typeof window === 'undefined') return true // SSR: assume support
  _supportsBackdropFilter =
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
  return _supportsBackdropFilter
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
  const glowId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInViewport, setIsInViewport] = useState(false)

  // Access the ambient glow context (if provider is present)
  const glowContext = useAmbientGlowSafe()

  // Track whether this instance is the active (visible + first) glow
  const [isActive, setIsActive] = useState(!glowContext) // No provider = always active

  // IntersectionObserver to detect viewport visibility
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting)
      },
      { threshold: 0.01 } // Trigger when even 1% is visible
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Register/unregister with the glow context based on viewport visibility
  useEffect(() => {
    if (!glowContext) {
      // No provider — always render as active
      setIsActive(true)
      return
    }

    if (isInViewport) {
      const active = glowContext.registerGlow(glowId)
      setIsActive(active)
    } else {
      glowContext.unregisterGlow(glowId)
      setIsActive(false)
    }

    return () => {
      glowContext.unregisterGlow(glowId)
    }
  }, [isInViewport, glowId, glowContext])

  // Re-check active status when context updates (another glow may have left)
  useEffect(() => {
    if (!glowContext) return
    if (isInViewport) {
      setIsActive(glowContext.isActiveGlow(glowId))
    }
  })

  // Determine if glow should be suppressed:
  // 1. Not the active glow (viewport constraint, Req 3.4)
  // 2. Browser doesn't support backdrop-filter (Req 4.10)
  const isSuppressed = !isActive || !supportsBackdropFilter()

  const classes = [
    'ambient-glow',
    `ambient-glow--${size}`,
    `ambient-glow--${intensity}`,
    `ambient-glow--${position}`,
    fixed ? 'ambient-glow--fixed' : '',
    isSuppressed ? 'ambient-glow--suppressed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={classes}
      style={{
        ...style,
        ['--ambient-glow-color' as string]: glowColor,
      } as typeof style}
      {...rest}
    >
      {isSuppressed ? (
        // Opaque fallback fill (Req 3.6, 4.9, 4.10)
        <div className="ambient-glow__fallback" />
      ) : (
        // Radial gradient from --gradient-ambient with status-colored overlay
        <div className="ambient-glow__pool" />
      )}
    </div>
  )
}
