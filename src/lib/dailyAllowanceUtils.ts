import type { Budget, Transaction } from '@/types'
import type { DailyAllowance, AllowanceStatus, IncomeSmoothing, MonthBoundaryCarryover } from '@/types/folio'
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
 * Calculates the number of days remaining in the month from a given date (inclusive).
 * Reuses logic similar to `daysLeftInMonth` from budgetUtils.ts but accepts arbitrary dates
 * and uses UTC-based calculations consistent with this file.
 *
 * @param fromDate - The starting date (inclusive)
 * @param currentDate - The current date (used to determine which month we're in)
 * @returns Number of days from `fromDate` to end of the month (inclusive of fromDate)
 */
export function getDaysRemainingFrom(fromDate: Date, currentDate: Date): number {
  const lastDayOfMonth = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const fromDay = fromDate.getUTCDate()
  return lastDayOfMonth - fromDay + 1
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
 * Computes smoothed monthly income from transaction history.
 * - 'current_month': sums income transactions in the current month (existing behavior)
 * - 'trailing_average': averages income over the last N months (including current if partially complete)
 *
 * For gig workers with irregular income, trailing_average produces a more stable
 * daily budget by smoothing over recent months rather than relying on a single month.
 *
 * Non-zero months only are averaged to avoid dragging the average down when no data
 * exists for a given month (e.g. first month of use).
 *
 * **Validates: Requirements 1.1, new**
 */
export function computeSmoothedIncome(
  transactions: Transaction[],
  currentDate: Date,
  smoothing: IncomeSmoothing
): number {
  const currentMonthPrefix = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`

  if (smoothing.strategy === 'current_month') {
    return transactions
      .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
      .reduce((sum, t) => sum + t.amount, 0)
  }

  // trailing_average strategy
  const windowMonths = smoothing.windowMonths ?? 3

  // Build month prefixes for each month in the window (current month + previous months)
  const monthPrefixes: string[] = []
  for (let i = 0; i < windowMonths; i++) {
    const d = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - i, 1))
    const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    monthPrefixes.push(prefix)
  }

  // Sum income per month
  const monthlyTotals: number[] = monthPrefixes.map(prefix =>
    transactions
      .filter(t => t.type === 'income' && t.date.startsWith(prefix))
      .reduce((sum, t) => sum + t.amount, 0)
  )

  // Average only non-zero months to avoid dragging down the average
  // when no data exists (e.g. first month of use)
  const nonZeroTotals = monthlyTotals.filter(total => total > 0)

  if (nonZeroTotals.length === 0) {
    return 0
  }

  return nonZeroTotals.reduce((sum, t) => sum + t, 0) / nonZeroTotals.length
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
 * @param setupDate - Optional date when user first configured budgets/income for the current month.
 *   When provided and within the current month, divides the discretionary pool by days remaining
 *   from setupDate (not the full month) for accurate mid-month starts.
 * @param incomeSmoothing - Optional income smoothing configuration for variable/irregular income.
 *   When provided and incomeSource is 'transactions', uses smoothed income instead of current month only.
 * @param carryoverEnabled - Optional flag to enable month-boundary savings carryover.
 *   When true and it's the first day of the month, computes leftover savings from the previous month.
 * @returns DailyAllowance object with amount, status, and message
 */
export function computeDailyAllowance(
  budgets: Budget[],
  transactions: Transaction[],
  currentDate: Date = new Date(),
  monthlyIncome?: number,
  fixedExpenses?: FixedExpense[],
  setupDate?: Date,
  incomeSmoothing?: IncomeSmoothing,
  carryoverEnabled?: boolean
): DailyAllowance {
  // Step 1: Calculate total monthly budget from all category limits
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  
  // Step 1a: Sum actual income transactions logged in the current month
  const currentMonthPrefix = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`
  const actualMonthlyIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + t.amount, 0)
  
  // Determine income source priority:
  // 1. Budget limits (if configured)
  // 2. Actual logged income transactions (if any exist this month)
  // 3. monthlyIncome parameter estimate (fallback)
  const hasBudgets = totalMonthlyBudget > 0
  const hasActualIncome = actualMonthlyIncome > 0
  const hasEstimate = typeof monthlyIncome === 'number' && monthlyIncome > 0
  
  let incomeSource: 'budget' | 'transactions' | 'estimate'
  if (hasBudgets) {
    incomeSource = 'budget'
  } else if (hasActualIncome) {
    incomeSource = 'transactions'
  } else {
    incomeSource = 'estimate'
  }

  // Step 1a-ii: When income smoothing is provided and source is transactions,
  // use smoothed income to stabilize the pool for gig workers with variable income.
  const smoothedIncome = (incomeSource === 'transactions' && incomeSmoothing)
    ? computeSmoothedIncome(transactions, currentDate, incomeSmoothing)
    : actualMonthlyIncome

  const isEstimated = incomeSource === 'estimate' && hasEstimate
  
  // Step 1b: Subtract fixed monthly obligations up front (rent, subscriptions, etc.)
  // Only discretionary money is spread across the remaining days.
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  
  // Step 2: Calculate daily budget from discretionary pool
  const daysInMonth = getDaysInMonth(currentDate)
  
  // Determine if setupDate qualifies for mid-month calculation:
  // Must be provided and within the same month/year as currentDate
  const isSetupMidMonth = setupDate !== undefined &&
    setupDate.getUTCFullYear() === currentDate.getUTCFullYear() &&
    setupDate.getUTCMonth() === currentDate.getUTCMonth()
  
  // When mid-month setup, divide by remaining days from setupDate; otherwise full month
  const effectiveDays = isSetupMidMonth
    ? getDaysRemainingFrom(setupDate!, currentDate)
    : daysInMonth
  
  let dailyBudget: number
  switch (incomeSource) {
    case 'budget':
      dailyBudget = Math.max(0, totalMonthlyBudget - totalFixed) / effectiveDays
      break
    case 'transactions':
      dailyBudget = Math.max(0, smoothedIncome - totalFixed) / effectiveDays
      break
    case 'estimate':
      dailyBudget = hasEstimate ? Math.max(0, monthlyIncome! - totalFixed) / 30 : 0
      break
  }
  
  // Step 3: Calculate spentToday (exclude fixed/recurring — already sunk in Step 1b)
  const todayStr = formatDateString(currentDate)
  const spentToday = transactions
    .filter(t => t.date === todayStr && t.type === 'expense' && !isFixedTransaction(t))
    .reduce((sum, t) => sum + t.amount, 0)
  
  // Step 4: Calculate rollover from previous days
  // Rollover = what was saved/overspent from setupDate (or day 1) to yesterday
  const dayOfMonth = currentDate.getUTCDate()
  
  // When mid-month setup, rollover only covers days from setupDate to yesterday
  const setupDay = isSetupMidMonth ? setupDate!.getUTCDate() : 1
  const daysElapsedSinceSetup = dayOfMonth - setupDay
  
  let rollover = 0
  if (daysElapsedSinceSetup > 0) {
    const rolloverStart = isSetupMidMonth
      ? new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), setupDay))
      : getMonthStart(currentDate)
    const yesterday = subtractDays(currentDate, 1)
    
    // Expected spend from setupDate (or month start) to yesterday
    const expectedSpendToYesterday = dailyBudget * daysElapsedSinceSetup
    
    // Actual spend from setupDate (or month start) to yesterday (exclude fixed/recurring)
    const actualSpendToYesterday = transactions
      .filter(t => {
        const txDate = t.date
        const startDate = formatDateString(rolloverStart)
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

  // Step 8: Compute month-boundary carryover when enabled and it's the 1st of the month
  let monthBoundaryCarryover: MonthBoundaryCarryover | undefined
  if (carryoverEnabled && dayOfMonth === 1) {
    const previousMonthDate = subtractDays(currentDate, 1) // last day of previous month
    monthBoundaryCarryover = computeMonthBoundaryCarryover(
      budgets,
      transactions,
      previousMonthDate,
      fixedExpenses,
      true
    )
  }

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
    incomeSource,
    reservedForBills: reservedForBills > 0 ? reservedForBills : undefined,
    upcomingBillCount: upcomingBillCount > 0 ? upcomingBillCount : undefined,
    monthBoundaryCarryover,
  }
}

