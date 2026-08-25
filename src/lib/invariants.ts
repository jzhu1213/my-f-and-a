/**
 * Data Invariants — defines the rules that must always hold for Folio's data layer.
 *
 * Task 521.1 — Document invariants
 * Task 521.2 — Build invariant checker
 *
 * Invariants are enforced at runtime by scanning the full dataset on app startup
 * and auto-correcting where safe. Violations are logged for debugging.
 */

import type { Transaction, Budget, Goal } from '@/types'
import type { Debt } from '@/types/folio'
import type { SinkingFund } from '@/lib/sinkingFunds'

// ============================================================================
// Invariant Definitions (521.1)
// ============================================================================

/**
 * Data Invariants — the rules that must always hold:
 *
 * 1. Transaction amount > 0
 * 2. Budget monthlyLimit >= 0
 * 3. Goal targetAmount >= 0
 * 4. Goal currentAmount <= targetAmount
 * 5. Goal currentAmount >= 0
 * 6. Debt balance >= 0 (0 = paid off)
 * 7. SinkingFund savedAmount >= 0
 * 8. SinkingFund savedAmount <= targetAmount
 * 9. SinkingFund targetAmount >= 0
 * 10. Date strings are valid ISO 8601 (YYYY-MM-DD)
 * 11. No duplicate transaction IDs
 */

// ============================================================================
// Types
// ============================================================================

export type ViolationSeverity = 'warning' | 'error'

export interface Violation {
  /** Which entity type the violation belongs to */
  entity: 'transaction' | 'budget' | 'goal' | 'debt' | 'sinkingFund'
  /** The ID of the offending record */
  id: string
  /** Which invariant was violated */
  rule: string
  /** Human-readable description */
  message: string
  /** Whether the violation was auto-corrected */
  corrected: boolean
  /** Severity — errors are data-integrity issues, warnings are clamped values */
  severity: ViolationSeverity
}

export interface InvariantReport {
  /** All violations found */
  violations: Violation[]
  /** Number of auto-corrections applied */
  correctionCount: number
  /** Total entities scanned */
  scannedCount: number
  /** Timestamp of the check */
  checkedAt: string
}

// ============================================================================
// Helpers
// ============================================================================

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidISODate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false
  const parts = dateStr.split('-')
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// ============================================================================
// Invariant Checker (521.2)
// ============================================================================

export interface DataSet {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  debts: Debt[]
  sinkingFunds: SinkingFund[]
}

/**
 * Scans the full dataset for invariant violations.
 * Auto-corrects where safe (clamps values) and logs violations.
 *
 * IMPORTANT: This mutates the input arrays in place for corrections.
 * Call on app startup after data load.
 */
export function checkInvariants(data: DataSet): InvariantReport {
  const violations: Violation[] = []
  let correctionCount = 0
  let scannedCount = 0

  // --- Transactions ---
  const seenTxIds = new Set<string>()
  for (const tx of data.transactions) {
    scannedCount++

    // Amount must be > 0
    if (tx.amount <= 0) {
      violations.push({
        entity: 'transaction',
        id: tx.id,
        rule: 'amount_positive',
        message: 'Transaction amount must be > 0, got ' + String(tx.amount),
        corrected: false,
        severity: 'error',
      })
    }

    // Date must be valid ISO 8601
    if (!isValidISODate(tx.date)) {
      violations.push({
        entity: 'transaction',
        id: tx.id,
        rule: 'date_valid',
        message: 'Transaction date is not valid ISO 8601: "' + tx.date + '"',
        corrected: false,
        severity: 'error',
      })
    }

    // No duplicate IDs
    if (seenTxIds.has(tx.id)) {
      violations.push({
        entity: 'transaction',
        id: tx.id,
        rule: 'no_duplicate_ids',
        message: 'Duplicate transaction ID: "' + tx.id + '"',
        corrected: false,
        severity: 'error',
      })
    }
    seenTxIds.add(tx.id)
  }

  // --- Budgets ---
  for (const budget of data.budgets) {
    scannedCount++

    if (budget.monthlyLimit < 0) {
      budget.monthlyLimit = 0
      correctionCount++
      violations.push({
        entity: 'budget',
        id: budget.id,
        rule: 'limit_nonnegative',
        message: 'Budget monthlyLimit was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }
  }

  // --- Goals ---
  for (const goal of data.goals) {
    scannedCount++

    if (goal.targetAmount < 0) {
      goal.targetAmount = 0
      correctionCount++
      violations.push({
        entity: 'goal',
        id: goal.id,
        rule: 'target_nonnegative',
        message: 'Goal targetAmount was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }

    if (goal.currentAmount < 0) {
      goal.currentAmount = 0
      correctionCount++
      violations.push({
        entity: 'goal',
        id: goal.id,
        rule: 'progress_nonnegative',
        message: 'Goal currentAmount was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }

    if (goal.currentAmount > goal.targetAmount) {
      goal.currentAmount = goal.targetAmount
      correctionCount++
      violations.push({
        entity: 'goal',
        id: goal.id,
        rule: 'progress_lte_target',
        message: 'Goal currentAmount exceeded targetAmount, clamped to target',
        corrected: true,
        severity: 'warning',
      })
    }

    if (goal.targetDate && !isValidISODate(goal.targetDate)) {
      violations.push({
        entity: 'goal',
        id: goal.id,
        rule: 'date_valid',
        message: 'Goal targetDate is not valid ISO 8601: "' + goal.targetDate + '"',
        corrected: false,
        severity: 'error',
      })
    }
  }

  // --- Debts ---
  for (const debt of data.debts) {
    scannedCount++

    if (debt.balance < 0) {
      debt.balance = 0
      correctionCount++
      violations.push({
        entity: 'debt',
        id: debt.id,
        rule: 'balance_nonnegative',
        message: 'Debt balance was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }
  }

  // --- Sinking Funds ---
  for (const fund of data.sinkingFunds) {
    scannedCount++

    if (fund.targetAmount < 0) {
      fund.targetAmount = 0
      correctionCount++
      violations.push({
        entity: 'sinkingFund',
        id: fund.id,
        rule: 'target_nonnegative',
        message: 'SinkingFund targetAmount was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }

    if (fund.savedAmount < 0) {
      fund.savedAmount = 0
      correctionCount++
      violations.push({
        entity: 'sinkingFund',
        id: fund.id,
        rule: 'saved_nonnegative',
        message: 'SinkingFund savedAmount was negative, clamped to 0',
        corrected: true,
        severity: 'warning',
      })
    }

    if (fund.savedAmount > fund.targetAmount) {
      fund.savedAmount = fund.targetAmount
      correctionCount++
      violations.push({
        entity: 'sinkingFund',
        id: fund.id,
        rule: 'saved_lte_target',
        message: 'SinkingFund savedAmount exceeded targetAmount, clamped to target',
        corrected: true,
        severity: 'warning',
      })
    }

    if (fund.dueDate && fund.dueDate !== '' && !isValidISODate(fund.dueDate)) {
      violations.push({
        entity: 'sinkingFund',
        id: fund.id,
        rule: 'date_valid',
        message: 'SinkingFund dueDate is not valid ISO 8601: "' + fund.dueDate + '"',
        corrected: false,
        severity: 'error',
      })
    }
  }

  const report: InvariantReport = {
    violations,
    correctionCount,
    scannedCount,
    checkedAt: new Date().toISOString(),
  }

  // Log violations for debugging
  if (violations.length > 0) {
    console.warn(
      '[Invariants] ' + String(violations.length) + ' violation(s) found, ' + String(correctionCount) + ' auto-corrected',
      violations
    )
  }

  return report
}
