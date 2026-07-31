/**
 * Smart Notifications — proactive financial alerts for Folio.
 *
 * Provides opt-in overdraft-avoidance and bill-due push notifications.
 * All notifications are off by default, warm in tone, and never fire
 * duplicates within the same day.
 *
 * Requirements: Task 114.2 — Glanceable widgets and notifications
 */

import type { DailyAllowance } from "@/types/folio"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { getNotificationPermissionStatus } from "./notificationScheduler"

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
  /** Last dates each notification type was fired (prevent duplicates) */
  lastFired: {
    lowAllowance: string | null // ISO date
    billDue: Record<string, string> // billId -> ISO date
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
  lastFired: {
    lowAllowance: null,
    billDue: {},
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
export function markNotificationFired(type: "lowAllowance" | "billDue", id?: string): void {
  const prefs = getSmartNotificationPrefs()
  const today = new Date().toISOString().slice(0, 10)

  if (type === "lowAllowance") {
    prefs.lastFired.lowAllowance = today
  } else if (type === "billDue" && id) {
    prefs.lastFired.billDue[id] = today
  }

  setSmartNotificationPrefs(prefs)
}
