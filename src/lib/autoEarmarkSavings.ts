import type { Transaction, Budget } from '@/types'

// ============================================================================
// Auto-Earmark Savings — Pure Utility Module
// ============================================================================
// Tracks unspent daily allowance as a virtual "earmark" toward a savings goal.
// Purely informational — does not create transactions or modify goal amounts.
// Shows the user: "you would have saved $X this month if you kept this up."

const STORAGE_KEY_ENABLED = 'folio-auto-earmark-enabled'
const STORAGE_KEY_GOAL_ID = 'folio-auto-earmark-goal-id'

// ============================================================================
// Types
// ============================================================================

export interface AutoEarmarkConfig {
  /** Whether the auto-earmark feature is enabled (opt-in) */
  enabled: boolean
  /** Goal ID to earmark towards, or null for generic "savings" */
  goalId: string | null
}

// ============================================================================
// LocalStorage Preferences
// ============================================================================

/**
 * Reads the auto-earmark configuration from localStorage.
 * Defaults to disabled with no goal selected.
 */
export function getAutoEarmarkConfig(): AutoEarmarkConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, goalId: null }
  }
  const enabled = localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'
  const goalId = localStorage.getItem(STORAGE_KEY_GOAL_ID) || null
  return { enabled, goalId }
}

/**
 * Persists the auto-earmark configuration to localStorage.
 */
export function setAutoEarmarkConfig(config: AutoEarmarkConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_ENABLED, String(config.enabled))
  if (config.goalId) {
    localStorage.setItem(STORAGE_KEY_GOAL_ID, config.goalId)
  } else {
    localStorage.removeItem(STORAGE_KEY_GOAL_ID)
  }
}

// ============================================================================
// Pure Computation
// ============================================================================

/**
 * Computes the virtual earmark for a single day.
 * The earmark is the difference between the daily budget and actual spending,
 * clamped to zero (no negative earmarks).
 *
 * @param dailyBudget - The user's computed daily budget
 * @param spentToday - Amount spent on this day
 * @returns The virtual earmark amount (always >= 0)
 */
export function computeDailyEarmark(dailyBudget: number, spentToday: number): number {
  if (dailyBudget <= 0) return 0
  const earmark = dailyBudget - spentToday
  return Math.max(0, earmark)
}

/**
 * Sums the daily earmarks across all days in the specified month that have
 * already passed.
 *
 * For each day in the month up to today, computes:
 *   earmark = max(0, dailyBudget - spentThatDay)
 *
 * The daily budget is derived from the user's budget limits for that month.
 *
 * @param transactions - All user transactions
 * @param budgets - User's budget limits
 * @param month - Month string in YYYY-MM format
 * @returns Total earmarked amount for the month so far
 */
export function computeMonthlyEarmarkTotal(
  transactions: Transaction[],
  budgets: Budget[],
  month: string
): number {
  // Determine daily budget from budget limits for this month
  const monthBudgets = budgets.filter(b => b.month === month)
  const totalMonthlyLimit = monthBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0)

  // If no budgets configured, we can't compute a meaningful earmark
  if (totalMonthlyLimit <= 0) return 0

  // Parse the month to determine days
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)

  // Days in this month
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const dailyBudget = totalMonthlyLimit / daysInMonth

  // Determine how many days have passed (up to today)
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNum

  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth

  // Filter expense transactions for this month
  const monthExpenses = transactions.filter(
    tx => tx.type === 'expense' && tx.date.startsWith(month)
  )

  // Sum earmarks for each day
  let total = 0
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    // Skip today if it hasn't ended yet (only count completed days)
    if (dateStr === todayStr) continue

    const daySpent = monthExpenses
      .filter(tx => tx.date === dateStr)
      .reduce((sum, tx) => sum + tx.amount, 0)

    total += computeDailyEarmark(dailyBudget, daySpent)
  }

  return total
}
