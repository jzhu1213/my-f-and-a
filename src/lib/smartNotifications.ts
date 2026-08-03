/**
 * Smart Notifications — proactive financial alerts for Folio.
 *
 * Provides opt-in overdraft-avoidance and bill-due push notifications.
 * All notifications are off by default, warm in tone, and never fire
 * duplicates within the same day.
 *
 * Requirements: Task 114.2 — Glanceable widgets and notifications
 */

import type { DailyAllowance, SavingsAccount } from "@/types/folio"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { getNotificationPermissionStatus } from "./notificationScheduler"
import { shouldSuppressNotification } from "./engagementTracker"

// ============================================================================
// Types
// ============================================================================

export interface SmartNotificationPreferences {
  /** Notify when allowance drops below a threshold (default: off) */
  lowAllowanceEnabled: boolean
  /** Dollar threshold for low-allowance warning (default: $10) */
  lowAllowanceThreshold: number
  /** Notify N days before a bill is due (default: off) */
  billDueEnabled: boolean
  /** Days before bill due date to notify (default: 1) */
  billDueLeadDays: number
  /** Weekly spending recap notification (default: off) */
  weeklyRecapEnabled: boolean
  /**
   * Payday-triggered reminder to fund savings accounts whose monthly
   * contribution target hasn't been met yet this month (default: off).
   * Task 160.1.
   */
  savingsContributionEnabled: boolean
  /**
   * Monthly reminder to manually update savings/investment account balances so
   * growth-over-time stays accurate (Folio doesn't connect to banks).
   * Opt-in, off by default. Task 163.1.
   */
  balanceUpdateEnabled: boolean
  /** Last dates each notification type was fired (prevent duplicates) */
  lastFired: {
    lowAllowance: string | null // ISO date
    billDue: Record<string, string> // billId -> ISO date
    /** Month (YYYY-MM) the savings contribution reminder last fired. */
    savingsContribution: string | null
    /** Month (YYYY-MM) the balance-update reminder last fired. */
    balanceUpdate: string | null
  }
}

