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
 * Start/end clamping: the `start` and `end` options define the scroll pixel
 * range over which progress ramps from 0→1. Values outside this range are
 * clamped, ensuring progress stays within [0, 1]. Updates happen per animation
 * frame via framer-motion's scroll subscription.
 *
 * Validates: Requirements 6.7, 6.8, 6.9, 13.1, 13.5, 8.4
 */

import type { RefObject } from "react"
import {
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { springs } from "@/lib/animations"
import { useReducedMotion } from "@/hooks/useReducedMotion"

export interface UseScrollProgressOptions {
  /**
   * Scroll container to track. Defaults to the document / window when omitted
   * (the app scrolls at the window level under {@link AppShell}).
   */
  container?: RefObject<HTMLElement>
  /**
   * Pixel distance over which `progress` ramps from 0 → 1 (clamped). Smaller
   * values make effects reach full intensity sooner. Defaults to 200px.
   *
   * @deprecated Use `start` and `end` for explicit range control.
   */
  distance?: number
  /**
   * Start scroll position in pixels where progress begins (0 at this point).
   * Defaults to 0.
   */
  start?: number
  /**
   * End scroll position in pixels where progress reaches 1.
   * Defaults to `distance` (200px) if not specified.
   */
  end?: number
  /**
   * When true, `progress` is smoothed with a gentle spring for a momentum-like
   * feel. `scrollY` always stays the raw, unsmoothed offset. Defaults to false.
   */
  spring?: boolean
}

export interface ScrollProgress {
  /** Raw vertical scroll offset in px (0 at the very top). */
  scrollY: MotionValue<number>
  /** Normalized 0→1 progress over the defined range, clamped at both ends. */
  progress: MotionValue<number>
  /** True when the user prefers reduced motion (skip movement-based effects). */
  prefersReducedMotion: boolean
}

/**
 * Track scroll and expose it as normalized, GPU-composited motion values.
 *
 * Progress is clamped between 0 and 1 based on the `start` and `end` scroll
 * positions. Updates happen per animation frame (driven by framer-motion's
 * scroll subscription which uses requestAnimationFrame internally).
 *
 * @example
 * // Simple: 0→1 over first 160px of scroll
 * const { scrollY, progress, prefersReducedMotion } = useScrollProgress({ end: 160 })
 *
 * @example
 * // Range: progress 0 at 50px scroll, 1 at 250px scroll
 * const { progress } = useScrollProgress({ start: 50, end: 250 })
 *
 * @example
 * // Legacy distance API (equivalent to end: 160)
 * const { progress } = useScrollProgress({ distance: 160 })
 */
export function useScrollProgress(
  options: UseScrollProgressOptions = {},
): ScrollProgress {
  const { container, distance = 200, start = 0, end, spring = false } = options
  const { prefersReducedMotion } = useReducedMotion()

  // Resolve the effective end value: explicit `end` takes priority over `distance`
  const effectiveEnd = end ?? (start + distance)

  // Ensure a minimum range of 1px to avoid division by zero
  const clampedEnd = Math.max(start + 1, effectiveEnd)

  // `useScroll` requires a stable options object shape; passing `container`
  // only when provided keeps it tracking the window by default.
  const { scrollY } = useScroll(container ? { container } : undefined)

  // Map scroll position to [0, 1] with clamping at start and end boundaries.
  // framer-motion's useTransform updates per animation frame via rAF.
  const rawProgress = useTransform(scrollY, [start, clampedEnd], [0, 1], {
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
