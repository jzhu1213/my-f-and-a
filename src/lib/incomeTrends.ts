/**
 * Income Trends — Pure utility functions
 *
 * Computes monthly income totals and growth metrics for the Income Trends
 * visualization. Intentionally PURE: no I/O, no side effects.
 *
 * Phase 11 — task 355
 */

import type { Transaction } from '@/types'
import { toMonthString, shiftMonth } from '@/lib/budgetUtils'

// ============================================================================
// Types
// ============================================================================

export interface MonthlyIncomeTotal {
  /** Month in YYYY-MM format */
  month: string
  /** Total income for the month */
  total: number
}

export interface IncomeGrowthMetrics {
  /** Month-over-month percentage change (null if insufficient data) */
  monthOverMonthChange: number | null
  /** Best-earning month (null if no income data) */
  bestMonth: { month: string; total: number } | null
  /** Average monthly income across the window */
  averageMonthly: number
  /** Income earned so far this month */
  currentMonthPace: number
  /** Projected income for the current month based on pace */
  currentMonthProjection: number
}

// ============================================================================
// Core functions
// ============================================================================

/**
 * Compute monthly income totals for the last N months.
 *
 * Returns an array ordered chronologically (oldest first). Months with zero
 * income are included so the chart has no gaps.
 *
 * @param transactions All user transactions.
 * @param monthsBack  Number of months to look back (default 6).
 * @param referenceDate Date to measure from (default: today).
 * @returns Array of monthly income totals.
 */
export function computeMonthlyIncomeTotals(
  transactions: Transaction[],
  monthsBack = 6,
  referenceDate: Date = new Date()
): MonthlyIncomeTotal[] {
  const currentMonth = toMonthString(referenceDate)

  // Build set of months to report on
  const months: string[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    months.push(shiftMonth(currentMonth, -i))
  }

  // Sum income per month
  const incomeByMonth = new Map<string, number>()
  for (const month of months) {
    incomeByMonth.set(month, 0)
  }

  for (const t of transactions) {
    if (t.type !== 'income') continue
    const txMonth = t.date.slice(0, 7) // YYYY-MM
    if (incomeByMonth.has(txMonth)) {
      incomeByMonth.set(txMonth, incomeByMonth.get(txMonth)! + t.amount)
    }
  }

  return months.map((month) => ({
    month,
    total: Math.round((incomeByMonth.get(month) ?? 0) * 100) / 100,
  }))
}

/**
 * Compute income growth metrics from monthly totals.
 *
 * Design note: only surfaces positive or neutral metrics. Month-over-month
 * change is included even if negative (the UI decides what to show), but
 * the caller should only render it when >= 0.
 *
 * @param monthlyTotals Array from computeMonthlyIncomeTotals (chronological).
 * @param referenceDate Date to measure current month pace from.
 * @returns Growth metrics object.
 */
export function computeIncomeGrowthMetrics(
  monthlyTotals: MonthlyIncomeTotal[],
  referenceDate: Date = new Date()
): IncomeGrowthMetrics {
  if (monthlyTotals.length === 0) {
    return {
      monthOverMonthChange: null,
      bestMonth: null,
      averageMonthly: 0,
      currentMonthPace: 0,
      currentMonthProjection: 0,
    }
  }

  const currentMonth = toMonthString(referenceDate)
  const currentEntry = monthlyTotals.find((m) => m.month === currentMonth)
  const currentMonthPace = currentEntry?.total ?? 0

  // Prior completed months (exclude current month for averages/best)
  const completedMonths = monthlyTotals.filter((m) => m.month !== currentMonth)

  // Best month (from completed months only)
  let bestMonth: { month: string; total: number } | null = null
  for (const m of completedMonths) {
    if (m.total > 0 && (!bestMonth || m.total > bestMonth.total)) {
      bestMonth = { month: m.month, total: m.total }
    }
  }

  // Average monthly income (completed months with income > 0)
  const monthsWithIncome = completedMonths.filter((m) => m.total > 0)
  const averageMonthly =
    monthsWithIncome.length > 0
      ? Math.round(
          (monthsWithIncome.reduce((sum, m) => sum + m.total, 0) / monthsWithIncome.length) * 100
        ) / 100
      : 0

  // Month-over-month change: compare last completed month to the one before it
  let monthOverMonthChange: number | null = null
  if (completedMonths.length >= 2) {
    const lastMonth = completedMonths[completedMonths.length - 1]
    const prevMonth = completedMonths[completedMonths.length - 2]
    if (prevMonth.total > 0) {
      monthOverMonthChange =
        Math.round(((lastMonth.total - prevMonth.total) / prevMonth.total) * 1000) / 10
    }
  }

  // Current month projection: extrapolate based on day-of-month pace
  const dayOfMonth = referenceDate.getDate()
  const daysInMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0
  ).getDate()
  const currentMonthProjection =
    dayOfMonth > 0
      ? Math.round((currentMonthPace / dayOfMonth) * daysInMonth * 100) / 100
      : 0

  return {
    monthOverMonthChange,
    bestMonth,
    averageMonthly,
    currentMonthPace,
    currentMonthProjection,
  }
}
