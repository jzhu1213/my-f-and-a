import type { Transaction } from '@/types'
import { parseDateLocal, formatDateLocal } from '@/lib/dateUtils'

/**
 * Income pattern analyzer — detects regularity, average amounts, and confidence
 * from historical income transactions, then projects future income with a
 * confidence band.
 *
 * This module is intentionally PURE: no I/O, no Supabase, no side effects. It
 * analyzes income transaction history and produces projections that downstream
 * features (allowance engine, cash-flow forecasts) can consume.
 *
 * **Validates: Requirements 18.1**
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Detected regularity of income deposits.
 * - `weekly`     — income arrives roughly every 7 days
 * - `biweekly`   — income arrives roughly every 14 days
 * - `monthly`    — income arrives roughly every 28–31 days
 * - `irregular`  — no consistent pattern detected
 */
export type IncomeRegularity = 'weekly' | 'biweekly' | 'monthly' | 'irregular'

/**
 * Result of income pattern analysis including projected monthly income
 * and a confidence band.
 */
export interface IncomePatternResult {
  /** Detected regularity (weekly / biweekly / monthly / irregular) */
  regularity: IncomeRegularity
  /** Average income amount per detected period */
  averagePerPeriod: number
  /** Confidence level 0–1 (high >= 0.7, medium >= 0.4, low < 0.4) */
  confidence: number
  /** Projected total monthly income for the target month */
  projectedMonthlyIncome: number
  /** Confidence band: low/high based on historical min/max */
  confidenceBand: { low: number; high: number }
}

// ============================================================================
// Constants
// ============================================================================

/** Number of months to look back for income history (maximum window). */
const MAX_LOOKBACK_MONTHS = 4

/** Minimum number of income transactions required for meaningful analysis. */
const MIN_TRANSACTIONS_FOR_ANALYSIS = 4

/** Day tolerance when detecting regularity (± days from expected interval). */
const REGULARITY_TOLERANCE_DAYS = 3

/** Average days per month for projections. */
const AVG_DAYS_PER_MONTH = 30.44

// ============================================================================
// Internal helpers
// ============================================================================

/** Compute the coefficient of variation (stddev / mean). Returns 0 if mean is 0. */
function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 1
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean === 0) return 1
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}

/** Compute day difference between two dates (b - a) in local time. */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  // Normalize to midnight to avoid DST edge cases
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((bStart.getTime() - aStart.getTime()) / msPerDay)
}

/**
 * Filter income transactions within the lookback window (last 2–4 months from
 * the reference date). Returns transactions sorted by date ascending.
 */
