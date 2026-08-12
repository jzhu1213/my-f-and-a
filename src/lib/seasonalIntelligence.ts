/**
 * Seasonal Intelligence — detects spending pattern shifts over time and
 * suggests budget mode switches when a significant change is detected.
 *
 * Runs entirely on local/cached data (transactions already loaded). Requires
 * 2+ months of history before activating — returns null when insufficient.
 *
 * Never auto-switches modes. Always surfaces as a dismissable suggestion.
 *
 * **Validates: Requirements 18.3, 18.2**
 *
 * Task 338.1
 */

import type { Transaction } from '@/types'
import { formatDateLocal } from '@/lib/dateUtils'
import { getBudgetModes, getActiveBudgetMode } from '@/lib/spendingModeConfig'

// ============================================================================
// Types
// ============================================================================

/**
 * A seasonal mode suggestion — surfaces when a spending pattern shift is
 * detected and maps to a known budget mode.
 */
export interface SeasonalModeSuggestion {
  /** The budget mode ID to suggest switching to */
  modeId: string
  /** Human-readable mode name (e.g., "Break") */
  modeName: string
  /** A warm, non-judgmental reason describing the detected pattern shift */
  reason: string
}

/**
 * Internal representation of a monthly spending summary used for comparison.
 */
interface MonthlySpendingSummary {
  /** YYYY-MM prefix */
  month: string
  /** Total expense amount */
  totalExpenses: number
  /** Expense total in "fixed" categories (rent, subscriptions) */
  fixedExpenses: number
  /** Expense total in discretionary categories */
  discretionaryExpenses: number
  /** Number of expense transactions */
  transactionCount: number
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum months of history required before seasonal detection activates. */
const MIN_HISTORY_MONTHS = 2

/** Threshold for "significant" drop in fixed expenses (30%+). */
const FIXED_DROP_THRESHOLD = 0.30

/** Threshold for "significant" increase in overall spending (40%+). */
const SPENDING_INCREASE_THRESHOLD = 0.40

/** Threshold for "significant" drop in overall spending (35%+). */
const SPENDING_DROP_THRESHOLD = 0.35

/** Categories considered "fixed" for pattern detection. */
const FIXED_CATEGORIES = new Set(['rent', 'subscriptions'])

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Summarize transactions into monthly spending buckets.
 * Pure: does not mutate input.
 */
function summarizeByMonth(transactions: Transaction[]): MonthlySpendingSummary[] {
  const monthMap = new Map<string, MonthlySpendingSummary>()

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const month = tx.date.slice(0, 7) // "YYYY-MM"

    let summary = monthMap.get(month)
    if (!summary) {
      summary = {
        month,
        totalExpenses: 0,
        fixedExpenses: 0,
        discretionaryExpenses: 0,
        transactionCount: 0,
      }
      monthMap.set(month, summary)
    }

    summary.totalExpenses += tx.amount
    summary.transactionCount += 1

    if (FIXED_CATEGORIES.has(tx.category)) {
      summary.fixedExpenses += tx.amount
    } else {
      summary.discretionaryExpenses += tx.amount
    }
  }

