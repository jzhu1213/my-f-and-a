"use client"

import { useEffect, useRef } from "react"
import type { DailyAllowance } from "@/types/folio"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { getNotificationPermissionStatus } from "@/lib/notificationScheduler"
import {
  getSmartNotificationPrefs,
  checkLowAllowanceNotification,
  checkBillDueNotifications,
  fireSmartNotification,
  markNotificationFired,
} from "@/lib/smartNotifications"

/** Check interval for bill-due notifications: once per hour */
const BILL_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * useSmartNotifications — checks and fires proactive financial notifications.
 *
 * - On each allowance update: checks if low-allowance notification should fire
 * - On mount + hourly interval: checks if any bill-due notifications should fire
 * - Respects notification permission and opt-in preferences
 *
 * Requirements: Task 114.2 — Glanceable widgets and notifications
 */
export function useSmartNotifications(
  allowance: DailyAllowance | null,
  fixedExpenses: FixedExpense[]
) {
  const lastCheckedAllowanceRef = useRef<number | null>(null)

  // ── Low-allowance check — runs whenever allowance updates ──────
  useEffect(() => {
    if (!allowance) return
    if (getNotificationPermissionStatus() !== "granted") return

    // Avoid re-checking if allowance amount hasn't changed
    if (lastCheckedAllowanceRef.current === allowance.amount) return
    lastCheckedAllowanceRef.current = allowance.amount

    const prefs = getSmartNotificationPrefs()
    const payload = checkLowAllowanceNotification(allowance, prefs)

    if (payload) {
      fireSmartNotification(payload).then((sent) => {
        if (sent) {
          markNotificationFired("lowAllowance")
        }
      })
    }
  }, [allowance])

  // ── Bill-due check — runs on mount + daily interval ────────────
  useEffect(() => {
    if (getNotificationPermissionStatus() !== "granted") return

    function checkBills() {
      const prefs = getSmartNotificationPrefs()
      const today = new Date()
      const payloads = checkBillDueNotifications(fixedExpenses, today, prefs)

      for (const payload of payloads) {
        // Extract bill id from tag: "folio-bill-due-{id}"
        const billId = payload.tag.replace("folio-bill-due-", "")
        fireSmartNotification(payload).then((sent) => {
          if (sent) {
            markNotificationFired("billDue", billId)
          }
        })
      }
    }

    // Check immediately on mount
    checkBills()

    // Re-check hourly (catches bill-due day transitions)
    const interval = setInterval(checkBills, BILL_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fixedExpenses])
}
