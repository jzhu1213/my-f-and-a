import type { Transaction, Budget, Goal } from '@/types'
import type { CelebrationEvent, CelebrationType, AnimationType } from '@/types/folio'
import { getNoSpendStreak, isNoSpendWeekend } from '@/lib/noSpendChallenge'
import { CELEBRATION_EMOJI, CELEBRATION_COPY } from '@/lib/vocabulary'
import { formatDateLocal, subtractDaysLocal, getDaysInMonthLocal } from '@/lib/dateUtils'
import { checkIncomeGrowthMilestone, checkIncomeRecordMonth } from '@/lib/incomeEncouragement'
import { hasBeenTriggered, markTriggered } from '@/lib/celebrationDedup'
import { computeStreakData, getStreakData } from '@/lib/streaks'
import { isStreakCounterActive, isMilestoneCelebrationsActive } from '@/lib/gamificationPreferences'

// Re-export for consumers that previously imported from here
export { hasBeenTriggered, markTriggered } from '@/lib/celebrationDedup'

// ============================================================================
// Celebration Engine (Requirements 6.1–6.6)
// ============================================================================

/**
 * localStorage key used to persist triggered celebration IDs.
 * Prevents duplicate celebrations per qualifying event (Req 6.6).
 */
const STORAGE_KEY = 'folio_triggered_celebrations'

// ── Per-session dedup guard (Task 75) ────────────────────────────────────────
// Prevents the celebration engine from re-running identical checks multiple
// times within the same browser session (page load). Once checkAllCelebrations
// has evaluated a specific fingerprint, it won't re-evaluate until data changes.
let sessionCelebrationFingerprint: string | null = null

// ============================================================================
// Internal Helpers
// ============================================================================

// NOTE: Removed UTC-based formatDate and subtractDays functions.
// Now using local-time utilities from dateUtils.ts (Task 94.1).

/**
 * Calculates the total daily budget from monthly budget limits (using local time).
 */
