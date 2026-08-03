/**
 * Engagement Tracker — adaptive tip & notification frequency tuning.
 *
 * Records how the user interacts with tips and notifications (acted, dismissed,
 * shown) and uses that history to suppress content they consistently ignore.
 *
 * Design principles:
 *  - **Quiet by default**: only ever decreases nudge volume, never increases it
 *  - **Graceful degradation**: if localStorage is unavailable, never suppresses
 *    (falls back to current behavior)
 *  - **Recency-weighted**: only considers the last 30 days of engagement data
 *  - **Per-type tracking**: engagement is tracked per tip type AND per tip ID
 *    pattern so suppression is granular
 *
 * Requirements: Task 167.1 — Tune tip & notification frequency to engagement
 * (extends Phase 1 tasks 8, 75, Phase 3 task 134.1)
 */

import type { TipType } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

/** The kind of engagement event. */
export type EngagementAction = "acted" | "dismissed" | "shown"

/** A single engagement event stored in history. */
export interface EngagementEvent {
  /** The specific tip/notification ID (e.g., "streak-7", "low-allowance"). */
  tipId: string
  /** The tip type category (e.g., "celebration", "gentle_nudge"). */
  tipType: TipType | string
  /** What the user did. */
  action: EngagementAction
  /** ISO timestamp of when this occurred. */
  timestamp: string
}

