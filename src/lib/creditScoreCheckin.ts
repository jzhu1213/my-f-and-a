/**
 * Credit Score Check-In
 *
 * A simple self-reported credit score tracker. Users manually enter their
 * credit score periodically (no bureau integration). Scores are stored in
 * localStorage with date history.
 *
 * Score range: 300–850 (standard FICO range)
 */

// ============================================================================
// Types
// ============================================================================

export interface CreditScoreEntry {
  score: number
  date: string // ISO date string (YYYY-MM-DD)
  note?: string
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-credit-score-history'
const MIN_SCORE = 300
const MAX_SCORE = 850

/** localStorage key for tracking when the last score-reminder tip was shown. */
const LAST_REMINDER_KEY = 'folio-credit-score-last-reminder'

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that a score is within the acceptable FICO range (300–850).
 */
export function isValidCreditScore(score: number): boolean {
  return Number.isFinite(score) && score >= MIN_SCORE && score <= MAX_SCORE
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Returns the full history of self-reported credit scores, newest first.
 */
export function getCreditScoreHistory(): CreditScoreEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const entries: CreditScoreEntry[] = JSON.parse(stored)
    // Sort newest first
    return entries.sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return []
  }
}

/**
 * Adds a new credit score entry. Validates score range before saving.
 * Returns true if saved successfully, false if validation failed.
 */
export function addCreditScoreEntry(score: number, note?: string): boolean {
  if (!isValidCreditScore(score)) return false
  if (typeof window === 'undefined') return false

  try {
    const history = getCreditScoreHistory()
    const entry: CreditScoreEntry = {
      score: Math.round(score),
      date: new Date().toISOString().slice(0, 10),
      note: note?.trim() || undefined,
    }
    history.unshift(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    return true
  } catch {
    return false
  }
}

/**
 * Returns the most recent credit score entry, or null if none exists.
 */
export function getLatestCreditScore(): CreditScoreEntry | null {
  const history = getCreditScoreHistory()
  return history.length > 0 ? history[0] : null
}

/**
 * Returns a friendly label for a credit score range.
 */
export function getScoreRangeLabel(score: number): string {
  if (score >= 800) return 'Excellent'
  if (score >= 740) return 'Very Good'
  if (score >= 670) return 'Good'
  if (score >= 580) return 'Fair'
  return 'Building'
}

/**
 * Returns the color token for a credit score range (for visual feedback).
 */
export function getScoreColor(score: number): string {
  if (score >= 740) return 'var(--success)'
  if (score >= 670) return 'rgba(6, 214, 160, 0.7)'
  if (score >= 580) return 'var(--warning)'
  return 'rgba(245, 158, 11, 0.7)'
}

// ============================================================================
// Reminder Logic
// ============================================================================

/**
 * Returns true if it's been at least 30 days since the user last logged a
 * credit score (eligible for a reminder tip).
 */
export function shouldRemindCreditScoreCheckin(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const latest = getLatestCreditScore()
    if (!latest) return false // No score logged yet — don't remind until they've used it once

    const lastDate = new Date(latest.date)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysSince >= 30
  } catch {
    return false
  }
}

/**
 * Returns true if the credit-score reminder tip hasn't been shown this month.
 */
export function canShowCreditScoreReminder(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const lastReminder = localStorage.getItem(LAST_REMINDER_KEY)
    if (!lastReminder) return true
    const currentMonth = new Date().toISOString().slice(0, 7)
    return lastReminder !== currentMonth
  } catch {
    return false
  }
}

/**
 * Marks the credit-score reminder as shown for this month.
 */
export function markCreditScoreReminderShown(): void {
  if (typeof window === 'undefined') return
  try {
    const currentMonth = new Date().toISOString().slice(0, 7)
    localStorage.setItem(LAST_REMINDER_KEY, currentMonth)
  } catch {
    // best-effort
  }
}
