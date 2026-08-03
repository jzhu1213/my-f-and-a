"use client"

import { useEffect, useRef } from "react"
import type { DailyAllowance, SavingsAccount } from "@/types/folio"
import type { FixedExpense } from "@/lib/fixedExpenses"
import type { PaySchedule } from "@/lib/paySchedule"
import type { Transaction } from "@/types"
import { getNotificationPermissionStatus } from "@/lib/notificationScheduler"
import { getDaysUntilPayday } from "@/lib/paySchedule"
import { getMonthToDateContributionsByAccount } from "@/lib/savingsContributionHistory"
import {
  getSmartNotificationPrefs,
  checkLowAllowanceNotification,
  checkBillDueNotifications,
  checkSavingsContributionNotification,
  checkBalanceUpdateNotification,
  fireSmartNotification,
  markNotificationFired,
} from "@/lib/smartNotifications"

/** Check interval for bill-due notifications: once per hour */
const BILL_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Whether a paycheck has landed today — either today is a scheduled payday, or
 * the user logged an income transaction dated today. Used to gate the payday
 * contribution reminder (task 160.1).
 */
function wasPaycheckToday(
  paySchedule: PaySchedule | null,
  incomeTransactions: Transaction[],
  now: Date
): boolean {
  const todayStr = now.toISOString().slice(0, 10)

  // Income logged today is the strongest "paycheck detected" signal.
  if (incomeTransactions.some((t) => t.type === "income" && t.date === todayStr)) {
    return true
  }

  // Otherwise fall back to the user's configured pay schedule.
  if (paySchedule) {
    return getDaysUntilPayday(paySchedule, now, incomeTransactions) === 0
  }

  return false
}

/**
 * useSmartNotifications — checks and fires proactive financial notifications.
 *
 * - On each allowance update: checks if low-allowance notification should fire
 * - On mount + hourly interval: checks if any bill-due notifications should fire
 * - On payday (or when income is logged): reminds the user to fund savings
 *   accounts whose monthly contribution target isn't met yet (task 160.1)
 * - Respects notification permission and opt-in preferences
 *
 * Requirements: Task 114.2 — Glanceable widgets and notifications;
 *               Task 160.1 — Payday-triggered contribution prompt
 */
export function useSmartNotifications(
  allowance: DailyAllowance | null,
  fixedExpenses: FixedExpense[],
  savingsAccounts: SavingsAccount[] = [],
  paySchedule: PaySchedule | null = null,
  transactions: Transaction[] = []
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

  // ── Payday savings-contribution check (task 160.1) ─────────────
  // On mount, when a paycheck lands, or when accounts change, remind the user
  // to fund savings accounts whose monthly target hasn't been met this month.
  useEffect(() => {
    if (getNotificationPermissionStatus() !== "granted") return
    if (savingsAccounts.length === 0) return

    function checkSavingsContribution() {
      const prefs = getSmartNotificationPrefs()
      if (!prefs.savingsContributionEnabled) return

      const now = new Date()
      // Only nudge around a paycheck — never out of the blue.
      if (!wasPaycheckToday(paySchedule, transactions, now)) return

      const monthToDate = getMonthToDateContributionsByAccount(
        savingsAccounts.map((a) => a.id),
        now
      )
      const payload = checkSavingsContributionNotification(
        savingsAccounts,
        monthToDate,
        now,
        prefs
      )
      if (payload) {
        fireSmartNotification(payload).then((sent) => {
          if (sent) markNotificationFired("savingsContribution")
        })
      }
    }

    // Check on mount / when inputs change.
    checkSavingsContribution()

    // Re-check hourly to catch the payday day-transition while the app is open.
    const interval = setInterval(checkSavingsContribution, BILL_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [savingsAccounts, paySchedule, transactions])

  // ── Monthly balance-update check (task 163.1) ─────────────────
  // Since Folio doesn't connect to banks, balances only move when the user
  // updates them. Once a month, gently remind them to update their savings
  // balances so growth-over-time stays accurate. Opt-in, deduped per month.
  useEffect(() => {
    if (getNotificationPermissionStatus() !== "granted") return
    if (savingsAccounts.length === 0) return

    function checkBalanceUpdate() {
      const prefs = getSmartNotificationPrefs()
      if (!prefs.balanceUpdateEnabled) return

      const now = new Date()
      const payload = checkBalanceUpdateNotification(savingsAccounts, now, prefs)
      if (payload) {
        fireSmartNotification(payload).then((sent) => {
          if (sent) markNotificationFired("balanceUpdate")
        })
      }
    }

    // Check on mount / when accounts change.
    checkBalanceUpdate()

    // Re-check hourly to catch the month day-transition while the app is open.
    const interval = setInterval(checkBalanceUpdate, BILL_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [savingsAccounts])
}
