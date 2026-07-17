"use client"

/**
 * MomentumScroll
 *
 * Wraps a content area (the quick log or transaction list) and gives it a
 * soft, momentum-like *spring* feel as the page scrolls. As scroll velocity
 * builds, the content leans gently against the direction of travel, then
 * settles back with a spring once scrolling slows — the same weighty,
 * inertial feel you get from a physical surface, without ever hijacking the
 * browser's native scroll (keyboard, trackpad, and screen-reader scrolling all
 * keep working exactly as normal).
 *
 * How it works:
 *   - {@link useScrollProgress} exposes the raw window `scrollY` MotionValue.
 *   - framer-motion's `useVelocity` turns that into a scroll velocity (px/s).
 *   - We map the (clamped) velocity to a small bounded `translateY` lean and
 *     smooth it with {@link useSpringScroll} so it eases in and springs back.
 *
 * Drop it around the areas that benefit from a tactile scroll feel:
 *
 *   <MomentumScroll>
 *     <QuickLogArea … />
 *   </MomentumScroll>
 *
 *   <MomentumScroll>
 *     <TransactionList … />
 *   </MomentumScroll>
 *
 * Performance: the only scroll-driven change is a `transform: translateY(...)`
 * (via a MotionValue) on a single wrapper, so it is GPU-composited and runs on
 * the compositor thread — scrolling never triggers a React re-render.
 *
 * Reduced motion: when the user prefers reduced motion the lean is disabled and
 * the wrapper renders as a plain, static container.
 *
 * Validates: Requirements 13.1, 13.5, 8.4
 */

import type { ReactNode } from "react"
import { motion, useTransform, useVelocity } from "framer-motion"
import { useScrollProgress, useSpringScroll } from "@/hooks/useScrollProgress"

export interface MomentumScrollProps {
  /** The scrollable content to give a momentum-spring feel. */
  children: ReactNode
  /**
   * Maximum lean in px at peak scroll velocity. Kept small so the effect reads
   * as weight, not movement. Defaults to 14.
   */
  strength?: number
  /**
   * Scroll velocity (px/s) at which the lean reaches `strength`. Higher values
   * make the content feel stiffer (less lean for the same flick). Defaults to
   * 1400.
   */
  velocityCap?: number
  /** Extra classes for the wrapper. */
  className?: string
}

export function MomentumScroll({
  children,
  strength = 14,
  velocityCap = 1400,
  className = "",
}: MomentumScrollProps) {
  const { scrollY, prefersReducedMotion } = useScrollProgress()

  // Scroll velocity in px/s (positive scrolling down, negative scrolling up).
  const velocity = useVelocity(scrollY)

  // Lean *against* the direction of travel for an inertial "drag" feel, mapped
  // from the clamped velocity range to a small bounded translate.
  const lean = useTransform(velocity, (v) => {
    const clamped = Math.max(-velocityCap, Math.min(velocityCap, v))
    return -(clamped / velocityCap) * strength
  })

  // Spring the lean so it eases in and settles back with momentum.
  const springLean = useSpringScroll(lean)

  if (prefersReducedMotion) {
    return (
      <div className={`momentum-scroll ${className}`.trim()}>{children}</div>
    )
  }

  return (
    <motion.div
      className={`momentum-scroll ${className}`.trim()}
      style={{ y: springLean }}
    >
      {children}
    </motion.div>
  )
}