function getDailyBudget(budgets: Budget[], date: Date): number {
  const totalMonthly = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const daysInMonth = getDaysInMonthLocal(date)
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

  const todayStr = formatDateLocal(now)
  const spentToday = getSpendingForDay(transactions, todayStr)

  if (spentToday >= dailyBudget * 0.8) return null

  const id = `under_budget_today_${todayStr}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'under_budget_today',
    CELEBRATION_COPY.under_budget_today.title,
    CELEBRATION_COPY.under_budget_today.message,
    CELEBRATION_EMOJI.under_budget_today,
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
  const streakEndDate = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `streak_3_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_3_days',
    CELEBRATION_COPY.streak_3_days.title,
    CELEBRATION_COPY.streak_3_days.message,
    CELEBRATION_EMOJI.streak_3_days,
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

  const streakEndDate = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `streak_7_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_7_days',
    CELEBRATION_COPY.streak_7_days.title,
    CELEBRATION_COPY.streak_7_days.message,
    CELEBRATION_EMOJI.streak_7_days,
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
      const emoji = milestone === 100 ? CELEBRATION_EMOJI.goal_complete : CELEBRATION_EMOJI.goal_progress
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
    CELEBRATION_COPY.first_transaction.title,
    CELEBRATION_COPY.first_transaction.message,
    CELEBRATION_EMOJI.first_transaction,
    'pulse',
    3500,
    'cheerful'
  )
}

/**
 * Checks if a no-spend streak or no-spend weekend celebration should trigger.
 *
 * **Validates: Requirements 5.4, 6.2**
 *
 * Fires when:
 * - The user has 3+ consecutive no-spend days (no expenses at all)
 * - The user completed a full no-spend weekend (Saturday + Sunday)
 *
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns Array of CelebrationEvents
 */
export function checkNoSpendStreak(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent[] {
  const events: CelebrationEvent[] = []

  // ── No-spend streak (3+ days) ──────────────────────────────────────────
  const yesterday = subtractDaysLocal(now, 1)
  const yesterdayStr = formatDateLocal(yesterday)

  const streak = getNoSpendStreak(transactions, yesterdayStr)
  if (streak >= 3) {
    const id = `no_spend_streak_${streak}_${yesterdayStr}`
    if (!hasBeenTriggered(id)) {
      markTriggered(id)
      events.push(createEvent(
        id,
        'no_spend_streak',
        CELEBRATION_COPY.no_spend_streak.title,
        streak >= 7
          ? "A whole week with no spending — that's some serious willpower. 🌟"
          : CELEBRATION_COPY.no_spend_streak.message,
        CELEBRATION_EMOJI.no_spend_streak,
        'sparkle',
        3500,
        'subtle'
      ))
    }
  }

  // ── No-spend weekend ───────────────────────────────────────────────────
  // Check if the most recent past weekend was a no-spend weekend
  const dayOfWeek = now.getDay() // 0=Sun, 6=Sat (local time)
  // Find last Sunday (or today if it's Monday, meaning weekend just ended)
  let lastSunday: Date
  if (dayOfWeek === 0) {
    // Today is Sunday — check last weekend (the one before)
    lastSunday = subtractDaysLocal(now, 7)
  } else {
    // Most recent Sunday
    lastSunday = subtractDaysLocal(now, dayOfWeek)
  }
  const lastSundayStr = formatDateLocal(lastSunday)

  if (isNoSpendWeekend(transactions, lastSundayStr)) {
    const weekendId = `no_spend_weekend_${lastSundayStr}`
    if (!hasBeenTriggered(weekendId)) {
      markTriggered(weekendId)
      events.push(createEvent(
        weekendId,
        'no_spend_weekend',
        CELEBRATION_COPY.no_spend_weekend.title,
        CELEBRATION_COPY.no_spend_weekend.message,
        CELEBRATION_EMOJI.no_spend_weekend,
        'bounce',
        3500,
        'subtle'
      ))
    }
  }

  return events
}

/**
 * Checks if a 14-day under-budget streak celebration should trigger.
 *
 * Fires when the user has spent under their daily budget for 14 consecutive days.
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkStreak14Days(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const streak = calculateStreak(budgets, transactions, now)
  if (streak < 14) return null

  const streakEndDate = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `streak_14_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_14_days',
    CELEBRATION_COPY.streak_14_days.title,
    CELEBRATION_COPY.streak_14_days.message,
    CELEBRATION_EMOJI.streak_14_days,
    'confetti',
    4000,
    'cheerful'
  )
}

/**
 * Checks if a 30-day under-budget streak celebration should trigger.
 *
 * Fires when the user has spent under their daily budget for 30 consecutive days.
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkStreak30Days(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const streak = calculateStreak(budgets, transactions, now)
  if (streak < 30) return null

  const streakEndDate = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `streak_30_days_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'streak_30_days',
    CELEBRATION_COPY.streak_30_days.title,
    CELEBRATION_COPY.streak_30_days.message,
    CELEBRATION_EMOJI.streak_30_days,
    'confetti',
    5000,
    'cheerful'
  )
}

/**
 * Returns the number of consecutive days (ending yesterday) where the user
 * logged at least one transaction. Today is excluded (still in progress).
 * Looks back up to 30 days.
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns Number of consecutive logging days (0–30)
 */
