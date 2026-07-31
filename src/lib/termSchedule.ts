/**
 * Term/Semester Schedule — pure module for academic term-based budgeting.
 *
 * Students often think in terms of semesters rather than calendar months.
 * This module models a term (e.g., "make this $3000 last from Aug 25 to Dec 15")
 * and provides helpers for term-aware daily budget calculations.
 *
 * Everything here is a pure function with no side effects — persistence lives
 * in useHomeData (localStorage) and UI in the relevant components.
 *
 * **Validates: Requirements 1.1, new**
 */

import { formatDateLocal, parseDateLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * A user's academic term schedule — start and end dates in ISO format.
 */
export interface TermSchedule {
  /** Start date of the term (ISO YYYY-MM-DD) */
  startDate: string
  /** End date of the term (ISO YYYY-MM-DD) */
  endDate: string
  /** Optional user-facing label, e.g. "Fall 2024" */
  label?: string
}

/**
 * A preset for quickly setting up a term with a known duration.
 */
export interface TermPreset {
  /** Display label, e.g. "Fall semester" */
  label: string
  /** Emoji for display */
  emoji: string
  /** Duration of the term in weeks */
  durationWeeks: number
}

// ============================================================================
// Constants
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Common academic term presets for quick setup.
 * Users pick a preset and a start date → end date is auto-computed.
 */
export const TERM_PRESETS: readonly TermPreset[] = [
  { label: 'Fall semester', emoji: '🍂', durationWeeks: 16 },
  { label: 'Spring semester', emoji: '🌸', durationWeeks: 16 },
  { label: 'Summer term', emoji: '☀️', durationWeeks: 8 },
  { label: 'Quarter', emoji: '📐', durationWeeks: 10 },
]

// ============================================================================
// Core Pure Helpers
// ============================================================================

/**
 * Determines if the current date falls within the term (inclusive of start and end).
 *
 * @param schedule - The term schedule with start/end dates
 * @param currentDate - The date to check
 * @returns true if currentDate is on or between startDate and endDate
 */
export function isTermActive(schedule: TermSchedule, currentDate: Date): boolean {
  const todayStr = formatDateLocal(currentDate)
  return todayStr >= schedule.startDate && todayStr <= schedule.endDate
}

/**
 * Returns the total number of days in the term (inclusive of start and end).
 *
 * @param schedule - The term schedule
 * @returns Total days from start to end (inclusive)
 */
export function getDaysInTerm(schedule: TermSchedule): number {
  const start = parseDateLocal(schedule.startDate)
  const end = parseDateLocal(schedule.endDate)
  const diff = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  return Math.max(1, diff + 1) // +1 for inclusive end
}

/**
 * Returns the number of days remaining in the term (including today).
 * Returns 0 if the term has ended.
 *
 * @param schedule - The term schedule
 * @param currentDate - The current date
 * @returns Days remaining including today, or 0 if term ended
 */
export function getDaysRemainingInTerm(schedule: TermSchedule, currentDate: Date): number {
  const todayStr = formatDateLocal(currentDate)
  if (todayStr > schedule.endDate) return 0
  if (todayStr < schedule.startDate) return getDaysInTerm(schedule)

  const today = parseDateLocal(todayStr)
  const end = parseDateLocal(schedule.endDate)
  const diff = Math.round((end.getTime() - today.getTime()) / DAY_MS)
  return Math.max(1, diff + 1) // +1 for inclusive today
}

/**
 * Returns the progress through the term as a 0-1 fraction.
 * 0 = term hasn't started, 1 = term ended or on last day.
 *
 * @param schedule - The term schedule
 * @param currentDate - The current date
 * @returns Progress fraction (0 to 1)
 */
export function getTermProgress(schedule: TermSchedule, currentDate: Date): number {
  const todayStr = formatDateLocal(currentDate)
  if (todayStr < schedule.startDate) return 0
  if (todayStr >= schedule.endDate) return 1

  const totalDays = getDaysInTerm(schedule)
  const remaining = getDaysRemainingInTerm(schedule, currentDate)
  const elapsed = totalDays - remaining

  return Math.min(1, Math.max(0, elapsed / (totalDays - 1)))
}

// ============================================================================
// Persistence Helpers (localStorage)
// ============================================================================

const STORAGE_KEY = 'folio-term-schedule'

/**
 * Load persisted term schedule from localStorage.
 * Returns null if nothing is stored or if parsing fails.
 */
export function loadTermSchedule(): TermSchedule | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.startDate || !parsed.endDate) return null
    return parsed as TermSchedule
  } catch {
    return null
  }
}

/**
 * Save term schedule to localStorage.
 */
export function saveTermSchedule(schedule: TermSchedule | null): void {
  if (typeof window === 'undefined') return
  try {
    if (schedule === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule))
    }
  } catch {
    // localStorage full or unavailable — fail silently
  }
}
