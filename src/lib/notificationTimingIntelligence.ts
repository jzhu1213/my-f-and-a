/**
 * Notification Timing Intelligence — delivers nudges at the user's active times.
 * ============================================================================
 *
 * Task 347.1. Tracks when the user typically opens the app (morning, afternoon,
 * evening, night) and recommends optimal notification delivery windows based on
 * detected patterns. Also handles re-engagement nudges when the user has been
 * inactive for 2+ days.
 *
 * Design:
 *  - Stores a rolling 30-day window of app open timestamps in localStorage
 *  - Categorizes opens into time windows: morning (6–11), afternoon (12–17),
 *    evening (18–23), night (0–5)
 *  - Needs at least 7 days of data for confident window recommendations
 *  - Falls back to existing scheduling when data is insufficient
 *  - Respects DND windows from patternNudges.ts
 *  - Never adds more notifications — only times existing ones better
 *
 * Requirements: 18.7
 */

import { isInDndWindow, getPatternNudgePrefs } from "./patternNudges"

// ============================================================================
// Types
// ============================================================================

/** Time window categories for app usage tracking. */
export type TimeWindow = "morning" | "afternoon" | "evening" | "night"

/** A single recorded app open event. */
export interface AppOpenEvent {
  /** ISO timestamp of when the user opened the app. */
  timestamp: string
  /** Hour of day (0–23) when the open occurred. */
  hour: number
  /** Which time window the open falls into. */
  window: TimeWindow
}

/** Stored app open history. */
export interface AppOpenHistory {
  events: AppOpenEvent[]
}

/** A detected active window with its frequency score. */
export interface ActiveWindowResult {
  /** The time window category. */
  window: TimeWindow
  /** Number of opens in this window (last 30 days). */
  count: number
  /** Percentage of total opens in this window. */
  percentage: number
  /** The most common hour within this window. */
  peakHour: number
}

/** Optimal nudge time recommendation. */
export interface NudgeTimeRecommendation {
  /** The recommended hour (0–23) to deliver the nudge. */
  hour: number
  /** The time window this falls into. */
  window: TimeWindow
  /** Confidence level based on data sufficiency. */
  confidence: "high" | "medium" | "low"
  /** Whether this is a fallback (insufficient data). */
  isFallback: boolean
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_app_open_history"

/** Only consider events from the last 30 days. */
const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Minimum days of data for confident recommendations. */
const MIN_DAYS_FOR_CONFIDENCE = 7

/** Maximum events to store (safety cap). */
const MAX_EVENTS = 200

/** Inactivity threshold for re-engagement nudge (2 days in ms). */
const REENGAGEMENT_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000

/** localStorage key for re-engagement nudge dedup. */
const REENGAGEMENT_FIRED_KEY = "folio_reengagement_last_fired"

/** Default nudge hour when insufficient data (9 AM — a common reasonable time). */
const DEFAULT_NUDGE_HOUR = 9

/**
 * Time window definitions: [startHour, endHour) — endHour is exclusive.
 */
const TIME_WINDOWS: Record<TimeWindow, { start: number; end: number }> = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 24 },
  night: { start: 0, end: 6 },
}

// ============================================================================
// Warm re-engagement copy pool
// ============================================================================

const REENGAGEMENT_MESSAGES: string[] = [
  "Hey, want to log anything from yesterday?",
  "Been a couple days — want to jot down any spending?",
  "Quick catch-up? Log anything you remember from the last day or two.",
  "No rush, but your budget's waiting when you're ready to log.",
  "Miss anything? A quick log keeps things on track.",
]

// ============================================================================
// Helpers
// ============================================================================

