"use client"

import { useState, useEffect, useCallback } from "react"
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
  getReminderPreferences,
  setReminderPreferences,
} from "@/lib/reminderPreferences"
import type { ReminderPreferences } from "@/lib/reminderPreferences"
import {
  getSmartNotificationPrefs,
  setSmartNotificationPrefs,
} from "@/lib/smartNotifications"
import type { SmartNotificationPreferences } from "@/lib/smartNotifications"
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleLocalReminder,
  cancelScheduledReminder,
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

const TIME_OPTIONS: ChipOption<string>[] = [
  { key: "evening", label: "8 PM", value: "20:00" },
  { key: "night", label: "9 PM", value: "21:00" },
  { key: "late", label: "10 PM", value: "22:00" },
]

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

function NudgeToggle({
  label,
  description,
  enabled,
  onToggle,
  ariaLabel,
  children,
}: {
  label: string
  description?: string
  enabled: boolean
  onToggle: () => void
  ariaLabel: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: description ? 4 : children && enabled ? 10 : 0,
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
      {description && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.4,
            marginBottom: children && enabled ? 10 : 0,
          }}
        >
          {description}
        </p>
      )}
      {enabled && children}
    </div>
  )
}

// ============================================================================
// NotificationCenter Component
// ============================================================================

/**
 * NotificationCenter — a single unified surface for all notification/nudge
 * preferences. Consolidates daily reminder, low-balance alert, bill-due
 * reminders, and weekly recap into one GlassCard.
 *
 * All toggles are opt-in (off by default). A shared notification permission
 * request appears when any nudge is enabled.
 *
 * Consolidates: Tasks 50.3, 51.x, 77, 114.2
 */
