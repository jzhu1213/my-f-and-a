import type { Transaction, TransactionCategory } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { parseDateLocal, formatDateLocal, addDaysLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

/** The detected frequency of a recurring expense. */
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly'

/** Status of a detected recurrence in the user's list. */
export type RecurrenceStatus = 'suggested' | 'confirmed' | 'dismissed' | 'paused'

/**
 * A detected recurring expense pattern from transaction history.
 * Broader than subscription detection — captures any repeating expense
 * (rent, utilities, groceries at the same store, etc.).
 */
export interface DetectedRecurrence {
  /** Unique identifier for this detected pattern */
  id: string
  /** Display label (merchant/note from the transactions) */
  label: string
  /** Average amount across occurrences */
  amount: number
  /** Predicted amount for next occurrence (mean of recent amounts) */
  predictedAmount: number
  /** Category from the most recent transaction in the pattern */
  category: TransactionCategory
  /** Detected frequency */
  frequency: RecurrenceFrequency
  /** Predicted next occurrence date (YYYY-MM-DD) */
  nextOccurrence: string
  /** Confidence score 0–1 */
  confidence: number
  /** User-facing status */
  status: RecurrenceStatus
  /** Date of the most recent occurrence (YYYY-MM-DD) */
  lastOccurrence: string
  /** Number of times this pattern has been observed */
  occurrenceCount: number
  /** Amount tolerance — how much the amount varies (std dev) */
  amountTolerance: number
  /** Optional link to a FixedExpense bill */
  linkedBillId?: string
  /** Whether this is a newly discovered pattern (not yet linked to a bill) */
  isNewDiscovery?: boolean
}

/**
 * Result of merging detected recurrences with explicit bills.
 */
export interface MergedRecurrence extends DetectedRecurrence {
  /** If matched to an existing bill, this is the bill's ID */
  linkedBillId?: string
  /** True when the pattern is new (not matching any existing bill) */
  isNewDiscovery: boolean
  /** Warm discovery copy for new patterns */
  discoveryCopy?: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Normalizes a label for grouping (lowercase, trimmed, collapsed whitespace). */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Groups transactions by a key function.
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
 * Computes the gap in days between two YYYY-MM-DD date strings.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = parseDateLocal(dateA).getTime()
  const b = parseDateLocal(dateB).getTime()
  return Math.abs(b - a) / (1000 * 60 * 60 * 24)
}

/**
 * Computes the mean of an array of numbers.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Computes the standard deviation of an array of numbers.
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Clamps a number to [0, 1]. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

// ============================================================================
// Frequency Detection
// ============================================================================

/** Canonical cycle lengths in days for each frequency. */
const FREQUENCY_CYCLES: Record<RecurrenceFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30.44,
}

/** Tolerance windows for each frequency (fraction of cycle). */
const FREQUENCY_TOLERANCE = 0.35

/**
 * Infers the most likely frequency from an average gap in days.
 * Returns the frequency whose canonical cycle best matches the gap.
 */
function inferFrequency(avgGapDays: number): RecurrenceFrequency {
  let bestFreq: RecurrenceFrequency = 'monthly'
  let bestFit = Infinity

  for (const [freq, cycle] of Object.entries(FREQUENCY_CYCLES) as [RecurrenceFrequency, number][]) {
    const relDist = Math.abs(avgGapDays - cycle) / cycle
    if (relDist < bestFit) {
      bestFit = relDist
      bestFreq = freq
    }
  }

  return bestFreq
}

/**
 * Scores how well a set of gaps matches a regular billing cycle.
 * Returns 0 (erratic) to 1 (perfectly regular).
 */
function gapRegularity(gaps: number[]): number {
  if (gaps.length < 2) return 0.5
  const avg = mean(gaps)
  if (avg <= 0) return 0
  const cv = stdDev(gaps) / avg // coefficient of variation
  return clamp01(1 - cv)
}

/**
 * Scores how well the average gap fits a canonical billing cycle.
 */
