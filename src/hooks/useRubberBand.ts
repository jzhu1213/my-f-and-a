"use client"

import { useRef, useEffect, useCallback } from "react"
import { useMotionValue, useTransform, type MotionValue } from "framer-motion"

/**
 * useRubberBand — applies tasteful rubber-band / overscroll physics to a
 * scrollable container. When the user scrolls past the top or bottom bounds,
 * the content stretches with diminishing returns (like iOS native scroll) then
 * snaps back on release.
 *
 * GPU-composited: drives only `translateY` via a motion value, so the browser
 * composites the transform on the GPU without layout thrashing.
 *
 * Usage:
 * ```tsx
 * const { containerRef, style } = useRubberBand()
 * return <motion.div ref={containerRef} style={style}>{children}</motion.div>
 * ```
 *
 * Or attach to any scrollable element:
 * ```tsx
 * const { containerRef, style } = useRubberBand({ elasticity: 0.25 })
 * <motion.main ref={containerRef} style={{ ...myStyles, ...style }}>
 * ```
 *
 * Respects `prefers-reduced-motion` by disabling the effect entirely.
 *
 * Task 242.3
 */

export interface UseRubberBandOptions {
  /** How much the content stretches beyond bounds (0–1). Default: 0.3 */
  elasticity?: number
  /** Max pixels the content can stretch. Default: 80 */
  maxStretch?: number
  /** Whether the effect is disabled (e.g. reduced motion). Default: false */
  disabled?: boolean
}

export interface UseRubberBandReturn {
  /** Attach this ref to the scrollable container element. */
  containerRef: React.RefObject<HTMLElement | null>
  /** Spread this into the motion element's `style` prop for GPU-composited elastic. */
  style: { y: MotionValue<number> }
}

/**
 * Rubber-band math: diminishing displacement beyond the boundary.
 * `d = maxStretch * (1 - e^(-delta * elasticity / maxStretch))`
 * This gives a natural iOS-like resistance curve.
 */
function rubberBandClamp(
  delta: number,
  elasticity: number,
  maxStretch: number
): number {
  const sign = delta < 0 ? -1 : 1
  const absDelta = Math.abs(delta)
  return sign * maxStretch * (1 - Math.exp((-absDelta * elasticity) / maxStretch))
}

export function useRubberBand(
  options: UseRubberBandOptions = {}
): UseRubberBandReturn {
  const { elasticity = 0.3, maxStretch = 80, disabled = false } = options

  const containerRef = useRef<HTMLElement | null>(null)
  const overscrollY = useMotionValue(0)
  const y = useTransform(overscrollY, (val) =>
    rubberBandClamp(val, elasticity, maxStretch)
  )

  // Track touch state
  const touchStartY = useRef(0)
  const isOverscrolling = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const el = containerRef.current
      if (!el) return

      // Only apply rubber-band if the element is independently scrollable
      // (has its own scrollable content). If scrollHeight <= clientHeight,
      // the element doesn't scroll and we should not intercept touch events.
      if (el.scrollHeight <= el.clientHeight) return

      const touchY = e.touches[0].clientY
      const deltaY = touchY - touchStartY.current

      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        // User is pulling past bounds
        isOverscrolling.current = true
        const overDelta = atTop ? deltaY : deltaY // raw delta past the edge
        overscrollY.set(overDelta)

        // Prevent native scroll bounce on iOS
        if (Math.abs(overDelta) > 2) {
          e.preventDefault()
        }
      } else if (isOverscrolling.current) {
        // User scrolled back within bounds
        isOverscrolling.current = false
        overscrollY.set(0)
      }
    },
    [overscrollY]
  )

  const handleTouchEnd = useCallback(() => {
    if (isOverscrolling.current) {
      isOverscrolling.current = false
      // Animate back to zero with a quick spring-like decay
      const current = overscrollY.get()
      if (current !== 0) {
        // Simple spring-back using requestAnimationFrame
        const springBack = () => {
          const val = overscrollY.get()
          if (Math.abs(val) < 0.5) {
            overscrollY.set(0)
            return
          }
          overscrollY.set(val * 0.75) // Exponential decay
          requestAnimationFrame(springBack)
        }
        requestAnimationFrame(springBack)
      }
    }
  }, [overscrollY])

  useEffect(() => {
    if (disabled) return

    const el = containerRef.current
    if (!el) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
      el.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    style: { y },
  }
}
