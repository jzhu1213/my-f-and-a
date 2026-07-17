import type { Transaction, Budget, Goal } from '@/types'
import type { CelebrationEvent, CelebrationType, AnimationType } from '@/types/folio'

// ============================================================================
// Celebration Engine (Requirements 6.1–6.6)
// ============================================================================

/**
 * localStorage key used to persist triggered celebration IDs.
 * Prevents duplicate celebrations per qualifying event (Req 6.6).
 */
const STORAGE_KEY = 'folio_triggered_celebrations'

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Formats a Date object into YYYY-MM-DD string (UTC).
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Subtracts a number of days from a date (UTC).
 */
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() - days)
  return result
}

/**
 * Gets the set of previously triggered celebration IDs from localStorage.
 */
function getTriggeredCelebrations(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    return new Set(JSON.parse(stored) as string[])
  } catch {
    return new Set()
  }
}

/**
 * Persists the set of triggered celebration IDs to localStorage.
 */
function saveTriggeredCelebrations(triggered: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...triggered]))
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Marks a celebration as triggered so it won't fire again for the same event.
 */
function markTriggered(id: string): void {
  const triggered = getTriggeredCelebrations()
  triggered.add(id)
  saveTriggeredCelebrations(triggered)
}

/**
 * Checks whether a celebration has already been triggered.
 */
function hasBeenTriggered(id: string): boolean {
  return getTriggeredCelebrations().has(id)
}

/**
 * Calculates the total daily budget from monthly budget limits.
 */
function getDailyBudget(budgets: Budget[], date: Date): number {
  const totalMonthly = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate()
  return totalMonthly / daysInMonth
}

/**
 * Calculates total expense spending for a specific date string (YYYY-MM-DD).
 */