function cycleFit(avgGapDays: number): number {
  if (avgGapDays <= 0) return 0
  let best = 0
  for (const cycle of Object.values(FREQUENCY_CYCLES)) {
    const relDist = Math.abs(avgGapDays - cycle) / cycle
    best = Math.max(best, clamp01(1 - relDist))
  }
  return best
}

// ============================================================================
// Core Detection Logic
// ============================================================================

/**
 * Detects recurring expense patterns from transaction history.
 *
 * Strategy:
 * 1. Filter to expense transactions with a note/merchant
 * 2. Group by normalized note (merchant name)
 * 3. For each group with ≥3 entries, analyze interval regularity and amount consistency
 * 4. Score confidence and predict next occurrence
 *
 * This is a pure function with no side effects.
 */
export function detectRecurrences(transactions: Transaction[]): DetectedRecurrence[] {
  const results: DetectedRecurrence[] = []

  // Only consider expense transactions with a note
  const expenses = transactions.filter(
    tx => tx.type === 'expense' && tx.note && tx.note.trim().length > 0
  )

  // Group by normalized note (merchant/label)
  const byNote = groupBy(expenses, tx => normalizeLabel(tx.note!))

  for (const [normalizedNote, txGroup] of Object.entries(byNote)) {
    // Require at least 3 occurrences for confidence
    if (txGroup.length < 3) continue

    // Sort chronologically
    const sorted = [...txGroup].sort((a, b) => a.date.localeCompare(b.date))
    const dates = sorted.map(t => t.date)
    const amounts = sorted.map(t => t.amount)

    // Compute gaps between consecutive transactions
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push(daysBetween(dates[i - 1], dates[i]))
    }

    if (gaps.length === 0) continue

    const avgGap = mean(gaps)

    // Filter: the average gap must reasonably fit a billing cycle
    const fit = cycleFit(avgGap)
    if (fit < FREQUENCY_TOLERANCE) continue

    // Compute signals
    const regularity = gapRegularity(gaps)
    const amountMean = mean(amounts)
    const amountStd = stdDev(amounts)
    const amountConsistency = amountMean > 0 ? clamp01(1 - amountStd / amountMean) : 0

    // Score confidence
    const countFactor = clamp01((txGroup.length - 2) / 4) // 3→0.25, 4→0.5, 6+→1
    const confidence = clamp01(
      0.1 +
      0.3 * regularity +
      0.25 * countFactor +
      0.2 * amountConsistency +
      0.15 * fit
    )

    // Skip low-confidence patterns
    if (confidence < 0.4) continue

    // Infer frequency
    const frequency = inferFrequency(avgGap)

    // Predict next occurrence based on last date + average gap
    const lastDate = dates[dates.length - 1]
    const lastParsed = parseDateLocal(lastDate)
    const nextDate = addDaysLocal(lastParsed, Math.round(avgGap))
    const nextOccurrence = formatDateLocal(nextDate)

    // Predicted amount: mean of the last 3 occurrences (more recent = more relevant)
    const recentAmounts = amounts.slice(-3)
    const predictedAmount = Math.round(mean(recentAmounts) * 100) / 100

    const latest = sorted[sorted.length - 1]

    results.push({
      id: `recurrence-${normalizedNote}`,
      label: latest.note || normalizedNote,
      amount: amountMean,
      predictedAmount,
      category: latest.category,
      frequency,
      nextOccurrence,
      confidence,
      status: 'suggested',
      lastOccurrence: lastDate,
      occurrenceCount: txGroup.length,
      amountTolerance: Math.round(amountStd * 100) / 100,
    })
  }

  // Sort by confidence descending, then by amount descending
  results.sort((a, b) => b.confidence - a.confidence || b.amount - a.amount)

  return results
}

// ============================================================================
// Merge with Explicit Bills (Subtask 410.2)
// ============================================================================

/**
 * Computes label similarity between two strings (Jaccard-like on words).
 */
function labelSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeLabel(a).split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(normalizeLabel(b).split(/\s+/).filter(w => w.length > 2))
  if (wordsA.size === 0 && wordsB.size === 0) return 0
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union > 0 ? intersection / union : 0
}