export interface NotificationPayload {
  title: string
  body: string
  tag: string
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_smart_notification_prefs"

const DEFAULT_PREFS: SmartNotificationPreferences = {
  lowAllowanceEnabled: false,
  lowAllowanceThreshold: 10,
  billDueEnabled: false,
  billDueLeadDays: 1,
  weeklyRecapEnabled: false,
  savingsContributionEnabled: false,
  balanceUpdateEnabled: false,
  lastFired: {
    lowAllowance: null,
    billDue: {},
    savingsContribution: null,
    balanceUpdate: null,
  },
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * Load smart notification preferences from localStorage.
 * Returns defaults if nothing is stored.
 */
export function getSmartNotificationPrefs(): SmartNotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFS
    const parsed = JSON.parse(stored) as Partial<SmartNotificationPreferences>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      lastFired: {
        ...DEFAULT_PREFS.lastFired,
        ...(parsed.lastFired ?? {}),
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * Save smart notification preferences to localStorage.
 */
export function setSmartNotificationPrefs(prefs: SmartNotificationPreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Notification checks
// ============================================================================

/**
 * Returns a notification payload if the user's daily allowance is at or below
 * their configured threshold AND this notification hasn't already fired today.
 */
export function checkLowAllowanceNotification(
  allowance: DailyAllowance,
  prefs: SmartNotificationPreferences
): NotificationPayload | null {
  if (!prefs.lowAllowanceEnabled) return null

  // Adaptive suppression: skip if user consistently ignores this type (Task 167.1)
  if (shouldSuppressNotification("lowAllowance")) return null

  const today = new Date().toISOString().slice(0, 10)

  // Already fired today — don't duplicate
  if (prefs.lastFired.lowAllowance === today) return null

  // Check threshold
  if (allowance.amount > prefs.lowAllowanceThreshold) return null

  const amountStr = `$${Math.max(0, Math.round(allowance.amount))}`

  return {
    title: "Folio",
    body: `Heads up — you've got about ${amountStr} left today. Maybe save the rest for later?`,
    tag: "folio-low-allowance",
  }
}

/**
 * Returns notifications for bills due within the configured lead days
 * that haven't been notified yet today.
 */
export function checkBillDueNotifications(
  bills: FixedExpense[],
  today: Date,
  prefs: SmartNotificationPreferences
): NotificationPayload[] {
  if (!prefs.billDueEnabled) return []

  // Adaptive suppression: skip if user consistently ignores bill-due notifications (Task 167.1)
  if (shouldSuppressNotification("billDue")) return []

  const todayStr = today.toISOString().slice(0, 10)
  const currentDay = today.getDate()
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate()

  const notifications: NotificationPayload[] = []

  for (const bill of bills) {
    if (!bill.isActive) continue

    // Effective due day (clamp to last day of month for bills due on 31st etc.)
    const effectiveDueDay = Math.min(bill.dueDay, daysInMonth)

    // How many days until this bill is due
    const daysUntilDue = effectiveDueDay - currentDay

    // Only notify if within lead days window (includes same-day)
    if (daysUntilDue < 0 || daysUntilDue > prefs.billDueLeadDays) continue

    // Already fired for this bill today
    if (prefs.lastFired.billDue[bill.id] === todayStr) continue

    const amountStr = `$${bill.amount}`
    let body: string

    if (daysUntilDue === 0) {
      body = `${bill.label} (${amountStr}) is due today — all taken care of?`
    } else if (daysUntilDue === 1) {
      body = `Reminder: ${bill.label} (${amountStr}) is due tomorrow`
    } else {
      body = `Reminder: ${bill.label} (${amountStr}) is due in ${daysUntilDue} days`
    }

    notifications.push({
      title: "Folio",
      body,
      tag: `folio-bill-due-${bill.id}`,
    })
  }

  return notifications
}

// ============================================================================
// Savings contribution reminder (task 160.1)
// ============================================================================

/** A savings account whose monthly contribution target isn't met yet. */
export interface UnmetContribution {
  accountId: string
  name: string
  /** The user's own monthly contribution target for this account. */
  monthlyTarget: number
  /** How much has already gone in this calendar month. */
  contributedThisMonth: number
  /** Remaining to reach the target (> 0). */
  remaining: number
}

/**
 * Determine which accounts still have room toward their monthly contribution
 * target, given the amount already contributed this month per account.
 *
 * Pure: only considers accounts with a positive `monthlyContribution` and
 * returns those whose month-to-date contributions fall short of the target.
 */
export function computeUnmetContributions(
  accounts: SavingsAccount[],
  monthToDateByAccount: Record<string, number>
): UnmetContribution[] {
  const unmet: UnmetContribution[] = []
  for (const account of accounts) {
    if (account.monthlyContribution <= 0) continue
    const contributed = Math.max(0, monthToDateByAccount[account.id] ?? 0)
    const remaining = account.monthlyContribution - contributed
    if (remaining > 0.005) {
      unmet.push({
        accountId: account.id,
        name: account.name,
        monthlyTarget: account.monthlyContribution,
        contributedThisMonth: contributed,
        remaining,
      })
    }
  }
  return unmet
}

/** Round to a whole-dollar display string (e.g. 50 → "$50"). */
function formatDollars(amount: number): string {
  return `$${Math.max(0, Math.round(amount))}`
}

/**
 * Returns a warm, non-shaming payload nudging the user to fund their savings
 * accounts on payday — but only when:
 *  - the reminder is enabled,
 *  - at least one account's monthly contribution target is still unmet, and
 *  - the reminder hasn't already fired this calendar month.
 *
 * `now` drives the once-per-month dedupe key so the prompt appears at most once
 * per month regardless of how many paychecks land. Returns null otherwise.
 */
export function checkSavingsContributionNotification(
  accounts: SavingsAccount[],
  monthToDateByAccount: Record<string, number>,
  now: Date,
  prefs: SmartNotificationPreferences
): NotificationPayload | null {
  if (!prefs.savingsContributionEnabled) return null

  // Adaptive suppression: skip if user consistently ignores this type (Task 167.1)
  if (shouldSuppressNotification("savingsContribution")) return null

  const monthKey = now.toISOString().slice(0, 7) // YYYY-MM

  // Already nudged this month — never repeat.
  if (prefs.lastFired.savingsContribution === monthKey) return null

  const unmet = computeUnmetContributions(accounts, monthToDateByAccount)
  if (unmet.length === 0) return null

  let body: string
  if (unmet.length === 1) {
    const account = unmet[0]
    body = `Payday 🎉 Want to move ${formatDollars(account.remaining)} toward ${account.name} this month?`
  } else {
    const total = unmet.reduce((sum, u) => sum + u.remaining, 0)
    body = `Payday 🎉 You've got ${formatDollars(total)} left to reach your savings goals this month — want to top them up?`
  }

  return {
    title: "Folio",
    body,
    tag: "folio-savings-contribution",
  }
}

// ============================================================================
// Monthly balance-update reminder (task 163.1)
// ============================================================================

/**
 * Returns a warm, non-shaming payload nudging the user to update their
 * savings/investment account balances so their growth-over-time stays
 * accurate. Folio doesn't connect to banks, so balances only move when the
 * user updates them — a gentle monthly check-in keeps the history meaningful.
 *
 * Only fires when:
 *  - the reminder is enabled,
 *  - the user has at least one savings/investment account, and
 *  - the reminder hasn't already fired this calendar month.
 *
 * `now` drives the once-per-month dedupe key so the prompt appears at most once
 * per month. Returns null otherwise.
 */
export function checkBalanceUpdateNotification(
  accounts: SavingsAccount[],
  now: Date,
  prefs: SmartNotificationPreferences
): NotificationPayload | null {
  if (!prefs.balanceUpdateEnabled) return null
  if (accounts.length === 0) return null

  // Adaptive suppression: skip if user consistently ignores this type (Task 167.1)
  if (shouldSuppressNotification("balanceUpdate")) return null

  const monthKey = now.toISOString().slice(0, 7) // YYYY-MM

  // Already nudged this month — never repeat.
  if (prefs.lastFired.balanceUpdate === monthKey) return null

  const body =
    accounts.length === 1
      ? `Quick check-in: got a minute to update your ${accounts[0].name} balance? It keeps your growth chart accurate.`
      : `Quick check-in: update your savings balances when you have a sec — it keeps your growth over time accurate.`

  return {
    title: "Folio",
    body,
    tag: "folio-balance-update",
  }
}

// ============================================================================
// Fire notification
// ============================================================================

/**
 * Fires a notification via service worker (or Notification API fallback).
 * Reuses the same pattern as notificationScheduler's fireLocalNotification.
 */
export async function fireSmartNotification(payload: NotificationPayload): Promise<boolean> {
  const permission = getNotificationPermissionStatus()
  if (permission !== "granted") return false

  try {
    // Try service worker notification first (works in background for PWA)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.tag,
      })
      return true
    }

    // Fallback to basic Notification API
    new Notification(payload.title, { body: payload.body, icon: "/icon-192.png" })
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Duplicate prevention
// ============================================================================

/**
 * Mark a notification type as fired today so it won't fire again.
 * For bill-due, pass the bill's id.
 */
export function markNotificationFired(
  type: "lowAllowance" | "billDue" | "savingsContribution" | "balanceUpdate",
  id?: string
): void {
  const prefs = getSmartNotificationPrefs()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  if (type === "lowAllowance") {
    prefs.lastFired.lowAllowance = today
  } else if (type === "billDue" && id) {
    prefs.lastFired.billDue[id] = today
  } else if (type === "savingsContribution") {
    // Dedupe per calendar month, not per day.
    prefs.lastFired.savingsContribution = now.toISOString().slice(0, 7)
  } else if (type === "balanceUpdate") {
    // Dedupe per calendar month, not per day.
    prefs.lastFired.balanceUpdate = now.toISOString().slice(0, 7)
  }

  setSmartNotificationPrefs(prefs)
}
