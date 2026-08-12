"use client"

/**
 * useScrollPreservation — Save/restore scroll position per destination.
 *
 * When navigating between primary destinations, this hook preserves scroll
 * positions so users return to where they left off. Positions are stored in
 * a ref (no re-renders) and restored within 4px accuracy using
 * requestAnimationFrame for post-render timing.
 *
 * Validates: Requirements 10.10
 */

import { useRef, useEffect } from 'react'
import type { AppNavKey } from '@/components/ui/AppShell'

/**
 * Preserves scroll position per destination, saving when leaving and
 * restoring when arriving.
 *
 * Since the app scrolls at the window/document level (not an internal
 * element), we track window.scrollY rather than el.scrollTop.
 *
 * @param activeNav - The currently active navigation destination.
 * @param scrollContainerRef - Ref to the scrollable element (unused, kept for API compat).
 */
export function useScrollPreservation(
  activeNav: AppNavKey,
  scrollContainerRef: React.RefObject<HTMLElement | null>,
): void {
  const positions = useRef<Record<string, number>>({
    home: 0,
    history: 0,
    tools: 0,
    settings: 0,
  })
  const prevNav = useRef<AppNavKey>(activeNav)

  useEffect(() => {
    // Save position when leaving a destination
    if (prevNav.current !== activeNav) {
      positions.current[prevNav.current] = window.scrollY || 0
      prevNav.current = activeNav
    }
  }, [activeNav, scrollContainerRef])

  useEffect(() => {
    // Restore position when arriving at a destination (after render)
    requestAnimationFrame(() => {
      window.scrollTo(0, positions.current[activeNav] ?? 0)
    })
  }, [activeNav])
}
