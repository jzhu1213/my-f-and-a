import type { Transaction } from '@/types'
import type { IncomePatternResult } from '@/lib/incomePatterns'
import { parseDateLocal } from '@/lib/dateUtils'

/**
 * Mid-month income adjustment utilities — Task 336.
 *
 * When projected income is the active source and actual income arrives mid-month,
 * these helpers compute a blended income pool (actual received + pro-rated
 * remaining projection) and detect when to show an encouraging acknowledgment.
 *
 * Pure functions — no side effects.
 *
 * **Validates: Requirements 18.1, 18.2**
 */

// ============================================================================
// Task 336.1: Auto-adjust allowance when income arrives
// ============================================================================

/**
 * Compute a blended income pool when actual income arrives while projected
 * income is the active source.
 *
 * Logic: actual income received this month + pro-rated remaining projection
 * for the rest of the month. This ensures the daily budget reflects reality
 * (actuals) while still accounting for expected future income this month.
 *
 * @param actualIncomeThisMonth  Total income logged this month so far.
 * @param projection             The income pattern projection for this month.
 * @param currentDate            Today's date.
 * @returns The blended monthly income pool, or null if blending isn't applicable.
 */
export function computeAdjustedIncomePool(
  actualIncomeThisMonth: number,
  projection: IncomePatternResult | null,
  currentDate: Date
): number | null {
  // Blending only applies when:
  // 1. There IS actual income this month (a paycheck/gig landed)
  // 2. There IS a valid projection with sufficient confidence
  if (actualIncomeThisMonth <= 0) return null
  if (!projection || projection.confidence < 0.4 || projection.projectedMonthlyIncome <= 0) return null

  const dayOfMonth = currentDate.getDate()
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate()
  const daysRemaining = daysInMonth - dayOfMonth

  // If we're at the end of the month, just use actuals
  if (daysRemaining <= 0) return actualIncomeThisMonth

  // Pro-rate the remaining projected income for the rest of the month.
  // Remaining projection = total projection × (days remaining / total days)
  // minus what we've already received (to avoid double-counting).
  const remainingProjectedFraction = daysRemaining / daysInMonth
  const remainingProjected = Math.max(
    0,
    projection.projectedMonthlyIncome * remainingProjectedFraction
  )

  // Blended pool: what we actually have + what we still expect
  return actualIncomeThisMonth + remainingProjected
}

/**
 * Determines whether an income acknowledgment toast should be shown.
 *
 * Returns true when:
 * - A new income transaction was added (prevCount < newCount)
 * - Projected income is the active source (confidence >= 0.4)
 *
 * The caller (UI component) uses this to show: "Got it — your daily budget just went up."
 *
 * @param prevIncomeCount  Number of income transactions in the previous render cycle.
 * @param newIncomeCount   Number of income transactions in the current render cycle.
 * @param projection       The income projection (to verify projection was active).
 * @returns Whether to show the acknowledgment.
 */
export function shouldShowIncomeAcknowledgment(
  prevIncomeCount: number,
  newIncomeCount: number,
  projection: IncomePatternResult | null
): boolean {
  if (newIncomeCount <= prevIncomeCount) return false
  // Only show the encouraging message when projected income was the active source,
  // meaning the daily budget was being calculated from projection — and now actuals
  // just improved it.
  if (!projection || projection.confidence < 0.4) return false
  return true
}

// ============================================================================
// Task 336.2: Handle income shortfalls gracefully
// ============================================================================

/**
 * Result of income overdue check.
 */
export interface IncomeOverdueResult {
  /** Whether income is considered overdue */
  isOverdue: boolean
  /** Expected amount based on projection (for tip metadata) */
  expectedAmount: number
  /** Days past the typical arrival date */
  daysPastDue: number
}

/**
 * Checks whether projected income is overdue — i.e., the expected payment
 * hasn't arrived by the typical date based on detected regularity.
 *
 * Uses the income pattern's regularity and the date of the last income
 * transaction to determine if a payment is late.
 *
 * Pure function, no side effects.
 *
 * @param transactions   All user transactions.
 * @param currentDate    Today's date.
 * @param projection     The income pattern projection.
 * @returns Whether income is overdue and by how many days.
 */
export function isIncomeOverdue(
  transactions: Transaction[],
  currentDate: Date,
  projection: IncomePatternResult | null
): IncomeOverdueResult {
  const NOT_OVERDUE: IncomeOverdueResult = { isOverdue: false, expectedAmount: 0, daysPastDue: 0 }

  // Need a valid projection with sufficient confidence
  if (!projection || projection.confidence < 0.4 || projection.projectedMonthlyIncome <= 0) {
    return NOT_OVERDUE
  }

  // Only check when regularity is detected (not irregular)
  if (projection.regularity === 'irregular') {
    return NOT_OVERDUE
  }

  // Find the most recent income transaction
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  const incomeThisMonth = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))

  // Get all income transactions sorted by date descending
  const allIncome = transactions
    .filter(t => t.type === 'income')
    .sort((a, b) => b.date.localeCompare(a.date))

  if (allIncome.length === 0) return NOT_OVERDUE

  const lastIncomeDate = parseDateLocal(allIncome[0].date)

  // Determine expected interval based on regularity
  const expectedIntervalDays = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    irregular: 0,
  }[projection.regularity]

  if (expectedIntervalDays === 0) return NOT_OVERDUE

  // Calculate days since last income
  const msPerDay = 24 * 60 * 60 * 1000
  const daysSinceLastIncome = Math.round(
    (currentDate.getTime() - lastIncomeDate.getTime()) / msPerDay
  )

  // Income is "overdue" when it's more than expectedInterval + 2 days grace period
  const gracePeriodDays = 2
  const daysPastDue = daysSinceLastIncome - expectedIntervalDays - gracePeriodDays

  if (daysPastDue <= 0) return NOT_OVERDUE

  // Only flag if no income has arrived this month when monthly,
  // or enough time has passed for weekly/biweekly
  if (projection.regularity === 'monthly' && incomeThisMonth.length > 0) {
    return NOT_OVERDUE
  }

  return {
    isOverdue: true,
    expectedAmount: projection.averagePerPeriod,
    daysPastDue,
  }
}
