/**
 * Notification scheduler — manages local reminder notifications for Folio.
 *
 * Uses the browser Notification API to show a gentle daily reminder at the
 * user's configured time. Falls back to an in-app badge if notification
 * permission is denied (never re-prompts for permission).
 *
 * The scheduler runs a timer while the app is open. When the configured time
 * arrives (and the reminder conditions are met), it fires a notification with
 * warm, non-guilt copy from a rotating pool.
 *
 * Requirements: Task 77 — Gentle re-engagement without nagging
 */

import {
  getReminderPreferences,
  shouldShowReminder,
  markReminderShownToday,
} from "./reminderPreferences"
import { shouldSuppressNotification } from "./engagementTracker"
import {
  getOptimalNudgeTime,
  shouldSendReengagementNudge,
  getReengagementPayload,
  markReengagementFired,
} from "./notificationTimingIntelligence"

// ============================================================================
// Types
// ============================================================================

export type NotificationPermissionStatus = "granted" | "denied" | "default" | "unsupported"

// ============================================================================
// Actionable notifications (task 182.1)
// ============================================================================

/**
 * A single quick action attached to a notification. Mirrors the web
 * `NotificationAction` shape, declared locally because the DOM lib bundled here
 * doesn't type the notification `actions` field.
 */
export interface FolioNotificationAction {
  action: string
  title: string
  icon?: string
}

/**
 * Notification options extended with the fields the notifications spec supports
 * for persistent (service-worker) notifications but that the bundled DOM lib
 * doesn't type — `actions` and `data`.
 */
export type ActionableNotificationOptions = NotificationOptions & {
  actions?: FolioNotificationAction[]
  data?: unknown
}

/**
 * Quick actions attached to Folio notifications so the daily loop can start
 * straight from the notification shade. The service worker's `notificationclick`
 * handler (see public/sw.js) routes each action:
 *   • "log-expense"    → the confirm-before-save quick log (reuses quickCapture)
 *   • "view-allowance" → Home, with the daily number front and centre
 *
 * Actions are only rendered by browsers that support persistent
 * (service-worker) notifications; the plain `Notification` fallback ignores them.
 */
export const FOLIO_NOTIFICATION_ACTIONS: FolioNotificationAction[] = [
  { action: "log-expense", title: "Log expense" },
  { action: "view-allowance", title: "View allowance" },
]

// ============================================================================
// Warm message pool — never guilt-based, always encouraging
// ============================================================================

const REMINDER_MESSAGES: string[] = [
  "How'd spending go today?",
  "Quick check-in: anything to log?",
  "Your daily budget resets tomorrow — log anything left?",
  "Got a minute? Log today's spending while it's fresh.",
  "End of day — want to jot down what you spent?",
  "A quick log keeps your budget on track. No pressure!",
  "Hey! Ready for a 10-second spending check-in?",
]

/** Key for tracking which messages have been used recently */
const USED_MESSAGES_KEY = "folio_reminder_used_msgs"

/**
 * Pick a warm reminder message, avoiding repetition within a week.
 * Selects randomly from messages not used in the past 7 days.
 */
function pickReminderMessage(): string {
  if (typeof window === "undefined") return REMINDER_MESSAGES[0]

  let usedIndices: number[] = []
  try {
    const stored = localStorage.getItem(USED_MESSAGES_KEY)
    if (stored) usedIndices = JSON.parse(stored) as number[]
  } catch {
    // ignore parse errors
  }

  // Available indices (not used recently)
  const available = REMINDER_MESSAGES
    .map((_, i) => i)
    .filter((i) => !usedIndices.includes(i))

  // If all have been used, reset the pool
  const pool = available.length > 0 ? available : REMINDER_MESSAGES.map((_, i) => i)

  const chosenIndex = pool[Math.floor(Math.random() * pool.length)]

  // Track this message as used (keep last 7)
  const updated = [...usedIndices, chosenIndex].slice(-7)
  try {
    localStorage.setItem(USED_MESSAGES_KEY, JSON.stringify(updated))
  } catch {
    // fail silently
  }

  return REMINDER_MESSAGES[chosenIndex]
}

// ============================================================================
// Permission helpers
// ============================================================================

/**
 * Get the current notification permission status.
 */
export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission as NotificationPermissionStatus
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission status.
 * Never re-prompts if already denied.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }

  // Already granted or denied — don't re-prompt
  if (Notification.permission !== "default") {
    return Notification.permission as NotificationPermissionStatus
  }

  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermissionStatus
  } catch {
    return "denied"
  }
}

