import type { Budget, Transaction } from '@/types'
import type { IncomeSmoothing } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'

// ============================================================================
// Affordability Simulator — "Can I afford this?" helper
// ============================================================================

/**
 * Result of simulating a hypothetical one-off purchase.
 */
export interface AffordabilityResult {
  /** Whether the purchase fits within today's remaining allowance */
  canAfford: boolean
  /** Remaining daily allowance after the hypothetical purchase (can be negative) */
  remainingAfter: number
  /** How much today's allowance would decrease by */
  impactOnDaily: number
  /** Days until next payday (when payday info is available) */
  daysUntilPayday?: number
  /** Safe-to-spend per day until payday after the purchase */
  safeToSpendUntilPayday?: number
  /** Warm, encouraging message describing the impact */
  message: string
}

/**
 * Options for the affordability simulation.
 */
export interface AffordabilityOptions {
  budgets: Budget[]
  transactions: Transaction[]
  purchaseAmount: number
  currentDate?: Date
  monthlyIncome?: number
  fixedExpenses?: FixedExpense[]
  setupDate?: Date
  incomeSmoothing?: IncomeSmoothing
  carryoverEnabled?: boolean
  /** Days until next payday (pre-computed by the caller) */
  daysUntilPayday?: number
}

/**
 * Simulates a hypothetical purchase by computing the daily allowance with and
 * without the purchase amount added to today's spending.
 *
 * This is a **pure function** — it does NOT mutate any data or persist anything.
 * It simply calls `computeDailyAllowance` twice (baseline and with-purchase) and
 * compares the results.
 *
 * Requirements: 1.1, 2.5, new
 */
export function simulatePurchase(options: AffordabilityOptions): AffordabilityResult {
  const {
    budgets,
    transactions,
    purchaseAmount,
    currentDate = new Date(),
    monthlyIncome,
    fixedExpenses,
    setupDate,
    incomeSmoothing,
    carryoverEnabled,
    daysUntilPayday,
  } = options

  // Guard: if purchase amount is not positive, return a neutral result
  if (purchaseAmount <= 0) {
    return {
      canAfford: true,
      remainingAfter: 0,
      impactOnDaily: 0,
      message: 'Enter an amount to check',
    }
  }

  // Step 1: Compute the current (baseline) daily allowance
  const baseline = computeDailyAllowance(
    budgets,
    transactions,
    currentDate,
    monthlyIncome,
    fixedExpenses,
    setupDate,
    incomeSmoothing,
    carryoverEnabled,
  )

  // Step 2: Create a synthetic transaction representing the hypothetical purchase
  const todayStr = formatDateUTC(currentDate)
  const syntheticTx: Transaction = {
    id: '__affordability_sim__',
    userId: '',
    date: todayStr,
    amount: purchaseAmount,
    type: 'expense',
    category: 'other',
    accountType: 'personal',
    createdAt: currentDate.toISOString(),
  }

  // Step 3: Compute the allowance WITH the hypothetical purchase
  const withPurchase = computeDailyAllowance(
    budgets,
    [...transactions, syntheticTx],
    currentDate,
    monthlyIncome,
    fixedExpenses,
    setupDate,
    incomeSmoothing,
    carryoverEnabled,
  )

  // Step 4: Derive results
  const remainingAfter = withPurchase.amount
  const impactOnDaily = baseline.amount - withPurchase.amount
  const canAfford = remainingAfter > 0

  // Step 5: Compute safe-to-spend-until-payday (if payday info available)
  let safeToSpendUntilPayday: number | undefined
  if (daysUntilPayday != null && daysUntilPayday > 0) {
    // After the purchase, estimate remaining daily budget * days until payday
    // minus the impact of this purchase spread over remaining days
    const remainingDays = daysUntilPayday
    safeToSpendUntilPayday = Math.max(0, withPurchase.dailyBudget * remainingDays - purchaseAmount) / remainingDays
  }

  // Step 6: Generate warm, encouraging message
  const message = generateAffordabilityMessage(canAfford, remainingAfter, impactOnDaily, purchaseAmount, daysUntilPayday)

  return {
    canAfford,
    remainingAfter,
    impactOnDaily,
    daysUntilPayday,
    safeToSpendUntilPayday,
    message,
  }
}

/**
 * Generates a warm, non-judgmental message based on the affordability result.
 */
function generateAffordabilityMessage(
  canAfford: boolean,
  remainingAfter: number,
  impactOnDaily: number,
  purchaseAmount: number,
  daysUntilPayday?: number,
): string {
  if (canAfford) {
    const remaining = Math.round(remainingAfter)
    if (remaining >= 20) {
      return `You'd still have $${remaining} left today — go for it!`
    }
    if (remaining >= 5) {
      return `That works! You'd have $${remaining} left for the rest of today.`
    }
    return `Tight but doable — you'd have $${remaining} left today.`
  }

  // Can't afford within today's budget
  if (daysUntilPayday != null && daysUntilPayday <= 2) {
    return `This would stretch today's budget, but payday is close.`
  }
  return `This would put you over today's budget, but tomorrow resets.`
}

/**
 * Formats a Date into YYYY-MM-DD (UTC).
 */
function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
