import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Transaction, TransactionCategory, TransactionType } from '@/types'
import type { DetectedRecurrence } from '@/lib/recurrenceDetector'
import { detectRecurrences, mergeWithBills } from '@/lib/recurrenceDetector'
import type { FixedExpense } from '@/lib/fixedExpenses'
import {
  type SuggestedEntry,
  loadSuggestedEntries,
  saveSuggestedEntries,
  generateSuggestedEntries,
  confirmSuggestedEntry,
  dismissSuggestedEntry,
  getPendingSuggestions,
  getPendingSuggestionsTotal,
  cleanupOldEntries,
  loadIncludeSuggestionsPreference,
  saveIncludeSuggestionsPreference,
} from '@/lib/suggestedEntries'
import { formatDateLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

export interface UseSuggestedEntriesReturn {
  /** All pending suggested entries (not yet confirmed/dismissed) */
  pendingSuggestions: SuggestedEntry[]
  /** Total amount of pending suggestions (for allowance display) */
  pendingTotal: number
  /** Whether to include suggestions in allowance calculation */
  includeSuggestionsInAllowance: boolean
  /** Set whether suggestions affect allowance */
  setIncludeSuggestionsInAllowance: (include: boolean) => void
  /** Confirm a suggested entry — returns the entry data for the caller to create a real transaction */
  confirmEntry: (entryId: string) => SuggestedEntry | null
  /** Dismiss a suggested entry */
  dismissEntry: (entryId: string) => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useSuggestedEntries — manages the lifecycle of auto-suggested transaction entries.
 *
 * On mount (and when recurrences change), generates new suggestions for confirmed
 * recurrences whose predicted date matches today. Provides confirm/dismiss actions
 * and tracks the allowance impact preference.
 *
 * Validates: Requirements 23.2
 */
export function useSuggestedEntries(
  transactions: Transaction[],
  bills: FixedExpense[]
): UseSuggestedEntriesReturn {
  // ── State ──────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<SuggestedEntry[]>(() => loadSuggestedEntries())
  const [includeSuggestions, setIncludeSuggestions] = useState<boolean>(
    () => loadIncludeSuggestionsPreference()
  )

  // ── Detect recurrences and generate suggestions ────────────────────────────
  const recurrences = useMemo(() => {
    if (transactions.length === 0) return []
    const detected = detectRecurrences(transactions)
    const merged = mergeWithBills(detected, bills)
    return merged
  }, [transactions, bills])

  // Generate suggestions when recurrences update or on mount
  useEffect(() => {
    if (recurrences.length === 0) return

    const currentDate = new Date()
    const newEntries = generateSuggestedEntries(recurrences, entries, currentDate)

    if (newEntries.length > 0) {
      setEntries(prev => {
        const updated = [...prev, ...newEntries]
        const cleaned = cleanupOldEntries(updated)
        saveSuggestedEntries(cleaned)
        return cleaned
      })
    }
    // Only re-run when recurrences change (not entries, to avoid loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrences])

  // ── Derived values ─────────────────────────────────────────────────────────
  const pendingSuggestions = useMemo(() => getPendingSuggestions(entries), [entries])
  const pendingTotal = useMemo(() => getPendingSuggestionsTotal(entries), [entries])

  // ── Actions ────────────────────────────────────────────────────────────────
  const confirmEntry = useCallback((entryId: string): SuggestedEntry | null => {
    const entry = entries.find(e => e.id === entryId && e.status === 'pending')
    if (!entry) return null

    setEntries(prev => {
      const updated = confirmSuggestedEntry(prev, entryId)
      saveSuggestedEntries(updated)
      return updated
    })

    return entry
  }, [entries])

  const dismissEntry = useCallback((entryId: string) => {
    setEntries(prev => {
      const updated = dismissSuggestedEntry(prev, entryId)
      saveSuggestedEntries(updated)
      return updated
    })
  }, [])

  const setIncludeSuggestionsInAllowance = useCallback((include: boolean) => {
    setIncludeSuggestions(include)
    saveIncludeSuggestionsPreference(include)
  }, [])

  return {
    pendingSuggestions,
    pendingTotal,
    includeSuggestionsInAllowance: includeSuggestions,
    setIncludeSuggestionsInAllowance: setIncludeSuggestionsInAllowance,
    confirmEntry,
    dismissEntry,
  }
}
