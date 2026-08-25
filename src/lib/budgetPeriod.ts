/**
 * Budget Period — user-facing period preference for the daily allowance engine.
 *
 * This module provides a simpler, user-level "budget period" setting that selects
 * which time-cycle to use for the daily allowance calculation. Unlike the existing
 * term/payday mechanisms (which are triggered by budget `period` field and schedules),
 * this feature is a user-facing preference that doesn't require budget-level annotations.
 *
 * Periods:
 * - monthly:   Existing calendar-month behavior (no change)
 * - weekly:    7-day periods from a user-set start day (0-6, Sun-Sat)
 * - biweekly:  14-day periods from a user-set start day
 * - term:      Custom start/end dates (reuses TermSchedule type)
 *
 * **Validates: Requirements 18.5**
 */

import { formatDateLocal, parseDateLocal } from '@/lib/dateUtils'
import type { TermSchedule } from '@/lib/termSchedule'

// ============================================================================
// Types
// ============================================================================

/** The available budget period modes. */
export type BudgetPeriodType = 'monthly' | 'weekly' | 'biweekly' | 'term'

/**
 * User preference for budget period.
 * Stored in localStorage as a JSON object.
 */
export interface BudgetPeriodPreference {
  /** Which period mode is active */
  type: BudgetPeriodType
  /** Start day of the week for weekly/biweekly (0 = Sunday, 6 = Saturday) */
  startDay?: number
  /** Term start/end dates (only used when type === 'term') */
  termDates?: { startDate: string; endDate: string }
}

/**
 * Computed period context — everything the UI and allowance engine need
 * to know about the current period.
 */
export interface PeriodContext {
  /** Total days in the current period */
  totalDays: number
  /** Days remaining in the current period (including today) */
  daysRemaining: number
  /** Days elapsed in the current period (before today) */
  daysElapsed: number
  /** The start date of the current period (ISO YYYY-MM-DD) */
  periodStart: string
  /** The end date of the current period (ISO YYYY-MM-DD) */
  periodEnd: string
  /** Human-friendly label for display (e.g., "Week 2 of 4", "Day 8 of 14") */
  label: string
  /** The active period type */
  type: BudgetPeriodType
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-budget-period'
const DAY_MS = 24 * 60 * 60 * 1000

// ============================================================================
// Zod schema for versioned storage
// ============================================================================

import { z } from 'zod'
import * as versionedStorage from './versionedStorage'

const BudgetPeriodPreferenceSchema = z.object({
  type: z.enum(['monthly', 'weekly', 'biweekly', 'term']),
  startDay: z.number().min(0).max(6).optional(),
  termDates: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }).optional(),
})

// ============================================================================
// Persistence Helpers (versioned localStorage)
// ============================================================================

/**
 * Load persisted budget period preference from localStorage.
 * Returns null if nothing stored or parsing fails (defaults to monthly).
 */
export function loadBudgetPeriodPreference(): BudgetPeriodPreference | null {
  if (typeof window === 'undefined') return null
  return versionedStorage.get(STORAGE_KEY, BudgetPeriodPreferenceSchema) as BudgetPeriodPreference | null
}

/**
 * Save budget period preference to localStorage.
 */
export function saveBudgetPeriodPreference(pref: BudgetPeriodPreference | null): void {
  if (typeof window === 'undefined') return
  if (pref === null) {
    versionedStorage.remove(STORAGE_KEY)
  } else {
    versionedStorage.set(STORAGE_KEY, pref, BudgetPeriodPreferenceSchema)
  }
}

// ============================================================================
// Core Period Computation
// ============================================================================

/**
 * Get the most recent period start date for weekly/biweekly periods.
 * Walks backward from currentDate to find the last occurrence of startDay.
 *
 * @param startDay - Day of week (0 = Sunday, 6 = Saturday)
 * @param currentDate - The reference date
 * @param periodLength - 7 for weekly, 14 for biweekly
 * @returns The start date of the current period
 */
function getWeeklyPeriodStart(startDay: number, currentDate: Date, periodLength: number): Date {
  const currentDayOfWeek = currentDate.getDay()
  // Days since the last start day
  let daysSinceStart = (currentDayOfWeek - startDay + 7) % 7

  // For biweekly, we need a consistent anchor. Use epoch alignment.
  if (periodLength === 14) {
    // Find the most recent start day occurrence
    const candidateStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - daysSinceStart
    )
    // Count weeks since epoch to determine if we're in an odd or even week
    const epochMs = candidateStart.getTime()
    const weeksSinceEpoch = Math.floor(epochMs / (7 * DAY_MS))
    // If it's an odd week relative to epoch, go back one more week
    if (weeksSinceEpoch % 2 !== 0) {
      daysSinceStart += 7
    }
  }

  return new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - daysSinceStart
  )
}

