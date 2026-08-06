"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  sectionHeader,
  borderRadius,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import {
  getAppLockPreferences,
  setAppLockPreferences,
  clearAppLock,
  clearSessionUnlock,
  isValidPin,
  buildPinCredential,
  isBiometricAvailable,
  registerBiometric,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
  type AppLockMethod,
  type AppLockPreferences,
} from "@/lib/appLock"

// ============================================================================
// AppLockSetting
// ============================================================================

/**
 * AppLockSetting — opt-in control for the cold-open app lock (task 182.1).
 *
 * Lives behind Settings → Privacy & security (progressive disclosure) and is
 * OFF by default. Enabling walks the user through setting up either a device
 * biometric (WebAuthn platform authenticator) or a numeric PIN. Nothing leaves
 * the device: the PIN is only ever stored as a salted PBKDF2 hash, and the
 * biometric stores just a credential id.
 */
export function AppLockSetting() {
  const [prefs, setPrefs] = useState<AppLockPreferences>(() => getAppLockPreferences())
  const [biometricSupported, setBiometricSupported] = useState(false)

  // ── Setup form state (only while configuring a fresh method) ────────────────
  const [configuring, setConfiguring] = useState<AppLockMethod | null>(null)
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Hydrate from storage + probe biometric availability on mount (SSR-safe).
  useEffect(() => {
    setPrefs(getAppLockPreferences())
    void isBiometricAvailable().then(setBiometricSupported)
  }, [])

  const persist = useCallback((next: AppLockPreferences) => {
    setPrefs(next)
    setAppLockPreferences(next)
  }, [])

  const resetForm = useCallback(() => {
    setConfiguring(null)
    setPin("")
    setConfirmPin("")
    setError(null)
    setBusy(false)
  }, [])

  // ── Disable the lock entirely ───────────────────────────────────────────────
  const handleDisable = useCallback(() => {
    clearAppLock()
    setPrefs(getAppLockPreferences())
    resetForm()
  }, [resetForm])

  // ── Save a PIN ───────────────────────────────────────────────────────────────
  const handleSavePin = useCallback(async () => {
    if (busy) return
    if (!isValidPin(pin)) {
      setError(`PIN must be ${MIN_PIN_LENGTH}–${MAX_PIN_LENGTH} digits`)
      return
    }
    if (pin !== confirmPin) {
      setError("PINs don't match")
      return
    }
    setBusy(true)
    try {
      const { pinHash, pinSalt } = await buildPinCredential(pin)
      persist({
        enabled: true,
        method: "pin",
        pinHash,
        pinSalt,
        credentialId: null,
      })
      // A fresh lock should engage on the next cold open.
      clearSessionUnlock()
      resetForm()
    } catch {
      setError("Couldn't save your PIN — please try again")
      setBusy(false)
    }
  }, [busy, pin, confirmPin, persist, resetForm])

  // ── Enroll biometrics ─────────────────────────────────────────────────────────
  const handleEnrollBiometric = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const credentialId = await registerBiometric("Folio")
    if (!credentialId) {
      setError("Biometric setup was cancelled or isn't available")
      setBusy(false)
      return
    }
    persist({
      enabled: true,
      method: "biometric",
      pinHash: null,
      pinSalt: null,
      credentialId,
    })
    clearSessionUnlock()
    resetForm()
  }, [busy, persist, resetForm])

  const isEnabled = prefs.enabled
  const activeMethodLabel = prefs.method === "biometric" ? "Device biometrics" : "PIN"

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
      <p style={{ ...sectionHeader }}>App lock</p>

      <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 16 }}>
        Ask for a PIN or your device biometrics when Folio reopens. It stays on your
        device — your account sign-in doesn&rsquo;t change.
      </p>

      {/* ── Enabled state summary ─────────────────────────────────────────────── */}
      {isEnabled && !configuring && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderRadius: borderRadius.md,
            background: "rgba(167, 139, 250, 0.1)",
            border: "1px solid rgba(167, 139, 250, 0.25)",
          }}
        >
          <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
            On · {activeMethodLabel}
          </span>
          <button
            type="button"
            onClick={handleDisable}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--sub)",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
            }}
            aria-label="Turn off app lock"
          >
            Turn off
          </button>
        </div>
      )}

      {/* ── Method chooser (when off and not yet configuring) ─────────────────── */}
      {!isEnabled && !configuring && (
        <div style={segmentedControl}>
          <motion.button
            type="button"
            onClick={() => {
              resetForm()
              setConfiguring("pin")
            }}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{ ...segmentedButtonBase, ...segmentedButtonInactive }}
            aria-label="Set up a PIN lock"
          >
            Set up a PIN
          </motion.button>
          <motion.button
            type="button"
            onClick={() => {
              resetForm()
              setConfiguring("biometric")
            }}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            disabled={!biometricSupported}
            style={{
              ...segmentedButtonBase,
              ...segmentedButtonInactive,
              opacity: biometricSupported ? 1 : 0.5,
              cursor: biometricSupported ? "pointer" : "not-allowed",
            }}
            aria-label="Use device biometrics"
          >
            {biometricSupported ? "Use biometrics" : "Biometrics N/A"}
          </motion.button>
        </div>
      )}

      {/* ── PIN setup form ─────────────────────────────────────────────────────── */}
      {configuring === "pin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Choose a PIN"
            placeholder={`Choose a ${MIN_PIN_LENGTH}–${MAX_PIN_LENGTH} digit PIN`}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_PIN_LENGTH))
              setError(null)
            }}
            style={pinInputStyle}
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Confirm your PIN"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_PIN_LENGTH))
              setError(null)
            }}
            style={pinInputStyle}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={resetForm} style={secondaryButtonStyle} aria-label="Cancel PIN setup">
              Cancel
            </button>
            <motion.button
              type="button"
              onClick={() => void handleSavePin()}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
              disabled={busy}
              style={primaryButtonStyle(busy)}
              aria-label="Save PIN"
            >
              {busy ? "Saving…" : "Save PIN"}
            </motion.button>
          </div>
        </div>
      )}

      {/* ── Biometric setup ────────────────────────────────────────────────────── */}
      {configuring === "biometric" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
            You&rsquo;ll be asked to confirm with Face ID, Touch ID, or your device&rsquo;s
            unlock. Folio only stores a reference — never your biometric data.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={resetForm} style={secondaryButtonStyle} aria-label="Cancel biometric setup">
              Cancel
            </button>
            <motion.button
              type="button"
              onClick={() => void handleEnrollBiometric()}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
              disabled={busy}
              style={primaryButtonStyle(busy)}
              aria-label="Enable biometric lock"
            >
              {busy ? "Waiting for device…" : "Enable"}
            </motion.button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 13, color: "var(--danger, #f87171)", marginTop: 12 }}>
          {error}
        </p>
      )}
    </GlassCard>
  )
}

// ============================================================================
// Local style helpers
// ============================================================================

const pinInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 16,
  color: "var(--text)",
  fontFamily: FONT_FAMILY,
  fontVariantNumeric: "tabular-nums",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: borderRadius.md,
  padding: "12px 14px",
  outline: "none",
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 0",
  borderRadius: borderRadius.sm,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--sub)",
  fontSize: 14,
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
}

function primaryButtonStyle(busy: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 0",
    borderRadius: borderRadius.sm,
    border: "none",
    background: busy ? "rgba(167, 139, 250, 0.3)" : "rgba(167, 139, 250, 0.9)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT_FAMILY,
    cursor: busy ? "not-allowed" : "pointer",
  }
}
