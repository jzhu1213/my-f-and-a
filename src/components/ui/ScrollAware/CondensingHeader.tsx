"use client"

/**
 * CondensingHeader
 *
 * A sticky header primitive that compresses its full-size hero content into a
 * compact glass pill as the user scrolls down. It is intentionally
 * content-agnostic so Task 11 / AppShell can drop the DailyAllowanceHero (or
 * anything else) into it:
 *
 *   <CondensingHeader compact={<CompactAllowancePill …/>}>
 *     <DailyAllowanceHero … />
 *   </CondensingHeader>
 *
 * How it works:
 *   - The header sticks just below the floating top bar.
 *   - The full content scales down + fades out as scroll `progress` goes 0→1.
 *   - An optional `compact` node cross-fades in to become a compact glass pill.
 *   - A soft shadow beneath the header fades in as it lifts above the content
 *     (see also {@link TopEdgeBlur} for the top-edge frosted treatment).
 *
 * Performance: every scroll-driven change is `transform` (scale / translateY)
 * or `opacity`, so it runs on the compositor thread. Progress comes from
 * {@link useScrollProgress}, a `MotionValue`, so scrolling does not re-render
 * React on every frame.
 *
 * Reduced motion: when the user prefers reduced motion, condensing is disabled
 * — the full content renders statically and native scrolling is untouched.
 *
 * Validates: Requirements 13.1, 13.5, 8.4
 */

import type { ReactNode } from "react"
import { motion, useTransform, type MotionValue } from "framer-motion"
import { useScrollProgress } from "@/hooks/useScrollProgress"

export interface CondensingHeaderProps {
  /** Full-size hero content shown at the top of the scroll. */
  children: ReactNode
  /**
   * Optional compact content that cross-fades in as the header condenses
   * (e.g. a small "$X left today" pill). When omitted, the header simply
   * shrinks and fades.
   */
  compact?: ReactNode
  /**
   * Provide an external scroll progress motion value (0→1) to share a single
   * scroll subscription across several scroll-aware components. When omitted,
   * the header tracks the window itself over `distance`.
   */
  progress?: MotionValue<number>
  /** Pixel distance over which the header fully condenses. Defaults to 180. */
  distance?: number
  /**
   * Where the header sticks from the top (clears the floating top bar by
   * default). Accepts any CSS length. Defaults to `calc(56px + var(--safe-top))`.
   */
  stickyTop?: string
  /** Extra classes for the sticky wrapper. */
  className?: string
}

export function CondensingHeader({
  children,
  compact,
  progress: externalProgress,
  distance = 180,
  stickyTop = "calc(56px + var(--safe-top, 0px))",
  className = "",
}: CondensingHeaderProps) {
  const internal = useScrollProgress({ distance })
  const prefersReducedMotion = internal.prefersReducedMotion
  const progress = externalProgress ?? internal.progress

  // Full hero: shrink + fade + nudge up as we condense.
  const fullScale = useTransform(progress, [0, 1], [1, 0.82])
  const fullOpacity = useTransform(progress, [0, 0.55], [1, 0])
  const fullY = useTransform(progress, [0, 1], [0, -6])

  // Compact pill: cross-fade + settle in during the back half of the range.
  const compactOpacity = useTransform(progress, [0.45, 1], [0, 1])
  const compactScale = useTransform(progress, [0.45, 1], [0.96, 1])

  // Soft elevation shadow that appears once the header lifts off the content.
  const shadowOpacity = useTransform(progress, [0, 0.25, 1], [0, 0.4, 1])

  if (prefersReducedMotion) {
    return (
      <div
        className={`condensing-header ${className}`.trim()}
        style={{ top: stickyTop }}
      >
        <div className="condensing-header__layer">{children}</div>
      </div>
    )
  }

  return (
    <div
      className={`condensing-header ${className}`.trim()}
      style={{ top: stickyTop }}
    >
      {/* Soft shadow under the condensed header */}
      <motion.div
        aria-hidden="true"
        className="condensing-header__shadow"
        style={{ opacity: shadowOpacity }}
      />

      {/* Full hero content */}
      <motion.div
        className="condensing-header__layer condensing-header__full"
        style={{ scale: fullScale, opacity: fullOpacity, y: fullY }}
      >
        {children}
      </motion.div>

      {/* Compact glass pill (optional) */}
      {compact && (
        <motion.div
          className="condensing-header__layer condensing-header__compact"
          style={{ opacity: compactOpacity, scale: compactScale }}
        >
          {compact}
        </motion.div>
      )}
    </div>
  )
}
