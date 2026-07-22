import type { Budget, Transaction } from '@/types'
import type { DailyAllowance, AllowanceStatus } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { getTotalFixedMonthly, isFixedTransaction, getUpcomingBillsList } from '@/lib/fixedExpenses'

/**
 * Formats a Date object into YYYY-MM-DD string format
 * Uses UTC to avoid timezone issues
 */
function formatDateString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gets the first day of the month for a given date
 * Uses UTC to avoid timezone issues
 */
function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Subtracts days from a date
 * Uses UTC to avoid timezone issues
 */
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() - days)
  return result
}

/**
 * Gets the number of days in the month for a given date
 * Uses UTC to avoid timezone issues
 */
function getDaysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

/**
 * Determines allowance status based on remaining amount and daily budget.
 *
 * **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
 */
export function getStatus(remainingAmount: number, dailyBudget: number): AllowanceStatus {
  if (remainingAmount < 0) {
    return 'over'
  }

  if (dailyBudget <= 0) {
    return 'warning'
  }

  const percentRemaining = (remainingAmount / dailyBudget) * 100

  if (percentRemaining > 50) {
    return 'healthy'
  }
  if (percentRemaining >= 25) {
    return 'caution'
  }
  return 'warning'
}

/**
 * Generates context-aware encouraging messages based on allowance status.
 * 
 * **Validates: Requirements 1.10, 2.3**
 * 
 * Messages follow UX guidelines:
 * - Encouraging and non-judgmental tone
 * - Short and human language
 * - Actionable context when appropriate
 * - Warm and supportive rather than shame-based
 */
export function generateEncouragingMessage(status: AllowanceStatus, amount: number, spentToday: number): string {
  // Format amounts for contextual messages
  const amountStr = amount > 0 ? `$${Math.round(amount)}` : '$0'
  
  switch (status) {
    case 'healthy':
      if (amount >= 50) {
        return `Nice! You've got ${amountStr} left today.`
      } else if (amount >= 20) {
        return `You're doing great — ${amountStr} to go.`
      } else {
        return `Still ${amountStr} left. You're on track!`
      }
      
    case 'caution':
      if (amount >= 10) {
        return `Heads up, you're close to today's limit. ${amountStr} left.`
      } else {
        return `Getting close — ${amountStr} left. You've got this.`
      }
      
    case 'warning':
      if (amount > 0) {
        return `Almost there — just ${amountStr} left today.`
      } else {
        return `Right at your limit. Nice job staying on track.`
      }
      
    case 'over':
      if (spentToday < 50) {
        return 'A little tight today — tomorrow resets.'
      } else {
        return 'Over today, but no stress. Tomorrow\'s a fresh start.'
      }
      
    default:
      // Fallback for any unexpected status values
      return 'No stress — let\'s keep it simple.'
  }
}

/**
 * Determines if celebration should be shown
 */
function shouldCelebrate(status: AllowanceStatus, spentToday: number, dailyBudget: number): boolean {
  // Celebrate if under budget at end of day or significantly under mid-day
  return status === 'healthy' && spentToday < dailyBudget * 0.5
}

/**
 * Computes daily allowance with rollover and status.
 * 
 * Fixed monthly obligations (rent, subscriptions, etc.) are subtracted from the
 * monthly pool up front so only discretionary money is spread across remaining days.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 14.2**
 * 
 * @param budgets - Array of budget limits by category
 * @param transactions - Array of all transactions
 * @param currentDate - Current date (for testing purposes)
 * @param monthlyIncome - Optional monthly income for estimation when no budgets are configured
 * @param fixedExpenses - Optional array of fixed monthly obligations to sink before daily division
 * @returns DailyAllowance object with amount, status, and message
 */
export function computeDailyAllowance(
  budgets: Budget[],
  transactions: Transaction[],
  currentDate: Date = new Date(),
  monthlyIncome?: number,
  fixedExpenses?: FixedExpense[]
): DailyAllowance {
  // Step 1: Calculate total monthly budget from all category limits
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  
  // If no budgets configured and monthlyIncome is provided, use income-based estimation
  const isEstimated = budgets.length === 0 && typeof monthlyIncome === 'number' && monthlyIncome > 0
  
  // Step 1b: Subtract fixed monthly obligations up front (rent, subscriptions, etc.)
  // Only discretionary money is spread across the remaining days.
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  
  // Step 2: Calculate daily budget from discretionary pool
  const daysInMonth = getDaysInMonth(currentDate)
  const dailyBudget = isEstimated
    ? Math.max(0, monthlyIncome! - totalFixed) / 30
    : Math.max(0, totalMonthlyBudget - totalFixed) / daysInMonth
  
  // Step 3: Calculate spentToday (exclude fixed/recurring — already sunk in Step 1b)
  const todayStr = formatDateString(currentDate)
  const spentToday = transactions
    .filter(t => t.date === todayStr && t.type === 'expense' && !isFixedTransaction(t))
    .reduce((sum, t) => sum + t.amount, 0)
  
  // Step 4: Calculate rollover from previous days
  // Rollover = what was saved/overspent from day 1 to yesterday
  const dayOfMonth = currentDate.getUTCDate()
  
  let rollover = 0
  if (dayOfMonth > 1) {
    const monthStart = getMonthStart(currentDate)
    const yesterday = subtractDays(currentDate, 1)
    
    // Expected spend up to yesterday
    const expectedSpendToYesterday = dailyBudget * (dayOfMonth - 1)
    
    // Actual spend up to yesterday (exclude fixed/recurring — already sunk in Step 1b)
    const actualSpendToYesterday = transactions
      .filter(t => {
        const txDate = t.date
        const startDate = formatDateString(monthStart)
        const endDate = formatDateString(yesterday)
        return txDate >= startDate && txDate <= endDate && t.type === 'expense' && !isFixedTransaction(t)
      })
      .reduce((sum, t) => sum + t.amount, 0)
    
    // Rollover: positive = saved, negative = overspent
    // Cap rollover to ±2 days budget to prevent extreme accumulation
    const rawRollover = expectedSpendToYesterday - actualSpendToYesterday
    const maxRollover = dailyBudget * 2
    rollover = Math.max(-maxRollover, Math.min(maxRollover, rawRollover))
  }
  
  // Step 5: Calculate final daily allowance
  const rawAmount = dailyBudget + rollover - spentToday
  const amount = Math.max(0, rawAmount)
  
  // Step 6: Determine status and message
  const status = getStatus(rawAmount, dailyBudget) // Use rawAmount to detect overspending
  const message = generateEncouragingMessage(status, amount, spentToday)
  const showCelebration = shouldCelebrate(status, spentToday, dailyBudget)
  
  // Step 7: Reserve upcoming bills from the spendable pool (informational)
  const upcomingBills = getUpcomingBillsList(fixedExpenses ?? [], currentDate)
  const reservedForBills = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0)
  const upcomingBillCount = upcomingBills.length

  // Return valid DailyAllowance
  return {
    amount,
    dailyBudget,
    spentToday,
    rollover,
    status,
    message,
    showCelebration,
    isEstimated,
    reservedForBills: reservedForBills > 0 ? reservedForBills : undefined,
    upcomingBillCount: upcomingBillCount > 0 ? upcomingBillCount : undefined,
  }
}
