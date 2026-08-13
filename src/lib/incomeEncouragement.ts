/**
 * Income Encouragement — Milestone celebrations & seasonal awareness
 *
 * Phase 11 — task 356
 *
 * 356.1: Income growth milestone + income record celebrations
 * 356.2: Best-earning period awareness (seasonal insight)
 *
 * Pure logic functions that produce CelebrationEvents or insight objects.
 * Dedup handled via the shared hasBeenTriggered / markTriggered helpers.
 */

import type { Transaction } from '@/types'
import type { CelebrationEvent } from '@/types/folio'
import { computeMonthlyIncomeTotals, computeIncomeGrowthMetrics } from '@/lib/incomeTrends'
import { hasBeenTriggered, markTriggered } from '@/lib/celebrationDedup'
import { CELEBRATION_EMOJI, CELEBRATION_COPY } from '@/lib/vocabulary'
import { toMonthString, shiftMonth } from '@/lib/budgetUtils'

// ============================================================================
// Types
// ============================================================================

/** Seasonal income insight returned by detectBestEarningPeriod */
export interface SeasonalIncomeInsight {
  /** Peak earning month name (e.g., "November") */
  month: string
  /** User-facing message */
  message: string
}

/** Seasonal income pattern from getSeasonalIncomePattern */
export interface SeasonalIncomePattern {
  /** Month number (1–12) with the highest average income */
  peakMonth: number
  /** Month number (1–12) with the lowest average income */
  lowestMonth: number
  /** Average income indexed by month number (1–12) */
  averageByMonth: Map<number, number>
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Minimum month-over-month growth % to trigger celebration */
const GROWTH_THRESHOLD = 10

/** Minimum months of data needed for seasonal awareness */
const MIN_MONTHS_FOR_SEASONAL = 6

// ============================================================================
// 356.1 — Income milestone celebrations
// ============================================================================

/**
 * Checks if income grew significantly month-over-month.
 *
 * Fires at most once per month when growth >= 10%.
 * Uses the last COMPLETED month vs. the one before it.
 */
export function checkIncomeGrowthMilestone(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const totals = computeMonthlyIncomeTotals(transactions, 3, now)
  const metrics = computeIncomeGrowthMetrics(totals, now)

  if (metrics.monthOverMonthChange === null) return null
  if (metrics.monthOverMonthChange < GROWTH_THRESHOLD) return null

  // ID uses the last completed month
  const currentMonth = toMonthString(now)
  const lastCompletedMonth = shiftMonth(currentMonth, -1)
  const id = `income-growth-${lastCompletedMonth}`

  if (hasBeenTriggered(id)) return null
  markTriggered(id)

  const pct = Math.round(metrics.monthOverMonthChange)
  const copy = CELEBRATION_COPY.income_growth

  return {
    id,
    type: 'income_growth',
    title: copy.title,
    message: `You made ${pct}% more this month than last — nice hustle`,
    emoji: CELEBRATION_EMOJI.income_growth,
    animation: 'sparkle',
    duration: 3000,
    sound: 'subtle',
  }
}

/**
 * Checks if the last completed month is the user's highest-earning month ever
 * (across up to 12 months of history).
 *
 * Fires at most once per month.
 */
export function checkIncomeRecordMonth(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const totals = computeMonthlyIncomeTotals(transactions, 12, now)
  const currentMonth = toMonthString(now)

  // Only look at completed months
  const completedMonths = totals.filter(m => m.month !== currentMonth)
  if (completedMonths.length < 2) return null // Need at least 2 months to compare

  const lastCompleted = completedMonths[completedMonths.length - 1]
  if (lastCompleted.total <= 0) return null

  // Check if the last completed month is strictly the highest
  const previousMonths = completedMonths.slice(0, -1)
  const isRecord = previousMonths.every(m => lastCompleted.total > m.total)
  if (!isRecord) return null

  const id = `income-record-${lastCompleted.month}`
  if (hasBeenTriggered(id)) return null
  markTriggered(id)

  const copy = CELEBRATION_COPY.income_record

  return {
    id,
    type: 'income_record',
    title: copy.title,
    message: 'New income record this month! 🎉',
    emoji: CELEBRATION_EMOJI.income_record,
    animation: 'confetti',
    duration: 4000,
    sound: 'cheerful',
  }
}

// ============================================================================
// 356.2 — Best-earning period awareness
// ============================================================================

/**
 * Computes income by month-of-year (Jan=1..Dec=12) averaging across available years.
 *
 * Returns the peak earning month, lowest earning month, and average by month.
 * Requires at least MIN_MONTHS_FOR_SEASONAL months of data with income.
 */
export function getSeasonalIncomePattern(
  transactions: Transaction[],
  now: Date = new Date()
): SeasonalIncomePattern | null {
  const totals = computeMonthlyIncomeTotals(transactions, 12, now)
  const currentMonth = toMonthString(now)

  // Only use completed months with income
  const completed = totals.filter(m => m.month !== currentMonth && m.total > 0)
  if (completed.length < MIN_MONTHS_FOR_SEASONAL) return null

  // Group income by month-of-year
  const sumByMonth = new Map<number, number>()
  const countByMonth = new Map<number, number>()

  for (const entry of completed) {
    const monthNum = parseInt(entry.month.split('-')[1], 10) // 1–12
    sumByMonth.set(monthNum, (sumByMonth.get(monthNum) ?? 0) + entry.total)
    countByMonth.set(monthNum, (countByMonth.get(monthNum) ?? 0) + 1)
  }

  // Compute averages
  const averageByMonth = new Map<number, number>()
  let peakMonth = 1
  let peakAvg = 0
  let lowestMonth = 1
  let lowestAvg = Infinity

  for (const [monthNum, sum] of sumByMonth.entries()) {
    const count = countByMonth.get(monthNum) ?? 1
    const avg = Math.round((sum / count) * 100) / 100
    averageByMonth.set(monthNum, avg)

    if (avg > peakAvg) {
      peakAvg = avg
      peakMonth = monthNum
    }
    if (avg < lowestAvg) {
      lowestAvg = avg
      lowestMonth = monthNum
    }
  }

  return { peakMonth, lowestMonth, averageByMonth }
}

/**
 * Detects if the user is approaching their historically best-earning period
 * and surfaces an awareness message.
 *
 * Fires when the current month is 1–2 months BEFORE the peak earning month.
 * Suggests setting aside extra for leaner months ahead.
 */
export function detectBestEarningPeriod(
  transactions: Transaction[],
  now: Date = new Date()
): SeasonalIncomeInsight | null {
  const pattern = getSeasonalIncomePattern(transactions, now)
  if (!pattern) return null

  const currentMonthNum = now.getMonth() + 1 // 1–12

  // Check if we're 1 or 2 months before the peak month
  const monthsUntilPeak = getMonthsUntil(currentMonthNum, pattern.peakMonth)
  if (monthsUntilPeak < 1 || monthsUntilPeak > 2) return null

  const peakName = MONTH_NAMES[pattern.peakMonth]

  // Suggest saving for the month AFTER the peak (which tends to be lower)
  const monthAfterPeak = pattern.peakMonth === 12 ? 1 : pattern.peakMonth + 1
  const afterPeakName = MONTH_NAMES[monthAfterPeak]

  return {
    month: peakName,
    message: `You tend to earn most in ${peakName} — maybe set aside extra for ${afterPeakName}.`,
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Calculates months from `from` to `to` going forward (wrapping at 12).
 * E.g., from=10, to=12 → 2; from=11, to=1 → 2
 */
function getMonthsUntil(from: number, to: number): number {
  if (to > from) return to - from
  return 12 - from + to
}
