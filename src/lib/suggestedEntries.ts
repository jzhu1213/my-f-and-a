import type { TransactionCategory } from '@/types'
import type { DetectedRecurrence, RecurrenceStatus } from '@/lib/recurrenceDetector'
import { formatDateLocal, parseDateLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * A suggested transaction entry generated from a confirmed or high-confidence
 * recurrence on its predicted date. Visually distinct, not yet committed.
 */
export interface SuggestedEntry {
  /** Unique ID for this suggestion instance */
  id: string
  /** The recurrence this was generated from */
  recurrenceId: string
  /** Pre-filled merchant/note label */
  label: string
  /** Predicted amount */
  amount: number
  /** Pre-filled category */
  category: TransactionCategory
  /** The date this suggestion is for (YYYY-MM-DD) */
  date: string
  /** Lifecycle state */
  status: 'pending' | 'confirmed' | 'dismissed'
  /** Timestamp when the suggestion was created */
  createdAt: string
  /** Timestamp when confirmed or dismissed (if applicable) */
  resolvedAt?: string
}

// ============================================================================
// LocalStorage Persistence
// ============================================================================

const SUGGESTED_ENTRIES_KEY = 'folio-suggested-entries'
const INCLUDE_SUGGESTIONS_KEY = 'folio-include-suggestions-in-allowance'

/**
 * Loads suggested entries from localStorage.
 */
export function loadSuggestedEntries(): SuggestedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SUGGESTED_ENTRIES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SuggestedEntry[]
  } catch {
    return []
  }
}

/**
 * Saves suggested entries to localStorage.
 */
export function saveSuggestedEntries(entries: SuggestedEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SUGGESTED_ENTRIES_KEY, JSON.stringify(entries))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Loads the user preference for including suggestions in allowance calculation.
 * Default: true (include, since bills are predictable).
 */
export function loadIncludeSuggestionsPreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(INCLUDE_SUGGESTIONS_KEY)
    if (raw === 'false') return false
    return true // default: include
  } catch {
    return true
  }
}

/**
 * Saves the user preference for including suggestions in allowance calculation.
 */
export function saveIncludeSuggestionsPreference(include: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INCLUDE_SUGGESTIONS_KEY, String(include))
  } catch {
    // fail silently
  }
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generates suggested entries from confirmed recurrences whose predicted date
 * matches today (or is within a 1-day window to account for slight drift).
 *
 * Only generates suggestions for recurrences that:
 * - Have status 'confirmed' (user-verified patterns)
 * - Have nextOccurrence matching today or yesterday (catch missed suggestions)
 * - Don't already have a pending/confirmed suggestion for the same date
 *
 * @param recurrences - All detected/merged recurrences
 * @param existingEntries - Already generated suggested entries
 * @param currentDate - Today's date
 * @returns New suggested entries to add (if any)
 */
export function generateSuggestedEntries(
  recurrences: DetectedRecurrence[],
  existingEntries: SuggestedEntry[],
  currentDate: Date
): SuggestedEntry[] {
  const todayStr = formatDateLocal(currentDate)
  // Also check yesterday to catch suggestions that might have been missed
  const yesterday = new Date(currentDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDateLocal(yesterday)

  const newEntries: SuggestedEntry[] = []

  // Only generate from confirmed recurrences (user-verified patterns)
  const activeRecurrences = recurrences.filter(
    r => r.status === 'confirmed'
  )

  for (const recurrence of activeRecurrences) {
    // Check if nextOccurrence is today or yesterday
    const isToday = recurrence.nextOccurrence === todayStr
    const isYesterday = recurrence.nextOccurrence === yesterdayStr

    if (!isToday && !isYesterday) continue

    // Check if we already have a suggestion for this recurrence on this date
    const alreadyExists = existingEntries.some(
      e => e.recurrenceId === recurrence.id &&
        e.date === recurrence.nextOccurrence &&
        (e.status === 'pending' || e.status === 'confirmed')
    )

    if (alreadyExists) continue

    newEntries.push({
      id: `suggested-${recurrence.id}-${recurrence.nextOccurrence}`,
      recurrenceId: recurrence.id,
      label: recurrence.label,
      amount: recurrence.predictedAmount,
      category: recurrence.category,
      date: recurrence.nextOccurrence,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  }

  return newEntries
}

// ============================================================================
// Suggestion Actions
// ============================================================================

/**
 * Confirms a suggested entry — marks it as confirmed so the caller can
 * create a real transaction from it.
 */
export function confirmSuggestedEntry(
  entries: SuggestedEntry[],
  entryId: string
): SuggestedEntry[] {
  return entries.map(e =>
    e.id === entryId
      ? { ...e, status: 'confirmed' as const, resolvedAt: new Date().toISOString() }
      : e
  )
}

/**
 * Dismisses a suggested entry — marks it as dismissed.
 * The system notes the dismissal for learning (task 412).
 */
export function dismissSuggestedEntry(
  entries: SuggestedEntry[],
  entryId: string
): SuggestedEntry[] {
  return entries.map(e =>
    e.id === entryId
      ? { ...e, status: 'dismissed' as const, resolvedAt: new Date().toISOString() }
      : e
  )
}

/**
 * Returns only pending suggested entries (not yet confirmed or dismissed).
 */
export function getPendingSuggestions(entries: SuggestedEntry[]): SuggestedEntry[] {
  return entries.filter(e => e.status === 'pending')
}

/**
 * Computes the total amount of pending suggestions for allowance impact display.
 */
export function getPendingSuggestionsTotal(entries: SuggestedEntry[]): number {
  return getPendingSuggestions(entries).reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Cleans up old entries — removes confirmed/dismissed entries older than 7 days
 * to keep localStorage lean. Keeps pending entries regardless of age (they may
 * be lingering for review).
 */
export function cleanupOldEntries(entries: SuggestedEntry[]): SuggestedEntry[] {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return entries.filter(e => {
    if (e.status === 'pending') return true
    const resolvedTime = e.resolvedAt ? new Date(e.resolvedAt).getTime() : 0
    return resolvedTime > sevenDaysAgo
  })
}
