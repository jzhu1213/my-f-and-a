/**
 * Confidence Score Engine — a gentle, positive-slope financial confidence metric.
 *
 * The score (0–100) reflects positive financial habits across five factors:
 *  - Logging consistency (are you tracking regularly?)
 *  - Allowance adherence (staying at or under your daily amount)
 *  - Savings progress (contributions toward goals/funds)
 *  - Bill punctuality (bills paid before due date)
 *  - Engagement streak (consecutive days/weeks of app use)
 *
 * Design principles:
 *  - **Positive-slope only**: doing more raises the score; inactivity keeps it
 *    static. Only tracked overspending decreases it, and even then gently.
 *  - **Opt-in**: hidden by default, surfaced only when the user explicitly enables it.
 *  - **Warm framing**: presented as a "money confidence journal", never a credit score.
 *  - **Never punitive**: the lowest tier is "Building" — always encouraging.
 *
 * Requirements: 19.7
 */

import type { Transaction, Budget, Goal } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"

// ============================================================================
// Types
// ============================================================================

/** Confidence tier labels — always warm and encouraging. */
export type ConfidenceTier = "Building" | "Growing" | "Thriving" | "Confident"

/** Individual factor scores (each 0–100 internally, then weighted). */
export interface ConfidenceFactors {
  /** How regularly the user logs transactions (0–100). */
  loggingConsistency: number
  /** How well the user stays at or under their daily allowance (0–100). */
  allowanceAdherence: number
  /** Progress toward savings goals and funds (0–100). */
  savingsProgress: number
  /** Bills paid before their due date (0–100). */
  billPunctuality: number
  /** Consecutive days/weeks of app engagement (0–100). */
  engagementStreak: number
}

/** The computed confidence score with tier and factors. */
export interface ConfidenceScore {
  /** Numeric score 0–100. */
  score: number
  /** Human-friendly tier label. */
  tier: ConfidenceTier
  /** Breakdown by factor. */
  factors: ConfidenceFactors
  /** ISO timestamp of when this was computed. */
  computedAt: string
}

/** A single weekly snapshot in the score history. */
export interface ConfidenceHistoryEntry {
  /** ISO week key, e.g. "2024-W52". */
  weekKey: string
  /** The score at the time of the snapshot. */
  score: number
  /** Tier at the time of the snapshot. */
  tier: ConfidenceTier
  /** Factor breakdown at the time of the snapshot. */
  factors: ConfidenceFactors
  /** ISO timestamp when the snapshot was taken. */
  recordedAt: string
}

/** Persisted confidence history. */
export interface ConfidenceHistory {
  /** Whether the user has opted into the confidence score. */
  enabled: boolean
  /** Weekly score snapshots (oldest first). */
  entries: ConfidenceHistoryEntry[]
  /** Last computed score (for quick access without full recalc). */
  lastScore: ConfidenceScore | null
}

/** Result of tier transition detection. */
export interface TierTransition {
  /** Previous tier before the change. */
  from: ConfidenceTier
  /** New tier after the change. */
  to: ConfidenceTier
  /** Warm celebration message for the user. */
  message: string
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_confidence_history"

/** Factor weights (must sum to 1.0). */
const WEIGHTS = {
  loggingConsistency: 0.25,
  allowanceAdherence: 0.25,
  savingsProgress: 0.20,
  billPunctuality: 0.15,
  engagementStreak: 0.15,
} as const

/** Tier thresholds. */
const TIER_THRESHOLDS: { min: number; tier: ConfidenceTier }[] = [
  { min: 76, tier: "Confident" },
  { min: 51, tier: "Thriving" },
  { min: 26, tier: "Growing" },
  { min: 0, tier: "Building" },
]

/** Number of recent days to consider for logging/adherence factors. */
const LOOKBACK_DAYS = 30

/** Maximum weekly entries to retain in history. */
const MAX_HISTORY_ENTRIES = 52

// ============================================================================
// Tier helpers
// ============================================================================

/** Map a numeric score (0–100) to a tier label. */
export function getTier(score: number): ConfidenceTier {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (clamped >= min) return tier
  }
  return "Building"
}

