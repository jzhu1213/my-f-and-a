import type { Transaction } from '@/types'
import { formatDateLocal, subtractDaysLocal, addDaysLocal } from '@/lib/dateUtils'

// ============================================================================
// No-Spend Challenge Helpers (Requirements 5.4, 6.2)
// ============================================================================

/**
 * localStorage key for persisted no-spend challenge state.
 */
const CHALLENGE_STORAGE_KEY = 'folio_no_spend_challenge'

// ============================================================================
// Pure Helpers
// ============================================================================

/**
 * Returns true if there are zero expense transactions for the given date.
 *
 * @param transactions - All user transactions
 * @param date - YYYY-MM-DD date string to check
 */
export function isNoSpendDay(transactions: Transaction[], date: string): boolean {
  return !transactions.some(t => t.date === date && t.type === 'expense')
}

/**
 * Counts consecutive no-spend days backwards from endDate.
 * Defaults to yesterday since today is still in progress.
 * Looks back up to 30 days.
 *
 * @param transactions - All user transactions
 * @param endDate - Optional YYYY-MM-DD string to start counting back from (defaults to yesterday)
 * @returns Number of consecutive no-spend days (0–30)
 */
export function getNoSpendStreak(
  transactions: Transaction[],
  endDate?: string
): number {
  const now = new Date()
  const start = endDate
    ? parseDateLocal(endDate)
    : subtractDaysLocal(now, 1)

  let streak = 0
  for (let i = 0; i < 30; i++) {
    const day = subtractDaysLocal(start, i)
    const dayStr = formatDateLocal(day)

    if (isNoSpendDay(transactions, dayStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// Helper to parse YYYY-MM-DD into local Date
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Checks if both Saturday and Sunday of a given weekend had no spending.
 * Pass any date within that weekend (Sat or Sun).
 *
 * @param transactions - All user transactions
 * @param weekendDate - YYYY-MM-DD of Saturday or Sunday
 * @returns true if the full weekend (Sat + Sun) was no-spend
 */
export function isNoSpendWeekend(
  transactions: Transaction[],
  weekendDate: string
): boolean {
  const d = parseDateLocal(weekendDate)
  const dayOfWeek = d.getDay() // 0=Sun, 6=Sat (local time)

  let saturday: Date
  let sunday: Date

  if (dayOfWeek === 6) {
    // weekendDate is Saturday
    saturday = d
    sunday = addDaysLocal(d, 1)
  } else if (dayOfWeek === 0) {
    // weekendDate is Sunday
    sunday = d
    saturday = subtractDaysLocal(d, 1)
  } else {
    // Not a weekend day
    return false
  }

  const satStr = formatDateLocal(saturday)
  const sunStr = formatDateLocal(sunday)

  return isNoSpendDay(transactions, satStr) && isNoSpendDay(transactions, sunStr)
}

/**
 * Challenge progress status.
 */
export interface NoSpendChallengeStatus {
  completedDays: number
  totalDays: number
  isActive: boolean
  isComplete: boolean
}

/**
 * Computes no-spend challenge progress from a start date.
 *
 * @param transactions - All user transactions
 * @param challengeStart - YYYY-MM-DD when the challenge started
 * @param challengeDays - Total days of the challenge
 * @returns Progress status
 */
export function getNoSpendChallengeStatus(
  transactions: Transaction[],
  challengeStart: string,
  challengeDays: number
): NoSpendChallengeStatus {
  const startDate = parseDateLocal(challengeStart)
  const now = new Date()
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let completedDays = 0
  let isActive = true

  for (let i = 0; i < challengeDays; i++) {
    const day = addDaysLocal(startDate, i)

    // Don't count today (still in progress) or future days
    if (day >= todayLocal) break

    const dayStr = formatDateLocal(day)
    if (isNoSpendDay(transactions, dayStr)) {
      completedDays++
    }
  }

  // Check if challenge period has ended
  const endDate = addDaysLocal(startDate, challengeDays)
  if (todayLocal >= endDate) {
    isActive = false
  }

  const isComplete = completedDays >= challengeDays

  return { completedDays, totalDays: challengeDays, isActive, isComplete }
}

// ============================================================================
// Challenge Persistence (localStorage)
// ============================================================================

export interface NoSpendChallengeData {
  startDate: string // YYYY-MM-DD
  totalDays: number
  createdAt: string // ISO timestamp
}

/**
 * Gets the active no-spend challenge from localStorage.
 */
export function getActiveChallenge(): NoSpendChallengeData | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(CHALLENGE_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as NoSpendChallengeData
  } catch {
    return null
  }
}

/**
 * Starts a new no-spend challenge (saves to localStorage).
 *
 * @param totalDays - Number of days for the challenge (default: 3)
 * @returns The challenge data that was persisted
 */
export function startChallenge(totalDays: number = 3): NoSpendChallengeData {
  const now = new Date()
  const startDate = formatDateLocal(now)
  const challenge: NoSpendChallengeData = {
    startDate,
    totalDays,
    createdAt: now.toISOString(),
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(challenge))
    } catch {
      // Silently fail
    }
  }
  return challenge
}

/**
 * Clears the active no-spend challenge.
 */
export function clearChallenge(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CHALLENGE_STORAGE_KEY)
  } catch {
    // Silently fail
  }
}
