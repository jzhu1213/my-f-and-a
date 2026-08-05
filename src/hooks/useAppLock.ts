/**
 * useAppLock — decides whether a cold open should be gated by the app lock.
 *
 * The lock is a device-local privacy convenience (see `lib/appLock.ts`), OFF by
 * default. This hook reads the stored preferences and the per-tab session state
 * once on mount and exposes a `locked` flag plus an `unlock` callback. Because
 * the check is synchronous localStorage/sessionStorage, the lock resolves on the
 * first client effect — the app never gets wedged behind a corrupt config since
 * the underlying helpers fall back to "unlocked".
 *
 * Requirements: Task 182.1 — Biometric/PIN lock (pairs with Group 27 security)
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getAppLockPreferences,
  isSessionUnlocked,
  markSessionUnlocked,
  shouldLockOnColdOpen,
} from "@/lib/appLock"

export interface UseAppLockResult {
  /** Whether the current cold open should be gated behind the lock screen. */
  locked: boolean
  /** True once the mount-time check has run (avoids acting on the SSR default). */
  checked: boolean
  /** Mark the session unlocked and dismiss the lock for the rest of the session. */
  unlock: () => void
}

/**
 * Gate the app behind the optional cold-open lock. Safe on SSR (returns
 * unlocked); the real check runs in a mount effect.
 */
export function useAppLock(): UseAppLockResult {
  const [locked, setLocked] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const prefs = getAppLockPreferences()
    const sessionUnlocked = isSessionUnlocked()
    setLocked(shouldLockOnColdOpen(prefs, sessionUnlocked))
    setChecked(true)
  }, [])

  const unlock = useCallback(() => {
    markSessionUnlocked()
    setLocked(false)
  }, [])

  return { locked, checked, unlock }
}