/** Warm celebration messages for tier transitions. */
function getTierTransitionMessage(from: ConfidenceTier, to: ConfidenceTier): string {
  const messages: Record<string, string> = {
    "Building→Growing": "You moved from Building to Growing — you're doing it!",
    "Growing→Thriving": "You've reached Thriving — your habits are really paying off!",
    "Thriving→Confident": "Welcome to Confident — you've built something amazing!",
    "Building→Thriving": "Wow, straight to Thriving — look at you go!",
    "Building→Confident": "All the way to Confident — incredible progress!",
    "Growing→Confident": "From Growing to Confident — your consistency shows!",
  }
  return messages[`${from}→${to}`] ?? `You moved to ${to} — keep it up!`
}

// ============================================================================
// Factor Calculations
// ============================================================================

/**
 * Logging consistency: How many of the last 30 days had at least one transaction logged.
 * More days logged = higher score. No logging = stays at baseline (not punished).
 */
export function calculateLoggingConsistency(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) return 0

  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Count unique days with at least one transaction in the lookback window
  const daysWithActivity = new Set<string>()
  for (const tx of transactions) {
    const txDate = tx.date ?? tx.createdAt?.slice(0, 10)
    if (txDate && txDate >= cutoffStr) {
      daysWithActivity.add(txDate)
    }
  }

  // Score: proportion of days with logging activity
  // 20+ days out of 30 = full score; scale linearly
  const activeDays = daysWithActivity.size
  const score = Math.min(100, (activeDays / 20) * 100)
  return Math.round(score)
}

/**
 * Allowance adherence: How often the user stayed within their daily budget.
 * Positive-slope: days within budget raise the score.
 * Overspending gently decreases it (half-weight penalty).
 */
export function calculateAllowanceAdherence(
  transactions: Transaction[],
  budgets: Budget[]
): number {
  if (!transactions || transactions.length === 0) return 50 // Neutral start
  if (!budgets || budgets.length === 0) return 50

  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Get total monthly budget limit
  const totalMonthlyLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  if (totalMonthlyLimit <= 0) return 50

  const dailyBudget = totalMonthlyLimit / 30

  // Group expenses by day within the lookback window
  const daySpending = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== "expense") continue
    const txDate = tx.date ?? tx.createdAt?.slice(0, 10)
    if (!txDate || txDate < cutoffStr) continue
    daySpending.set(txDate, (daySpending.get(txDate) ?? 0) + tx.amount)
  }

  if (daySpending.size === 0) return 50

  // Score each day: within budget = +1, over budget = -0.5 (gentle penalty)
  let withinDays = 0
  let overDays = 0
  for (const [, spent] of daySpending) {
    if (spent <= dailyBudget) {
      withinDays++
    } else {
      overDays++
    }
  }

  const totalDays = withinDays + overDays
  if (totalDays === 0) return 50

  // Positive-slope: each within-budget day adds full weight, over-budget adds half-weight penalty
  const rawScore = (withinDays - overDays * 0.5) / totalDays
  const score = Math.max(0, Math.min(100, 50 + rawScore * 50))
  return Math.round(score)
}

/**
 * Savings progress: How close the user is to their goals, weighted by activity.
 * Having goals and making contributions raises the score.
 * No goals = neutral (50), not penalized.
 */
export function calculateSavingsProgress(goals: Goal[]): number {
  if (!goals || goals.length === 0) return 50 // No goals = neutral, not penalized

  // Calculate average progress across all goals
  let totalProgress = 0
  let goalCount = 0

  for (const goal of goals) {
    if (goal.targetAmount > 0) {
      const progress = Math.min(1, goal.currentAmount / goal.targetAmount)
      totalProgress += progress
      goalCount++
    }
  }

  if (goalCount === 0) return 50

  const avgProgress = totalProgress / goalCount
  // Scale: 0% progress = 30, 50% = 65, 100% = 100
  const score = 30 + avgProgress * 70
  return Math.round(Math.min(100, score))
}

/**
 * Bill punctuality: Proportion of bills that were paid before their due date.
 * No bills = full score (100) — not having bills to worry about is positive.
 * Paid on time = positive. Missed = gentle decrease.
 */
