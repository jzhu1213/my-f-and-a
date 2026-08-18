"use client"

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react"

// ============================================================================
// ScreenReaderAnnouncer — centralised live region for programmatic
// screen reader announcements.
//
// Components push messages via `announce(msg)` and this renders a visually-
// hidden aria-live region that screen readers pick up without interrupting
// the current reading flow (polite mode).
//
// Use for confirmations that don't have a dedicated visual live region:
//   • Transaction logged successfully
//   • Allowance recalculated
//   • Sync status changes
//
// Requirements: 27.1 (Task 449.1)
// ============================================================================

interface AnnouncerContextType {
  /** Push a message to the screen reader live region (polite — non-interrupting). */
  announce: (message: string) => void
}

const AnnouncerContext = createContext<AnnouncerContextType | undefined>(undefined)

/**
 * Provider that renders a visually-hidden live region and exposes `announce()`.
 * Place once near the root of the app (e.g., in layout or AppShell).
 */
export function ScreenReaderAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("")
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const announce = useCallback((msg: string) => {
    // Clear previous message first so screen readers detect the change
    // even if the new message is identical to the previous one.
    setMessage("")
    if (clearTimer.current) clearTimeout(clearTimer.current)

    // Use a microtask delay so the empty → new transition is two distinct renders
    requestAnimationFrame(() => {
      setMessage(msg)
      // Auto-clear after 5s to prevent stale announcements lingering in the DOM
      clearTimer.current = setTimeout(() => setMessage(""), 5000)
    })
  }, [])

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Visually-hidden live region — picked up by screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  )
}

/**
 * Hook to access the screen reader announcer.
 * Returns `{ announce }` — call `announce("message")` to push to the live region.
 */
export function useScreenReaderAnnouncer(): AnnouncerContextType {
  const context = useContext(AnnouncerContext)
  if (!context) {
    // Graceful fallback: if used outside provider, announce is a no-op.
    // This avoids crashes in isolated component tests.
    return { announce: () => {} }
  }
  return context
}
