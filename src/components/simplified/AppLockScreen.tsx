"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { springs } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"
import {
  getAppLockPreferences,
  verifyPin,
  verifyBiometric,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
} from "@/lib/appLock"

// ============================================================================
// AppLockScreen
// ============================================================================

/**
 * AppLockScreen — full-screen, device-local unlock gate shown on a cold open
 * when the optional app lock is enabled (task 182.1).
 *
 * This is a privacy convenience, not account security — Supabase auth still
 * owns the session. The screen supports whichever method the user configured:
 *
 *   • biometric — challenges the enrolled platform authenticator (Face ID /
 *     Touch ID / Windows Hello) via WebAuthn, auto-prompting on mount.
 *   • pin — a warm numeric entry verified against the salted PBKDF2 hash.
 *
 * Warm, shame-free copy; respects `prefers-reduced-motion`; fully keyboard
 * accessible with labelled controls.
 */
export function AppLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const reduceMotion = useReducedMotion()
  const prefs = getAppLockPreferences()
  const method = prefs.method

  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Biometric unlock ──────────────────────────────────────────────────────
  const runBiometric = useCallback(async () => {
    if (!prefs.credentialId) return
    setBusy(true)
    setError(null)
    const ok = await verifyBiometric(prefs.credentialId)
    setBusy(false)
    if (ok) {
      onUnlock()
    } else {
      setError("Couldn't verify — try again")
    }
  }, [prefs.credentialId, onUnlock])

  // Auto-prompt biometrics on mount so a cold open feels instant.
  useEffect(() => {
    if (method === "biometric" && prefs.credentialId) {
      void runBiometric()
    } else if (method === "pin") {
      // Focus the PIN field for immediate keyboard entry.
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── PIN unlock ──────────────────────────────────────────────────────────────
  const submitPin = useCallback(async () => {
    if (busy) return
    if (!prefs.pinHash || !prefs.pinSalt) return
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN is at least ${MIN_PIN_LENGTH} digits`)
      return
    }
    setBusy(true)
    setError(null)
    const ok = await verifyPin(pin, prefs.pinSalt, prefs.pinHash)
    setBusy(false)
    if (ok) {
      onUnlock()
    } else {
      setError("That PIN didn't match — try again")
      setPin("")
      inputRef.current?.focus()
    }
  }, [busy, pin, prefs.pinHash, prefs.pinSalt, onUnlock])

  const handlePinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Numeric only, capped at the max PIN length.
    const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_PIN_LENGTH)
    setPin(digits)
    setError(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        void submitPin()
      }
    },
    [submitPin]
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: FONT_FAMILY,
      }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Lock glyph */}
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(167, 139, 250, 0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
          }}
        >
          🔒
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            Folio is locked
          </h1>
          <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5 }}>
            {method === "biometric"
              ? "Unlock with your device to pick up where you left off."
              : "Enter your PIN to pick up where you left off."}
          </p>
        </div>

        {method === "pin" && (
          <>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Enter your PIN"
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handleKeyDown}
              placeholder="••••"
              disabled={busy}
              style={{
                width: "100%",
                textAlign: "center",
                letterSpacing: "0.5em",
                fontSize: 26,
                fontWeight: 600,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: borderRadius.md,
                padding: "14px 16px",
                outline: "none",
              }}
            />
            <motion.button
              type="button"
              onClick={() => void submitPin()}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={springs.snappy}
              disabled={busy || pin.length < MIN_PIN_LENGTH}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: borderRadius.sm,
                border: "none",
                background:
                  busy || pin.length < MIN_PIN_LENGTH
                    ? "rgba(167, 139, 250, 0.3)"
                    : "rgba(167, 139, 250, 0.9)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                cursor: busy || pin.length < MIN_PIN_LENGTH ? "not-allowed" : "pointer",
              }}
              aria-label="Unlock with PIN"
            >
              {busy ? "Checking…" : "Unlock"}
            </motion.button>
          </>
        )}

        {method === "biometric" && (
          <motion.button
            type="button"
            onClick={() => void runBiometric()}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={springs.snappy}
            disabled={busy}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: borderRadius.sm,
              border: "none",
              background: busy ? "rgba(167, 139, 250, 0.3)" : "rgba(167, 139, 250, 0.9)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: FONT_FAMILY,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            aria-label="Unlock with biometrics"
          >
            {busy ? "Waiting for device…" : "Unlock with biometrics"}
          </motion.button>
        )}

        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--danger, #f87171)", textAlign: "center" }}>
            {error}
          </p>
        )}
      </motion.div>
    </div>
  )
}
