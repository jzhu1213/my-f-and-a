import type { Transaction } from '@/types'
import type { RhythmWeights } from '@/types/folio'
import { isFixedTransaction } from '@/lib/fixedExpenses'
import { parseDateLocal, subtractDaysLocal, formatDateLocal } from '@/lib/dateUtils'

// ============================================================================
// Rhythm Model — Weekly Spending Pattern Analysis (Task 164.1)
// ============================================================================
//
// Learns each user's day-of-week spending rhythm from their transaction history.
// The model produces 7 weights (Sun=0 through Sat=6) that represent relative
// spending intensity per day of the week.
//
// Design principles:
//   • Pure functions — no Date.now(), no side effects, no external state
//   • Stable output — weights are capped to [0.5, 2.0] to prevent wild swings
//   • Graceful fallback — returns null with insufficient history (<4 weeks)
//   • Opt-in — callers can ignore rhythm weights entirely for flat behavior
//
// ============================================================================

/** Minimum weeks of data required for a reliable model */
const MIN_WEEKS_FOR_RELIABILITY = 4

/** Default trailing window (in weeks) used to compute the model */
const DEFAULT_WINDOW_WEEKS = 8

/** Weight floor — no day can be less than 50% of the mean */
const WEIGHT_MIN = 0.5

/** Weight ceiling — no day can be more than 200% of the mean */
const WEIGHT_MAX = 2.0

/**
 * Computes day-of-week spending rhythm weights from transaction history.
 *
 * Filters to expense transactions only (excluding fixed/recurring), groups by
 * day-of-week using the transaction's `date` field, and normalizes weights so
 * they sum to 7.0 (average = 1.0).
 *
 * @param transactions - All user transactions
 * @param currentDate - The reference date (determines the trailing window end)
 * @param windowWeeks - Number of trailing weeks to analyze (default: 8)
 * @returns RhythmWeights if sufficient data exists, or null otherwise
 */
export function computeRhythmWeights(
  transactions: Transaction[],
  currentDate: Date,
  windowWeeks: number = DEFAULT_WINDOW_WEEKS
): RhythmWeights | null {
  // Determine the trailing window: from (currentDate - windowWeeks*7 days) to yesterday
  const windowDays = windowWeeks * 7
  const windowStart = subtractDaysLocal(currentDate, windowDays)
  const windowStartStr = formatDateLocal(windowStart)
  // Exclude today — only use completed days for the model
  const yesterdayStr = formatDateLocal(subtractDaysLocal(currentDate, 1))

  // Filter to discretionary expenses within the window
  const relevantExpenses = transactions.filter(t =>
    t.type === 'expense' &&
    !isFixedTransaction(t) &&
    t.date >= windowStartStr &&
    t.date <= yesterdayStr
  )

  // If no expenses at all, can't compute a model
  if (relevantExpenses.length === 0) {
    return null
  }

  // Determine actual weeks of data available
  // Use the date span from earliest transaction to yesterday
  const earliestTxDate = relevantExpenses.reduce(
    (min, t) => t.date < min ? t.date : min,
    relevantExpenses[0].date
  )
  const earliestDate = parseDateLocal(earliestTxDate)
  const daySpan = Math.max(1, Math.round(
    (parseDateLocal(yesterdayStr).getTime() - earliestDate.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1)
  const weeksOfData = Math.floor(daySpan / 7)

  // Insufficient history — require at least MIN_WEEKS_FOR_RELIABILITY weeks
  const isReliable = weeksOfData >= MIN_WEEKS_FOR_RELIABILITY

  // Group total spending by day-of-week (0=Sun, 6=Sat)
  const dayTotals: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]

  for (const tx of relevantExpenses) {
    const txDate = parseDateLocal(tx.date)
    const dayOfWeek = txDate.getDay() // 0=Sun, 6=Sat
    dayTotals[dayOfWeek] += tx.amount
  }

  // Count how many times each day-of-week appears in the window (for averaging)
  // Walk through the window day by day to count occurrences of each weekday
  const dayOccurrences: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
  let walkDate = new Date(windowStart.getTime())
  const yesterdayDate = parseDateLocal(yesterdayStr)
  while (walkDate <= yesterdayDate) {
    dayOccurrences[walkDate.getDay()]++
    walkDate = new Date(walkDate.getFullYear(), walkDate.getMonth(), walkDate.getDate() + 1)
  }

  // Compute average daily spend per day-of-week
  // Use occurrence count to normalize (so weeks with fewer data points are handled)
  const dayAverages: number[] = new Array(7)
  for (let i = 0; i < 7; i++) {
    if (dayOccurrences[i] > 0) {
      dayAverages[i] = dayTotals[i] / dayOccurrences[i]
    } else {
      dayAverages[i] = 0
    }
  }

  // Compute the overall daily average across all days
  const totalAverage = dayAverages.reduce((sum, v) => sum + v, 0) / 7

  // If overall average is zero (no spending), return flat weights
  if (totalAverage <= 0) {
    return {
      weights: [1, 1, 1, 1, 1, 1, 1],
      weeksOfData,
      isReliable,
    }
  }

  // Compute raw weights (relative to the overall average)
  const rawWeights: number[] = dayAverages.map(avg => avg / totalAverage)

  // Clamp weights to [WEIGHT_MIN, WEIGHT_MAX] for stability
  const clampedWeights = rawWeights.map(w => Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w)))

  // Re-normalize so they sum to exactly 7.0
  const clampedSum = clampedWeights.reduce((sum, w) => sum + w, 0)
  const normalizedWeights = clampedWeights.map(w => (w / clampedSum) * 7) as [number, number, number, number, number, number, number]

  return {
    weights: normalizedWeights,
    weeksOfData,
    isReliable,
  }
}

/**
 * Computes the rhythm-adjusted daily budget for a given day of the week.
 *
 * Takes the flat `dailyBudget` (pool / effectiveDays) and multiplies by the
 * rhythm weight for the specified day. This means high-spend days (e.g., weekends)
 * get a larger allowance, while quiet days (e.g., mid-week) get less.
 *
 * @param dailyBudget - The flat daily budget (before rhythm adjustment)
 * @param rhythmWeights - The computed rhythm weights
 * @param dayOfWeek - Day of the week (0=Sun, 6=Sat)
 * @returns Adjusted daily budget for that day
 */
export function computeRhythmAdjustedBudget(
  dailyBudget: number,
  rhythmWeights: RhythmWeights,
  dayOfWeek: number
): number {
  const weight = rhythmWeights.weights[dayOfWeek]
  return dailyBudget * weight
}
