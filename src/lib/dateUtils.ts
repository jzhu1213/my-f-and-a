// ============================================================================
// Date Utilities — Pure Functions (Local Time)
// ============================================================================
//
// DESIGN DECISION: All date utilities in this module use LOCAL TIME, not UTC.
// This ensures "today" means the user's local calendar day, not UTC's day.
//
// Problem: UTC-based date functions cause timezone bugs:
//   - At 11:59 PM PST (UTC-8), UTC date is already the next day
//   - Transactions logged at night appear as the next day
//   - Daily resets happen at the wrong time for users
//
// Solution: Use local time methods (getFullYear, getMonth, getDate) throughout.
// The only exception is when storing/parsing ISO strings, which remain in local
// time but are formatted without timezone suffixes for database compatibility.
//
// ============================================================================

/**
 * Formats a Date object into YYYY-MM-DD string using LOCAL time.
 * This is the canonical date formatting function for all business logic.
 *
 * @param date - Date object to format
 * @returns YYYY-MM-DD string representing the local calendar date
 *
 * @example
 * // At 11:59 PM PST on Dec 31, 2023:
 * formatDateLocal(new Date()) // "2023-12-31" (correct local date)
 * // vs UTC formatting would return "2024-01-01" (wrong!)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gets the first day of the month for a given date using LOCAL time.
 *
 * @param date - Date object
 * @returns Date object set to the first day of the month at local midnight
 */
export function getMonthStartLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Gets the last day of the month for a given date using LOCAL time.
 *
 * @param date - Date object
 * @returns Date object set to the last day of the month at local midnight
 */
export function getMonthEndLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Subtracts days from a date using LOCAL time.
 *
 * @param date - Starting date
 * @param days - Number of days to subtract
 * @returns New Date object with days subtracted
 */
export function subtractDaysLocal(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setDate(result.getDate() - days)
  return result
}

/**
 * Adds days to a date using LOCAL time.
 *
 * @param date - Starting date
 * @param days - Number of days to add
 * @returns New Date object with days added
 */
export function addDaysLocal(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Gets the number of days in the month for a given date using LOCAL time.
 *
 * @param date - Date object
 * @returns Number of days in the month (28-31)
 */
export function getDaysInMonthLocal(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Parses a YYYY-MM-DD string into a Date object at local midnight.
 * This is the canonical parsing function for date strings from the database.
 *
 * @param dateStr - YYYY-MM-DD string
 * @returns Date object set to local midnight on the specified date
 *
 * @example
 * parseDateLocal("2023-12-31") // Date object at 2023-12-31 00:00:00 local time
 */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Gets today's date as a YYYY-MM-DD string using LOCAL time.
 * This is the canonical "today" function for all business logic.
 *
 * @returns YYYY-MM-DD string for today's local date
 */
export function getTodayLocal(): string {
  return formatDateLocal(new Date())
}

/**
 * Gets yesterday's date as a YYYY-MM-DD string using LOCAL time.
 *
 * @returns YYYY-MM-DD string for yesterday's local date
 */
export function getYesterdayLocal(): string {
  return formatDateLocal(subtractDaysLocal(new Date(), 1))
}

/**
 * Checks if two dates represent the same local calendar day.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are the same local calendar day
 */
export function isSameDayLocal(date1: Date, date2: Date): boolean {
  return formatDateLocal(date1) === formatDateLocal(date2)
}

/**
 * Returns a human-friendly relative date label using LOCAL time.
 * - "Today" for the current date
 * - "Yesterday" for the previous date
 * - A short format like "Jun 15" otherwise
 *
 * Expects `dateStr` in ISO date format (YYYY-MM-DD).
 */
export function getRelativeDate(dateStr: string): string {
  const today = getTodayLocal()
  const yesterday = getYesterdayLocal()
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  const d = parseDateLocal(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Calculates the number of days remaining in the month from a given date (inclusive).
 * Uses LOCAL time for accurate month-boundary calculations.
 *
 * @param fromDate - The starting date (inclusive)
 * @param currentDate - The current date (used to determine which month we're in)
 * @returns Number of days from `fromDate` to end of the month (inclusive of fromDate)
 */
export function getDaysRemainingFromLocal(fromDate: Date, currentDate: Date): number {
  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate()
  const fromDay = fromDate.getDate()
  return lastDayOfMonth - fromDay + 1
}