/** Categorize an hour (0–23) into a time window. */
export function getTimeWindow(hour: number): TimeWindow {
  if (hour >= 6 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  if (hour >= 18 && hour < 24) return "evening"
  return "night"
}

/** Get the midpoint hour of a time window (used as fallback nudge time). */
function getWindowMidpointHour(window: TimeWindow): number {
  const def = TIME_WINDOWS[window]
  if (window === "night") return 3 // 0–6, midpoint is 3 but not ideal for nudges
  return Math.floor((def.start + def.end) / 2)
}

// ============================================================================
// Persistence
// ============================================================================

/** Load app open history from localStorage. */
function getAppOpenHistory(): AppOpenHistory {
  if (typeof window === "undefined") return { events: [] }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { events: [] }
    const parsed = JSON.parse(stored) as AppOpenHistory
    return parsed && Array.isArray(parsed.events) ? parsed : { events: [] }
  } catch {
    return { events: [] }
  }
}

/** Save app open history to localStorage, pruning stale events. */
function setAppOpenHistory(history: AppOpenHistory): void {
  if (typeof window === "undefined") return
  try {
    const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
    const pruned = history.events.filter((e) => e.timestamp >= cutoff)
    const capped = pruned.length > MAX_EVENTS ? pruned.slice(-MAX_EVENTS) : pruned
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events: capped }))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Recording
// ============================================================================

/**
 * Record an app open event. Call this once per app session (e.g., on mount of
 * the home screen or app shell). Deduplicates opens within the same hour to
 * avoid inflating counts from page refreshes.
 */
export function recordAppOpen(): void {
  if (typeof window === "undefined") return

  const now = new Date()
  const hour = now.getHours()
  const timestamp = now.toISOString()

  const history = getAppOpenHistory()

  // Deduplicate: skip if there's already an event within the last 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const recentOpen = history.events.find((e) => e.timestamp >= thirtyMinAgo)
  if (recentOpen) return

  history.events.push({
    timestamp,
    hour,
    window: getTimeWindow(hour),
  })

  setAppOpenHistory(history)
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Get the number of unique days with recorded opens in the last 30 days.
 * Used to determine if we have enough data for confident recommendations.
 */
function getUniqueDaysWithOpens(events: AppOpenEvent[]): number {
  const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
  const recentEvents = events.filter((e) => e.timestamp >= cutoff)
  const uniqueDays = new Set(recentEvents.map((e) => e.timestamp.slice(0, 10)))
  return uniqueDays.size
}

/**
 * Returns the user's detected preferred active time windows, sorted by
 * frequency (most common first). Returns the top 1–2 windows that together
 * account for the majority of app opens.
 *
 * Returns an empty array if insufficient data (< 7 days of history).
 */
export function getActiveWindows(): ActiveWindowResult[] {
  if (typeof window === "undefined") return []

  const history = getAppOpenHistory()
  const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
  const recentEvents = history.events.filter((e) => e.timestamp >= cutoff)

  if (recentEvents.length === 0) return []

  const uniqueDays = getUniqueDaysWithOpens(recentEvents)
  if (uniqueDays < MIN_DAYS_FOR_CONFIDENCE) return []

  // Count opens per window
  const windowCounts: Record<TimeWindow, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  }

  // Track hours for peak-hour detection
  const hoursByWindow: Record<TimeWindow, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  }

  for (const event of recentEvents) {
    windowCounts[event.window]++
    hoursByWindow[event.window].push(event.hour)
  }

  const totalOpens = recentEvents.length

  // Build results for windows with activity
  const results: ActiveWindowResult[] = []

  for (const w of ["morning", "afternoon", "evening", "night"] as TimeWindow[]) {
    if (windowCounts[w] === 0) continue

    const hours = hoursByWindow[w]
    // Find the most common hour in this window
    const hourFreq: Record<number, number> = {}
    for (const h of hours) {
      hourFreq[h] = (hourFreq[h] ?? 0) + 1
    }
    const peakHour = Object.entries(hourFreq)
      .sort(([, a], [, b]) => b - a)[0]
    const peakHourNum = peakHour ? parseInt(peakHour[0], 10) : getWindowMidpointHour(w)

    results.push({
      window: w,
      count: windowCounts[w],
      percentage: Math.round((windowCounts[w] / totalOpens) * 100),
      peakHour: peakHourNum,
    })
  }

  // Sort by count descending, return top 2
  results.sort((a, b) => b.count - a.count)
  return results.slice(0, 2)
}

