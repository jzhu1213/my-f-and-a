/**
 * useServiceWorker — registers the Folio service worker on mount.
 *
 * The service worker enables PWA notification support for the daily
 * spending reminder. Registration happens once on first mount and is
 * a no-op if the browser doesn't support service workers.
 *
 * Native push (Firebase Cloud Messaging) is documented as a future phase.
 * This SW currently supports local scheduled notifications fired by the
 * app's own timer while open or backgrounded as a PWA.
 *
 * Requirements: Task 77 — Gentle re-engagement without nagging
 */

"use client"

import { useEffect } from "react"

/**
 * Register the service worker. Call from the root client component.
 * Safe to call in SSR (no-ops on the server).
 */
export function useServiceWorker(): void {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "development"
    ) {
      return
    }

    // Register asynchronously — don't block rendering
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        // Non-critical — log but don't disrupt the app
        console.warn("[Folio] Service worker registration failed:", err)
      })
  }, [])
}
