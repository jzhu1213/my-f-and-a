/**
 * Streak Engine — Logging streak tracking with grace days.
 *
 * Pure computational module: no React, no components. Designed to be called
 * from hooks/components.
 *
 * Streak rules:
 * - A day "counts" if there is ≥1 transaction logged OR the date is in the
 *   zeroSpendDays list (user explicitly marked it as a "$0 day").
 * - Grace days: 1 free miss per week (Mon–Sun). Resets each Sunday.
 * - If the user misses 2+ days in a week without remaining grace days, the
 *   streak resets.
 * - Breaking a streak has zero negative consequences — just resets the count.
 *
 * Requirements: 25.1
 */

import type { Transaction } from '@/types'
import { formatDateLocal, subtractDaysLocal } from '@/lib/dateUtils'
import { syncStreakToServer } from './gamificationSync'

// ============================================================================
// Types
// ============================================================================

export interface StreakData {
  /** Consecutive days with tracked activity (transactions or $0 day marks) */
  currentStreak: number
  /** Highest streak ever achieved */
  longestStreak: number
  /** Total days the user has been active (ever) */
  totalActiveDays: number
  /** Grace days remaining this week (max 1, resets Sunday) */
  graceDaysRemaining: number
  /** ISO date string (YYYY-MM-DD) of last active day */
  lastActiveDate: string | null
  /** Number of grace days used this week (Mon–Sun) */
  graceDaysUsedThisWeek: number
  /** Dates the user explicitly marked as "$0 day" (YYYY-MM-DD strings) */
  zeroSpendDays: string[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio_streak_data'
const MAX_GRACE_DAYS_PER_WEEK = 1

// ============================================================================
// localStorage Persistence
// ============================================================================

/**
 * Reads persisted streak data from localStorage.
 * Returns null if no data exists or parsing fails.
 */
export function getStreakData(): StreakData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StreakData
  } catch {
    return null
  }
}

/**
 * Persists streak data to localStorage and syncs to server in background.
 */
export function saveStreakData(data: StreakData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Best-effort persistence — localStorage may be full or unavailable
  }
  // Fire-and-forget sync to Supabase (Task 525.2)
  syncStreakToServer(data)
}

// ============================================================================
// Zero-Spend Day Management
// ============================================================================

/**
 * Adds a date to the zero-spend days list and persists.
 * Returns the updated StreakData.
 */
export function markZeroSpendDay(date: string): StreakData {
  const existing = getStreakData()
  const zeroSpendDays = existing?.zeroSpendDays ?? []

  // Avoid duplicates
  if (!zeroSpendDays.includes(date)) {
    zeroSpendDays.push(date)
  }

  // Re-compute streak with updated zero-spend days
  // We don't have transactions here, so just persist the updated list
  const updated: StreakData = existing
    ? { ...existing, zeroSpendDays }
    : {
        currentStreak: 1,
        longestStreak: 1,
        totalActiveDays: 1,
        graceDaysRemaining: MAX_GRACE_DAYS_PER_WEEK,
        lastActiveDate: date,
        graceDaysUsedThisWeek: 0,
        zeroSpendDays,
      }

  saveStreakData(updated)
  return updated
}

// ============================================================================
// Core Streak Computation (Pure Function)
// ============================================================================

/**
 * Returns the ISO day-of-week for a YYYY-MM-DD string (1=Mon, 7=Sun).
 */
function getISODayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00') // noon to avoid timezone edge cases
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  return day === 0 ? 7 : day
}

/**
 * Returns the Monday (start of ISO week) for a given date string.
 */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1 // distance from Monday
  const monday = new Date(d)
  monday.setDate(monday.getDate() - diff)
  return formatDateLocal(monday)
}

/**
 * Computes streak data from transaction history and zero-spend marks.
 *
 * This is the main pure function — given all inputs, it returns the complete
 * streak state. No side effects.
 *
 * @param transactions - All user transactions
 * @param zeroSpendDays - Dates marked as "$0 day"
 * @param today - Override for testability (defaults to current date)
 */