export function calculateBillPunctuality(
  bills: FixedExpense[],
  transactions: Transaction[]
): number {
  if (!bills || bills.length === 0) return 100 // No bills = perfect score

  const activeBills = bills.filter((b) => b.isActive)
  if (activeBills.length === 0) return 100

  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM
  const currentDay = now.getDate()

  // Check each active bill's due status this month
  let paidOnTime = 0
  let duePassed = 0

  for (const bill of activeBills) {
    // Only consider bills whose due day has passed this month
    if (bill.dueDay > currentDay) continue

    duePassed++

    // Check if there's a matching transaction for this bill this month
    const billPaid = transactions.some((tx) => {
      if (tx.type !== "expense") return false
      const txDate = tx.date ?? tx.createdAt?.slice(0, 10)
      if (!txDate || !txDate.startsWith(currentMonth)) return false

      // Match by recurring ID or by amount + category
      if (tx.recurringId === bill.recurringId) return true
      if (
        tx.category === bill.category &&
        Math.abs(tx.amount - bill.amount) < 1
      ) {
        // Paid on or before due day
        const txDay = parseInt(txDate.slice(8, 10), 10)
        return txDay <= bill.dueDay
      }
      return false
    })

    if (billPaid) paidOnTime++
  }

  if (duePassed === 0) return 100 // No bills due yet this month

  const score = (paidOnTime / duePassed) * 100
  return Math.round(score)
}

/**
 * Engagement streak: How consistently the user has been using the app.
 * Based on recent transaction logging frequency (proxy for app engagement).
 * Longer streaks = higher score. Gaps don't decrease — just stop growing.
 */
export function calculateEngagementStreak(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) return 0

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Build a set of dates with any activity in the last 30 days
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const activeDates = new Set<string>()
  for (const tx of transactions) {
    const txDate = tx.date ?? tx.createdAt?.slice(0, 10)
    if (txDate && txDate >= cutoffStr && txDate <= todayStr) {
      activeDates.add(txDate)
    }
  }

  if (activeDates.size === 0) return 0

  // Calculate current streak (consecutive days ending today or yesterday)
  let streak = 0
  const checkDate = new Date(now)

  // Allow a 1-day grace period (yesterday counts as "still active")
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (activeDates.has(dateStr)) {
      streak++
    } else if (i > 1) {
      // Allow 1 day gap (grace period), but break on 2+ day gap
      break
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Score: 7-day streak = 50, 14-day = 75, 21+ = 100
  if (streak >= 21) return 100
  if (streak >= 14) return 75 + Math.round(((streak - 14) / 7) * 25)
  if (streak >= 7) return 50 + Math.round(((streak - 7) / 7) * 25)
  return Math.round((streak / 7) * 50)
}

// ============================================================================
// Main Calculation
// ============================================================================

/** Input data for computing the confidence score. */
export interface ConfidenceScoreInput {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  bills: FixedExpense[]
}

/**
 * Compute the overall confidence score from the user's financial data.
 * Returns a ConfidenceScore with the numeric value, tier, and factor breakdown.
 */
