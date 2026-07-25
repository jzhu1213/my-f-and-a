"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeadingStrong } from "@/styles/shared"
import {
  getReminderPreferences,
  setReminderPreferences,
} from "@/lib/reminderPreferences"
import type { ReminderPreferences } from "@/lib/reminderPreferences"
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleLocalReminder,
  cancelScheduledReminder,
} from "@/lib/notificationScheduler"
import type { NotificationPermissionStatus } from "@/lib/notificationScheduler"

// ============================================================================
// Time options
// ============================================================================

interface TimeOption {
  key: string
  label: string
  value: string
}

const TIME_OPTIONS: TimeOption[] = [
  { key: "evening", label: "Evening (8 PM)", value: "20:00" },
  { key: "night", label: "Night (9 PM)", value: "21:00" },
  { key: "late", label: "Late (10 PM)", value: "22:00" },
]

// ============================================================================
// DailyReminderSetting Component
// ============================================================================

/**
 * DailyReminderSetting — opt-in toggle and configuration for the daily
 * spending reminder notification.
 *
 * Features:
 * - Toggle to enable/disable (off by default)
 * - Time selection for when to send the reminder
 * - Notification permission status with request button
 * - Warm, non-pressuring copy
 *
 * Validates: Task 77 — Gentle re-engagement without nagging
 */
export function DailyReminderSetting() {
  const [prefs, setPrefs] = useState<ReminderPreferences>(getReminderPreferences)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("default")

  // Load permission status on mount
  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus())
  }, [])

  // Sync scheduler whenever prefs change
  useEffect(() => {
    if (prefs.enabled) {
      scheduleLocalReminder()
    } else {
      cancelScheduledReminder()
    }
  }, [prefs.enabled, prefs.time])

  const handleToggle = useCallback(() => {
    const updated: ReminderPreferences = {
      ...prefs,
      enabled: !prefs.enabled,
    }
    setPrefs(updated)
    setReminderPreferences(updated)

    if (!updated.enabled) {
      cancelScheduledReminder()
    }
  }, [prefs])

  const handleTimeChange = useCallback(
    (timeValue: string) => {
      const updated: ReminderPreferences = { ...prefs, time: timeValue }
      setPrefs(updated)
      setReminderPreferences(updated)
    },
    [prefs]
  )

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission()
    setPermissionStatus(result)
  }, [])

  const needsPermission = prefs.enabled && permissionStatus === "default"
  const permissionDenied = prefs.enabled && permissionStatus === "denied"

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
      <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
        Daily Reminder
      </p>
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        A gentle nudge to log today&rsquo;s spending. No pressure — turn it off anytime.
      </p>

      {/* ── Toggle ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: prefs.enabled ? 16 : 0,
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text)", fontFamily: FONT_FAMILY }}>
          Enable reminder
        </span>
        <motion.button
          type="button"
          onClick={handleToggle}
          whileTap={{ scale: 0.92 }}
          transition={springs.snappy}
          role="switch"
          aria-checked={prefs.enabled}
          aria-label={prefs.enabled ? "Disable daily reminder" : "Enable daily reminder"}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: "none",
            padding: 3,
            cursor: "pointer",
            background: prefs.enabled
              ? "rgba(74, 222, 128, 0.5)"
              : "rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: prefs.enabled ? "flex-end" : "flex-start",
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
              background: prefs.enabled ? "#fff" : "rgba(255, 255, 255, 0.5)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </motion.button>
      </div>

      {/* ── Configuration (shown only when enabled) ────────────────────── */}
      {prefs.enabled && (
        <div>
          {/* Time selection */}
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
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: 4,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              marginBottom: 14,
            }}
          >
            {TIME_OPTIONS.map((opt) => {
              const isActive = prefs.time === opt.value
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  onClick={() => handleTimeChange(opt.value)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    borderRadius: 9,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: FONT_FAMILY,
                    cursor: "pointer",
                    color: isActive ? "var(--text)" : "var(--muted)",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
                    textAlign: "center",
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

          {/* Permission status */}
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
              aria-label="Allow notifications for daily reminder"
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
                borderRadius: 8,
              }}
            >
              Notifications are blocked by your browser. The reminder will show as an in-app badge instead.
            </p>
          )}

          {permissionStatus === "granted" && (
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
        </div>
      )}
    </GlassCard>
  )
}
