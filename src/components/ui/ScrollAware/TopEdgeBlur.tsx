"use client"

/**
 * TopEdgeBlur
 *
 * A fixed frosted-glass overlay pinned to the top edge of the viewport. As
 * content scrolls up behind it, the band's `opacity` ramps in — reading as a
 * blur that *intensifies* the more content passes underneath — and a soft
 * shadow appears beneath it, grounding a condensed header above the content.
 *
 * Why opacity (not animated blur): `backdrop-filter` blur radius can't be
 * animated on the compositor thread. Instead we keep a constant blur on the
 * band and animate only its `opacity`, which is GPU-composited and stays off
 * the main thread while giving the same "blur fades in" impression.
 *
 * The band uses a downward alpha mask so it fades softly into the content
 * rather than ending on a hard line.
 *
 * Reduced motion: when the user prefers reduced motion the band renders at a
 * gentle static opacity instead of reacting to scroll.
 *
 * Validates: Requirements 13.1, 13.5, 8.4
 */

import { motion, useTransform, type MotionValue } from "framer-motion"
import { useScrollProgress } from "@/hooks/useScrollProgress"

export interface TopEdgeBlurProps {
  /**
   * Optional shared scroll progress (0→1). When omitted the overlay tracks the
   * window itself over `distance`.
   */
  progress?: MotionValue<number>
  /** Pixel distance over which the blur reaches full intensity. Defaults to 120. */
  distance?: number
  /** Height of the frosted band in px. Defaults to 96. */
  height?: number
  /**
   * Offset from the very top (e.g. to sit below the floating top bar). Accepts
   * any CSS length. Defaults to 0.
   */
  top?: string
  /** Extra classes for the overlay. */
  className?: string
}

export function TopEdgeBlur({
  progress: externalProgress,
  distance = 120,
  height = 96,
  top = "0px",
  className = "",
}: TopEdgeBlurProps) {
  const internal = useScrollProgress({ distance })
  const prefersReducedMotion = internal.prefersReducedMotion
  const progress = externalProgress ?? internal.progress

  const opacity = useTransform(progress, [0, 1], [0, 1])

  return (
    <motion.div
      aria-hidden="true"
      className={`top-edge-blur ${className}`.trim()}
      style={{
        top,
        height,
        opacity: prefersReducedMotion ? 0.5 : opacity,
      }}
    />
  )
}
