/**
 * Automation Activity Log — builds a human-readable log of recent automation
 * actions for the transparency section in Automation settings.
 *
 * Cross-references suggestion outcomes (correctionTracker) with suggested entries
 * to produce friendly messages like:
 *   - "Suggested Netflix $15.99 — confirmed by you"
 *   - "Predicted electric bill $92 — you edited to $87"
 *   - "Got it — stopped suggesting gym membership"
 *
 * Requirements: 23.7
 */

import { loadOutcomes, type SuggestionOutcome } from '@/lib/correctionTracker'
import { loadSuggestedEntries } from '@/lib/suggestedEntries'

// ============================================================================
// Types
// ============================================================================

export interface AutomationLogEntry {
  /** Unique identifier for this log entry */
  id: string
  /** Human-readable message describing what happened */
  message: string
  /** Outcome type for potential styling */
  type: 'confirmed' | 'edited' | 'dismissed' | 'auto-disabled'
  /** When this action occurred */
  timestamp: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a dollar amount for display (no cents if whole number).
 */
function formatAmount(amount: number): string {
  if (amount === Math.floor(amount)) {
    return `$${amount}`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * Builds a recurrenceId → label lookup from suggested entries.
 * Falls back to "recurring expense" when no label is found.
 */
function buildLabelLookup(): Record<string, string> {
  const entries = loadSuggestedEntries()
  const lookup: Record<string, string> = {}
  for (const entry of entries) {
    // Keep the most recent label per recurrence (entries are in order)
    lookup[entry.recurrenceId] = entry.label
  }
  return lookup
}

/**
 * Counts consecutive dismissals from most recent for a given recurrence
 * within a sorted (descending) list of outcomes.
 */
function countConsecutiveDismissalsInGroup(outcomes: SuggestionOutcome[]): number {
  let count = 0
  for (const o of outcomes) {
    if (o.outcome === 'dismissed') {
      count++
    } else {
      break
    }
  }
  return count
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Returns recent automation activity as human-readable log entries.
 *
 * Reads outcomes from the correction tracker, cross-references with suggested
 * entries for labels, and formats into friendly messages. Collapses consecutive
 * dismissals for the same recurrence into a single "stopped suggesting" message.
 *
 * @param limit - Maximum entries to return (default 10)
 */
export function getRecentAutomationActivity(limit = 10): AutomationLogEntry[] {
  const outcomes = loadOutcomes()
  if (outcomes.length === 0) return []

  const labelLookup = buildLabelLookup()

  // Sort outcomes by timestamp descending (most recent first)
  const sorted = [...outcomes].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  // Group outcomes by recurrenceId to detect consecutive dismissals
  const byRecurrence: Record<string, SuggestionOutcome[]> = {}
  for (const o of sorted) {
    if (!byRecurrence[o.recurrenceId]) {
      byRecurrence[o.recurrenceId] = []
    }
    byRecurrence[o.recurrenceId].push(o)
  }

  // Track which recurrences have already been represented by an auto-disable entry
  const autoDisabledRecurrences = new Set<string>()

  // Check which recurrences have 2+ consecutive dismissals (auto-disabled)
  for (const [recurrenceId, recOutcomes] of Object.entries(byRecurrence)) {
    const consecutiveDismissals = countConsecutiveDismissalsInGroup(recOutcomes)
    if (consecutiveDismissals >= 2) {
      autoDisabledRecurrences.add(recurrenceId)
    }
  }

  const entries: AutomationLogEntry[] = []
  const processedDismissalGroups = new Set<string>()

  for (const outcome of sorted) {
    if (entries.length >= limit) break

    const label = labelLookup[outcome.recurrenceId] || 'recurring expense'

    // Handle auto-disabled recurrences (2+ consecutive dismissals)
    if (
      outcome.outcome === 'dismissed' &&
      autoDisabledRecurrences.has(outcome.recurrenceId)
    ) {
      // Only emit one "stopped suggesting" entry per recurrence
      if (!processedDismissalGroups.has(outcome.recurrenceId)) {
        processedDismissalGroups.add(outcome.recurrenceId)
        entries.push({
          id: `log-${outcome.id}-auto-disabled`,
          message: `Got it — stopped suggesting ${label}`,
          type: 'auto-disabled',
          timestamp: outcome.timestamp,
        })
      }
      continue
    }

    // Regular outcomes
    switch (outcome.outcome) {
      case 'confirmed':
        entries.push({
          id: `log-${outcome.id}`,
          message: `Suggested ${label} ${formatAmount(outcome.suggestedAmount)} — confirmed by you`,
          type: 'confirmed',
          timestamp: outcome.timestamp,
        })
        break

      case 'edited':
        entries.push({
          id: `log-${outcome.id}`,
          message: `Predicted ${label} ${formatAmount(outcome.suggestedAmount)} — you edited to ${formatAmount(outcome.actualAmount ?? outcome.suggestedAmount)}`,
          type: 'edited',
          timestamp: outcome.timestamp,
        })
        break

      case 'dismissed':
        // Single dismissal (not part of an auto-disable group)
        entries.push({
          id: `log-${outcome.id}`,
          message: `Suggested ${label} ${formatAmount(outcome.suggestedAmount)} — you skipped this one`,
          type: 'dismissed',
          timestamp: outcome.timestamp,
        })
        break
    }
  }

  return entries
}

/**
 * Formats a timestamp into a relative time string (e.g. "2 days ago", "just now").
 */
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} min ago`
  return 'just now'
}
