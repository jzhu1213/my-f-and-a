/**
 * Reminder preferences — persistence and logic for the daily spending reminder.
 *
 * Stores user preferences in localStorage. The reminder is opt-in only (off by
 * default) and never nags. If the user hasn't opened the app in 3+ days, the
 * system marks them as a returning user and shows a warm "welcome back" badge
 * instead of an immediate reminder.
 *
 * Requirements: Task 77 — Gentle re-engagement without nagging
 */

// ============================================================================
// Types
// ============================================================================

export interface ReminderPreferences {
  /** Whether the daily reminder is enabled (opt-in, default false) */
  enabled: boolean
  /** Time of day to send the reminder in HH:MM format (default "20:00" — 8 PM) */
  time: string
  /** ISO date string of the last day a notification was shown */
  lastNotifiedDate: string | null
  /** ISO date string — suppress reminders until this date */
  snoozedUntil: string | null
}

export interface LastActiveInfo {
  /** ISO date string of the user's last app open */
  lastActiveDate: string | null
  /** Whether the user is returning after 3+ days of inactivity */
  isReturningUser: boolean
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_reminder_prefs"
const LAST_ACTIVE_KEY = "folio_last_active_date"
const WELCOME_BACK_DISMISSED_KEY = "folio_welcome_back_dismissed"
const RETURNING_USER_THRESHOLD_DAYS = 3

const DEFAULT_PREFERENCES: ReminderPreferences = {
  enabled: false,
  time: "20:00",
  lastNotifiedDate: null,
  snoozedUntil: null,
}

// ============================================================================
// Persistence helpers
// ============================================================================

/**
 * Get the user's reminder preferences from localStorage.
 * Returns default preferences if none are stored.
 */
export function getReminderPreferences(): ReminderPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(stored) as Partial<ReminderPreferences>
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * Save reminder preferences to localStorage.
 */
export function setReminderPreferences(prefs: ReminderPreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Last-active tracking
// ============================================================================

/**
 * Record today's date as the last active date.
 * Call this on app open.
 */
export function recordLastActive(): void {
  if (typeof window === "undefined") return
  try {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(LAST_ACTIVE_KEY, today)
  } catch {
    // fail silently
  }
}

/**
 * Get last active info — whether the user is returning after 3+ days.
 */
export function getLastActiveInfo(): LastActiveInfo {
  if (typeof window === "undefined") {
    return { lastActiveDate: null, isReturningUser: false }
  }
  try {
    const lastActiveDate = localStorage.getItem(LAST_ACTIVE_KEY)
    if (!lastActiveDate) {
      return { lastActiveDate: null, isReturningUser: false }
    }

    const lastDate = new Date(lastActiveDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffMs = today.getTime() - lastDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    return {
      lastActiveDate,
      isReturningUser: diffDays >= RETURNING_USER_THRESHOLD_DAYS,
    }
  } catch {
    return { lastActiveDate: null, isReturningUser: false }
  }
}

/**
 * Check if the welcome-back badge has already been dismissed this session.
 */
export function isWelcomeBackDismissed(): boolean {
  if (typeof window === "undefined") return true
  try {
    return sessionStorage.getItem(WELCOME_BACK_DISMISSED_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Mark the welcome-back badge as dismissed for this session.
 */
export function dismissWelcomeBack(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(WELCOME_BACK_DISMISSED_KEY, "true")
  } catch {
    // fail silently
  }
}

// ============================================================================
// Reminder logic
// ============================================================================

/**
 * Determine whether a reminder should be shown right now.
 *
 * Returns false if:
 * - Reminders are disabled
 * - Already reminded today
 * - Currently snoozed
 * - User is a returning user (show welcome-back instead, no immediate reminder)
 */
export function shouldShowReminder(): boolean {
  const prefs = getReminderPreferences()
  if (!prefs.enabled) return false

  const today = new Date().toISOString().slice(0, 10)

  // Already notified today — never nag
  if (prefs.lastNotifiedDate === today) return false

  // Snoozed
  if (prefs.snoozedUntil && prefs.snoozedUntil >= today) return false

  // If user is returning after 3+ days, don't fire a reminder immediately —
  // show welcome-back badge instead (handled separately)
  const { isReturningUser } = getLastActiveInfo()
  if (isReturningUser) return false

  return true
}

/**
 * Mark that the reminder was shown today — prevents duplicate notifications.
 */
export function markReminderShownToday(): void {
  const prefs = getReminderPreferences()
  const today = new Date().toISOString().slice(0, 10)
  setReminderPreferences({ ...prefs, lastNotifiedDate: today })
}