/**
 * Returns the optimal time to schedule a nudge based on detected active windows.
 * Respects DND windows from patternNudges preferences.
 *
 * Falls back to the default hour (9 AM) if insufficient data or if all detected
 * windows fall in DND.
 */
export function getOptimalNudgeTime(): NudgeTimeRecommendation {
  const activeWindows = getActiveWindows()
  const nudgePrefs = getPatternNudgePrefs()

  // Insufficient data — fallback
  if (activeWindows.length === 0) {
    return {
      hour: DEFAULT_NUDGE_HOUR,
      window: "morning",
      confidence: "low",
      isFallback: true,
    }
  }

  // Try each active window (most frequent first) — pick the first that isn't in DND
  for (const aw of activeWindows) {
    if (!isInDndWindow(aw.peakHour, nudgePrefs)) {
      const history = getAppOpenHistory()
      const uniqueDays = getUniqueDaysWithOpens(history.events)
      const confidence: "high" | "medium" =
        uniqueDays >= 14 ? "high" : "medium"

      return {
        hour: aw.peakHour,
        window: aw.window,
        confidence,
        isFallback: false,
      }
    }
  }

  // All active windows are in DND — fall back to default
  return {
    hour: DEFAULT_NUDGE_HOUR,
    window: "morning",
    confidence: "low",
    isFallback: true,
  }
}

// ============================================================================
// Re-engagement nudge
// ============================================================================

/**
 * Checks whether the user has been inactive (no app opens) for 2+ days.
 * Returns true if a re-engagement nudge should be sent.
 *
 * Also checks that we haven't already fired a re-engagement nudge today.
 */
export function shouldSendReengagementNudge(): boolean {
  if (typeof window === "undefined") return false

  try {
    const history = getAppOpenHistory()
    if (history.events.length === 0) return false // No data at all — don't nudge a brand new user

    // Find the most recent app open
    const sorted = [...history.events].sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp)
    )
    const lastOpen = sorted[0]
    if (!lastOpen) return false

    const lastOpenTime = new Date(lastOpen.timestamp).getTime()
    const timeSinceLastOpen = Date.now() - lastOpenTime

    if (timeSinceLastOpen < REENGAGEMENT_THRESHOLD_MS) return false

    // Check dedup — only fire once per day
    const today = new Date().toISOString().slice(0, 10)
    const lastFired = localStorage.getItem(REENGAGEMENT_FIRED_KEY)
    if (lastFired === today) return false

    // Respect DND
    const nudgePrefs = getPatternNudgePrefs()
    const currentHour = new Date().getHours()
    if (isInDndWindow(currentHour, nudgePrefs)) return false

    return true
  } catch {
    return false
  }
}

/**
 * Returns a warm, non-pressuring re-engagement message.
 * Rotates through a pool to avoid repetition.
 */
export function getReengagementMessage(): string {
  if (typeof window === "undefined") return REENGAGEMENT_MESSAGES[0]

  try {
    // Simple rotation based on day-of-year to vary copy
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const index = dayOfYear % REENGAGEMENT_MESSAGES.length
    return REENGAGEMENT_MESSAGES[index]
  } catch {
    return REENGAGEMENT_MESSAGES[0]
  }
}

/**
 * Mark the re-engagement nudge as fired today (prevents duplicate sends).
 */
export function markReengagementFired(): void {
  if (typeof window === "undefined") return
  try {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(REENGAGEMENT_FIRED_KEY, today)
  } catch {
    // fail silently
  }
}

/**
 * Get the re-engagement notification payload ready for firing via
 * `fireSmartNotification()`.
 */
export function getReengagementPayload(): {
  title: string
  body: string
  tag: string
} {
  return {
    title: "Folio",
    body: getReengagementMessage(),
    tag: "folio-reengagement",
  }
}
