"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  sectionHeadingStrong,
  borderRadius,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import {
  getSmartNotificationPrefs,
  setSmartNotificationPrefs,
} from "@/lib/smartNotifications"
import type { SmartNotificationPreferences } from "@/lib/smartNotifications"
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from "@/lib/notificationScheduler"
import type { NotificationPermissionStatus } from "@/lib/notificationScheduler"

// ============================================================================
// Option configs
// ============================================================================

interface ChipOption<T> {
  key: string
  label: string
  value: T
}

const THRESHOLD_OPTIONS: ChipOption<number>[] = [
  { key: "$5", label: "$5", value: 5 },
  { key: "$10", label: "$10", value: 10 },
  { key: "$20", label: "$20", value: 20 },
]

const LEAD_DAY_OPTIONS: ChipOption<number>[] = [
  { key: "same", label: "Same day", value: 0 },
  { key: "1day", label: "1 day before", value: 1 },
  { key: "2days", label: "2 days before", value: 2 },
]

// ============================================================================
// Toggle sub-component
// ============================================================================

function SettingToggle({
  label,
  enabled,
  onToggle,
  ariaLabel,
}: {
  label: string
  enabled: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 14, color: "var(--text)", fontFamily: FONT_FAMILY }}>
        {label}
      </span>
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.92 }}
        transition={springs.snappy}
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          border: "none",
          padding: 3,
          cursor: "pointer",
          background: enabled
            ? "rgba(74, 222, 128, 0.5)"
            : "rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: enabled ? "flex-end" : "flex-start",
          transition: "background 0.2s ease",
        }}
      >
        <motion.div
          layout
          transition={springs.snappy}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            background: enabled ? "#fff" : "rgba(255, 255, 255, 0.5)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </motion.button>
    </div>
  )
}

// ============================================================================
// SmartNotificationSettings Component
// ============================================================================

/**
 * SmartNotificationSettings — opt-in toggles for low-balance and bill-due alerts.
 *
 * Both toggles are OFF by default. Uses the same GlassCard / segmented control
 * pattern as DailyReminderSetting.
 *
 * Requirements: Task 114.2 — Glanceable widgets and notifications
 */
