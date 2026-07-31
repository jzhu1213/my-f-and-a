/**
 * Defaults Engine — Time-of-day aware category & funding source prediction.
 *
 * Pure helper module that pre-selects the most likely category and funding
 * source based on the user's historical transaction patterns at the current
 * time of day. Never overrides an explicit user choice — predictions are
 * surfaced as suggestions only.
 *
 * Task 132.1
 */

import type { Transaction, TransactionCategory } from '@/types'
import type { FundingSource } from './fundingSources'
import { getTimeOfDaySlot, type TimeSlot } from './habitEngine'

// ============================================================================
// Types
// ============================================================================

export interface SmartDefault {
  /** Predicted category for this time of day */
  category: TransactionCategory | null
  /** Confidence in the category prediction (0–1) */
  categoryConfidence: number
  /** Predicted funding source ID for this time of day */
  fundingSourceId: string | null
  /** Confidence in the funding source prediction (0–1) */
  sourceConfidence: number
  /** The time slot used for this prediction */
  timeSlot: TimeSlot
}

export interface DefaultsEngineOptions {
  /** Minimum confidence threshold to surface a category prediction (default: 0.25) */
  minCategoryConfidence?: number
  /** Minimum confidence threshold to surface a source prediction (default: 0.2) */
  minSourceConfidence?: number
  /** Maximum number of historical transactions to analyze (default: 200) */
  maxHistorySize?: number
  /** Current time override for testing (default: new Date()) */
  currentTime?: Date
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIN_CATEGORY_CONFIDENCE = 0.25
const DEFAULT_MIN_SOURCE_CONFIDENCE = 0.2
const DEFAULT_MAX_HISTORY = 200

/** Minimum number of transactions in a time slot to make a prediction */
const MIN_SLOT_TRANSACTIONS = 3

/** Recency decay factor — recent transactions weighted more heavily */
const RECENCY_DECAY = 0.97

/** Day-of-week similarity bonus (same weekday type: weekday/weekend) */
const DAY_TYPE_BONUS = 1.2

// ============================================================================
// Core Engine
// ============================================================================

/**
 * Computes smart defaults for the current time context.
 *
 * Algorithm:
 * 1. Determine the current time slot (early_morning, morning, midday, etc.)
 * 2. Filter transaction history to expenses in the same time slot
 * 3. Score each category by frequency × recency × day-type similarity
 * 4. Score each funding source by the same weighted approach
 * 5. Return predictions above confidence thresholds
 *
 * Pure function — no side effects, no network calls.
 */
export function computeSmartDefaults(
  transactions: Transaction[],
  fundingSources: FundingSource[],
  options: DefaultsEngineOptions = {}
): SmartDefault {
  const {
    minCategoryConfidence = DEFAULT_MIN_CATEGORY_CONFIDENCE,
    minSourceConfidence = DEFAULT_MIN_SOURCE_CONFIDENCE,
    maxHistorySize = DEFAULT_MAX_HISTORY,
    currentTime = new Date(),
  } = options

  const timeSlot = getTimeOfDaySlot(currentTime)
  const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6

  // Limit history for performance
  const history = transactions.slice(0, maxHistorySize)

  // Filter to expenses that match the current time slot
  const slotTransactions = history.filter((tx) => {
    if (tx.type !== 'expense') return false
    const txDate = new Date(tx.createdAt)
    return getTimeOfDaySlot(txDate) === timeSlot
  })

  // Not enough data in this slot
  if (slotTransactions.length < MIN_SLOT_TRANSACTIONS) {
    return {
      category: null,
      categoryConfidence: 0,
      fundingSourceId: null,
      sourceConfidence: 0,
      timeSlot,
    }
  }

  // ── Category prediction ─────────────────────────────────────────────────
  const categoryScores = new Map<TransactionCategory, number>()

  for (let i = 0; i < slotTransactions.length; i++) {
    const tx = slotTransactions[i]
    let score = 1

    // Recency weight: index 0 is most recent
    score *= Math.pow(RECENCY_DECAY, i)

    // Day-type bonus: same type of day (weekday/weekend)
    const txDate = new Date(tx.createdAt)
    const txIsWeekend = txDate.getDay() === 0 || txDate.getDay() === 6
    if (txIsWeekend === isWeekend) {
      score *= DAY_TYPE_BONUS
    }

    const prev = categoryScores.get(tx.category) ?? 0
    categoryScores.set(tx.category, prev + score)
  }

  const categoryResult = pickBest(categoryScores, slotTransactions.length)

  // ── Funding source prediction ───────────────────────────────────────────
  const sourceScores = new Map<string, number>()

  // Only look at transactions that have a funding source assigned
  const sourceTxs = slotTransactions.filter((tx) => tx.fundingSourceId)

  for (let i = 0; i < sourceTxs.length; i++) {
    const tx = sourceTxs[i]
    let score = 1

    score *= Math.pow(RECENCY_DECAY, i)

    const txDate = new Date(tx.createdAt)
    const txIsWeekend = txDate.getDay() === 0 || txDate.getDay() === 6
    if (txIsWeekend === isWeekend) {
      score *= DAY_TYPE_BONUS
    }

    const sourceId = tx.fundingSourceId!
    const prev = sourceScores.get(sourceId) ?? 0
    sourceScores.set(sourceId, prev + score)
  }

  const sourceResult = pickBest(sourceScores, sourceTxs.length || 1)

  // Validate that predicted source still exists
  const sourceValid =
    sourceResult.key !== null &&
    fundingSources.some((s) => s.id === sourceResult.key)

  return {
    category:
      categoryResult.confidence >= minCategoryConfidence
        ? (categoryResult.key as TransactionCategory)
        : null,
    categoryConfidence: categoryResult.confidence,
    fundingSourceId:
      sourceValid && sourceResult.confidence >= minSourceConfidence
        ? sourceResult.key
        : null,
    sourceConfidence: sourceValid ? sourceResult.confidence : 0,
    timeSlot,
  }
}

// ============================================================================
// Category prediction for a specific time slot (useful for QuickLog pre-select)
// ============================================================================

/**
 * Returns the predicted category for the current time of day.
 * Convenience wrapper around computeSmartDefaults that returns just the category.
 *
 * @returns The predicted category or null if confidence is too low
 */
export function predictCategory(
  transactions: Transaction[],
  options: DefaultsEngineOptions = {}
): TransactionCategory | null {
  const result = computeSmartDefaults(transactions, [], options)
  return result.category
}

/**
 * Returns ranked category predictions for the current time slot.
 * Useful for sorting/highlighting categories in the quick-log grid.
 *
 * Each entry includes the category and its score, sorted by descending confidence.
 * Only categories above the minimum threshold are included.
 */
export function getRankedCategories(
  transactions: Transaction[],
  options: DefaultsEngineOptions = {}
): Array<{ category: TransactionCategory; confidence: number }> {
  const {
    minCategoryConfidence = DEFAULT_MIN_CATEGORY_CONFIDENCE,
    maxHistorySize = DEFAULT_MAX_HISTORY,
    currentTime = new Date(),
  } = options

  const timeSlot = getTimeOfDaySlot(currentTime)
  const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6

  const history = transactions.slice(0, maxHistorySize)

  const slotTransactions = history.filter((tx) => {
    if (tx.type !== 'expense') return false
    const txDate = new Date(tx.createdAt)
    return getTimeOfDaySlot(txDate) === timeSlot
  })

  if (slotTransactions.length < MIN_SLOT_TRANSACTIONS) return []

  const categoryScores = new Map<TransactionCategory, number>()

  for (let i = 0; i < slotTransactions.length; i++) {
    const tx = slotTransactions[i]
    let score = 1
    score *= Math.pow(RECENCY_DECAY, i)

    const txDate = new Date(tx.createdAt)
    const txIsWeekend = txDate.getDay() === 0 || txDate.getDay() === 6
    if (txIsWeekend === isWeekend) {
      score *= DAY_TYPE_BONUS
    }

    const prev = categoryScores.get(tx.category) ?? 0
    categoryScores.set(tx.category, prev + score)
  }

  // Normalize scores to confidence values
  const totalScore = Array.from(categoryScores.values()).reduce((a, b) => a + b, 0) || 1

  return Array.from(categoryScores.entries())
    .map(([category, score]) => ({
      category,
      confidence: score / totalScore,
    }))
    .filter((entry) => entry.confidence >= minCategoryConfidence)
    .sort((a, b) => b.confidence - a.confidence)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Picks the key with the highest weighted score from a score map.
 * Returns confidence as the best score relative to the total score pool.
 */
function pickBest<K>(
  scores: Map<K, number>,
  totalTransactions: number
): { key: K | null; confidence: number } {
  if (scores.size === 0) {
    return { key: null, confidence: 0 }
  }

  let bestKey: K | null = null
  let bestScore = 0
  let totalScore = 0

  for (const [key, score] of scores) {
    totalScore += score
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }

  // Confidence = proportion of total weighted score held by the winner
  const confidence = totalScore > 0 ? bestScore / totalScore : 0

  return { key: bestKey, confidence }
}