  // Sort by month ascending
  return [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Get the month string N months before the reference date.
 */
function getMonthOffset(referenceDate: Date, monthsBack: number): string {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthsBack, 1)
  return formatDateLocal(d).slice(0, 7)
}

// ============================================================================
// Core detection
// ============================================================================

/**
 * Detect seasonal spending pattern shifts by comparing recent spending (last
 * 1 month) against a historical baseline (2-4 months ago).
 *
 * Returns a suggestion mapped to an available budget mode, or null if:
 * - Insufficient history (< 2 months)
 * - No significant pattern shift detected
 * - The suggested mode is already active
 * - No matching mode exists in the user's configured modes
 *
 * Pure: deterministic given the same inputs. No I/O.
 *
 * @param transactions All user transactions (will be filtered to expenses).
 * @param referenceDate The "today" date (injected for testability).
 * @returns A seasonal mode suggestion, or null.
 */
export function detectSeasonalShift(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): SeasonalModeSuggestion | null {
  const monthlySummaries = summarizeByMonth(transactions)

  // Need at least MIN_HISTORY_MONTHS of expense data
  if (monthlySummaries.length < MIN_HISTORY_MONTHS) {
    return null
  }

  // Define the "recent" month and "historical" baseline window
  const recentMonth = getMonthOffset(referenceDate, 0)
  const recentSummary = monthlySummaries.find(s => s.month === recentMonth)

  // If we have no data for the current month yet, look at last month
  const effectiveRecent = recentSummary?.transactionCount && recentSummary.transactionCount >= 3
    ? recentSummary
    : monthlySummaries.find(s => s.month === getMonthOffset(referenceDate, 1))

  if (!effectiveRecent) {
    return null
  }

  // Historical baseline: average of months 2-4 before the reference
  const baselineMonths: MonthlySpendingSummary[] = []
  for (let i = 2; i <= 4; i++) {
    const monthStr = getMonthOffset(referenceDate, i)
    const found = monthlySummaries.find(s => s.month === monthStr)
    if (found && found.transactionCount >= 3) {
      baselineMonths.push(found)
    }
  }

  // Need at least 1 baseline month for comparison
  if (baselineMonths.length === 0) {
    return null
  }

  const baselineAvg = {
    totalExpenses: baselineMonths.reduce((s, m) => s + m.totalExpenses, 0) / baselineMonths.length,
    fixedExpenses: baselineMonths.reduce((s, m) => s + m.fixedExpenses, 0) / baselineMonths.length,
    discretionaryExpenses: baselineMonths.reduce((s, m) => s + m.discretionaryExpenses, 0) / baselineMonths.length,
  }

  // Avoid division by zero
  if (baselineAvg.totalExpenses === 0) {
    return null
  }

  // Pattern 1: Fixed expenses dropped significantly → likely entering a break
  if (
    baselineAvg.fixedExpenses > 0 &&
    effectiveRecent.fixedExpenses < baselineAvg.fixedExpenses * (1 - FIXED_DROP_THRESHOLD)
  ) {
    return mapToMode(
      'break',
      "your fixed expenses have dropped — looks like a break might be starting"
    )
  }

  // Pattern 2: Overall spending increased significantly → might have a job now
  if (
    effectiveRecent.totalExpenses > baselineAvg.totalExpenses * (1 + SPENDING_INCREASE_THRESHOLD)
  ) {
    return mapToMode(
      'summer_job',
      "spending's picked up — maybe you're earning more this season"
    )
  }

  // Pattern 3: Overall spending dropped significantly → might be studying abroad or on break
  if (
    effectiveRecent.totalExpenses < baselineAvg.totalExpenses * (1 - SPENDING_DROP_THRESHOLD)
  ) {
    return mapToMode(
      'break',
      "spending has slowed down quite a bit — a lighter budget might fit better"
    )
  }

  return null
}

/**
 * Maps a detected pattern to an available budget mode.
 * Returns null if the mode isn't configured or is already active.
 */
function mapToMode(
  patternHint: 'break' | 'summer_job' | 'semester' | 'study_abroad',
  reason: string
): SeasonalModeSuggestion | null {
  const modes = getBudgetModes()
  const activeMode = getActiveBudgetMode()

  // Map pattern hints to mode ID patterns
  const modeIdPatterns: Record<string, string[]> = {
    break: ['preset_break', 'break'],
    summer_job: ['preset_summer_job', 'summer_job', 'summer'],
    semester: ['preset_semester', 'semester'],
    study_abroad: ['preset_study_abroad', 'study_abroad', 'abroad'],
  }

  const patterns = modeIdPatterns[patternHint] ?? []

  // Find a matching mode
  const matchedMode = modes.find(m =>
    patterns.some(p =>
      m.id.toLowerCase().includes(p) || m.name.toLowerCase().includes(p.replace('_', ' '))
    )
  )

  if (!matchedMode) {
    return null
  }

  // Don't suggest if this mode is already active
  if (activeMode && activeMode.id === matchedMode.id) {
    return null
  }

  return {
    modeId: matchedMode.id,
    modeName: matchedMode.name,
    reason,
  }
}
