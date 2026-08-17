import type { SuggestedEntry } from '@/lib/suggestedEntries'

// ============================================================================
// Types
// ============================================================================

/**
 * Records the outcome of a suggestion — what the user did with it.
 * Used to learn from corrections and improve future predictions.
 */
export interface SuggestionOutcome {
  /** Unique outcome ID */
  id: string
  /** Which recurrence this is for */
  recurrenceId: string
  /** The suggestion that was resolved */
  suggestedEntryId: string
  /** What the user did */
  outcome: 'confirmed' | 'edited' | 'dismissed'
  /** Original predicted amount */
  suggestedAmount: number
  /** Amount if confirmed/edited (null if dismissed) */
  actualAmount: number | null
  /** Difference between actual and suggested (0 if dismissed) */
  amountDelta: number
  /** The predicted date (YYYY-MM-DD) */
  suggestedDate: string
  /** The date it was actually logged (null if dismissed) */
  actualDate: string | null
  /** Shift in days from predicted date (positive = later, negative = earlier) */
  dateDeltaDays: number
  /** When this outcome was recorded */
  timestamp: string
}

// ============================================================================
// LocalStorage Persistence
// ============================================================================

const OUTCOMES_KEY = 'folio-suggestion-outcomes'

/**
 * Loads suggestion outcomes from localStorage.
 */
export function loadOutcomes(): SuggestionOutcome[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OUTCOMES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SuggestionOutcome[]
  } catch {
    return []
  }
}

/**
 * Saves suggestion outcomes to localStorage.
 */
