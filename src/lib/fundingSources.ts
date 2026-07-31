/**
 * Funding Sources: User-managed list of payment methods.
 *
 * This module defines the FundingSource type and provides default common sources
 * so the feature works with zero configuration. Users can track how they pay for
 * things (debit card, cash, credit, external wallets, borrowed money) and whether
 * each source settles immediately or is deferred.
 */

export type FundingSourceKind =
  | 'cash'
  | 'debit'
  | 'credit'
  | 'external_wallet'
  | 'borrowed'

export interface FundingSource {
  id: string
  userId: string
  label: string
  emoji: string
  kind: FundingSourceKind
  /** Whether this source reduces balance immediately (true) or is deferred (false) */
  reducesBalanceNow: boolean
  /** User-editable starting balance for per-source balance tracking (defaults to 0) */
  snapshotBalance?: number
  createdAt: string
}

/**
 * Default funding sources shipped with the app.
 * These provide immediate utility with zero configuration.
 */
const DEFAULT_SOURCES: Omit<FundingSource, 'id' | 'userId' | 'createdAt'>[] = [
  {
    label: 'Debit Card',
    emoji: '💳',
    kind: 'debit',
    reducesBalanceNow: true,
  },
  {
    label: 'Cash',
    emoji: '💵',
    kind: 'cash',
    reducesBalanceNow: true,
  },
  {
    label: 'Credit Card',
    emoji: '💎',
    kind: 'credit',
    reducesBalanceNow: false,
  },
  {
    label: 'Venmo',
    emoji: '📱',
    kind: 'external_wallet',
    reducesBalanceNow: true,
  },
  {
    label: 'Apple Cash',
    emoji: '🍎',
    kind: 'external_wallet',
    reducesBalanceNow: true,
  },
  {
    label: "Parents' Card",
    emoji: '👨‍👩‍👧',
    kind: 'borrowed',
    reducesBalanceNow: false,
  },
  {
    label: 'Campus Card',
    emoji: '🎓',
    kind: 'external_wallet',
    reducesBalanceNow: true,
  },
]

/**
 * Returns the default set of funding sources for a given user.
 * Each source gets a unique ID and the current timestamp.
 *
 * @param userId - The user ID to associate with these sources
 * @returns Array of FundingSource objects ready to use
 */
export function getDefaultSources(userId: string): FundingSource[] {
  const now = new Date().toISOString()

  return DEFAULT_SOURCES.map((source, index) => ({
    ...source,
    id: `default-${source.kind}-${index}`,
    userId,
    createdAt: now,
  }))
}

/**
 * Determines whether a funding source settles immediately.
 * This is a convenience helper that returns the `reducesBalanceNow` field.
 *
 * @param source - The funding source to check
 * @returns true if the source reduces balance immediately, false if deferred
 */
export function isImmediateSettlement(source: FundingSource): boolean {
  return source.reducesBalanceNow
}

/**
 * Determines whether a transaction was made on a borrowed/parents' funding source.
 * Borrowed transactions don't count against the user's daily allowance.
 *
 * @param transaction - The transaction to check
 * @param fundingSources - Available funding sources for lookup
 * @returns true if the transaction's funding source has kind === 'borrowed'
 */
export function isBorrowedTransaction(
  transaction: Transaction,
  fundingSources: FundingSource[]
): boolean {
  if (!transaction.fundingSourceId || fundingSources.length === 0) return false

  const source = fundingSources.find(s => s.id === transaction.fundingSourceId)
  if (!source) return false

  return source.kind === 'borrowed'
}

// ── Time bucketing for habit-based prediction ───────────────────────────

type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * Returns the time bucket for a given date.
 * Used to group transactions by when they typically happen.
 *
 * - morning: 5am-11am
 * - afternoon: 11am-5pm
 * - evening: 5pm-10pm
 * - night: 10pm-5am
 */
function getTimeBucket(date: Date): TimeBucket {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

// ── Transaction type (imported for prediction logic) ────────────────────
// We need to import Transaction and TransactionCategory to analyze patterns

import type { Transaction, TransactionCategory } from '@/types'

/**
 * Predicts the most likely funding source based on recent transaction history.
 *
 * Algorithm:
 * 1. Filter transactions to the selected category
 * 2. Group by fundingSourceId
 * 3. Weight by:
 *    - Frequency (how many times this source was used for this category)
 *    - Recency (recent transactions weighted higher: decay factor 0.95 per transaction)
 *    - Time similarity (bonus weight if current time bucket matches transaction time bucket)
 * 4. Return the fundingSourceId with the highest weighted score
 *
 * @param transactions - User's transaction history
 * @param category - The currently selected category
 * @param fundingSources - Available funding sources for validation
 * @param currentTime - Current time for time-of-day matching
 * @returns The predicted funding source ID, or null if no pattern found
 */
export function predictFundingSource(
  transactions: Transaction[],
  category: TransactionCategory,
  fundingSources: FundingSource[],
  currentTime: Date
): string | null {
  if (!transactions || transactions.length === 0) return null
  if (!fundingSources || fundingSources.length === 0) return null

  // Filter to transactions in this category that have a funding source
  const categoryTxs = transactions
    .filter(tx => tx.category === category && tx.fundingSourceId)
    .slice(0, 100) // Look at last 100 relevant transactions for performance

  if (categoryTxs.length === 0) return null

  const currentBucket = getTimeBucket(currentTime)

  // Group by funding source and calculate weighted scores
  const sourceScores = new Map<string, number>()

  categoryTxs.forEach((tx, index) => {
    const sourceId = tx.fundingSourceId!

    // Base score: frequency (each occurrence = 1 point)
    let score = 1

    // Recency weight: more recent transactions weighted higher
    // Most recent = index 0 gets full weight, older ones decay by 5% per position
    const recencyWeight = Math.pow(0.95, index)
    score *= recencyWeight

    // Time bucket bonus: if this transaction's time bucket matches current time, add 30% bonus
    const txDate = new Date(tx.createdAt)
    const txBucket = getTimeBucket(txDate)
    if (txBucket === currentBucket) {
      score *= 1.3
    }

    // Accumulate score for this source
    const existing = sourceScores.get(sourceId) || 0
    sourceScores.set(sourceId, existing + score)
  })

  // Find the source with the highest score
  let bestSourceId: string | null = null
  let bestScore = 0

  sourceScores.forEach((score, sourceId) => {
    if (score > bestScore) {
      bestScore = score
      bestSourceId = sourceId
    }
  })

  // Validate that the predicted source still exists in available sources
  if (bestSourceId && fundingSources.some(s => s.id === bestSourceId)) {
    return bestSourceId
  }

  return null
}
