/**
 * useDepthSurfaceTimeout — Monitors depth surface loading and triggers
 * a timeout error state if the surface takes too long to become interactive.
 *
 * Starts a 5-second timer when the hook mounts (i.e., when a depth surface
 * begins loading). If the surface component renders and calls `markReady()`
 * before the timeout, the timer is cleared. Otherwise, the hook returns
 * `timedOut: true` so the parent can show an error + retry.
 *
 * The Home surface remains interactive because depth surfaces render in an
 * overlay — Home stays mounted underneath.
 *
 * Requirements: 17.6, 17.7, 17.11
 */

import { useState, useEffect, useCallback, useRef } from "react"

/** Depth surface timeout in milliseconds. */
const DEPTH_TIMEOUT_MS = 5_000

export interface UseDepthSurfaceTimeoutOptions {
  /** Whether the depth surface is currently open/loading. */
  active: boolean
}

export interface UseDepthSurfaceTimeoutResult {
  /** True if the timeout has elapsed without the surface becoming ready. */
  timedOut: boolean
  /** Call this from the depth surface component to signal it has rendered. */
  markReady: () => void
  /** Retry handler: resets timeout state so the surface can attempt to load again. */
  retry: () => void
}

export function useDepthSurfaceTimeout({
  active,
}: UseDepthSurfaceTimeoutOptions): UseDepthSurfaceTimeoutResult {
  const [timedOut, setTimedOut] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const readyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const markReady = useCallback(() => {
    readyRef.current = true
    clearTimer()
    setTimedOut(false)
  }, [clearTimer])

  const retry = useCallback(() => {
    readyRef.current = false
    setTimedOut(false)
    setRetryCount((c) => c + 1)
  }, [])

  useEffect(() => {
    if (!active) {
      // Clean up when depth surface closes
      clearTimer()
      readyRef.current = false
      setTimedOut(false)
      return
    }

    // If already ready (component loaded fast), no timer needed
    if (readyRef.current) return

    // Start the timeout
    timerRef.current = setTimeout(() => {
      if (!readyRef.current) {
        setTimedOut(true)
      }
    }, DEPTH_TIMEOUT_MS)

    return clearTimer
  }, [active, retryCount, clearTimer])

  return { timedOut, markReady, retry }
}
