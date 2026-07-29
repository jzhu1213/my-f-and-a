import type { Transaction } from '@/types'

/**
 * Result of the weekend allowance computation.
 */
export interface WeekendAllowanceResult {
  /** Amount safe to spend this weekend */
  weekendAmount: number
  /** Contextual label: "This weekend" (Fri/Sat/Sun) or "Next weekend" (Mon–Thu) */
  label: string
  /** Days until the next weekend starts (0 if already a weekend day) */
  daysUntilWeekend: number
}

/**
 * Computes a "safe to spend this weekend" number from the user's daily budget.
 *
 * Rules:
 * - If today is Friday (after noon), Saturday, or Sunday → "This weekend"
 *   Weekend days remaining: Fri counts as 0.5 (after noon), Sat = 1, Sun = 1
 *   weekendAmount = dailyBudget × daysInWeekend + rollover − alreadySpentThisWeekend
 *
 * - If today is Monday–Thursday → "Next weekend"
 *   weekendAmount = dailyBudget × 2 (Sat + Sun budget assuming you stick to plan)
 *   No rollover or spending subtracted — it's a forward projection
 *
 * @param dailyBudget - The user's computed daily discretionary budget
 * @param transactions - All user transactions (used to sum weekend spending)
 * @param currentDate - The current date/time (for testability)
 * @returns WeekendAllowanceResult with amount, label, and daysUntilWeekend
 *
 * @pure No side effects, no internal Date.now() calls.
 */
export function computeWeekendAllowance(
  dailyBudget: number,
  transactions: Transaction[],
  currentDate: Date
): WeekendAllowanceResult {
  // getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const dayOfWeek = currentDate.getDay()
  const hour = currentDate.getHours()

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6

  if (!isWeekend) {
    // Mon–Thu: project forward. Weekend = Sat + Sun = 2 days of budget.
    // daysUntilWeekend = days until Friday (day 5)
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
    // We show "Next weekend" and just project 2 full days of budget
    return {
      weekendAmount: Math.max(0, Math.round(dailyBudget * 2)),
      label: 'Next weekend',
      daysUntilWeekend: daysUntilFriday,
    }
  }

  // It's a weekend day (Fri, Sat, or Sun) — compute remaining weekend budget
  let daysRemaining: number

  if (dayOfWeek === 5) {
    // Friday: count as 0.5 if after noon, plus Sat (1) + Sun (1) = 2.5 or 2
    daysRemaining = hour >= 12 ? 0.5 + 2 : 1 + 2
  } else if (dayOfWeek === 6) {
    // Saturday: rest of today (1) + Sunday (1) = 2
    daysRemaining = 2
  } else {
    // Sunday: just today (1)
    daysRemaining = 1
  }

  // Sum expenses already spent this weekend (Fri + Sat + Sun of the current weekend)
  const weekendDates = getThisWeekendDates(currentDate)
  const alreadySpent = transactions
    .filter(t =>
      t.type === 'expense' &&
      weekendDates.includes(t.date)
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Rollover is already baked into dailyBudget via the allowance calculation,
  // so we just multiply dailyBudget by remaining weekend days minus what's spent.
  const weekendAmount = Math.max(0, Math.round(dailyBudget * daysRemaining - alreadySpent))

  return {
    weekendAmount,
    label: 'This weekend',
    daysUntilWeekend: 0,
  }
}

/**
 * Returns an array of YYYY-MM-DD date strings for the current weekend
 * (Friday, Saturday, Sunday) containing `currentDate`.
 *
 * If currentDate is Friday → [Fri, Sat, Sun]
 * If currentDate is Saturday → [Fri, Sat, Sun]  (Fri = yesterday)
 * If currentDate is Sunday → [Fri, Sat, Sun]  (Fri = 2 days ago)
 */
function getThisWeekendDates(currentDate: Date): string[] {
  const dayOfWeek = currentDate.getDay()
  const dates: string[] = []

  // Find the Friday of this weekend
  let fridayOffset: number
  if (dayOfWeek === 5) fridayOffset = 0
  else if (dayOfWeek === 6) fridayOffset = -1
  else fridayOffset = -2 // Sunday

  for (let i = 0; i < 3; i++) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + fridayOffset + i)
    dates.push(formatDate(d))
  }

  return dates
}

/**
 * Formats a Date into YYYY-MM-DD string (local time).
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