/** The persisted engagement history structure. */
export interface EngagementHistory {
  events: EngagementEvent[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_engagement_history"

/** Only consider events from the last 30 days. */
const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Minimum number of times a tip type must have been shown before suppression
 * can kick in. Prevents suppressing after just 1-2 appearances.
 */
const MIN_SHOWN_FOR_SUPPRESSION = 3

/**
 * Maximum number of events to keep in storage (prevents unbounded growth).
 * Events older than 30 days are pruned on write; this cap is a safety net.
 */
const MAX_EVENTS = 500

// ============================================================================
// Persistence
// ============================================================================

/**
 * Load engagement history from localStorage.
 * Returns an empty history if nothing is stored or localStorage is unavailable.
 */
function getEngagementHistory(): EngagementHistory {
  if (typeof window === "undefined") return { events: [] }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { events: [] }
    const parsed = JSON.parse(stored) as EngagementHistory
    return parsed && Array.isArray(parsed.events) ? parsed : { events: [] }
  } catch {
    return { events: [] }
  }
}

/**
 * Save engagement history to localStorage, pruning stale events.
 */
function setEngagementHistory(history: EngagementHistory): void {
  if (typeof window === "undefined") return
  try {
    // Prune events older than the recency window
    const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
    const pruned = history.events.filter((e) => e.timestamp >= cutoff)
    // Cap total events as a safety net
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
 * Record an engagement event (shown, acted, dismissed) for a tip or notification.
 *
 * Call this from the HomeScreen when:
 *  - A tip is rendered → action = "shown"
 *  - The user taps the tip's action button → action = "acted"
 *  - The user dismisses the tip → action = "dismissed"
 */
export function recordEngagement(
  tipId: string,
  tipType: TipType | string,
  action: EngagementAction
): void {
  const history = getEngagementHistory()
  history.events.push({
    tipId,
    tipType,
    action,
    timestamp: new Date().toISOString(),
  })
  setEngagementHistory(history)
}

// ============================================================================
// Query helpers
// ============================================================================

/**
 * Get recent events (within the 30-day window) filtered by tip type.
 */
function getRecentEventsByType(tipType: TipType | string): EngagementEvent[] {
  const history = getEngagementHistory()
  const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
  return history.events.filter(
    (e) => e.tipType === tipType && e.timestamp >= cutoff
  )
}

/**
 * Get recent events (within the 30-day window) filtered by a tip ID prefix.
 * Useful for pattern matching (e.g., all "bill-due-*" tips).
 */
function getRecentEventsByIdPrefix(prefix: string): EngagementEvent[] {
  const history = getEngagementHistory()
  const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS).toISOString()
  return history.events.filter(
    (e) => e.tipId.startsWith(prefix) && e.timestamp >= cutoff
  )
}

// ============================================================================
// Suppression decisions
// ============================================================================

/**
 * Determines whether a specific tip should be suppressed based on engagement
 * history. A tip is suppressed when:
 *  - It has been shown 3+ times (by type) in the last 30 days
 *  - AND the user has never acted on it (0 acts for that type)
 *
 * Also checks the specific tip ID prefix pattern for more granular suppression.
 *
 * @returns true if the tip should be suppressed (not shown)
 */
export function shouldSuppressTip(tipId: string, tipType: TipType): boolean {
  if (typeof window === "undefined") return false
  try {
    // Check by type first
    const typeEvents = getRecentEventsByType(tipType)
    const shownByType = typeEvents.filter((e) => e.action === "shown").length
    const actedByType = typeEvents.filter((e) => e.action === "acted").length

    if (shownByType >= MIN_SHOWN_FOR_SUPPRESSION && actedByType === 0) {
      return true
    }

    // Check by ID prefix (e.g., "bill-due-", "streak-")
    const dashIndex = tipId.lastIndexOf("-")
    if (dashIndex > 0) {
      const prefix = tipId.slice(0, dashIndex + 1)
      // Only use prefix matching if the prefix is meaningful (not just "x-")
      if (prefix.length > 3) {
        const prefixEvents = getRecentEventsByIdPrefix(prefix)
        const shownByPrefix = prefixEvents.filter((e) => e.action === "shown").length
        const actedByPrefix = prefixEvents.filter((e) => e.action === "acted").length

        if (shownByPrefix >= MIN_SHOWN_FOR_SUPPRESSION && actedByPrefix === 0) {
          return true
        }
      }
    }

    return false
  } catch {
    // Graceful degradation: never suppress if something goes wrong
    return false
  }
}

/**
 * Determines whether a notification type should be suppressed.
 * Uses the same logic as tip suppression but keyed on notification type string.
 *
 * @param notificationType - e.g., "lowAllowance", "billDue", "daily_reminder",
 *   "savingsContribution", "balanceUpdate"
 * @returns true if the notification should be suppressed
 */
export function shouldSuppressNotification(notificationType: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const events = getRecentEventsByType(notificationType)
    const shown = events.filter((e) => e.action === "shown").length
    const acted = events.filter((e) => e.action === "acted").length

    // Suppress if shown 3+ times and never acted on
    return shown >= MIN_SHOWN_FOR_SUPPRESSION && acted === 0
  } catch {
    // Graceful degradation: never suppress if something goes wrong
    return false
  }
}

/**
 * Returns an adaptive frequency multiplier for a given tip type.
 * Used to extend cooldown periods proportionally:
 *  - 1.0 = user engages with this type → normal frequency
 *  - 0.5 = user occasionally engages → show at half frequency (extend cooldowns)
 *  - 0   = user consistently ignores → fully suppress
 *
 * Never returns a value > 1.0 (never increases nudge volume).
 */
export function getAdaptiveFrequencyMultiplier(tipType: TipType | string): number {
  if (typeof window === "undefined") return 1.0
  try {
    const events = getRecentEventsByType(tipType)
    const shown = events.filter((e) => e.action === "shown").length
    const acted = events.filter((e) => e.action === "acted").length

    // Not enough data yet — default to normal frequency
    if (shown < MIN_SHOWN_FOR_SUPPRESSION) return 1.0

    const engagementRate = acted / shown

    // High engagement (>= 30% act rate): normal frequency
    if (engagementRate >= 0.3) return 1.0

    // Some engagement (> 0 acts but < 30%): half frequency
    if (acted > 0) return 0.5

    // Zero engagement: fully suppress
    return 0
  } catch {
    // Graceful degradation: normal frequency
    return 1.0
  }
}
