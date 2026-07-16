import type { Budget, Transaction } from '@/types'
import type { DailyAllowance, AllowanceStatus } from '@/types/folio'

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
 * Determines allowance status based on remaining amount and daily budget
 */
function getStatus(remainingAmount: number, dailyBudget: number): AllowanceStatus {
  if (remainingAmount < 0 || dailyBudget === 0) {
    return 'over'
  }
  
  const percentRemaining = (remainingAmount / dailyBudget) * 100
  
  if (percentRemaining <= 25) {
    return 'warning'
  }
  if (percentRemaining <= 50) {
    return 'caution'
  }
  return 'healthy'
}

/**
 * Generates encouraging message based on status
 */
function generateEncouragingMessage(status: AllowanceStatus, amount: number, spentToday: number): string {
  const messages: Record<AllowanceStatus, string[]> = {
    healthy: [
      "You're doing great! Stay on track.",
      "Nice! Plenty of budget left today.",
      "Looking good! Keep it up.",
      "You're in great shape today!"
    ],
    caution: [
      "Getting close, but you've got this.",
      "Watch your spending, you're doing well.",
      "Halfway there, stay mindful.",
      "You're on track, just be careful."
    ],
    warning: [
      "Almost at your limit, spend wisely.",
      "Getting tight, make it count.",
      "Nearly there, choose carefully.",
      "Running low, be thoughtful."
    ],
    over: [
      "Over budget today, try to save tomorrow.",
      "A bit over, but tomorrow's a new day.",
      "Over today, plan better tomorrow.",
      "Above budget, reset tomorrow."
    ]
  }

  const statusMessages = messages[status]
  const index = Math.floor(Math.random() * statusMessages.length)
  return statusMessages[index]
}

/**
 * Determines if celebration should be shown
 */
function shouldCelebrate(status: AllowanceStatus, spentToday: number, dailyBudget: number): boolean {
  // Celebrate if under budget at end of day or significantly under mid-day
  return status === 'healthy' && spentToday < dailyBudget * 0.5
}

/**
 * Computes daily allowance with rollover and status
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * @param budgets - Array of budget limits by category
 * @param transactions - Array of all transactions
 * @param currentDate - Current date (for testing purposes)
 * @returns DailyAllowance object with amount, status, and message
 */
export function computeDailyAllowance(
  budgets: Budget[],
  transactions: Transaction[],
  currentDate: Date = new Date()
): DailyAllowance {
  // Step 1: Calculate total monthly budget from all category limits
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  
  // Step 2: Calculate daily budget
  const daysInMonth = getDaysInMonth(currentDate)
  const dailyBudget = totalMonthlyBudget / daysInMonth
  
  // Step 3: Calculate spentToday
  const todayStr = formatDateString(currentDate)
  const spentToday = transactions
    .filter(t => t.date === todayStr && t.type === 'expense')
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
    
    // Actual spend up to yesterday
    const actualSpendToYesterday = transactions
      .filter(t => {
        const txDate = t.date
        const startDate = formatDateString(monthStart)
        const endDate = formatDateString(yesterday)
        return txDate >= startDate && txDate <= endDate && t.type === 'expense'
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
  
  // Return valid DailyAllowance
  return {
    amount,
    dailyBudget,
    spentToday,
    rollover,
    status,
    message,
    showCelebration
  }
}
