import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'

// ============================================================================
// Types
// ============================================================================

/**
 * A detected subscription — either confirmed via recurringId or heuristically
 * identified from same-amount, same-note transaction patterns.
 */
export interface DetectedSubscription {
  id: string
  label: string
  amount: number
  category: TransactionCategory
  lastCharged: string
  chargeCount: number
  frequency: 'monthly' | 'weekly' | 'annual'
  isConfirmed: boolean
  recurringId?: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns the emoji for a given category. */
export function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? '💼'
}

/**
 * Determines approximate frequency based on average gap between charges.
 * - Weekly: 5–10 day gaps
 * - Monthly: 25–40 day gaps
 * - Annual: 340–400 day gaps
 */
function inferFrequency(avgGapDays: number): 'weekly' | 'monthly' | 'annual' {
  if (avgGapDays <= 10) return 'weekly'
  if (avgGapDays <= 40) return 'monthly'
  return 'annual'
}

/**
 * Groups an array of values by a key derived from each item.
 */
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}

/**
 * Calculates the average gap (in days) between sorted date strings.
 */
function averageGap(dates: string[]): number {
  if (dates.length < 2) return 30 // default to monthly
  const sorted = [...dates].sort()
  let totalGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const d1 = new Date(sorted[i - 1]).getTime()
    const d2 = new Date(sorted[i]).getTime()
    totalGap += (d2 - d1) / (1000 * 60 * 60 * 24)
  }
  return totalGap / (sorted.length - 1)
}

// ============================================================================
// Core Detection Logic
// ============================================================================

/**
 * Detects recurring subscriptions from transaction history.
 *
 * Strategy:
 * 1. Group confirmed recurring transactions by `recurringId`
 * 2. Heuristically detect unconfirmed recurring patterns:
 *    same note AND same amount, appearing 2+ times at roughly monthly intervals
 *    (28–35 day gaps on average)
 * 3. Deduplicate and return sorted by amount descending
 *
 * This is a pure function with no side effects.
 */
export function detectSubscriptions(transactions: Transaction[]): DetectedSubscription[] {
  const subscriptions: DetectedSubscription[] = []
  const seenIds = new Set<string>()

  // Only consider expense transactions
  const expenses = transactions.filter(tx => tx.type === 'expense')

  // ── Step 1: Confirmed recurring via recurringId ─────────────────────────
  const byRecurringId = groupBy(
    expenses.filter(tx => tx.recurringId),
    tx => tx.recurringId!
  )

  for (const [recurringId, txGroup] of Object.entries(byRecurringId)) {
    if (txGroup.length < 2) continue

    const sorted = [...txGroup].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const avgGap = averageGap(sorted.map(t => t.date))

    const sub: DetectedSubscription = {
      id: `confirmed-${recurringId}`,
      label: latest.note || `${latest.category} subscription`,
      amount: latest.amount,
      category: latest.category,
      lastCharged: latest.date,
      chargeCount: txGroup.length,
      frequency: inferFrequency(avgGap),
      isConfirmed: true,
      recurringId,
    }

    subscriptions.push(sub)
    seenIds.add(sub.id)

    // Track these transaction IDs so we don't double-count in heuristic step
    for (const tx of txGroup) {
      seenIds.add(tx.id)
    }
  }

  // ── Step 2: Heuristic detection ─────────────────────────────────────────
  // Group by (note + amount) for transactions without recurringId
  const heuristicCandidates = expenses.filter(
    tx => !tx.recurringId && tx.note && tx.note.trim().length > 0 && !seenIds.has(tx.id)
  )

  const byNoteAndAmount = groupBy(
    heuristicCandidates,
    tx => `${tx.note!.toLowerCase().trim()}|${tx.amount}`
  )

  for (const [key, txGroup] of Object.entries(byNoteAndAmount)) {
    if (txGroup.length < 2) continue

    const sorted = [...txGroup].sort((a, b) => a.date.localeCompare(b.date))
    const avgGap = averageGap(sorted.map(t => t.date))

    // Only consider monthly-ish patterns (28–35 day average gap)
    if (avgGap < 28 || avgGap > 35) continue

    const latest = sorted[sorted.length - 1]
    const subId = `heuristic-${key}`

    if (seenIds.has(subId)) continue

    subscriptions.push({
      id: subId,
      label: latest.note || 'Unknown subscription',
      amount: latest.amount,
      category: latest.category,
      lastCharged: latest.date,
      chargeCount: txGroup.length,
      frequency: 'monthly',
      isConfirmed: false,
    })

    seenIds.add(subId)
  }

  // ── Step 3: Sort by amount descending ───────────────────────────────────
  subscriptions.sort((a, b) => b.amount - a.amount)

  return subscriptions
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Sums the monthly cost of all detected subscriptions.
 * Weekly subscriptions are multiplied by ~4.33, annual divided by 12.
 */
export function getMonthlySubscriptionTotal(subscriptions: DetectedSubscription[]): number {
  return subscriptions.reduce((sum, sub) => {
    switch (sub.frequency) {
      case 'weekly':
        return sum + sub.amount * 4.33
      case 'annual':
        return sum + sub.amount / 12
      case 'monthly':
      default:
        return sum + sub.amount
    }
  }, 0)
}
