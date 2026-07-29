import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, TransactionCategory } from '@/types'

// ============================================================================
// Budget Summary — Pure Utility Functions
// ============================================================================

/**
 * Returns the number of days in the current month (local time).
 * Pure with respect to its implicit dependency on the current date.
 */
export function getDaysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

/**
 * Returns the number of days in the month containing the given date.
 */
export function getDaysInMonthForDate(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Computes the total monthly budget across all categories.
 * Accepts optional local overrides (e.g. from an unsaved slider state)
 * that take priority over persisted budget records.
 */
export function computeTotalMonthlyBudget(
  budgets: Budget[],
  localOverrides?: Record<string, number>
): number {
  let total = 0
  for (const cat of BUDGET_CATEGORIES) {
    const override = localOverrides?.[cat.category]
    if (override !== undefined) {
      total += override
    } else {
      const budget = budgets.find(b => b.category === cat.category)
      total += budget?.monthlyLimit ?? 0
    }
  }
  return total
}

/**
 * Computes the daily budget from a monthly total, dividing by the number
 * of days in the current month (or a provided day count).
 */
export function computeDailyBudgetFromTotal(totalMonthly: number, daysInMonth?: number): number {
  const days = daysInMonth ?? getDaysInCurrentMonth()
  return days > 0 ? totalMonthly / days : 0
}

export interface BudgetSummary {
  totalMonthly: number
  dailyBudget: number
}

/**
 * Convenience: computes both the total monthly budget and the derived daily budget.
 */
export function computeBudgetSummary(
  budgets: Budget[],
  localOverrides?: Record<string, number>,
  daysInMonth?: number
): BudgetSummary {
  const totalMonthly = computeTotalMonthlyBudget(budgets, localOverrides)
  const dailyBudget = computeDailyBudgetFromTotal(totalMonthly, daysInMonth)
  return { totalMonthly, dailyBudget }
}

/**
 * Computes the daily equivalent for a single category's monthly limit.
 */
export function computeDailyEquivalent(monthlyLimit: number, daysInMonth?: number): number {
  const days = daysInMonth ?? getDaysInCurrentMonth()
  return days > 0 ? monthlyLimit / days : 0
}