/**
 * Cross-references detected recurrences with user-defined recurring bills.
 *
 * - If a detected pattern matches a known bill (by recurringId, label similarity,
 *   or amount+category proximity), link them without duplicating.
 * - If a detected pattern is new, surface it as a discovery.
 *
 * @param recurrences - Detected recurring patterns
 * @param bills - User-defined fixed expenses / recurring bills
 * @returns Merged list with linked bills and new discoveries
 */
export function mergeWithBills(
  recurrences: DetectedRecurrence[],
  bills: FixedExpense[]
): MergedRecurrence[] {
  const activeBills = bills.filter(b => b.isActive)
  const matchedBillIds = new Set<string>()

  const merged: MergedRecurrence[] = recurrences.map(recurrence => {
    // Try to match against existing bills

    // 1. Match by recurringId (strongest signal)
    // Check if any transaction in the pattern has a recurringId matching a bill
    const billByRecurringId = activeBills.find(
      bill => bill.recurringId && bill.recurringId === recurrence.id.replace('recurrence-', '')
    )
    if (billByRecurringId && !matchedBillIds.has(billByRecurringId.id)) {
      matchedBillIds.add(billByRecurringId.id)
      return {
        ...recurrence,
        linkedBillId: billByRecurringId.id,
        isNewDiscovery: false,
        status: 'confirmed' as RecurrenceStatus,
      }
    }

    // 2. Match by label similarity + amount proximity + category
    const AMOUNT_TOLERANCE = 0.2 // 20% tolerance
    const LABEL_THRESHOLD = 0.5

    const matchedBill = activeBills.find(bill => {
      if (matchedBillIds.has(bill.id)) return false

      const similarity = labelSimilarity(recurrence.label, bill.label)
      const amountDiff = Math.abs(recurrence.amount - bill.amount)
      const amountClose = bill.amount > 0
        ? amountDiff / bill.amount <= AMOUNT_TOLERANCE
        : amountDiff < 5

      // Strong match: high label similarity + close amount
      if (similarity >= LABEL_THRESHOLD && amountClose) return true

      // Category match + very close amount + some label overlap
      if (bill.category === recurrence.category && amountClose && similarity > 0.2) return true

      return false
    })

    if (matchedBill) {
      matchedBillIds.add(matchedBill.id)
      return {
        ...recurrence,
        linkedBillId: matchedBill.id,
        isNewDiscovery: false,
        status: 'confirmed' as RecurrenceStatus,
      }
    }

    // 3. No match — this is a new discovery
    const freqLabel = recurrence.frequency === 'weekly'
      ? 'every week'
      : recurrence.frequency === 'biweekly'
        ? 'every two weeks'
        : 'every month'

    return {
      ...recurrence,
      isNewDiscovery: true,
      discoveryCopy: `We noticed you pay ~$${recurrence.predictedAmount.toFixed(0)} to ${recurrence.label} ${freqLabel} — want to track it?`,
    }
  })

  return merged
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Returns only the new discoveries (patterns not linked to existing bills).
 */
export function getNewDiscoveries(merged: MergedRecurrence[]): MergedRecurrence[] {
  return merged.filter(r => r.isNewDiscovery)
}

/**
 * Returns confirmed recurrences (user-verified or linked to a bill).
 */
export function getConfirmedRecurrences(merged: MergedRecurrence[]): MergedRecurrence[] {
  return merged.filter(r => r.status === 'confirmed')
}

/**
 * Returns suggested recurrences (auto-detected, awaiting user action).
 */
export function getSuggestedRecurrences(merged: MergedRecurrence[]): MergedRecurrence[] {
  return merged.filter(r => r.status === 'suggested')
}

/**
 * Sums the predicted monthly cost of all active (non-dismissed, non-paused) recurrences.
 */
export function getMonthlyRecurrenceTotal(recurrences: DetectedRecurrence[]): number {
  return recurrences
    .filter(r => r.status !== 'dismissed' && r.status !== 'paused')
    .reduce((sum, r) => {
      switch (r.frequency) {
        case 'weekly':
          return sum + r.predictedAmount * 4.33
        case 'biweekly':
          return sum + r.predictedAmount * 2.17
        case 'monthly':
        default:
          return sum + r.predictedAmount
      }
    }, 0)
}