/**
 * Computes leftover savings at a month boundary.
 * When a user underspends their daily budget consistently, the raw rollover can exceed
 * the ±2-day cap. The excess is the "carryover" — money that could be routed to savings.
 *
 * This is purely informational/advisory — it reports how much COULD be saved,
 * it doesn't automatically move money.
 *
 * **Validates: Requirements 1.2, new**
 *
 * @param budgets - Budget limits
 * @param transactions - All transactions (to calculate previous month's spending)
 * @param previousMonthDate - A date in the previous month (e.g., last day of prev month)
 * @param fixedExpenses - Fixed monthly obligations
 * @param enabled - Whether the carryover feature is enabled by the user
 * @returns MonthBoundaryCarryover with the excess amount
 */
export function computeMonthBoundaryCarryover(
  budgets: Budget[],
  transactions: Transaction[],
  previousMonthDate: Date,
  fixedExpenses?: FixedExpense[],
  enabled?: boolean
): MonthBoundaryCarryover {
  // Calculate daily budget for the previous month
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  const daysInPrevMonth = getDaysInMonth(previousMonthDate)
  const dailyBudget = Math.max(0, totalMonthlyBudget - totalFixed) / daysInPrevMonth

  // Calculate total expected discretionary spend for the entire previous month
  const expectedSpendForMonth = dailyBudget * daysInPrevMonth

  // Calculate actual discretionary spending for the entire previous month
  const prevMonthPrefix = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const actualSpendForMonth = transactions
    .filter(t =>
      t.date.startsWith(prevMonthPrefix) &&
      t.type === 'expense' &&
      !isFixedTransaction(t)
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Raw rollover: positive means saved money, negative means overspent
  const rawRollover = expectedSpendForMonth - actualSpendForMonth

  // Cap rollover to ±2 days of daily budget (same logic as computeDailyAllowance Step 4)
  const maxRollover = dailyBudget * 2
  const cappedRollover = Math.max(-maxRollover, Math.min(maxRollover, rawRollover))

  // Carryover is the excess savings beyond the cap (only positive excess counts)
  const carryoverAmount = Math.max(0, rawRollover - cappedRollover)

  // If not enabled, report zero amount but still provide the raw data for transparency
  if (!enabled) {
    return {
      amount: 0,
      rawRollover,
      cappedRollover,
      enabled: false,
    }
  }

  return {
    amount: carryoverAmount,
    rawRollover,
    cappedRollover,
    enabled: true,
  }
}
