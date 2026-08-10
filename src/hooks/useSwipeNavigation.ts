"use client"

/**
 * useSwipeNavigation — Horizontal swipe between adjacent primary destinations.
 *
 * Wraps the generic `useGesture` hook specifically for inter-destination
 * navigation via horizontal swipe. Direction is derived from dock order:
 *   - Swipe left (forward) = trailing edge = next destination
 *   - Swipe right (backward) = leading edge = previous destination
 *
 * Dock order: home(0) → history(1) → tools(2) → settings(3)
 *
 * Validates: Requirements 10.8, 10.10, 8.4, 8.6
 */

import { useCallback } from 'react'
import { useGesture, type GestureState } from '@/hooks/useGesture'
import type { AppNavKey } from '@/components/ui/AppShell'

/** Dock order defines adjacency for swipe navigation. */
const DOCK_ORDER: AppNavKey[] = ['home', 'history', 'tools', 'settings']

export interface UseSwipeNavigationOptions {
  /** Currently active navigation destination. */
  activeNav: AppNavKey
  /** Called when a swipe commits to a new destination. */
  onNavChange: (nav: AppNavKey) => void
  /** Enable/disable swipe navigation. Default: true */
  enabled?: boolean
}

export interface UseSwipeNavigationReturn {
  /** Ref to attach to the swipeable content container. */
  gestureRef: React.RefObject<HTMLElement | null>
  /** Current gesture state (for driving visual feedback). */
  state: GestureState
}

/**
 * Hook for horizontal swipe navigation between primary destinations.
 *
 * Attach the returned `gestureRef` to the scrollable/swipeable content area.
 * Swipe gestures that commit will trigger `onNavChange` with the adjacent
 * destination in dock order.
 */
export function useSwipeNavigation({
  activeNav,
  onNavChange,
  enabled = true,
}: UseSwipeNavigationOptions): UseSwipeNavigationReturn {
  const handleCommit = useCallback(
    (gestureState: GestureState) => {
      const currentIndex = DOCK_ORDER.indexOf(activeNav)
      if (currentIndex === -1) return

      if (gestureState.direction === 'left' && currentIndex < DOCK_ORDER.length - 1) {
        // Swipe left = forward (trailing edge) = next destination
        onNavChange(DOCK_ORDER[currentIndex + 1])
      } else if (gestureState.direction === 'right' && currentIndex > 0) {
        // Swipe right = backward (leading edge) = previous destination
        onNavChange(DOCK_ORDER[currentIndex - 1])
      }
    },
    [activeNav, onNavChange],
  )

  const { gestureRef, state } = useGesture({
    enabled,
    horizontalSwipe: {
      threshold: 10,
      maxAngle: 30,
      commitDistanceFraction: 0.3,
      commitVelocity: 400,
      settleMs: 400,
    },
    onCommit: handleCommit,
  })

  return { gestureRef, state }
}
