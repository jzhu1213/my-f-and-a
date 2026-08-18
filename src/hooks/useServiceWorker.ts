/**
 * useServiceWorker — registers the Folio service worker, detects updates,
 * and exposes state for the update prompt UI.
 *
 * The service worker enables:
 * - PWA notification support for the daily spending reminder
 * - Offline-first caching with distinct strategies per resource type
 * - Graceful update detection with user-controlled activation
 *
 * Requirements: 28.7 — Service worker & PWA optimization
 * Task 476.3 — Cache versioning and cleanup (update detection + prompt)
 */

"use client"

import { useEffect, useState, useCallback } from "react"

export interface ServiceWorkerState {
  /** Whether a new service worker is waiting to activate */
  updateAvailable: boolean
  /** Call this to activate the waiting SW and reload */
  applyUpdate: () => void
}

/**
 * Register the service worker and detect updates.
 * Returns state for the update prompt UI.
 * Safe to call in SSR (returns inert state on the server).
 */
export function useServiceWorker(): ServiceWorkerState {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "development"
    ) {
      return
    }

    let registration: ServiceWorkerRegistration | null = null

    const handleStateChange = (sw: ServiceWorker) => {
      if (sw.state === "installed") {
        // A new SW is installed and waiting — show the update prompt
        setWaitingWorker(sw)
        setUpdateAvailable(true)
      }
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg

        // If there's already a waiting worker (page was refreshed while update pending)
        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
          setUpdateAvailable(true)
          return
        }

        // Listen for new installing workers
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            handleStateChange(newWorker)
          })
        })
      })
      .catch((err) => {
        // Non-critical — log but don't disrupt the app
        console.warn("[Folio] Service worker registration failed:", err)
      })

    // Listen for the controlling SW changing (after skipWaiting + claim)
    let refreshing = false
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return

    // Tell the waiting SW to skip waiting and take over
    waitingWorker.postMessage({ type: "SKIP_WAITING" })
    setUpdateAvailable(false)
  }, [waitingWorker])

  return { updateAvailable, applyUpdate }
}