export function computeConfidenceScore(input: ConfidenceScoreInput): ConfidenceScore {
  const { transactions, budgets, goals, bills } = input

  const factors: ConfidenceFactors = {
    loggingConsistency: calculateLoggingConsistency(transactions),
    allowanceAdherence: calculateAllowanceAdherence(transactions, budgets),
    savingsProgress: calculateSavingsProgress(goals),
    billPunctuality: calculateBillPunctuality(bills, transactions),
    engagementStreak: calculateEngagementStreak(transactions),
  }

  // Weighted sum
  const score = Math.round(
    factors.loggingConsistency * WEIGHTS.loggingConsistency +
      factors.allowanceAdherence * WEIGHTS.allowanceAdherence +
      factors.savingsProgress * WEIGHTS.savingsProgress +
      factors.billPunctuality * WEIGHTS.billPunctuality +
      factors.engagementStreak * WEIGHTS.engagementStreak
  )

  const clampedScore = Math.max(0, Math.min(100, score))

  return {
    score: clampedScore,
    tier: getTier(clampedScore),
    factors,
    computedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Persistence — localStorage
// ============================================================================

/** Load the confidence history from localStorage. */
export function getConfidenceHistory(): ConfidenceHistory {
  if (typeof window === "undefined") {
    return { enabled: false, entries: [], lastScore: null }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { enabled: false, entries: [], lastScore: null }
    const parsed = JSON.parse(stored) as ConfidenceHistory
    if (parsed && typeof parsed.enabled === "boolean" && Array.isArray(parsed.entries)) {
      return parsed
    }
    return { enabled: false, entries: [], lastScore: null }
  } catch {
    return { enabled: false, entries: [], lastScore: null }
  }
}

/** Save the confidence history to localStorage. */
function setConfidenceHistory(history: ConfidenceHistory): void {
  if (typeof window === "undefined") return
  try {
    // Cap entries to prevent unbounded growth
    const capped =
      history.entries.length > MAX_HISTORY_ENTRIES
        ? history.entries.slice(-MAX_HISTORY_ENTRIES)
        : history.entries
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...history, entries: capped })
    )
  } catch {
    // localStorage unavailable — fail silently
  }
}

/** Enable or disable the confidence score feature. */
export function setConfidenceEnabled(enabled: boolean): void {
  const history = getConfidenceHistory()
  setConfidenceHistory({ ...history, enabled })
}

/** Check if the confidence score feature is enabled. */
export function isConfidenceEnabled(): boolean {
  return getConfidenceHistory().enabled
}

// ============================================================================
// Weekly Snapshots
// ============================================================================

/** Get the ISO week key for a given date (e.g. "2024-W52"). */
export function getWeekKey(date: Date = new Date()): string {
  // ISO week calculation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

/**
 * Record a weekly snapshot of the current confidence score.
 * Only records once per week (deduplicates by weekKey).
 * Returns a TierTransition if the tier changed from the previous entry.
 */
export function recordWeeklySnapshot(
  score: ConfidenceScore
): TierTransition | null {
  const history = getConfidenceHistory()
  if (!history.enabled) return null

  const weekKey = getWeekKey()

  // Don't duplicate entries for the same week
  const existingIdx = history.entries.findIndex((e) => e.weekKey === weekKey)
  const entry: ConfidenceHistoryEntry = {
    weekKey,
    score: score.score,
    tier: score.tier,
    factors: score.factors,
    recordedAt: new Date().toISOString(),
  }

  if (existingIdx >= 0) {
    // Update existing entry for this week
    history.entries[existingIdx] = entry
  } else {
    history.entries.push(entry)
  }

  // Detect tier transition
  let transition: TierTransition | null = null
  if (history.entries.length >= 2 && existingIdx < 0) {
    const previousEntry = history.entries[history.entries.length - 2]
    if (previousEntry && previousEntry.tier !== score.tier) {
      // Only celebrate upward transitions
      const tierOrder: ConfidenceTier[] = ["Building", "Growing", "Thriving", "Confident"]
      const prevIdx = tierOrder.indexOf(previousEntry.tier)
      const newIdx = tierOrder.indexOf(score.tier)
      if (newIdx > prevIdx) {
        transition = {
          from: previousEntry.tier,
          to: score.tier,
          message: getTierTransitionMessage(previousEntry.tier, score.tier),
        }
      }
    }
  }

  // Update last score
  history.lastScore = score
  setConfidenceHistory(history)

  return transition
}

/**
 * Get the score trend direction from recent history.
 * Returns "up", "stable", or "down" based on the last few weeks.
 */
export function getScoreTrend(
  history?: ConfidenceHistory
): "up" | "stable" | "down" {
  const h = history ?? getConfidenceHistory()
  if (h.entries.length < 2) return "stable"

  // Compare last 2 entries
  const recent = h.entries.slice(-2)
  const diff = recent[1].score - recent[0].score

  if (diff >= 3) return "up"
  if (diff <= -3) return "down"
  return "stable"
}

/**
 * Get the last recorded score without recomputing.
 * Returns null if no score has been recorded yet.
 */
export function getLastConfidenceScore(): ConfidenceScore | null {
  return getConfidenceHistory().lastScore
}
