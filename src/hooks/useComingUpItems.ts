import { useMemo } from 'react'
import type { Transaction } from '@/types'
import type { DetectedRecurrence } from '@/lib/recurrenceDetector'
import { detectRecurrences, mergeWithBills } from '@/lib/recurrenceDetector'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { parseDateLocal, formatDateLocal } from '@/lib/dateUtils'
import type { ComingUpItem } from '@/components/simplified/ComingUpSection'

// ============================================================================
// Hook
// ============================================================================

/**
 * useComingUpItems — computes the next 3 predicted expenses within 7 days
 * from the recurrence detector. Filters to confirmed/suggested recurrences
 * and sorts by date. Excludes items due today (those go through suggested
 * entries instead).
 *
 * Validates: Requirements 23.4
 */
export function useComingUpItems(
  transactions: Transaction[],
  bills: FixedExpense[]
): ComingUpItem[] {
  return useMemo(() => {
    if (transactions.length === 0) return []

    const detected = detectRecurrences(transactions)
    const merged = mergeWithBills(detected, bills)

    // Only include confirmed or suggested (not dismissed/paused)
    const active = merged.filter(
      r => r.status === 'confirmed' || r.status === 'suggested'
    )

    const today = new Date()
    const todayStr = formatDateLocal(today)

    const items: ComingUpItem[] = []

    for (const rec of active) {
      if (!rec.nextOccurrence) continue

      const nextDate = parseDateLocal(rec.nextOccurrence)
      const diffMs = nextDate.getTime() - parseDateLocal(todayStr).getTime()
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

      // Only include items 1–7 days away (today's items are handled by
      // suggested entries; beyond 7 days is too far out)
      if (daysUntil < 1 || daysUntil > 7) continue

      items.push({
        id: rec.id,
        label: rec.label,
        predictedAmount: rec.predictedAmount,
        expectedDate: rec.nextOccurrence,
        daysUntil,
        category: rec.category,
      })
    }

    // Sort by nearest first, limit to 3
    items.sort((a, b) => a.daysUntil - b.daysUntil)
    return items.slice(0, 3)
  }, [transactions, bills])
}
