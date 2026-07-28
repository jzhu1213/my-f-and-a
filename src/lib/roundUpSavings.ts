import type { Transaction } from '@/types'

// ============================================================================
// Round-Up Savings — Pure Utility Module
// ============================================================================

const STORAGE_KEY = 'folio-round-up-enabled'

/**
 * Computes the round-up for a given expense amount.
 * Rounds up to the nearest whole dollar and returns the difference.
 *
 * Pure function — no side effects.
 */
export function computeRoundUp(amount: number): {
  roundedAmount: number
  roundUpDifference: number
} {
  const roundedAmount = Math.ceil(amount)
  const roundUpDifference = roundedAmount - amount
  return { roundedAmount, roundUpDifference }
}

/**
 * Sums the round-up differences from all expense transactions in a given month.
 * Useful for showing how much was "saved" via round-ups over a period.
 *
 * @param transactions - Array of user transactions
 * @param month - Month string in YYYY-MM format
 * @returns Total round-up savings for that month
 */
export function computeMonthlyRoundUpTotal(
  transactions: Transaction[],
  month: string
): number {
  return transactions
    .filter(tx => tx.type === 'expense' && tx.date.startsWith(month))
    .reduce((total, tx) => {
      const { roundUpDifference } = computeRoundUp(tx.amount)
      return total + roundUpDifference
    }, 0)
}

/**
 * Checks whether the round-up savings feature is enabled.
 * Reads from localStorage. Defaults to false (opt-in).
 */
export function isRoundUpEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

/**
 * Persists the round-up savings toggle state to localStorage.
 */
export function setRoundUpEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(enabled))
}

/**
 * Applies the round-up logic to an expense amount.
 * When enabled, returns the rounded expense and the savings portion.
 * When disabled, passes through the original amount with zero savings.
 *
 * This helper can be consumed by the expense logging flow to optionally
 * route the round-up difference to a savings bucket.
 *
 * Reversible: disabling simply stops future round-ups. No existing
 * transactions are modified.
 */
export function applyRoundUp(expenseAmount: number): {
  expenseAmount: number
  savingsAmount: number
} {
  if (!isRoundUpEnabled()) {
    return { expenseAmount, savingsAmount: 0 }
  }

  const { roundedAmount, roundUpDifference } = computeRoundUp(expenseAmount)
  return { expenseAmount: roundedAmount, savingsAmount: roundUpDifference }
}