export function getLoggingStreak(
  transactions: Transaction[],
  now: Date = new Date()
): number {
  let streak = 0
  for (let i = 1; i <= 30; i++) {
    const day = subtractDaysLocal(now, i)
    const dayStr = formatDateLocal(day)
    const hasTransaction = transactions.some(t => t.date === dayStr)
    if (hasTransaction) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * Checks if a logging streak celebration should trigger.
 *
 * Fires at 3, 7, 14, and 30 consecutive days of logging at least one transaction.
 *
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkLoggingStreak(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const streak = getLoggingStreak(transactions, now)

  // Fire at specific milestones
  const milestones = [30, 14, 7, 3] // Check highest first
  const reachedMilestone = milestones.find(m => streak >= m)
  if (!reachedMilestone) return null

  const streakEndDate = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `logging_streak_${reachedMilestone}_${streakEndDate}`
  if (hasBeenTriggered(id)) return null

  const titles: Record<number, string> = {
    3: '3 days logging!',
    7: 'A week of logging!',
    14: 'Two weeks of logging!',
    30: 'A month of logging!',
  }
  const messages: Record<number, string> = {
    3: "Three days in a row — you're building a habit!",
    7: "A full week of tracking. That consistency pays off!",
    14: "Two weeks straight — tracking is second nature now.",
    30: "A whole month of daily logging. Incredible commitment!",
  }

  markTriggered(id)
  return createEvent(
    id,
    'logging_streak',
    titles[reachedMilestone],
    messages[reachedMilestone],
    CELEBRATION_EMOJI.logging_streak,
    reachedMilestone >= 14 ? 'confetti' : 'sparkle',
    reachedMilestone >= 14 ? 4000 : 3000,
    reachedMilestone >= 14 ? 'cheerful' : 'subtle'
  )
}

/**
 * Checks if the weekly win celebration should trigger.
 *
 * Fires on Monday when total spending for the prior week (Mon–Sun) was under
 * the total weekly budget (monthly limits ÷ ~4.33 weeks).
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkWeeklyWin(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  // Only trigger on Monday (day after the week ended)
  if (now.getDay() !== 1) return null

  const totalMonthly = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  if (totalMonthly <= 0) return null

  // Weekly budget = monthly / 4.33 (average weeks per month)
  const weeklyBudget = totalMonthly / 4.33

  // Calculate last week's spending (Monday through Sunday)
  // Today is Monday, so last week's Sunday was yesterday (1 day ago)
  // and last week's Monday was 7 days ago
  let weeklySpending = 0
  for (let i = 1; i <= 7; i++) {
    const day = subtractDaysLocal(now, i)
    const dayStr = formatDateLocal(day)
    weeklySpending += getSpendingForDay(transactions, dayStr)
  }

  if (weeklySpending >= weeklyBudget) return null

  const lastSunday = formatDateLocal(subtractDaysLocal(now, 1))
  const id = `weekly_win_${lastSunday}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'weekly_win',
    CELEBRATION_COPY.weekly_win.title,
    CELEBRATION_COPY.weekly_win.message,
    CELEBRATION_EMOJI.weekly_win,
    'confetti',
    4000,
    'cheerful'
  )
}

/**
 * Checks if today is the lowest spend day of the week so far.
 *
 * A micro-celebration that fires once per week when today's total spending
 * (so far) is the lowest of any completed day this week.
 * Only fires if we're past at least 2 days in the week and after 6 PM (to
 * ensure the day is mostly done).
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkLowestSpendDay(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  // Only check after 6 PM so the day is mostly done
  if (now.getHours() < 18) return null

  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...6=Sat
  // Need at least 2 prior days in the week to compare
  // Week starts on Monday (dayOfWeek 1)
  const daysIntoWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Mon=0, Tue=1...Sun=6
  if (daysIntoWeek < 2) return null

  const todayStr = formatDateLocal(now)
  const todaySpending = getSpendingForDay(transactions, todayStr)

  // Compare against each prior day this week
  for (let i = 1; i <= daysIntoWeek; i++) {
    const priorDay = subtractDaysLocal(now, i)
    const priorDayStr = formatDateLocal(priorDay)
    const priorSpending = getSpendingForDay(transactions, priorDayStr)
    if (todaySpending >= priorSpending) return null
  }

  // Today is the lowest — fire micro-celebration
  const id = `lowest_spend_day_${todayStr}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'lowest_spend_day',
    CELEBRATION_COPY.lowest_spend_day.title,
    CELEBRATION_COPY.lowest_spend_day.message,
    CELEBRATION_EMOJI.lowest_spend_day,
    'pulse',
    2000,
    'subtle'
  )
}

// ============================================================================
// Milestone Journeys (Phase 4 task 199.1)
// ----------------------------------------------------------------------------
// Warm, once-ever "re-engagement" moments that go beyond streaks: a user's
// first month with Folio, their first completed goal, and their first full
// no-spend week. Each fires exactly once (lifetime), guarded by the same
// localStorage dedup as every other celebration. They extend the streak and
// gentle re-engagement systems (Phase 1 task 77, Phase 2 task 126.1) by
// celebrating durable habits rather than transient streak counts.
// ============================================================================

/**
 * Returns the earliest transaction date (YYYY-MM-DD) across all transactions,
 * or null when there are none. Dates are ISO `YYYY-MM-DD` strings, so a plain
 * lexicographic min is chronologically correct.
 */
export function getFirstTransactionDate(transactions: Transaction[]): string | null {
  let earliest: string | null = null
  for (const tx of transactions) {
    const day = tx.date.slice(0, 10)
    if (earliest === null || day < earliest) earliest = day
  }
  return earliest
}

/**
 * Whole days elapsed between a `YYYY-MM-DD` day and `now` (local time).
 * Returns 0 for same-day and never goes negative.
 */
function daysSinceLocal(dayStr: string, now: Date): number {
  const [y, m, d] = dayStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = today.getTime() - start.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Number of days a user has been active (a once-ever milestone) after which the
 * "first month" journey fires. 30 days ≈ one month of showing up.
 */
const FIRST_MONTH_DAYS = 30

/**
 * Checks if the "first month with Folio" milestone should trigger.
 *
 * A warm, shame-free re-engagement moment: fires once, ever, when at least
 * 30 days have passed since the user's first logged transaction. It celebrates
 * simply *being here* — not a streak, not a budget outcome — so it lands even
 * for users whose streaks have lapsed (gentle re-engagement, task 77).
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkFirstMonth(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const firstDate = getFirstTransactionDate(transactions)
  if (firstDate === null) return null

  if (daysSinceLocal(firstDate, now) < FIRST_MONTH_DAYS) return null

  const id = 'milestone_first_month'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'first_month',
    CELEBRATION_COPY.first_month.title,
    CELEBRATION_COPY.first_month.message,
    CELEBRATION_EMOJI.first_month,
    'confetti',
    5000,
    'cheerful'
  )
}

/**
 * Checks if the "first goal reached" milestone should trigger.
 *
 * Fires once, ever, the first time *any* goal reaches 100% funded. This is a
 * lifetime journey milestone distinct from the per-goal `goal_complete`
 * celebration — it marks the moment the user proves to themselves that goals
 * are achievable.
 *
 * @param goals - User's savings goals
 * @returns CelebrationEvent or null
 */
export function checkFirstGoalMet(goals: Goal[]): CelebrationEvent | null {
  const hasCompletedGoal = goals.some(
    g => g.targetAmount > 0 && g.currentAmount >= g.targetAmount
  )
  if (!hasCompletedGoal) return null

  const id = 'milestone_first_goal_met'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'first_goal_met',
    CELEBRATION_COPY.first_goal_met.title,
    CELEBRATION_COPY.first_goal_met.message,
    CELEBRATION_EMOJI.first_goal_met,
    'confetti',
    5000,
    'cheerful'
  )
}

/**
 * Checks if the "first full no-spend week" milestone should trigger.
 *
 * Fires once, ever, the first time the user reaches a 7+ day no-spend streak
 * (counted back from yesterday, since today is still in progress). Builds on
 * the existing no-spend streak infrastructure but marks the first week as a
 * distinct, lasting achievement.
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkFirstNoSpendWeek(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const yesterdayStr = formatDateLocal(subtractDaysLocal(now, 1))
  const streak = getNoSpendStreak(transactions, yesterdayStr)
  if (streak < 7) return null

  const id = 'milestone_first_no_spend_week'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'first_no_spend_week',
    CELEBRATION_COPY.first_no_spend_week.title,
    CELEBRATION_COPY.first_no_spend_week.message,
    CELEBRATION_EMOJI.first_no_spend_week,
    'confetti',
    5000,
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
  // ── Per-session dedup: skip if we already evaluated this exact data state ──
  const fingerprint = `${transactions.length}:${goals.map(g => `${g.id}:${g.currentAmount}`).join('|')}:${now.toISOString().slice(0, 13)}`
  if (fingerprint === sessionCelebrationFingerprint) return []
  sessionCelebrationFingerprint = fingerprint

  const events: CelebrationEvent[] = []

  const underBudget = checkUnderBudgetToday(budgets, transactions, now)
  if (underBudget) events.push(underBudget)

  const streak3 = checkStreak3Days(budgets, transactions, now)
  if (streak3) events.push(streak3)

  const streak7 = checkStreak7Days(budgets, transactions, now)
  if (streak7) events.push(streak7)

  const streak14 = checkStreak14Days(budgets, transactions, now)
  if (streak14) events.push(streak14)

  const streak30 = checkStreak30Days(budgets, transactions, now)
  if (streak30) events.push(streak30)

  const goalEvents = checkGoalProgress(goals)
  events.push(...goalEvents)

  const firstTx = checkFirstTransaction(transactions)
  if (firstTx) events.push(firstTx)

  // No-spend streak and weekend celebrations
  const noSpendEvents = checkNoSpendStreak(transactions, now)
  events.push(...noSpendEvents)

  // Logging streak celebration
  const loggingStreak = checkLoggingStreak(transactions, now)
  if (loggingStreak) events.push(loggingStreak)

  // Weekly win celebration (fires on Mondays)
  const weeklyWin = checkWeeklyWin(budgets, transactions, now)
  if (weeklyWin) events.push(weeklyWin)

  // Micro-celebration: lowest spend day this week
  const lowestSpend = checkLowestSpendDay(transactions, now)
  if (lowestSpend) events.push(lowestSpend)

  // ── Milestone journeys (Phase 4 task 199.1) ────────────────────────────
  // Once-ever warm moments that reward durable habits and re-engagement.
  const firstMonth = checkFirstMonth(transactions, now)
  if (firstMonth) events.push(firstMonth)

  const firstGoalMet = checkFirstGoalMet(goals)
  if (firstGoalMet) events.push(firstGoalMet)

  const firstNoSpendWeek = checkFirstNoSpendWeek(transactions, now)
  if (firstNoSpendWeek) events.push(firstNoSpendWeek)

  // ── Income encouragement (Phase 11 task 356.1) ─────────────────────────
  const incomeGrowth = checkIncomeGrowthMilestone(transactions, now)
  if (incomeGrowth) events.push(incomeGrowth)

  const incomeRecord = checkIncomeRecordMonth(transactions, now)
  if (incomeRecord) events.push(incomeRecord)

  // ── New user first-week milestones (Phase 13 task 393.1) ───────────────
  const newUserFirstExpense = checkNewUserFirstExpense(transactions, now)
  if (newUserFirstExpense) events.push(newUserFirstExpense)

  const newUserFirstDay = checkNewUserFirstDay(budgets, transactions, now)
  if (newUserFirstDay) events.push(newUserFirstDay)

  const newUser3DayStreak = checkNewUser3DayStreak(transactions, now)
  if (newUser3DayStreak) events.push(newUser3DayStreak)

  const newUserFirstWeek = checkNewUserFirstWeek(transactions, now)
  if (newUserFirstWeek) events.push(newUserFirstWeek)

  // ── Streak milestones (Phase 17 task 430.3) ────────────────────────────
  const streakMilestone = checkStreakMilestone(transactions, now)
  if (streakMilestone) events.push(streakMilestone)

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
// Streak Milestones (Phase 17 task 430.3)
// ============================================================================

/**
 * Streak milestone thresholds and their celebration copy.
 * Uses the grace-day-aware streak from src/lib/streaks.ts (not the simpler
 * logging streak) for a fair, forgiving measure.
 *
 * Requirements: 25.1, 25.4
 */
const STREAK_MILESTONES: {
  days: number
  title: string
  message: string
  animation: AnimationType
  duration: number
  sound: 'subtle' | 'cheerful'
}[] = [
  {
    days: 7,
    title: 'One week!',
    message: "7 days of tracking — the start of something great.",
    animation: 'sparkle',
    duration: 3000,
    sound: 'subtle',
  },
  {
    days: 14,
    title: 'Two weeks strong!',
    message: "14 days — this is becoming part of your routine.",
    animation: 'confetti',
    duration: 3500,
    sound: 'cheerful',
  },
  {
    days: 30,
    title: '30 days!',
    message: "30 days — you've built a real habit.",
    animation: 'confetti',
    duration: 4000,
    sound: 'cheerful',
  },
  {
    days: 60,
    title: '60 days!',
    message: "Two months of consistent tracking. Genuinely impressive.",
    animation: 'confetti',
    duration: 4500,
    sound: 'cheerful',
  },
  {
    days: 100,
    title: '100 days!',
    message: "Triple digits. You've made mindful spending a lifestyle.",
    animation: 'confetti',
    duration: 5000,
    sound: 'cheerful',
  },
]

/**
 * Checks if a streak milestone celebration should fire based on the grace-day
 * aware streak from `src/lib/streaks.ts`.
 *
 * Fires at 7, 14, 30, 60, and 100-day thresholds. Each fires only once per
 * streak instance (dedup key includes the threshold).
 *
 * @param transactions - All user transactions
 * @param now - Current date (for testability)
 * @returns CelebrationEvent or null
 */
export function checkStreakMilestone(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  // Respect gamification toggle — streak milestones are gamification (Req 25.5)
  if (!isStreakCounterActive()) return null

  // Get the grace-day-aware streak data
  const stored = getStreakData()
  const zeroSpendDays = stored?.zeroSpendDays ?? []
  const streakData = computeStreakData(transactions, zeroSpendDays, now)

  const currentStreak = streakData.currentStreak
  if (currentStreak < 7) return null

  // Check milestones from highest to lowest — fire the highest one not yet triggered
  for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
    const milestone = STREAK_MILESTONES[i]
    if (currentStreak < milestone.days) continue

    const id = `streak_milestone_${milestone.days}`
    if (hasBeenTriggered(id)) continue

    markTriggered(id)
    return createEvent(
      id,
      'streak_milestone',
      milestone.title,
      milestone.message,
      '🔥',
      milestone.animation,
      milestone.duration,
      milestone.sound
    )
  }

  return null
}

// ============================================================================
// Public: Streak Calculation
// ============================================================================

/**
 * Returns the number of consecutive under-budget days ending yesterday.
 * Today is excluded because it's still in progress. Looks back up to 30 days.
 *
 * Use this to display the user's current streak in tips, UI badges, or
 * celebration logic.
 *
 * **Validates: Requirements 5.4, 6.2**
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date/time (defaults to now for convenience)
 * @returns Number of consecutive under-budget days (0–30)
 */
export function getUnderBudgetStreak(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): number {
  const dailyBudget = getDailyBudget(budgets, now)
  if (dailyBudget <= 0) return 0

  let streak = 0
  for (let i = 1; i <= 30; i++) {
    const day = subtractDaysLocal(now, i)
    const dayStr = formatDateLocal(day)
    const spent = getSpendingForDay(transactions, dayStr)
    if (spent < dailyBudget) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Internal alias for backward compatibility with celebration checks.
 */
function calculateStreak(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date
): number {
  return getUnderBudgetStreak(budgets, transactions, now)
}

// ============================================================================
// New User First-Week Milestones (Phase 13 task 393.1)
// ----------------------------------------------------------------------------
// Supplemental celebrations gated to users within their first 7 days. These
// fire *in addition to* the existing celebrations (never replace them). A user
// is considered "new" if their first transaction date is <= 7 days ago.
// ============================================================================

/**
 * Returns true if the user is within their first 7 days (based on their
 * earliest transaction date). Returns false if there are no transactions.
 */
function isNewUser(transactions: Transaction[], now: Date): boolean {
  const firstDate = getFirstTransactionDate(transactions)
  if (firstDate === null) return false
  return daysSinceLocal(firstDate, now) <= 7
}

/**
 * Checks if the "first expense logged" new-user milestone should trigger.
 *
 * Fires once for new users (first 7 days) when they log their very first
 * expense transaction. Distinct from the generic `first_transaction` celebration.
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkNewUserFirstExpense(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  if (!isNewUser(transactions, now)) return null

  // Must have at least one expense transaction
  const hasExpense = transactions.some(t => t.type === 'expense')
  if (!hasExpense) return null

  const id = 'new_user_first_expense'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'new_user_first_expense',
    CELEBRATION_COPY.new_user_first_expense.title,
    CELEBRATION_COPY.new_user_first_expense.message,
    CELEBRATION_EMOJI.new_user_first_expense,
    'sparkle',
    3000,
    'subtle'
  )
}

/**
 * Checks if the "first full day tracked" new-user milestone should trigger.
 *
 * Fires once for new users when they have at least 1 expense logged AND stayed
 * under their daily budget on their first complete day (the day of their first
 * transaction, checked the following day).
 *
 * @param budgets - User's budget limits
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkNewUserFirstDay(
  budgets: Budget[],
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  if (!isNewUser(transactions, now)) return null

  const firstDate = getFirstTransactionDate(transactions)
  if (firstDate === null) return null

  // Only fire the day *after* the first day (so the first day is complete)
  if (daysSinceLocal(firstDate, now) < 1) return null

  const dailyBudget = getDailyBudget(budgets, now)
  if (dailyBudget <= 0) return null

  // Check spending on the first day
  const firstDaySpending = getSpendingForDay(transactions, firstDate)
  if (firstDaySpending >= dailyBudget) return null

  // Must have logged at least one expense on the first day
  const hasExpenseOnFirstDay = transactions.some(
    t => t.date === firstDate && t.type === 'expense'
  )
  if (!hasExpenseOnFirstDay) return null

  const id = 'new_user_first_day'
  if (hasBeenTriggered(id)) return null

  const spentStr = `$${Math.round(firstDaySpending)}`
  markTriggered(id)
  return createEvent(
    id,
    'new_user_first_day',
    CELEBRATION_COPY.new_user_first_day.title,
    `Day 1 complete — you stayed at ${spentStr}.`,
    CELEBRATION_EMOJI.new_user_first_day,
    'sparkle',
    3500,
    'subtle'
  )
}

/**
 * Checks if the "3 days in a row" new-user milestone should trigger.
 *
 * Fires once for new users when they have a 3+ day logging streak (at least
 * one transaction logged on each of 3 consecutive days ending yesterday).
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkNewUser3DayStreak(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  if (!isNewUser(transactions, now)) return null

  const loggingStreak = getLoggingStreak(transactions, now)
  if (loggingStreak < 3) return null

  const id = 'new_user_3_day_streak'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'new_user_3_day_streak',
    CELEBRATION_COPY.new_user_3_day_streak.title,
    "3 days running — you're building a habit.",
    CELEBRATION_EMOJI.new_user_3_day_streak,
    'sparkle',
    3500,
    'subtle'
  )
}

/**
 * Checks if the "first week" new-user milestone should trigger.
 *
 * Fires once when exactly 7 days have passed since the user's first transaction.
 *
 * @param transactions - All user transactions
 * @param now - Current date/time (for testability)
 * @returns CelebrationEvent or null
 */
export function checkNewUserFirstWeek(
  transactions: Transaction[],
  now: Date = new Date()
): CelebrationEvent | null {
  const firstDate = getFirstTransactionDate(transactions)
  if (firstDate === null) return null

  // Fire when exactly 7 days have passed (the boundary of "first week")
  if (daysSinceLocal(firstDate, now) < 7) return null

  const id = 'new_user_first_week'
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'new_user_first_week',
    CELEBRATION_COPY.new_user_first_week.title,
    "One week down. You know more about your money than most.",
    CELEBRATION_EMOJI.new_user_first_week,
    'confetti',
    4000,
    'cheerful'
  )
}

// ============================================================================
// Wish List Completion (Phase 11 task 352.3)
// ============================================================================

/**
 * Creates a celebration event when a wish list item is marked complete.
 *
 * This is triggered imperatively (not as part of checkAllCelebrations) because
 * wish completion is an explicit user action, not an automatic detection.
 *
 * @param wishItemId - Unique ID of the completed wish item
 * @param wishItemName - Display name of the item (used in copy)
 * @returns CelebrationEvent or null (if already triggered)
 */
export function createWishCompleteCelebration(
  wishItemId: string,
  wishItemName: string
): CelebrationEvent | null {
  const id = `wish_complete_${wishItemId}`
  if (hasBeenTriggered(id)) return null

  markTriggered(id)
  return createEvent(
    id,
    'wish_complete',
    `You did it!`,
    `Enjoy your ${wishItemName}! 🎉`,
    '🌟',
    'confetti',
    5000,
    'cheerful'
  )
}