export function computeStreakData(
  transactions: Transaction[],
  zeroSpendDays: string[],
  today?: Date
): StreakData {
  const now = today ?? new Date()
  const todayStr = formatDateLocal(now)

  // Build a set of all "active" dates (dates with ≥1 transaction OR marked $0)
  const activeDates = new Set<string>(zeroSpendDays)
  for (const tx of transactions) {
    activeDates.add(tx.date)
  }

  const totalActiveDays = activeDates.size

  // Walk backwards from today to compute the current streak
  let currentStreak = 0
  let graceDaysUsedThisWeek = 0
  let graceDaysRemaining = MAX_GRACE_DAYS_PER_WEEK
  let consecutiveMissesInWeek = 0
  let streakBroken = false
  let lastActiveDate: string | null = null

  // Track grace days per week using week-start keys
  const graceDaysUsedByWeek = new Map<string, number>()

  // Look back up to 365 days (generous limit)
  for (let i = 0; i <= 365; i++) {
    const checkDate = formatDateLocal(subtractDaysLocal(now, i))
    const weekStart = getWeekStart(checkDate)
    const isActive = activeDates.has(checkDate)

    if (isActive) {
      if (!streakBroken) {
        currentStreak++
        if (!lastActiveDate) lastActiveDate = checkDate
      }
      // Reset consecutive misses for this week context
      consecutiveMissesInWeek = 0
    } else {
      // This day was missed
      if (streakBroken) continue // Already done counting

      // Check if we can use a grace day
      const usedInThisWeek = graceDaysUsedByWeek.get(weekStart) ?? 0

      if (usedInThisWeek < MAX_GRACE_DAYS_PER_WEEK) {
        // Use a grace day — streak continues
        graceDaysUsedByWeek.set(weekStart, usedInThisWeek + 1)
        currentStreak++ // Grace day counts toward streak
        consecutiveMissesInWeek++
      } else {
        // No grace days left for this week — streak breaks
        streakBroken = true
      }
    }
  }

  // Calculate grace days remaining for the current week
  const currentWeekStart = getWeekStart(todayStr)
  const usedThisWeek = graceDaysUsedByWeek.get(currentWeekStart) ?? 0
  graceDaysRemaining = Math.max(0, MAX_GRACE_DAYS_PER_WEEK - usedThisWeek)
  graceDaysUsedThisWeek = usedThisWeek

  // Calculate longest streak (scan all history)
  const longestStreak = computeLongestStreak(activeDates, transactions, zeroSpendDays)

  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, longestStreak),
    totalActiveDays,
    graceDaysRemaining,
    lastActiveDate,
    graceDaysUsedThisWeek,
    zeroSpendDays,
  }
}

/**
 * Computes the longest streak ever achieved from the set of active dates.
 * Uses a sorted walk with grace day logic.
 */
function computeLongestStreak(
  activeDates: Set<string>,
  transactions: Transaction[],
  zeroSpendDays: string[]
): number {
  if (activeDates.size === 0) return 0

  // Get all dates sorted ascending
  const allDates = Array.from(activeDates).sort()
  const firstDate = allDates[0]
  const lastDate = allDates[allDates.length - 1]

  // Walk from first to last date, tracking streaks
  let longest = 0
  let current = 0
  const graceDaysUsedByWeek = new Map<string, number>()

  const start = new Date(firstDate + 'T12:00:00')
  const end = new Date(lastDate + 'T12:00:00')
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateLocal(d)
    const weekStart = getWeekStart(dateStr)
    const isActive = activeDates.has(dateStr)

    if (isActive) {
      current++
    } else {
      const usedInWeek = graceDaysUsedByWeek.get(weekStart) ?? 0
      if (usedInWeek < MAX_GRACE_DAYS_PER_WEEK) {
        graceDaysUsedByWeek.set(weekStart, usedInWeek + 1)
        current++ // Grace day extends the streak
      } else {
        // Streak breaks
        longest = Math.max(longest, current)
        current = 0
        // Reset grace tracking for fresh start
        graceDaysUsedByWeek.clear()
      }
    }
  }

  return Math.max(longest, current)
}

// ============================================================================
// Grace Day Communication
// ============================================================================

/**
 * Returns a warm grace-day message if a grace day was used, or null.
 *
 * Should be called after computing streak data to determine if the user
 * needs to be informed about a grace day keeping their streak alive.
 */
export function getGraceDayMessage(streakData: StreakData): string | null {
  if (streakData.graceDaysUsedThisWeek === 0) return null
  if (streakData.currentStreak === 0) return null

  const remaining = streakData.graceDaysRemaining
  if (remaining > 0) {
    return `You missed a day but your grace day kept your streak alive — ${remaining} left this week.`
  }
  return 'You missed yesterday but your grace day kept your streak alive — 0 left this week.'
}

/**
 * Returns a brief streak status message for display (e.g., on home screen).
 */
export function getStreakStatusMessage(streakData: StreakData): string | null {
  if (streakData.currentStreak <= 0) return null
  if (streakData.currentStreak === 1) return '1 day tracked'
  return `${streakData.currentStreak}-day streak`
}
