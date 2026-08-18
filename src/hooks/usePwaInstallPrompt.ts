/**
 * usePwaInstallPrompt — captures the browser's install prompt and defers showing
 * the install banner until the user is engaged (3+ sessions or onboarding complete).
 *
 * Requirements: 28.7 — Service worker & PWA optimization
 * Task 477.1 — Install prompt timing
 */

"use client"

import { useEffect, useState, useCallback, useRef } from "react"

/** localStorage keys */
const SESSION_COUNT_KEY = "folio-session-count"
const INSTALL_DISMISSED_KEY = "folio-install-dismissed"
const ONBOARDING_COMPLETE_KEY = "folio-onboarding-complete"

/** Minimum sessions before showing the install prompt */
const MIN_SESSIONS = 3

export interface PwaInstallPromptState {
  /** Whether the install banner can be shown (conditions met + not dismissed) */
  canShowInstallPrompt: boolean
  /** Trigger the native install prompt */
  showInstallPrompt: () => Promise<void>
  /** Dismiss the install banner (won't show again) */
  dismissInstallPrompt: () => void
}

/**
 * Hook to manage PWA install prompt timing.
 * Shows the install banner only after the user is engaged:
 * - After 3+ sessions, OR
 * - After onboarding completes
 *
 * Respects user dismissal (persisted in localStorage).
 */
export function usePwaInstallPrompt(): PwaInstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canShow, setCanShow] = useState(false)
  const promptHandled = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // ── Track session count ──────────────────────────────────────
    const rawCount = localStorage.getItem(SESSION_COUNT_KEY)
    const currentCount = rawCount ? parseInt(rawCount, 10) + 1 : 1
    localStorage.setItem(SESSION_COUNT_KEY, String(currentCount))

    // ── Check eligibility ────────────────────────────────────────
    const wasDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true"
    if (wasDismissed) return

    const onboardingDone = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true"
    const isEngaged = currentCount >= MIN_SESSIONS || onboardingDone

    // ── Listen for beforeinstallprompt ────────────────────────────
    const handleBeforeInstall = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      if (isEngaged && !wasDismissed) {
        setCanShow(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    // Also check if app is already installed
    const handleAppInstalled = () => {
      setCanShow(false)
      setDeferredPrompt(null)
    }

    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const showInstallPrompt = useCallback(async () => {
    if (!deferredPrompt || promptHandled.current) return

    promptHandled.current = true
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setCanShow(false)
      setDeferredPrompt(null)
    } else {
      // User dismissed the native prompt — hide the banner
      promptHandled.current = false
      setCanShow(false)
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true")
    }
  }, [deferredPrompt])

  const dismissInstallPrompt = useCallback(() => {
    setCanShow(false)
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true")
  }, [])

  return {
    canShowInstallPrompt: canShow,
    showInstallPrompt,
    dismissInstallPrompt,
  }
}

// ─── Type declaration for the BeforeInstallPromptEvent ───────────────────────
// (Not yet in standard TypeScript DOM lib)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
