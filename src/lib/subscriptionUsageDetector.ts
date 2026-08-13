import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import type { DetectedSubscription } from '@/lib/subscriptionDetector'
import { parseDateLocal, getTodayLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * A subscription flagged as "possibly unused" because there has been no other
 * spending in its category for 60+ days. Surfaced gently — never shame-based.
 */
export interface PossiblyUnusedSubscription {
  subscription: DetectedSubscription
  categoryLabel: string
  daysSinceLastCategoryActivity: number
}

// ============================================================================
// Helpers
// ============================================================================

/** Minimum days of no other category activity before flagging. */
const INACTIVE_THRESHOLD_DAYS = 60

/**
 * Returns a human-friendly lowercase label for a transaction category.
 */
function getCategoryLabel(category: TransactionCategory): string {
  const entry = BUDGET_CATEGORIES.find(c => c.category === category)
  return entry?.label?.toLowerCase() ?? category
}

/**
 * Computes difference in calendar days between two YYYY-MM-DD date strings.
 * Returns the number of days `from` is before `to` (positive = from is earlier).
 */
function daysBetween(from: string, to: string): number {
  const a = parseDateLocal(from)
  const b = parseDateLocal(to)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Determines whether a transaction is likely the subscription charge itself
 * (and should be excluded from "other activity" in the category).
 */
function isSubscriptionCharge(tx: Transaction, sub: DetectedSubscription): boolean {
  // Match by recurringId if available
  if (sub.recurringId && tx.recurringId === sub.recurringId) return true

  // Match by similar amount AND similar note/label
  const amountClose = Math.abs(tx.amount - sub.amount) < 0.5
  const noteMatches =
    tx.note != null &&
    sub.label != null &&
    tx.note.toLowerCase().includes(sub.label.toLowerCase())

  return amountClose && noteMatches
}

// ============================================================================
// Main Detection
// ============================================================================

/**
 * Cross-references detected subscriptions with transaction history to identify
 * subscriptions whose category has had zero other spend for 60+ days.
 *
 * This is a non-judgmental signal — the user decides whether it matters.
 *
 * @param subscriptions - All detected subscriptions
 * @param transactions - Full transaction list (expenses)
 * @param today - Override for testing (YYYY-MM-DD); defaults to local today
 */
export function detectPossiblyUnusedSubscriptions(
  subscriptions: DetectedSubscription[],
  transactions: Transaction[],
  today?: string,
): PossiblyUnusedSubscription[] {
  const referenceDate = today ?? getTodayLocal()
  const results: PossiblyUnusedSubscription[] = []

  // Pre-filter: only expense transactions
  const expenses = transactions.filter(tx => tx.type === 'expense')

  for (const sub of subscriptions) {
    const category = sub.category

    // Find all expense transactions in the same category that are NOT the subscription itself
    const otherCategoryTxns = expenses.filter(
      tx => tx.category === category && !isSubscriptionCharge(tx, sub),
    )

    // Find the most recent non-subscription transaction in this category
    let mostRecentDate: string | null = null
    for (const tx of otherCategoryTxns) {
      if (!mostRecentDate || tx.date > mostRecentDate) {
        mostRecentDate = tx.date
      }
    }

    // If there are zero other transactions ever, or the most recent one is 60+ days ago
    let daysSince: number
    if (!mostRecentDate) {
      // No other spending in this category at all — use a large number
      daysSince = INACTIVE_THRESHOLD_DAYS + 30
    } else {
      daysSince = daysBetween(mostRecentDate, referenceDate)
    }

    if (daysSince >= INACTIVE_THRESHOLD_DAYS) {
      results.push({
        subscription: sub,
        categoryLabel: getCategoryLabel(category),
        daysSinceLastCategoryActivity: daysSince,
      })
    }
  }

  return results
}
