// ============================================================================
// Bill Weekly Outlook — calendar helpers & bill-heavy week detection
// ============================================================================

import type { FixedExpense } from "./fixedExpenses"

/**
 * Represents a single week in the month with its bill totals.
 */
export interface WeekBillSummary {
  /** Start date of the week (Monday) */
  startDate: Date
  /** End date of the week (Sunday) */
  endDate: Date
  /** Total bills due in this week */
  totalAmount: number
  /** Individual bills due in this week */
  bills: FixedExpense[]
  /** Whether this is the current week */
  isCurrent: boolean
}

/**
 * Represents a day in the monthly calendar grid.
 */
export interface CalendarDay {
  /** Day of month (1–31) */
  day: number
  /** Bills due on this day */
  bills: FixedExpense[]
  /** Total amount due this day */
  totalAmount: number
  /** Whether this is today */
  isToday: boolean
  /** Whether this day is in the current month (false = padding day) */
  isCurrentMonth: boolean
}

/**
 * A bill-heavy week warning payload.
 */
export interface BillHeavyWeekWarning {
  /** Total amount due next week */
  nextWeekTotal: number
  /** Average weekly bill total for the month */
  averageWeeklyTotal: number
  /** How much above average (as a multiplier, e.g. 1.6 = 60% above) */
  aboveAverageMultiplier: number
  /** Human-friendly message */
  message: string
}

// ============================================================================
// Core functions
// ============================================================================

/**
 * Get the Monday of the week containing the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay() returns 0 for Sunday, so adjust
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the Sunday of the week containing the given date.
 */
function getSunday(date: Date): Date {
  const monday = getMonday(date)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday
}

/**
 * Builds the monthly calendar grid for the bill calendar view.
 * Returns days for the given month including leading/trailing padding days
 * to fill complete weeks.
 */
export function buildMonthCalendar(
  bills: FixedExpense[],
  year: number,
  month: number, // 0-indexed (0 = January)
  today: Date
): CalendarDay[] {
  const activeBills = bills.filter(b => b.isActive)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1)
  const todayDate = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  // Determine which weekday the 1st falls on (0 = Sun, adjust for Mon-start)
  let startPadding = firstDay.getDay() - 1
  if (startPadding < 0) startPadding = 6 // Sunday becomes 6

  const days: CalendarDay[] = []

  // Leading padding (prev month days)
  for (let i = 0; i < startPadding; i++) {
    days.push({
      day: 0,
      bills: [],
      totalAmount: 0,
      isToday: false,
      isCurrentMonth: false,
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dayBills = activeBills.filter(b => b.dueDay === d)
    const totalAmount = dayBills.reduce((sum, b) => sum + b.amount, 0)
    const isToday = d === todayDate && month === todayMonth && year === todayYear

    days.push({
      day: d,
      bills: dayBills,
      totalAmount,
      isToday,
      isCurrentMonth: true,
    })
  }

  // Trailing padding to fill last week
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 0; i < remaining; i++) {
      days.push({
        day: 0,
        bills: [],
        totalAmount: 0,
        isToday: false,
        isCurrentMonth: false,
      })
    }
  }

  return days
}

/**
 * Computes weekly bill summaries for the given month.
 * Splits the month into calendar weeks (Mon–Sun) and sums bill amounts per week.
 */
export function getWeeklyBillSummaries(
  bills: FixedExpense[],
  year: number,
  month: number, // 0-indexed
  today: Date
): WeekBillSummary[] {
  const activeBills = bills.filter(b => b.isActive)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Find the Monday of the week containing the 1st
  const firstOfMonth = new Date(year, month, 1)
  const firstMonday = getMonday(firstOfMonth)

  // Find the Sunday of the week containing the last day
  const lastOfMonth = new Date(year, month, daysInMonth)
  const lastSunday = getSunday(lastOfMonth)

  const currentMonday = getMonday(today)

  const weeks: WeekBillSummary[] = []
  let weekStart = new Date(firstMonday)

  while (weekStart <= lastSunday) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    // Find bills in this week that fall within the target month
    const weekBills = activeBills.filter(b => {
      const billDate = new Date(year, month, b.dueDay)
      // Only include if the bill day is valid for this month
      if (b.dueDay > daysInMonth) return false
      return billDate >= weekStart && billDate <= weekEnd
    })

    const totalAmount = weekBills.reduce((sum, b) => sum + b.amount, 0)
    const isCurrent = weekStart.getTime() === currentMonday.getTime()

    weeks.push({
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd),
      totalAmount,
      bills: weekBills,
      isCurrent,
    })

    // Advance to next Monday
    weekStart.setDate(weekStart.getDate() + 7)
  }

  return weeks
}

/**
 * Detects whether the upcoming week has significantly more bills than average.
 * Fires when next week's total is >50% above the monthly average weekly total.
 *
 * @param bills - All recurring bills
 * @param today - Current date
 * @returns Warning payload or null if conditions aren't met
 *
 * Validates: Requirements 23.5, 23.6
 */
export function detectBillHeavyWeek(
  bills: FixedExpense[],
  today: Date
): BillHeavyWeekWarning | null {
  const activeBills = bills.filter(b => b.isActive)
  if (activeBills.length === 0) return null

  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Next week = Monday after this week's Monday
  const currentMonday = getMonday(today)
  const nextMonday = new Date(currentMonday)
  nextMonday.setDate(currentMonday.getDate() + 7)
  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6)

  // Bills due next week (considering only the current month)
  const nextWeekBills = activeBills.filter(b => {
    if (b.dueDay > daysInMonth) return false
    const billDate = new Date(year, month, b.dueDay)
    return billDate >= nextMonday && billDate <= nextSunday
  })

  const nextWeekTotal = nextWeekBills.reduce((sum, b) => sum + b.amount, 0)

  // If next week has no bills, no warning needed
  if (nextWeekTotal === 0) return null

  // Compute average weekly bill total for the month
  // Total monthly / ~4.33 weeks per month
  const totalMonthly = activeBills
    .filter(b => b.dueDay <= daysInMonth)
    .reduce((sum, b) => sum + b.amount, 0)
  const weeksInMonth = Math.ceil(daysInMonth / 7)
  const averageWeeklyTotal = totalMonthly / weeksInMonth

  // Only warn if >50% above average
  if (averageWeeklyTotal <= 0) return null
  const multiplier = nextWeekTotal / averageWeeklyTotal
  if (multiplier < 1.5) return null

  const formattedTotal = nextWeekTotal.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })

  return {
    nextWeekTotal,
    averageWeeklyTotal: Math.round(averageWeeklyTotal),
    aboveAverageMultiplier: Math.round(multiplier * 100) / 100,
    message: `Heads up — next week has around $${formattedTotal} in bills coming up.`,
  }
}