function getRecentIncomeTransactions(
  transactions: Transaction[],
  referenceDate: Date
): Transaction[] {
  const cutoff = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - MAX_LOOKBACK_MONTHS,
    referenceDate.getDate()
  )
  const cutoffStr = formatDateLocal(cutoff)

  return transactions
    .filter((t) => t.type === 'income' && t.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ============================================================================
// Core analysis
// ============================================================================

/**
 * Detect income regularity from a set of income transactions.
 *
 * Analyzes intervals between consecutive income deposits and classifies them
 * as weekly (~7d), biweekly (~14d), monthly (~30d), or irregular.
 *
 * Pure: does not mutate input.
 *
 * **Validates: Requirements 18.1**
 *
 * @param transactions All transactions (will be filtered to income only in the
 *                     last 4 months).
 * @param referenceDate The date to measure "recent" from (defaults to today).
 * @returns The detected regularity pattern.
 */
export function detectIncomeRegularity(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): IncomeRegularity {
  const incomes = getRecentIncomeTransactions(transactions, referenceDate)

  if (incomes.length < 2) {
    return 'irregular'
  }

  // Compute intervals between consecutive income dates
  const intervals: number[] = []
  for (let i = 1; i < incomes.length; i++) {
    const days = daysBetween(
      parseDateLocal(incomes[i - 1].date),
      parseDateLocal(incomes[i].date)
    )
    if (days > 0) {
      intervals.push(days)
    }
  }

  if (intervals.length === 0) {
    return 'irregular'
  }

  const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length

  // Check how many intervals fall within tolerance of each cadence
  const cadences: { regularity: IncomeRegularity; expected: number }[] = [
    { regularity: 'weekly', expected: 7 },
    { regularity: 'biweekly', expected: 14 },
    { regularity: 'monthly', expected: 30 },
  ]

  // Pick the cadence where the average interval best fits
  let bestMatch: IncomeRegularity = 'irregular'
  let bestMatchScore = 0

  for (const { regularity, expected } of cadences) {
    const matchingIntervals = intervals.filter(
      (d) => Math.abs(d - expected) <= REGULARITY_TOLERANCE_DAYS
    )
    const score = matchingIntervals.length / intervals.length

    // Require at least 60% of intervals to match AND the average to be close
    if (
      score > bestMatchScore &&
      score >= 0.6 &&
      Math.abs(avgInterval - expected) <= REGULARITY_TOLERANCE_DAYS * 2
    ) {
      bestMatch = regularity
      bestMatchScore = score
    }
  }

  return bestMatch
}

// ============================================================================
// Projection
// ============================================================================

/**
 * Analyze income patterns and project income for a target month.
 *
 * Examines the last 2–4 months of income transactions to detect regularity,
 * average amount per period, and confidence level. Returns a projection with
 * a confidence band (low/high) based on historical variance.
 *
 * Confidence thresholds:
 * - high  >= 0.7 — consistent paychecks, predictable pattern
 * - medium >= 0.4 — mostly regular with some variation
 * - low   < 0.4 — sporadic or insufficient data
 *
 * When fewer than 4 income transactions exist in the window, returns
 * confidence = 0 (insufficient data).
 *
 * Pure: no side effects, deterministic given the same inputs.
 *
 * **Validates: Requirements 18.1**
 *
 * @param transactions  All user transactions (income + expense).
 * @param targetMonth   The month to project income for (any Date within that month).
 * @returns Income pattern analysis and projection result.
 */
export function getIncomeProjection(
  transactions: Transaction[],
  targetMonth: Date
): IncomePatternResult {
  // Use the target month as reference for "recent" lookback
  const referenceDate = targetMonth
  const incomes = getRecentIncomeTransactions(transactions, referenceDate)

  // Insufficient data: return zero-confidence result
  if (incomes.length < MIN_TRANSACTIONS_FOR_ANALYSIS) {
    return {
      regularity: 'irregular',
      averagePerPeriod: 0,
      confidence: 0,
      projectedMonthlyIncome: 0,
      confidenceBand: { low: 0, high: 0 },
    }
  }

  // Step 1: Detect regularity
  const regularity = detectIncomeRegularity(transactions, referenceDate)

  // Step 2: Compute intervals and amounts
  const amounts = incomes.map((t) => t.amount)
  const intervals: number[] = []
  for (let i = 1; i < incomes.length; i++) {
    const days = daysBetween(
      parseDateLocal(incomes[i - 1].date),
      parseDateLocal(incomes[i].date)
    )
    if (days > 0) {
      intervals.push(days)
    }
  }

  // Step 3: Compute average amount per period
  const averagePerPeriod = amounts.reduce((s, a) => s + a, 0) / amounts.length

  // Step 4: Calculate confidence based on consistency
  // Coefficient of variation of amounts (lower = more consistent)
  const amountCV = coefficientOfVariation(amounts)

  // Coefficient of variation of intervals (lower = more regular timing)
  const intervalCV = intervals.length > 0 ? coefficientOfVariation(intervals) : 1

  // Confidence formula: penalize high variability in both amounts and timing.
  // Each CV contributes equally. Perfect consistency (CV=0) → confidence=1.
  // We clamp to [0, 1].
  const rawConfidence = Math.max(0, 1 - (amountCV * 0.5 + intervalCV * 0.5))
  const confidence = Math.min(1, Math.max(0, rawConfidence))

  // Step 5: Project monthly income for the target month
  const avgInterval =
    intervals.length > 0
      ? intervals.reduce((s, d) => s + d, 0) / intervals.length
      : AVG_DAYS_PER_MONTH

  // How many pay periods fit in one month?
  const periodsPerMonth = AVG_DAYS_PER_MONTH / Math.max(1, avgInterval)
  const projectedMonthlyIncome = averagePerPeriod * periodsPerMonth

  // Step 6: Confidence band based on historical min/max amounts scaled to monthly
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)
  const confidenceBand = {
    low: minAmount * periodsPerMonth,
    high: maxAmount * periodsPerMonth,
  }

  return {
    regularity,
    averagePerPeriod: Math.round(averagePerPeriod * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    projectedMonthlyIncome: Math.round(projectedMonthlyIncome * 100) / 100,
    confidenceBand: {
      low: Math.round(confidenceBand.low * 100) / 100,
      high: Math.round(confidenceBand.high * 100) / 100,
    },
  }
}
