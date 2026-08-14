"use client"
import { useRef, useState, useEffect, useCallback } from 'react'

// ── Scroll position persistence (per-interaction within history) ──
const SCROLL_POSITION_KEY = 'folio-history-detail-scroll'

/**
 * Save window scroll position before navigating to transaction detail/editor.
 */
export function saveHistoryScrollPosition(): void {
  try {
    sessionStorage.setItem(SCROLL_POSITION_KEY, String(Math.round(window.scrollY)))
  } catch {
    // Silently fail
  }
}

/**
 * Restore window scroll position after returning from transaction detail/editor.
 * Returns the stored value and clears it.
 */
export function restoreHistoryScrollPosition(): void {
  try {
    const stored = sessionStorage.getItem(SCROLL_POSITION_KEY)
    if (stored) {
      const position = Number(stored)
      sessionStorage.removeItem(SCROLL_POSITION_KEY)
      // Use double-rAF for post-render timing
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, position)
        })
      })
    }
  } catch {
    // Silently fail
  }
}

/**
 * Clear stored scroll position (e.g., on view mode switch).
 */
export function clearHistoryScrollPosition(): void {
  try {
    sessionStorage.removeItem(SCROLL_POSITION_KEY)
  } catch {
    // Silently fail
  }
}

// ── Fast scroll detection hook (window-based) ────────────────────
const FAST_SCROLL_THRESHOLD = 2500 // px/s — velocity threshold for skeleton

interface UseWindowScrollTrackingResult {
  /** Whether user is scrolling fast (for skeleton display) */
  isScrollingFast: boolean
}

/**
 * Tracks window scroll velocity to detect fast scrolling.
 * When velocity exceeds threshold, date groups not yet painted
 * will show skeleton placeholders briefly.
 */
export function useWindowScrollTracking(): UseWindowScrollTrackingResult {
  const lastScrollTop = useRef(0)
  const lastTime = useRef(Date.now())
  const [isScrollingFast, setIsScrollingFast] = useState(false)
  const fastScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now()
      const currentTop = window.scrollY
      const dt = now - lastTime.current

      if (dt > 16) {
        const velocity = Math.abs(currentTop - lastScrollTop.current) / dt * 1000

        if (velocity > FAST_SCROLL_THRESHOLD) {
          setIsScrollingFast(true)
        }

        // Clear fast-scroll state after scrolling slows
        if (fastScrollTimer.current) clearTimeout(fastScrollTimer.current)
        fastScrollTimer.current = setTimeout(() => {
          setIsScrollingFast(false)
        }, 150)

        lastScrollTop.current = currentTop
        lastTime.current = now
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (fastScrollTimer.current) clearTimeout(fastScrollTimer.current)
    }
  }, [])

  return { isScrollingFast }
}
