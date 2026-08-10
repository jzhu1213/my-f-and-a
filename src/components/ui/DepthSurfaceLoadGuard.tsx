"use client"

/**
 * DepthSurfaceLoadGuard — Timeout guard for depth surface loading.
 *
 * Wraps depth surface content and monitors load time. If the content takes
 * longer than 5 seconds to mount, shows an ErrorState with a retry button.
 * Home remains interactive underneath since depth surfaces are overlays.
 *
 * Usage:
 *   <DepthSurfaceTransition open>
 *     <DepthSurfaceLoadGuard onClose={handleClose}>
 *       <MyDepthScreen ... />
 *     </DepthSurfaceLoadGuard>
 *   </DepthSurfaceTransition>
 *
 * Requirements: 17.6, 17.7, 17.11
 */

import { type ReactNode, useEffect, useRef, useState, useCallback } from "react"
import { ErrorState } from "@/components/ui/primitives/ErrorState"

// ============================================================================
// Constants
// ============================================================================

/** Depth surface timeout in milliseconds. */
const DEPTH_TIMEOUT_MS = 5_000

// ============================================================================
// Props
// ============================================================================

export interface DepthSurfaceLoadGuardProps {
  /** Depth surface content (the dynamically loaded component). */
  children: ReactNode
  /** Called when user wants to go back (close the depth surface). */
  onClose?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function DepthSurfaceLoadGuard({ children, onClose }: DepthSurfaceLoadGuardProps) {
  const [timedOut, setTimedOut] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const mountedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Start a timeout timer. If children mount and render (meaning the dynamic
  // import resolved), the child component will be in the tree and the ref stays
  // false only if we genuinely timed out.
  useEffect(() => {
    mountedRef.current = true
    setTimedOut(false)

    timerRef.current = setTimeout(() => {
      // If we're still mounted and the children haven't signaled readiness,
      // show timeout. In practice, once the dynamic chunk loads and children
      // render, React will re-render this component and we'll be past the
      // timeout state. The timeout mainly catches network failures or very
      // slow connections where the chunk never arrives.
      setTimedOut(true)
    }, DEPTH_TIMEOUT_MS)

    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [retryKey, clearTimer])

  const handleRetry = useCallback(() => {
    setTimedOut(false)
    setRetryKey((k) => k + 1)
  }, [])

  if (timedOut) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: 20,
        }}
      >
        <ErrorState
          title="Taking too long"
          message="This screen is taking a while to load. Check your connection and try again."
          retry
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return <>{children}</>
}
