"use client"

/**
 * useScrollProgress
 *
 * A small, composable hook that turns scroll position into GPU-friendly
 * motion values other components can bind to `transform` / `opacity`.
 *
 * It wraps framer-motion's `useScroll`, so the returned `scrollY` and
 * `progress` are `MotionValue`s — reading them drives style updates on the
 * compositor thread (off the main thread) rather than triggering React
 * re-renders on every scroll frame.
 *
 * Typical uses in the simplified Folio UI:
 *   - parallax on the gradient mesh background (translate slower than content)
 *   - condensing the daily-allowance hero into a compact glass pill
 *   - intensifying a frosted blur at the top edge as content scrolls under it
 *
 * Momentum feel: pass `spring: true` to run the normalized `progress` through
 * a gentle spring, giving scroll-driven transforms a soft, momentum-like
 * settle without ever hijacking the browser's native scroll (keyboard,
 * screen-reader, and trackpad scrolling all keep working normally).
 *
 * Reduced motion: the hook still returns live motion values, but also reports
 * `prefersReducedMotion` so consumers can opt out of movement and render a
 * calm, static layout instead.
 *
 * Validates: Requirements 13.1, 13.5, 8.4
 */

import type { RefObject } from "react"
import {
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"

export interface UseScrollProgressOptions {
  /**
   * Scroll container to track. Defaults to the document / window when omitted
   * (the app scrolls at the window level under {@link AppShell}).
   */
  container?: RefObject<HTMLElement>
  /**
   * Pixel distance over which `progress` ramps from 0 → 1 (clamped). Smaller
   * values make effects reach full intensity sooner. Defaults to 200px.
   */
  distance?: number
  /**
   * When true, `progress` is smoothed with a gentle spring for a momentum-like
   * feel. `scrollY` always stays the raw, unsmoothed offset. Defaults to false.
   */
  spring?: boolean
}

export interface ScrollProgress {
  /** Raw vertical scroll offset in px (0 at the very top). */
  scrollY: MotionValue<number>
  /** Normalized 0→1 progress over `distance`, clamped at both ends. */
  progress: MotionValue<number>
  /** True when the user prefers reduced motion (skip movement-based effects). */
  prefersReducedMotion: boolean
}

/**
 * Track scroll and expose it as normalized, GPU-composited motion values.
 *
 * @example
 * const { scrollY, progress, prefersReducedMotion } = useScrollProgress({ distance: 160 })
 * const meshY = useTransform(scrollY, (v) => -v * 0.15)
 * // <motion.div style={{ y: prefersReducedMotion ? 0 : meshY }} />
 */
export function useScrollProgress(
  options: UseScrollProgressOptions = {},
): ScrollProgress {
  const { container, distance = 200, spring = false } = options
  const { prefersReducedMotion } = useReducedMotion()

  // `useScroll` requires a stable options object shape; passing `container`
  // only when provided keeps it tracking the window by default.
  const { scrollY } = useScroll(container ? { container } : undefined)

  const rawProgress = useTransform(scrollY, [0, Math.max(1, distance)], [0, 1], {
    clamp: true,
  })

  // Always create the spring (Rules of Hooks) but only surface it when asked.
  const springProgress = useSpring(rawProgress, springs.gentle)

  return {
    scrollY,
    progress: spring ? springProgress : rawProgress,
    prefersReducedMotion,
  }
}

/**
 * useSpringScroll
 *
 * Convenience helper to give any scroll-derived `MotionValue` a momentum-like
 * spring settle. Use it to add a soft, weighty feel to transforms on the quick
 * log and transaction areas without touching native scrolling.
 *
 * @example
 * const { scrollY } = useScrollProgress()
 * const lift = useTransform(scrollY, [0, 300], [0, -12])
 * const springyLift = useSpringScroll(lift)      // momentum feel
 * // <motion.div style={{ y: springyLift }} />
 */
export function useSpringScroll(
  value: MotionValue<number>,
): MotionValue<number> {
  return useSpring(value, springs.gentle)
}
