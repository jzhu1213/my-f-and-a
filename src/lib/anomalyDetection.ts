/**
 * Anomaly Detection — Task 165.1
 *
 * Detects when a single expense is far above the user's own norm for that
 * category. Pure utility — no side effects, no localStorage access.
 *
 * Algorithm:
 * 1. Filter transactions to same category (expense only), excluding the current one
 * 2. Require at least 5 prior transactions to avoid false positives for new users
 * 3. Compute mean and standard deviation
 * 4. Flag as anomalous when amount > max(2× mean, mean + 2σ) — uses the HIGHER
 *    threshold so it only fires for truly unusual amounts (more lenient)
 * 5. Return a warm, shame-free message
 */

import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface AnomalyResult {
  /** Whether this transaction is anomalously high */
  isAnomaly: boolean
  /** The category of the transaction */
  category: TransactionCategory
  /** The amount that was logged */
  amount: number
  /** The user's typical (mean) amount for this category */
  typicalAmount: number
  /** A warm, shame-free message for the tip slot */
  message: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns a friendly lowercase label for a category. */
function getCategoryLabel(category: TransactionCategory): string {
  const entry = BUDGET_CATEGORIES.find(c => c.category === category)
  if (!entry) return category
  // Use a shorter, more conversational form for certain categories
  switch (category) {
    case 'food': return 'food'
    case 'drinks': return 'drinks'
    case 'rent': return 'rent & bills'
    case 'transport': return 'transportation'
    case 'fun': return 'fun'
    case 'subscriptions': return 'subscriptions'
    case 'health': return 'health'
    case 'school': return 'school'
    case 'other': return 'this category'
    default: return entry.label.toLowerCase()
  }
}

/** Computes the arithmetic mean of a number array. */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Computes the population standard deviation. */
function stddev(values: number[], avg: number): number {
  if (values.length === 0) return 0
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ============================================================================
// Core Detection
// ============================================================================

/** Minimum prior transactions in the same category before detection activates. */
const MIN_HISTORY_SIZE = 5

/**
 * Detects if a transaction amount is unusually high for its category
 * based on the user's own spending history.
 *
 * Requires at least 5 prior transactions in the category to activate.
 * Uses 2× mean OR mean + 2σ threshold — whichever is HIGHER (more lenient)
 * so the tip only fires for truly unusual amounts.
 */
export function detectSpendAnomaly(
  amount: number,
  category: TransactionCategory,
  transactions: Transaction[]
): AnomalyResult {
  // Default non-anomaly result
  const noAnomaly: AnomalyResult = {
    isAnomaly: false,
    category,
    amount,
    typicalAmount: 0,
    message: '',
  }

  // Only look at expenses in the same category
  const categoryAmounts = transactions
    .filter(tx => tx.type === 'expense' && tx.category === category)
    .map(tx => tx.amount)

  // Need enough history to form a baseline
  if (categoryAmounts.length < MIN_HISTORY_SIZE) {
    return noAnomaly
  }

  const avg = mean(categoryAmounts)
  const sd = stddev(categoryAmounts, avg)

  // Two thresholds — use the HIGHER one (more lenient, fewer false positives)
  const thresholdDouble = 2 * avg
  const thresholdSigma = avg + 2 * sd
  const threshold = Math.max(thresholdDouble, thresholdSigma)

  if (amount <= threshold) {
    return { ...noAnomaly, typicalAmount: Math.round(avg * 100) / 100 }
  }

  // It's anomalous — generate a warm message
  const label = getCategoryLabel(category)
  const typicalRounded = Math.round(avg)
  const message = `That's more than your usual ${label} (~$${typicalRounded}) — all good if intentional`

  return {
    isAnomaly: true,
    category,
    amount,
    typicalAmount: Math.round(avg * 100) / 100,
    message,
  }
}
