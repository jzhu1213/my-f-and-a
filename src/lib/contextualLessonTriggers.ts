/**
 * Contextual Lesson Triggers
 *
 * Detects key user milestones (first goal created, first over-budget week)
 * and provides localStorage guards so each trigger fires at most once.
 *
 * These are pure utility functions — the actual tip selection lives in tipUtils.ts.
 */

// ============================================================================
// localStorage Keys
// ============================================================================

/** Whether the "first goal" micro-lesson has been shown. */
const FIRST_GOAL_LESSON_KEY = 'folio-first-goal-lesson-seen'

/** Whether the "first over-budget week" micro-lesson has been shown. */
const OVER_BUDGET_WEEK_LESSON_KEY = 'folio-over-budget-week-lesson-seen'

/** Whether the "first savings account" micro-lesson has been shown. */
const FIRST_SAVINGS_ACCOUNT_LESSON_KEY = 'folio-first-savings-account-lesson-seen'

/** Whether the "first savings contribution" micro-lesson has been shown. */
const FIRST_CONTRIBUTION_LESSON_KEY = 'folio-first-contribution-lesson-seen'

// ============================================================================
// First Goal Lesson
// ============================================================================

/**
 * Returns true if the user has already been shown the first-goal micro-lesson.
 */
export function hasSeenFirstGoalLesson(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(FIRST_GOAL_LESSON_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Marks that the first-goal micro-lesson has been shown.
 */
export function markFirstGoalLessonSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FIRST_GOAL_LESSON_KEY, 'true')
  } catch {
    // best-effort
  }
}

// ============================================================================
// First Over-Budget Week Lesson
// ============================================================================

/**
 * Returns true if the user has already been shown the over-budget-week micro-lesson.
 */
export function hasSeenOverBudgetWeekLesson(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(OVER_BUDGET_WEEK_LESSON_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Marks that the over-budget-week micro-lesson has been shown.
 */
export function markOverBudgetWeekLessonSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OVER_BUDGET_WEEK_LESSON_KEY, 'true')
  } catch {
    // best-effort
  }
}

// ============================================================================
// First Savings Account Lesson
// ============================================================================

/**
 * Returns true if the user has already been shown the first-savings-account micro-lesson.
 */
export function hasSeenFirstSavingsAccountLesson(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(FIRST_SAVINGS_ACCOUNT_LESSON_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Marks that the first-savings-account micro-lesson has been shown.
 */
export function markFirstSavingsAccountLessonSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FIRST_SAVINGS_ACCOUNT_LESSON_KEY, 'true')
  } catch {
    // best-effort
  }
}

// ============================================================================
// First Savings Contribution Lesson
// ============================================================================

/**
 * Returns true if the user has already been shown the first-contribution micro-lesson.
 */
export function hasSeenFirstContributionLesson(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(FIRST_CONTRIBUTION_LESSON_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Marks that the first-contribution micro-lesson has been shown.
 */
export function markFirstContributionLessonSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FIRST_CONTRIBUTION_LESSON_KEY, 'true')
  } catch {
    // best-effort
  }
}

// ============================================================================
// Over-Budget Week Detection (pure function)
// ============================================================================

/**
 * Counts the number of days in the last 7 days where expense spending exceeded
 * the user's daily budget. Used to detect whether the user just had their first
 * over-budget week (5+ days over budget in the past 7 days).
 *
 * @param transactions - All user transactions
 * @param dailyBudget - The user's computed daily budget
 * @param today - Today's date as YYYY-MM-DD (injected for testability)
 * @returns Number of days in the last 7 where spending exceeded dailyBudget
 */
export function countOverBudgetDaysLast7(
  transactions: { type: string; date: string; amount: number }[],
  dailyBudget: number,
  today: string
): number {
  if (dailyBudget <= 0) return 0

  const todayDate = new Date(today + 'T00:00:00')
  const daySpend: Record<string, number> = {}

  // Accumulate expense spending per day for the last 7 days
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    daySpend[key] = 0
  }

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const txDate = tx.date.slice(0, 10)
    if (txDate in daySpend) {
      daySpend[txDate] += tx.amount
    }
  }

  // Count days where spending exceeded the daily budget
  let overBudgetDays = 0
  for (const amount of Object.values(daySpend)) {
    if (amount > dailyBudget) {
      overBudgetDays++
    }
  }

  return overBudgetDays
}
