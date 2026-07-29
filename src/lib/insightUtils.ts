import type { Budget, Transaction } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { isFixedTransaction } from '@/lib/fixedExpenses'

/**
 * Result of projecting the end-of-month balance.
 */
export interface EndOfMonthProjection {
  /** Projected balance at month end (can be negative) */
  projectedBalance: number
  /** Average daily discretionary spend so far this month */
  dailyBurnRate: number
  /** Days remaining in the month (excluding today) */
  daysRemaining: number
  /** Total monthly pool (sum of budget limits, or income-based) */
  totalMonthlyPool: number
  /** Total discretionary spending so far this month */
  spentSoFar: number
  /** Projected remaining spending based on burn rate */
  projectedRemaining: number
  /** Fixed costs still due this month (dueDay > currentDay) */
  remainingFixedCosts: number
}

/**
 * Projects end-of-month balance from the current burn rate and known fixed costs.
 *
 * This is a pure utility with no side effects.
 *
 * Calculation:
 * 1. Sum discretionary (non-fixed) expenses this month → spentSoFar
 * 2. Compute dailyBurnRate = spentSoFar / daysElapsed
 * 3. Project remaining = dailyBurnRate * daysRemaining
 * 4. Sum remaining fixed expenses (active, dueDay > currentDay)
 * 5. projectedBalance = totalMonthlyPool - spentSoFar - projectedRemaining - remainingFixedCosts
 *
 * @param transactions - All transactions (filtered to current month internally)
 * @param budgets - Current month budget limits
 * @param fixedExpenses - Optional array of fixed monthly obligations
 * @param currentDate - Date to compute from (defaults to now, useful for testing)
 */
export function projectEndOfMonthBalance(
  transactions: Transaction[],
  budgets: Budget[],
  fixedExpenses?: FixedExpense[],
  currentDate: Date = new Date()
): EndOfMonthProjection {
  const year = currentDate.getUTCFullYear()
  const month = currentDate.getUTCMonth()
  const currentDay = currentDate.getUTCDate()

  // Days in this month
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  // Days elapsed (including today)
  const daysElapsed = currentDay

  // Days remaining after today
  const daysRemaining = daysInMonth - currentDay

  // Current month prefix for filtering
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`

  // Filter to this month's transactions
  const monthTransactions = transactions.filter(t => t.date.startsWith(monthPrefix))

  // Total monthly pool: sum of budget monthlyLimit values
  // If no budgets, fall back to income logged this month
  const totalBudgetPool = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const monthlyIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalMonthlyPool = totalBudgetPool > 0 ? totalBudgetPool : monthlyIncome

  // Discretionary spending so far (exclude fixed/recurring)
  const spentSoFar = monthTransactions
    .filter(t => t.type === 'expense' && !isFixedTransaction(t))
    .reduce((sum, t) => sum + t.amount, 0)

  // Daily burn rate (avoid divide by zero on day 1)
  const dailyBurnRate = daysElapsed > 0 ? spentSoFar / daysElapsed : 0

  // Project remaining discretionary spend
  const projectedRemaining = dailyBurnRate * daysRemaining

  // Remaining fixed costs: active expenses with dueDay > currentDay
  const remainingFixedCosts = (fixedExpenses ?? [])
    .filter(fe => fe.isActive && fe.dueDay > currentDay && fe.dueDay <= daysInMonth)
    .reduce((sum, fe) => sum + fe.amount, 0)

  // Projected balance at end of month
  const projectedBalance = totalMonthlyPool - spentSoFar - projectedRemaining - remainingFixedCosts

  return {
    projectedBalance,
    dailyBurnRate,
    daysRemaining,
    totalMonthlyPool,
    spentSoFar,
    projectedRemaining,
    remainingFixedCosts,
  }
}

/**
 * Returns a warm, non-judgmental message based on the projection.
 */
export function getProjectionMessage(projection: EndOfMonthProjection): {
  message: string
  tone: 'positive' | 'tight' | 'negative'
} {
  const { projectedBalance, totalMonthlyPool } = projection

  // If there's no pool to project against, skip
  if (totalMonthlyPool <= 0) {
    return { message: '', tone: 'positive' }
  }

  const ratio = projectedBalance / totalMonthlyPool

  if (projectedBalance > 0 && ratio > 0.1) {
    return {
      message: `On track to end the month with ~$${Math.round(projectedBalance)} left 🎉`,
      tone: 'positive',
    }
  }

  if (projectedBalance >= 0) {
    return {
      message: 'At this pace, things might be tight by month-end',
      tone: 'tight',
    }
  }

  return {
    message: "Spending's running a bit high — spacing things out will keep you on track",
    tone: 'tight',
  }
}