// ============================================================================
// Local notification firing
// ============================================================================

/**
 * Show a local notification with a warm reminder message.
 * Uses the service worker registration for persistent notifications (PWA),
 * or falls back to the Notification constructor.
 */
async function fireLocalNotification(): Promise<boolean> {
  const permission = getNotificationPermissionStatus()
  if (permission !== "granted") return false

  const body = pickReminderMessage()

  try {
    // Try service worker notification first (works when PWA is in background)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready
      const options: ActionableNotificationOptions = {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "folio-daily-reminder",
        // Quick actions so the reminder is actionable (task 182.1).
        actions: FOLIO_NOTIFICATION_ACTIONS,
        data: { defaultUrl: "/" },
      }
      await registration.showNotification("Folio", options)
      return true
    }

    // Fallback to basic Notification API
    new Notification("Folio", { body, icon: "/icon-192.png" })
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Scheduler
// ============================================================================

let scheduledTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null

/**
 * Calculate milliseconds until the next occurrence of a given time today.
 * If the time has already passed today, returns ms until that time tomorrow.
 */
function msUntilTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  let diff = target.getTime() - now.getTime()
  if (diff < 0) {
    // Time already passed today — schedule for tomorrow
    diff += 24 * 60 * 60 * 1000
  }
  return diff
}

/**
 * Determine the effective reminder time by combining the user's configured time
 * with timing intelligence from app-open patterns. If timing intelligence has
 * sufficient data and its recommended hour differs from the configured time,
 * prefer the detected active window (it's when the user is most likely to see
 * and act on the nudge). Falls back to the user's manual setting when data is
 * insufficient.
 *
 * Task 347.1 — Notification timing intelligence integration.
 */
function getEffectiveReminderTime(): string {
  const prefs = getReminderPreferences()
  const timing = getOptimalNudgeTime()

  // If timing intelligence has no confident recommendation, use user's config
  if (timing.isFallback) return prefs.time

  // Use the detected optimal hour (pad to HH:00 format)
  const hourStr = timing.hour.toString().padStart(2, "0")
  return `${hourStr}:00`
}

/**
 * Schedule the daily reminder notification at the user's active time.
 * Uses timing intelligence to detect the user's preferred app-open window
 * and schedules near that time. Falls back to the user's configured time
 * when insufficient data is available.
 *
 * Also checks for re-engagement nudge conditions (2+ days inactive).
 *
 * Returns true if a reminder was scheduled, false if reminders are disabled
 * or conditions aren't met.
 */
export function scheduleLocalReminder(): boolean {
  cancelScheduledReminder()

  const prefs = getReminderPreferences()
  if (!prefs.enabled) return false

  const effectiveTime = getEffectiveReminderTime()
  const delay = msUntilTime(effectiveTime)

  scheduledTimer = setTimeout(async () => {
    // Adaptive suppression: if user consistently ignores daily reminders,
    // skip firing (they can re-enable in Settings). Task 167.1
    if (shouldSuppressNotification("daily_reminder")) {
      scheduleLocalReminder()
      return
    }

    if (shouldShowReminder()) {
      const sent = await fireLocalNotification()
      if (sent) {
        markReminderShownToday()
      }
      // Notify in-app listeners (for badge fallback)
      window.dispatchEvent(new CustomEvent("folio-reminder-fired", { detail: { sent } }))
    }
    // Re-schedule for the next day
    scheduleLocalReminder()
  }, delay)

  // Also check re-engagement nudge (Task 347.1)
  checkReengagementNudge()

  return true
}

/**
 * Check if we should send a re-engagement nudge (user inactive 2+ days).
 * Fires via the service worker notification if conditions are met.
 * Task 347.1.
 */
async function checkReengagementNudge(): Promise<void> {
  if (!shouldSendReengagementNudge()) return

  const permission = getNotificationPermissionStatus()
  if (permission !== "granted") return

  const payload = getReengagementPayload()

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready
      const options: ActionableNotificationOptions = {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.tag,
        actions: FOLIO_NOTIFICATION_ACTIONS,
        data: { defaultUrl: "/" },
      }
      await registration.showNotification(payload.title, options)
      markReengagementFired()
    } else {
      new Notification(payload.title, { body: payload.body, icon: "/icon-192.png" })
      markReengagementFired()
    }
  } catch {
    // fail silently
  }
}

/**
 * Cancel any scheduled reminder timers.
 */
export function cancelScheduledReminder(): void {
  if (scheduledTimer !== null) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
  if (checkInterval !== null) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}