export function saveOutcomes(outcomes: SuggestionOutcome[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Recording Outcomes
// ============================================================================

/**
 * Records an outcome when a suggested entry is confirmed, edited, or dismissed.
 *
 * @param entry - The suggested entry that was resolved
 * @param outcome - What the user did: confirmed (as-is), edited (changed amount/date), dismissed
 * @param actualAmount - The actual amount if confirmed or edited (null if dismissed)
 * @param actualDate - The date of the actual transaction (null if dismissed)
 * @returns The new outcome record
 */
export function recordOutcome(
  entry: SuggestedEntry,
  outcome: 'confirmed' | 'edited' | 'dismissed',
  actualAmount: number | null = null,
  actualDate: string | null = null
): SuggestionOutcome {
  const suggestedAmount = entry.amount
  const suggestedDate = entry.date

  // Calculate amount delta
  const amountDelta = outcome === 'dismissed'
    ? 0
    : (actualAmount ?? suggestedAmount) - suggestedAmount

  // Calculate date delta in days
  let dateDeltaDays = 0
  if (outcome !== 'dismissed' && actualDate && suggestedDate) {
    const suggested = new Date(suggestedDate + 'T00:00:00')
    const actual = new Date(actualDate + 'T00:00:00')
    dateDeltaDays = Math.round((actual.getTime() - suggested.getTime()) / (1000 * 60 * 60 * 24))
  }

  const newOutcome: SuggestionOutcome = {
    id: `outcome-${entry.id}-${Date.now()}`,
    recurrenceId: entry.recurrenceId,
    suggestedEntryId: entry.id,
    outcome,
    suggestedAmount,
    actualAmount: outcome === 'dismissed' ? null : (actualAmount ?? suggestedAmount),
    amountDelta,
    suggestedDate,
    actualDate: outcome === 'dismissed' ? null : (actualDate ?? suggestedDate),
    dateDeltaDays,
    timestamp: new Date().toISOString(),
  }

  // Persist
  const outcomes = loadOutcomes()
  outcomes.push(newOutcome)
  saveOutcomes(outcomes)

  return newOutcome
}

// ============================================================================
// Learning: Adjusted Predictions
// ============================================================================

/**
 * Computes an improved predicted amount using a weighted average of recent actual
 * amounts. More recent outcomes have higher weight. Also adjusts timing if the
 * user consistently pays earlier or later.
 *
 * @param recurrenceId - The recurrence to get adjusted prediction for
 * @param currentPredictedAmount - The current predicted amount (fallback if no history)
 * @param currentPredictedDate - The current predicted date (YYYY-MM-DD)
 * @returns Adjusted prediction with improved amount and date shift
 */
export function getAdjustedPrediction(
  recurrenceId: string,
  currentPredictedAmount: number,
  currentPredictedDate: string
): { adjustedAmount: number; adjustedDateShiftDays: number } {
  const outcomes = loadOutcomes()

  // Only consider confirmed/edited outcomes for this recurrence (not dismissals)
  const relevantOutcomes = outcomes.filter(
    o => o.recurrenceId === recurrenceId && o.outcome !== 'dismissed'
  )

  if (relevantOutcomes.length === 0) {
    return { adjustedAmount: currentPredictedAmount, adjustedDateShiftDays: 0 }
  }

  // Sort by timestamp ascending (oldest first) for weighting
  const sorted = [...relevantOutcomes].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Use last 5 outcomes max for the weighted average
  const recent = sorted.slice(-5)

  // Weighted average of actual amounts (more recent = higher weight)
  // Weights: 1, 2, 3, 4, 5 for the last 5 outcomes
  let totalWeight = 0
  let weightedSum = 0
  let weightedDateShift = 0

  for (let i = 0; i < recent.length; i++) {
    const weight = i + 1
    const amount = recent[i].actualAmount ?? currentPredictedAmount
    weightedSum += amount * weight
    weightedDateShift += recent[i].dateDeltaDays * weight
    totalWeight += weight
  }

  const adjustedAmount = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : currentPredictedAmount

  const adjustedDateShiftDays = totalWeight > 0
    ? Math.round(weightedDateShift / totalWeight)
    : 0

  return { adjustedAmount, adjustedDateShiftDays }
}

// ============================================================================
// Auto-Disable Logic
// ============================================================================

/**
 * Counts the number of consecutive dismissals (from most recent) for a recurrence.
 */
export function getConsecutiveDismissals(recurrenceId: string): number {
  const outcomes = loadOutcomes()

  // Filter to this recurrence and sort by timestamp descending (most recent first)
  const recurrenceOutcomes = outcomes
    .filter(o => o.recurrenceId === recurrenceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  let consecutiveDismissals = 0
  for (const outcome of recurrenceOutcomes) {
    if (outcome.outcome === 'dismissed') {
      consecutiveDismissals++
    } else {
      break // Stop counting at the first non-dismissal
    }
  }

  return consecutiveDismissals
}

/**
 * Checks if a recurrence should be auto-disabled due to repeated dismissals.
 * After 2 consecutive dismissals, returns true with a notification message.
 *
 * @param recurrenceId - The recurrence to check
 * @param label - The display label for the notification
 * @returns Whether to auto-disable, and the notification message if so
 */
export function shouldAutoDisable(
  recurrenceId: string,
  label: string
): { disable: boolean; notification: string | null } {
  const consecutiveDismissals = getConsecutiveDismissals(recurrenceId)

  if (consecutiveDismissals >= 2) {
    return {
      disable: true,
      notification: getAutoDisableNotification(label),
    }
  }

  return { disable: false, notification: null }
}

/**
 * Returns the warm, non-punitive notification copy for auto-disabling a suggestion.
 */
export function getAutoDisableNotification(label: string): string {
  return `Got it — we won't suggest ${label} again. You can re-enable it anytime in recurring bills.`
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Gets all outcomes for a specific recurrence, ordered by most recent first.
 */
export function getOutcomesForRecurrence(recurrenceId: string): SuggestionOutcome[] {
  const outcomes = loadOutcomes()
  return outcomes
    .filter(o => o.recurrenceId === recurrenceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Cleans up old outcomes — keeps the last 20 per recurrence to prevent
 * localStorage from growing unbounded.
 */
export function cleanupOldOutcomes(): void {
  const outcomes = loadOutcomes()

  // Group by recurrenceId
  const byRecurrence: Record<string, SuggestionOutcome[]> = {}
  for (const o of outcomes) {
    if (!byRecurrence[o.recurrenceId]) {
      byRecurrence[o.recurrenceId] = []
    }
    byRecurrence[o.recurrenceId].push(o)
  }

  // Keep only last 20 per recurrence (sorted by timestamp descending)
  const trimmed: SuggestionOutcome[] = []
  for (const recurrenceId of Object.keys(byRecurrence)) {
    const sorted = byRecurrence[recurrenceId].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    trimmed.push(...sorted.slice(0, 20))
  }

  saveOutcomes(trimmed)
}