/**
 * Compute the full period context for a given budget period preference.
 *
 * @param pref - The user's budget period preference (null = monthly)
 * @param currentDate - The current date
 * @param termSchedule - Optional term schedule (used when type === 'term' and pref.termDates not set)
 * @returns PeriodContext with all computed info, or null if type is 'monthly'
 */
export function computePeriodContext(
  pref: BudgetPeriodPreference | null,
  currentDate: Date,
  termSchedule?: TermSchedule | null
): PeriodContext | null {
  // Monthly = existing behavior, no period context needed
  if (!pref || pref.type === 'monthly') return null

  const todayStr = formatDateLocal(currentDate)

  if (pref.type === 'weekly' || pref.type === 'biweekly') {
    const periodLength = pref.type === 'weekly' ? 7 : 14
    const startDay = pref.startDay ?? 0 // Default to Sunday

    const periodStart = getWeeklyPeriodStart(startDay, currentDate, periodLength)
    const periodEnd = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      periodStart.getDate() + periodLength - 1
    )

    const periodStartStr = formatDateLocal(periodStart)
    const periodEndStr = formatDateLocal(periodEnd)

    const daysElapsed = Math.max(0, Math.round(
      (currentDate.getTime() - periodStart.getTime()) / DAY_MS
    ))
    const daysRemaining = Math.max(1, periodLength - daysElapsed)

    // Build label
    let label: string
    if (pref.type === 'weekly') {
      // "Week 2 of 4" — which week of the month
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const daysSinceMonthStart = Math.floor(
        (currentDate.getTime() - monthStart.getTime()) / DAY_MS
      )
      const weekOfMonth = Math.floor(daysSinceMonthStart / 7) + 1
      const weeksInMonth = Math.ceil(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() / 7
      )
      label = `Week ${weekOfMonth} of ${weeksInMonth}`
    } else {
      // "Day 8 of 14"
      label = `Day ${daysElapsed + 1} of ${periodLength}`
    }

    return {
      totalDays: periodLength,
      daysRemaining,
      daysElapsed,
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      label,
      type: pref.type,
    }
  }

  if (pref.type === 'term') {
    // Use pref.termDates if available, fall back to termSchedule
    const termDates = pref.termDates ?? (termSchedule
      ? { startDate: termSchedule.startDate, endDate: termSchedule.endDate }
      : null)

    if (!termDates) return null

    const start = parseDateLocal(termDates.startDate)
    const end = parseDateLocal(termDates.endDate)

    // Check if we're within the term
    if (todayStr < termDates.startDate || todayStr > termDates.endDate) return null

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1)
    const daysElapsed = Math.max(0, Math.round(
      (currentDate.getTime() - start.getTime()) / DAY_MS
    ))
    const daysRemaining = Math.max(1, totalDays - daysElapsed)

    // Build label: "3 weeks left in term" or "X days left in term"
    const weeksLeft = Math.floor(daysRemaining / 7)
    let label: string
    if (weeksLeft >= 2) {
      label = `${weeksLeft} weeks left in term`
    } else if (daysRemaining > 1) {
      label = `${daysRemaining} days left in term`
    } else {
      label = 'Last day of term'
    }

    return {
      totalDays,
      daysRemaining,
      daysElapsed,
      periodStart: termDates.startDate,
      periodEnd: termDates.endDate,
      label,
      type: 'term',
    }
  }

  return null
}

/**
 * Get the effective days remaining for the allowance engine based on budget period.
 * Returns null if monthly (caller should use existing logic).
 */
export function getEffectiveDaysForPeriod(
  pref: BudgetPeriodPreference | null,
  currentDate: Date,
  termSchedule?: TermSchedule | null
): number | null {
  const context = computePeriodContext(pref, currentDate, termSchedule)
  if (!context) return null
  return context.daysRemaining
}

/**
 * Get the period start date for rollover calculations.
 * Returns null if monthly (caller should use existing logic).
 */
export function getPeriodStartDate(
  pref: BudgetPeriodPreference | null,
  currentDate: Date,
  termSchedule?: TermSchedule | null
): Date | null {
  const context = computePeriodContext(pref, currentDate, termSchedule)
  if (!context) return null
  return parseDateLocal(context.periodStart)
}

/**
 * Get the total days in the current period for budget scaling.
 * Returns null if monthly (caller should use existing logic).
 */
export function getTotalDaysInPeriod(
  pref: BudgetPeriodPreference | null,
  currentDate: Date,
  termSchedule?: TermSchedule | null
): number | null {
  const context = computePeriodContext(pref, currentDate, termSchedule)
  if (!context) return null
  return context.totalDays
}
