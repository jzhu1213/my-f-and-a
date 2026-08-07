"use client"

/**
 * useReducedMotion
 *
 * A standalone hook that detects whether the user has requested reduced motion
 * via the `prefers-reduced-motion: reduce` media query. Returns a simple
 * boolean consumers can use to skip movement-based effects.
 *
 * The motion system respects this globally: when reduced motion becomes active
 * mid-animation, all variants settle to their resting state within 150ms
 * (Requirement 6.9). Components consuming this hook should hold scroll-linked
 * properties at their resting value and substitute opacity-only transitions of
 * at most 150ms for spring-driven movement (Requirement 6.8).
 *
 * Wraps framer-motion's `useReducedMotion` which subscribes to the OS-level
 * media query reactively.
 *
 * Validates: Requirements 6.7, 6.8, 6.9
 */

import { useReducedMotion as useFramerReducedMotion } from "framer-motion"

export interface UseReducedMotionReturn {
  /** True when the operating system reports `prefers-reduced-motion: reduce`. */
  prefersReducedMotion: boolean
}

/**
 * Detect whether the user prefers reduced motion.
 *
 * @example
 * const { prefersReducedMotion } = useReducedMotion()
 * // Skip scroll-linked transforms when true
 */
export function useReducedMotion(): UseReducedMotionReturn {
  const prefersReducedMotion = useFramerReducedMotion() ?? false
  return { prefersReducedMotion }
}