export function NotificationCenter() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [reminderPrefs, setReminderPrefsState] = useState<ReminderPreferences>(getReminderPreferences)
  const [smartPrefs, setSmartPrefsState] = useState<SmartNotificationPreferences>(getSmartNotificationPrefs)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("default")
  const [customThreshold, setCustomThreshold] = useState<string>("")
  const [showCustomInput, setShowCustomInput] = useState(false)

  // Load permission status on mount
  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus())
  }, [])

  // Detect custom threshold
  useEffect(() => {
    const isPreset = THRESHOLD_OPTIONS.some((opt) => opt.value === smartPrefs.lowAllowanceThreshold)
    if (!isPreset && smartPrefs.lowAllowanceEnabled) {
      setShowCustomInput(true)
      setCustomThreshold(String(smartPrefs.lowAllowanceThreshold))
    }
  }, [smartPrefs.lowAllowanceEnabled, smartPrefs.lowAllowanceThreshold])

  // Sync daily reminder scheduler when prefs change
  useEffect(() => {
    if (reminderPrefs.enabled) {
      scheduleLocalReminder()
    } else {
      cancelScheduledReminder()
    }
  }, [reminderPrefs.enabled, reminderPrefs.time])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const updateReminderPrefs = useCallback((updated: ReminderPreferences) => {
    setReminderPrefsState(updated)
    setReminderPreferences(updated)
  }, [])

  const updateSmartPrefs = useCallback((updated: SmartNotificationPreferences) => {
    setSmartPrefsState(updated)
    setSmartNotificationPrefs(updated)
  }, [])

  // Daily reminder
  const handleToggleReminder = useCallback(() => {
    const updated: ReminderPreferences = { ...reminderPrefs, enabled: !reminderPrefs.enabled }
    updateReminderPrefs(updated)
    if (!updated.enabled) cancelScheduledReminder()
  }, [reminderPrefs, updateReminderPrefs])

  const handleTimeChange = useCallback(
    (value: string) => {
      updateReminderPrefs({ ...reminderPrefs, time: value })
    },
    [reminderPrefs, updateReminderPrefs]
  )

  // Low balance
  const handleToggleLowBalance = useCallback(() => {
    updateSmartPrefs({ ...smartPrefs, lowAllowanceEnabled: !smartPrefs.lowAllowanceEnabled })
  }, [smartPrefs, updateSmartPrefs])

  const handleThresholdChange = useCallback(
    (value: number) => {
      setShowCustomInput(false)
      updateSmartPrefs({ ...smartPrefs, lowAllowanceThreshold: value })
    },
    [smartPrefs, updateSmartPrefs]
  )

  const handleCustomThreshold = useCallback(() => {
    setShowCustomInput(true)
  }, [])

  const handleCustomThresholdSubmit = useCallback(() => {
    const parsed = parseFloat(customThreshold)
    if (!isNaN(parsed) && parsed > 0) {
      updateSmartPrefs({ ...smartPrefs, lowAllowanceThreshold: parsed })
    }
  }, [customThreshold, smartPrefs, updateSmartPrefs])

  // Bill due
  const handleToggleBillDue = useCallback(() => {
    updateSmartPrefs({ ...smartPrefs, billDueEnabled: !smartPrefs.billDueEnabled })
  }, [smartPrefs, updateSmartPrefs])

  const handleLeadDaysChange = useCallback(
    (value: number) => {
      updateSmartPrefs({ ...smartPrefs, billDueLeadDays: value })
    },
    [smartPrefs, updateSmartPrefs]
  )

  // Weekly recap
  const handleToggleWeeklyRecap = useCallback(() => {
    updateSmartPrefs({ ...smartPrefs, weeklyRecapEnabled: !smartPrefs.weeklyRecapEnabled })
  }, [smartPrefs, updateSmartPrefs])

  // Savings contribution reminder (task 160.1)
  const handleToggleSavingsContribution = useCallback(() => {
    updateSmartPrefs({
      ...smartPrefs,
      savingsContributionEnabled: !smartPrefs.savingsContributionEnabled,
    })
  }, [smartPrefs, updateSmartPrefs])

  // Monthly balance-update reminder (task 163.1)
  const handleToggleBalanceUpdate = useCallback(() => {
    updateSmartPrefs({
      ...smartPrefs,
      balanceUpdateEnabled: !smartPrefs.balanceUpdateEnabled,
    })
  }, [smartPrefs, updateSmartPrefs])

  // Permission
  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission()
    setPermissionStatus(result)
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────────

  const anyEnabled =
    reminderPrefs.enabled ||
    smartPrefs.lowAllowanceEnabled ||
    smartPrefs.billDueEnabled ||
    smartPrefs.weeklyRecapEnabled ||
    smartPrefs.savingsContributionEnabled ||
    smartPrefs.balanceUpdateEnabled

  const needsPermission = anyEnabled && permissionStatus === "default"
  const permissionDenied = anyEnabled && permissionStatus === "denied"

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
      <p style={{ ...sectionHeader, marginBottom: 6 }}>
        Notifications
      </p>
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          marginBottom: 18,
          lineHeight: 1.5,
        }}
      >
        Gentle nudges to help you stay on track. All opt-in — turn any off anytime.
      </p>

      {/* ── 1. Daily Reminder ──────────────────────────────────────────── */}
      <NudgeToggle
        label="Daily spending reminder"
        description="A friendly end-of-day nudge to log what you spent"
        enabled={reminderPrefs.enabled}
        onToggle={handleToggleReminder}
        ariaLabel={reminderPrefs.enabled ? "Disable daily reminder" : "Enable daily reminder"}
      >
        <div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            Reminder time
          </p>
          <div style={segmentedControl}>
            {TIME_OPTIONS.map((opt) => {
              const isActive = reminderPrefs.time === opt.value
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  onClick={() => handleTimeChange(opt.value)}
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
                  aria-label={`Set reminder time to ${opt.label}`}
                >
                  {opt.label}
                </motion.button>
              )
            })}
          </div>
        </div>
      </NudgeToggle>

      {/* ── 2. Low Balance Alert ───────────────────────────────────────── */}
      <NudgeToggle
        label="Low balance alert"
        description="Heads up when your daily allowance is running low"
        enabled={smartPrefs.lowAllowanceEnabled}
        onToggle={handleToggleLowBalance}
        ariaLabel={
          smartPrefs.lowAllowanceEnabled
            ? "Disable low balance alert"
            : "Enable low balance alert"
        }
      >
        <div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            Alert when below
          </p>
          <div style={{ ...segmentedControl, marginBottom: showCustomInput ? 10 : 0 }}>
            {THRESHOLD_OPTIONS.map((opt) => {
              const isActive = !showCustomInput && smartPrefs.lowAllowanceThreshold === opt.value
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
      </NudgeToggle>

      {/* ── 3. Bill Due Reminders ──────────────────────────────────────── */}
      <NudgeToggle
        label="Bill due reminders"
        description="Get a heads-up before your recurring bills are due"
        enabled={smartPrefs.billDueEnabled}
        onToggle={handleToggleBillDue}
        ariaLabel={
          smartPrefs.billDueEnabled
            ? "Disable bill due reminders"
            : "Enable bill due reminders"
        }
      >
        <div>
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
              const isActive = smartPrefs.billDueLeadDays === opt.value
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
      </NudgeToggle>

      {/* ── 4. Weekly Recap ────────────────────────────────────────────── */}
      <NudgeToggle
        label="Weekly spending recap"
        description="A short summary of your week every Sunday evening"
        enabled={smartPrefs.weeklyRecapEnabled}
        onToggle={handleToggleWeeklyRecap}
        ariaLabel={
          smartPrefs.weeklyRecapEnabled
            ? "Disable weekly recap"
            : "Enable weekly recap"
        }
      />

      {/* ── 5. Savings Contribution Reminder (task 160.1) ──────────────── */}
      <NudgeToggle
        label="Payday savings reminder"
        description="On payday, a gentle nudge to fund your savings goals if there's still room this month"
        enabled={smartPrefs.savingsContributionEnabled}
        onToggle={handleToggleSavingsContribution}
        ariaLabel={
          smartPrefs.savingsContributionEnabled
            ? "Disable payday savings reminder"
            : "Enable payday savings reminder"
        }
      />

      {/* ── 6. Monthly Balance Check-in (task 163.1) ───────────────────── */}
      <NudgeToggle
        label="Monthly balance check-in"
        description="Once a month, a gentle nudge to update your savings balances so your growth over time stays accurate"
        enabled={smartPrefs.balanceUpdateEnabled}
        onToggle={handleToggleBalanceUpdate}
        ariaLabel={
          smartPrefs.balanceUpdateEnabled
            ? "Disable monthly balance check-in"
            : "Enable monthly balance check-in"
        }
      />

      {/* ── Shared Permission Status ──────────────────────────────────── */}
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
            marginTop: 4,
          }}
          aria-label="Allow notifications"
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
            marginTop: 4,
          }}
        >
          Notifications are blocked by your browser. Enable them in browser settings to receive nudges.
        </p>
      )}

      {anyEnabled && permissionStatus === "granted" && (
        <p
          style={{
            fontSize: 12,
            color: "var(--success)",
            opacity: 0.8,
            marginTop: 4,
          }}
        >
          ✓ Notifications enabled
        </p>
      )}
    </GlassCard>
  )
}