function getSpendingForDay(transactions: Transaction[], dateStr: string): number {
  return transactions
    .filter(t => t.date === dateStr && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Creates a CelebrationEvent with standard defaults.
 */
function createEvent(
  id: string,
  type: CelebrationType,
  title: string,
  message: string,
  emoji: string,
  animation: AnimationType,
  duration: number,
  sound?: 'subtle' | 'cheerful' | 'none'
): CelebrationEvent {
  return { id, type, title, message, emoji, animation, duration, sound }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Checks if the under-budget-today celebration should trigger.
 *
 * **Validates: Requirement 6.1**
 *
 * Fires when:
 * - The current hour is >= 21 (9 PM check)
 * - Today's total spending is < 80% of the daily budget
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkUnderBudgetToday(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const hour = now.getHours()
  if (hour < 21) return null

  const dailyBudget = getDailyBudget(budgets, now)
  if (dailyBudget <= 0) return null

  const todayStr = formatDate(now)
  const spentToday = getSpendingForDay(transactions, todayStr)

  if (spentToday >= dailyBudget * 0.8) return null

  const id = `under_budget_today_${todayStr}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'under_budget_today',
    'Under budget today!',
    "Nice work — you spent well below today's limit.",
    '🌟',
    'sparkle',
    3000,
    'subtle'
  )
}

/**
 * Checks if a 3-day under-budget streak celebration should trigger.
 *
 * **Validates: Requirement 6.2**
 *
 * Fires when the user has spent under their daily budget for 3 consecutive days
 * (yesterday and the 2 days before it).
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkStreak3Days(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const streak = calculateStreak(budgets, transactions, now)
  if (streak < 3) return null

  // Use the date that completed the streak for a unique ID
  const streakEndDate = formatDate(subtractDays(now, 1))
  const id = `streak_3_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_3_days',
    '3-day streak!',
    "Three days under budget in a row. You're building momentum!",
    '🔥',
    'confetti',
    4000,
    'cheerful'
  )
}

/**
 * Checks if a 7-day under-budget streak celebration should trigger.
 *
 * **Validates: Requirement 6.3**
 *
 * Fires when the user has spent under their daily budget for 7 consecutive days.
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkStreak7Days(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const streak = calculateStreak(budgets, transactions, now)
  if (streak < 7) return null

  const streakEndDate = formatDate(subtractDays(now, 1))
  const id = `streak_7_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_7_days',
    'One whole week!',
    "Seven days under budget — that's seriously impressive.",
    '🏆',
    'confetti',
    5000,
    'cheerful'
  )
}

/**
 * Checks if a goal progress milestone celebration should trigger.
 *
 * **Validates: Requirement 6.4**
 *
 * Fires at 25%, 50%, 75%, and 100% milestones for each goal.
 *
 * @param goals - User's savings goals
 * @returns Array of CelebrationEvents (one per newly reached milestone)
 */
export function checkGoalProgress(goals: Goal[]): CelebrationEvent[] {
  const events: CelebrationEvent[] = []
  const milestones = [25, 50, 75, 100]

  for (const goal of goals) {
    if (goal.targetAmount <= 0) continue
    const percent = (goal.currentAmount / goal.targetAmount) * 100

    for (const milestone of milestones) {
      if (percent < milestone) break

      const id = `goal_progress_${goal.id}_${milestone}`
      if (hasBeenTriggered(id)) continue

      markTriggered(id)

      const type: CelebrationType = milestone === 100 ? 'goal_complete' : 'goal_progress'
      const animation: AnimationType = milestone === 100 ? 'confetti' : 'bounce'
      const sound: 'subtle' | 'cheerful' = milestone === 100 ? 'cheerful' : 'subtle'
      const emoji = milestone === 100 ? '🎉' : '🎯'
      const title =
        milestone === 100
          ? `${goal.name} complete!`
          : `${milestone}% of ${goal.name}!`
      const message =
        milestone === 100
          ? `You did it! ${goal.name} is fully funded.`
          : `You're ${milestone}% of the way to ${goal.name}. Keep going!`

      events.push(createEvent(id, type, title, message, emoji, animation, 4000, sound))
    }
  }

  return events
}

/**
 * Checks if the first-transaction celebration should trigger.
 *
 * **Validates: Requirement 6.5**
 *
 * Fires when the user logs their very first transaction (count goes from 0 to 1).
 *
 * @param transactions - All user transactions
 * @returns CelebrationEvent or null
 */
export function checkFirstTransaction(
  transactions: Transaction[]
): CelebrationEvent | null {
  if (transactions.length !== 1) return null

  const id = 'first_transaction'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'first_transaction',
    'First one logged!',
    "You've started tracking. That's the hardest part.",
    '✨',
    'pulse',
    3500,
    'cheerful'
  )
}

/**
 * Runs all celebration checks and returns any newly triggered events.
 *
 * **Validates: Requirements 6.1–6.6**
 *
 * Convenience function that aggregates all celebration triggers into a single call.
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param goals - User's savings goals
 * @param now - Current date/time (for testability)
 * @returns Array of CelebrationEvents to display
 */
export function checkAllCelebrations(
  budgets: Budget[],
  transactions: Transaction[],
  goals: Goal[],
  now: Date = new Date()
): CelebrationEvent[] {
  const events: CelebrationEvent[] = []

  const underBudget = checkUnderBudgetToday(budgets, transactions, now)
  if (underBudget) events.push(underBudget)

  const streak3 = checkStreak3Days(budgets, transactions, now)
  if (streak3) events.push(streak3)

  const streak7 = checkStreak7Days(budgets, transactions, now)
  if (streak7) events.push(streak7)

  const goalEvents = checkGoalProgress(goals)
  events.push(...goalEvents)

  const firstTx = checkFirstTransaction(transactions)
  if (firstTx) events.push(firstTx)

  return events
}

/**
 * Clears all triggered celebration records.
 * Useful for testing or resetting user state.
 */
export function clearTriggeredCelebrations(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Internal: Streak Calculation
// ============================================================================

/**
 * Calculates the number of consecutive days (ending yesterday) where spending
 * was under the daily budget. Today is excluded because it's still in progress.
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns Number of consecutive under-budget days
 */
function calculateStreak(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date
): number {
  const dailyBudget = getDailyBudget(budgets, now)
  if (dailyBudget <= 0) return 0

  let streak = 0
  for (let i = 1; i <= 30; i++) {
    const day = subtractDays(now, i)
    const dayStr = formatDate(day)
    const spent = getSpendingForDay(transactions, dayStr)
    if (spent < dailyBudget) {
      streak++
    } else {
      break
    }
  }

  return streak
}
