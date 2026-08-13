import type { SpendingInsight, InsightTone } from '@/lib/spendingInsights'

// ============================================================================
// Insight Delivery Cadence (Task 357.2)
// ============================================================================
//
// Controls when and which insights are shown to the user. Prevents fatigue by
// enforcing daily/weekly limits, prioritizing positive tones, and rotating types.
// ============================================================================

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum insights shown per calendar day. */
export const MAX_PER_DAY = 1

/** Maximum insights shown per rolling 7-day window. */
export const MAX_PER_WEEK = 3

/** localStorage key for persisted insight history. */
const STORAGE_KEY = 'folio-insight-history'

// ── Types ────────────────────────────────────────────────────────────────────

export interface InsightHistoryEntry {
  insightId: string
  type: SpendingInsight['type']
  tone: InsightTone
  shownAt: string // ISO date-time string
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Reads insight history from localStorage.
 * Returns an empty array if unavailable.
 */
export function getInsightHistory(): InsightHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as InsightHistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Records that an insight was shown. Appends to localStorage history.
 * Trims entries older than 30 days to keep storage bounded.
 */
export function recordInsightShown(
  insightId: string,
  type: SpendingInsight['type'],
  tone: InsightTone,
  now: Date = new Date(),
): void {
  if (typeof window === 'undefined') return
  try {
    const history = getInsightHistory()
    history.push({
      insightId,
      type,
      tone,
      shownAt: now.toISOString(),
    })

    // Trim entries older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const trimmed = history.filter(h => h.shownAt >= thirtyDaysAgo)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage unavailable — best-effort
  }
}

// ── Cadence Checks ───────────────────────────────────────────────────────────

/**
 * Checks whether an insight can be shown right now based on daily/weekly limits.
 *
 * @param now - Current date/time (injectable for testing)
 * @returns true if the user hasn't exceeded their daily or weekly insight budget
 */
export function canShowInsight(now: Date = new Date()): boolean {
  const history = getInsightHistory()
  if (history.length === 0) return true

  const todayStr = now.toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Check daily limit
  const shownToday = history.filter(h => h.shownAt.startsWith(todayStr))
  if (shownToday.length >= MAX_PER_DAY) return false

  // Check weekly limit (rolling 7-day window)
  const shownThisWeek = history.filter(h => h.shownAt >= sevenDaysAgo)
  if (shownThisWeek.length >= MAX_PER_WEEK) return false

  return true
}

/**
 * Returns the insight types that were shown in the last 7 days.
 * Used for rotation — avoids showing the same type back-to-back.
 */
export function getRecentInsightTypes(now: Date = new Date()): SpendingInsight['type'][] {
  const history = getInsightHistory()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  return history
    .filter(h => h.shownAt >= sevenDaysAgo)
    .map(h => h.type)
}

// ── Selection Logic ──────────────────────────────────────────────────────────

/** Tone priority order: positive insights shown first, cautionary last. */
const TONE_PRIORITY: Record<InsightTone, number> = {
  positive: 1,
  neutral: 2,
  cautionary: 3,
}

/**
 * Selects the best insight to show from a list of candidates.
 *
 * Selection criteria (in order):
 * 1. Cadence check — if daily/weekly limits exceeded, returns null.
 * 2. Tone priority — positive/neutral insights beat cautionary.
 * 3. Type rotation — avoid the most recently shown type.
 * 4. Declared priority (insight.priority) as tiebreaker.
 *
 * @param candidates - All currently detected insights
 * @param now - Current date/time (injectable for testing)
 * @returns The best insight to show, or null if none should be shown
 */
export function selectBestInsight(
  candidates: SpendingInsight[],
  now: Date = new Date(),
): SpendingInsight | null {
  if (candidates.length === 0) return null
  if (!canShowInsight(now)) return null

  const recentTypes = getRecentInsightTypes(now)

  // Score each candidate: lower score = better
  const scored = candidates.map(insight => {
    let score = 0

    // 1. Tone priority (positive = 1, neutral = 2, cautionary = 3) × 10
    score += (TONE_PRIORITY[insight.tone] ?? 2) * 10

    // 2. Penalty for recently-shown type (most recent = highest penalty)
    const lastIndex = recentTypes.lastIndexOf(insight.type)
    if (lastIndex >= 0) {
      // More recent = higher penalty
      score += 5 + (recentTypes.length - lastIndex)
    }

    // 3. Declared priority as tiebreaker
    score += insight.priority

    return { insight, score }
  })

  // Sort by score ascending (lower = better)
  scored.sort((a, b) => a.score - b.score)

  return scored[0].insight
}
