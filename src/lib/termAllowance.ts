/**
 * Term Allowance — "make this last until end of term" daily number.
 *
 * Computes how much per day the user can safely spend from now until
 * the end of their academic term. Follows the pattern of weekendAllowance.ts:
 * a pure function that produces a display-ready result.
 *
 * **Validates: Requirements 1.1, new**
 */

import type { Transaction } from '@/types'
import type { TermSchedule } from '@/lib/termSchedule'
import { isTermActive, getDaysInTerm, getDaysRemainingInTerm } from '@/lib/termSchedule'
import { formatDateLocal } from '@/lib/dateUtils'
import { AVG_DAYS_PER_MONTH } from '@/lib/paySchedule'

// ============================================================================
// Types
// ============================================================================

export interface TermAllowanceResult {
  /** Daily amount safe to spend until term ends */
  termDailyAmount: number
  /** Label: "Until end of term" or custom term label */
  label: string
  /** Days remaining in the term */
  daysRemaining: number
  /** How much has been spent since term started */
  spentSinceTerm: number
  /** Total pool for the term */
  termPool: number
}

// ============================================================================
// Core Computation
// ============================================================================

/**
 * Computes the "make this last until end of term" daily amount.
 *
 * @param termSchedule - The user's active term schedule
 * @param transactions - All user transactions (to sum expenses since term start)
 * @param monthlyPool - Monthly discretionary pool (from budgets or income)
 * @param currentDate - The current date (for testability)
 * @returns TermAllowanceResult or null when term is not active
 *
 * @pure No side effects, no internal Date.now() calls.
 */
export function computeTermAllowance(
  termSchedule: TermSchedule,
  transactions: Transaction[],
  monthlyPool: number,
  currentDate: Date
): TermAllowanceResult | null {
  // Only compute when term is active
  if (!isTermActive(termSchedule, currentDate)) return null

  const daysInTerm = getDaysInTerm(termSchedule)
  const daysRemaining = getDaysRemainingInTerm(termSchedule, currentDate)

  // Scale the monthly pool to the full term length
  // e.g., $3000/month budget across a 112-day term → $3000 * (112/30.44) ≈ $11,035
  const termPool = monthlyPool * (daysInTerm / AVG_DAYS_PER_MONTH)

  // Sum expenses from term start to today (inclusive)
  const todayStr = formatDateLocal(currentDate)
  const spentSinceTerm = transactions
    .filter(t =>
      t.type === 'expense' &&
      t.date >= termSchedule.startDate &&
      t.date <= todayStr
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // How much per day if you spend evenly from now until the end
  const termDailyAmount = Math.max(0, (termPool - spentSinceTerm) / daysRemaining)

  // Build a friendly label
  const label = termSchedule.label
    ? `Until end of ${termSchedule.label}`
    : 'Until end of term'

  return {
    termDailyAmount: Math.round(termDailyAmount * 100) / 100,
    label,
    daysRemaining,
    spentSinceTerm,
    termPool: Math.round(termPool * 100) / 100,
  }
}