export function SmartNotificationSettings() {
  const [prefs, setPrefs] = useState<SmartNotificationPreferences>(getSmartNotificationPrefs)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("default")
  const [customThreshold, setCustomThreshold] = useState<string>("")
  const [showCustomInput, setShowCustomInput] = useState(false)

  // Load permission status on mount
  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus())
  }, [])

  // Detect if current threshold is a custom value
  useEffect(() => {
    const isPreset = THRESHOLD_OPTIONS.some((opt) => opt.value === prefs.lowAllowanceThreshold)
    if (!isPreset && prefs.lowAllowanceEnabled) {
      setShowCustomInput(true)
      setCustomThreshold(String(prefs.lowAllowanceThreshold))
    }
  }, [prefs.lowAllowanceEnabled, prefs.lowAllowanceThreshold])

  const updatePrefs = useCallback((updated: SmartNotificationPreferences) => {
    setPrefs(updated)
    setSmartNotificationPrefs(updated)
  }, [])

  const handleToggleLowAllowance = useCallback(() => {
    updatePrefs({ ...prefs, lowAllowanceEnabled: !prefs.lowAllowanceEnabled })
  }, [prefs, updatePrefs])

  const handleToggleBillDue = useCallback(() => {
    updatePrefs({ ...prefs, billDueEnabled: !prefs.billDueEnabled })
  }, [prefs, updatePrefs])

  const handleThresholdChange = useCallback(
    (value: number) => {
      setShowCustomInput(false)
      updatePrefs({ ...prefs, lowAllowanceThreshold: value })
    },
    [prefs, updatePrefs]
  )

  const handleCustomThreshold = useCallback(() => {
    setShowCustomInput(true)
  }, [])

  const handleCustomThresholdSubmit = useCallback(() => {
    const parsed = parseFloat(customThreshold)
    if (!isNaN(parsed) && parsed > 0) {
      updatePrefs({ ...prefs, lowAllowanceThreshold: parsed })
    }
  }, [customThreshold, prefs, updatePrefs])

  const handleLeadDaysChange = useCallback(
    (value: number) => {
      updatePrefs({ ...prefs, billDueLeadDays: value })
    },
    [prefs, updatePrefs]
  )

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission()
    setPermissionStatus(result)
  }, [])

  const anyEnabled = prefs.lowAllowanceEnabled || prefs.billDueEnabled
  const needsPermission = anyEnabled && permissionStatus === "default"
  const permissionDenied = anyEnabled && permissionStatus === "denied"

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
      <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
        Smart Alerts
      </p>
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        Helpful heads-ups about your daily allowance and upcoming bills. Always opt-in.
      </p>

      {/* ── Low balance alert ─────────────────────────────────────────── */}
      <SettingToggle
        label="Low daily allowance alert"
        enabled={prefs.lowAllowanceEnabled}
        onToggle={handleToggleLowAllowance}
        ariaLabel={
          prefs.lowAllowanceEnabled
            ? "Disable low daily allowance alert"
            : "Enable low daily allowance alert"
        }
      />

      {prefs.lowAllowanceEnabled && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            Alert when daily allowance drops below
          </p>
          <div style={{ ...segmentedControl, marginBottom: showCustomInput ? 10 : 0 }}>
            {THRESHOLD_OPTIONS.map((opt) => {
              const isActive = !showCustomInput && prefs.lowAllowanceThreshold === opt.value
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  onClick={() => handleThresholdChange(opt.value)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    ...segmentedButtonBase,
                    ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                    padding: "9px 6px",
                    fontSize: 12,
                    lineHeight: 1.3,
                  }}
                  aria-pressed={isActive}
                  aria-label={`Set threshold to ${opt.label}`}
                >
                  {opt.label}
                </motion.button>
              )
            })}
            <motion.button
              type="button"
              onClick={handleCustomThreshold}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={{
                ...segmentedButtonBase,
                ...(showCustomInput ? segmentedButtonActive : segmentedButtonInactive),
                padding: "9px 6px",
                fontSize: 12,
                lineHeight: 1.3,
              }}
              aria-pressed={showCustomInput}
              aria-label="Set custom threshold"
            >
              Custom
            </motion.button>
          </div>

          {showCustomInput && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "var(--text)", fontFamily: FONT_FAMILY }}>$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                onBlur={handleCustomThresholdSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomThresholdSubmit()
                }}
                aria-label="Custom threshold amount"
                style={{
                  width: 80,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text)",
                  fontSize: 14,
                  fontFamily: FONT_FAMILY,
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Bill due reminders ────────────────────────────────────────── */}
      <SettingToggle
        label="Bill due reminders"
        enabled={prefs.billDueEnabled}
        onToggle={handleToggleBillDue}
        ariaLabel={
          prefs.billDueEnabled
            ? "Disable bill due reminders"
            : "Enable bill due reminders"
        }
      />

      {prefs.billDueEnabled && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            Remind me
          </p>
          <div style={segmentedControl}>
            {LEAD_DAY_OPTIONS.map((opt) => {
              const isActive = prefs.billDueLeadDays === opt.value
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  onClick={() => handleLeadDaysChange(opt.value)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    ...segmentedButtonBase,
                    ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                    padding: "9px 6px",
                    fontSize: 12,
                    lineHeight: 1.3,
                  }}
                  aria-pressed={isActive}
                  aria-label={`Set reminder to ${opt.label}`}
                >
                  {opt.label}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Permission status ─────────────────────────────────────────── */}
      {needsPermission && (
        <motion.button
          type="button"
          onClick={handleRequestPermission}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(167, 139, 250, 0.3)",
            background: "rgba(167, 139, 250, 0.08)",
            color: "var(--accent, #a78bfa)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            cursor: "pointer",
            textAlign: "center",
          }}
          aria-label="Allow notifications for smart alerts"
        >
          Allow notifications
        </motion.button>
      )}

      {permissionDenied && (
        <p
          style={{
            fontSize: 12,
            color: "var(--sub)",
            lineHeight: 1.5,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: borderRadius.sm,
          }}
        >
          Notifications are blocked by your browser. Enable them in browser settings to receive smart alerts.
        </p>
      )}

      {anyEnabled && permissionStatus === "granted" && (
        <p
          style={{
            fontSize: 12,
            color: "var(--success)",
            opacity: 0.8,
          }}
        >
          ✓ Notifications enabled
        </p>
      )}
    </GlassCard>
  )
}
