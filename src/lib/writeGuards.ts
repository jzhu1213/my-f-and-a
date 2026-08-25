/**
 * Write Guards — prevents impossible writes from reaching the database.
 *
 * Task 521.3
 *
 * These guard functions validate input BEFORE calling supabaseData.ts mutations.
 * They return a discriminated union: success with validated data, or error with
 * a message. The caller decides how to surface the error (toast, inline, etc.).
 *
 * Usage:
 *   const result = guardTransaction({ amount: -5, ... })
 *   if (!result.ok) { showToast(result.error); return }
 *   await insertTransaction(userId, result.data)
 */

import type { TransactionCategory, TransactionType, AccountType } from '@/types'

// ============================================================================
// Result Type
// ============================================================================

export type GuardResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ============================================================================
// Input Types (mirror the mutation function parameter shapes)
// ============================================================================

export interface TransactionInput {
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  note?: string
  isRecurring?: boolean
  accountType?: AccountType
  fundingSourceId?: string
}

export interface TransactionUpdateInput {
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  note?: string
}

export interface BudgetLimitInput {
  monthlyLimit: number
}

export interface GoalCreateInput {
  name: string
  targetAmount: number
  emoji: string
  targetDate?: string
  linkedAccountId?: string
}

export interface GoalProgressInput {
  currentAmount: number
  targetAmount: number
}

export interface DebtInput {
  name: string
  balance: number
  apr: number
  minimumPayment: number
}

export interface SinkingFundInput {
  label: string
  targetAmount: number
  savedAmount: number
  monthlyReserve: number
  dueDate?: string
}

// ============================================================================
// Validation Helpers
// ============================================================================

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_TRANSACTION_AMOUNT = 99999
const MAX_NOTE_LENGTH = 60

function isValidISODate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false
  const parts = dateStr.split('-')
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function sanitizeNote(note: string | undefined): string | undefined {
  if (!note) return undefined
  // Strip HTML tags and trim to max length
  const stripped = note.replace(/<[^>]*>/g, '').trim()
  return stripped.slice(0, MAX_NOTE_LENGTH) || undefined
}

/**
 * Strips HTML tags from a name/label string. Used for goals, debts, and
 * sinking funds to prevent stored XSS via custom names.
 */
function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, '').trim()
}

// ============================================================================
// Guard Functions
// ============================================================================

/**
 * Validates a transaction before insert.
 * - Amount must be > 0 and <= 99999
 * - Date must be valid ISO 8601
 * - Note is sanitized (HTML stripped, max 60 chars)
 */
export function guardTransaction(input: TransactionInput): GuardResult<TransactionInput> {
  if (input.amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero' }
  }
  if (input.amount > MAX_TRANSACTION_AMOUNT) {
    return { ok: false, error: 'Amount cannot exceed $' + MAX_TRANSACTION_AMOUNT.toLocaleString() }
  }
  if (!isValidISODate(input.date)) {
    return { ok: false, error: 'Date must be a valid date (YYYY-MM-DD)' }
  }

  return {
    ok: true,
    data: { ...input, note: sanitizeNote(input.note) },
  }
}

/**
 * Validates a transaction update.
 * Same rules as insert — amount > 0, valid date, sanitized note.
 */
export function guardTransactionUpdate(input: TransactionUpdateInput): GuardResult<TransactionUpdateInput> {
  if (input.amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero' }
  }
  if (input.amount > MAX_TRANSACTION_AMOUNT) {
    return { ok: false, error: 'Amount cannot exceed $' + MAX_TRANSACTION_AMOUNT.toLocaleString() }
  }
  if (!isValidISODate(input.date)) {
    return { ok: false, error: 'Date must be a valid date (YYYY-MM-DD)' }
  }

  return {
    ok: true,
    data: { ...input, note: sanitizeNote(input.note) },
  }
}

/**
 * Validates a budget limit change.
 * - monthlyLimit must be >= 0
 */
export function guardBudgetLimit(input: BudgetLimitInput): GuardResult<BudgetLimitInput> {
  if (input.monthlyLimit < 0) {
    return { ok: false, error: 'Budget limit cannot be negative' }
  }

  return { ok: true, data: input }
}

/**
 * Validates goal creation.
 * - targetAmount must be >= 0
 * - name must be non-empty
 * - targetDate (if provided) must be valid ISO 8601
 */
export function guardGoalCreate(input: GoalCreateInput): GuardResult<GoalCreateInput> {
  const name = sanitizeName(input.name)
  if (!name) {
    return { ok: false, error: 'Goal name is required' }
  }
  if (input.targetAmount < 0) {
    return { ok: false, error: 'Goal target cannot be negative' }
  }
  if (input.targetDate && !isValidISODate(input.targetDate)) {
    return { ok: false, error: 'Target date must be a valid date (YYYY-MM-DD)' }
  }

  return { ok: true, data: { ...input, name } }
}

/**
 * Validates goal progress update.
 * - currentAmount must be >= 0
 * - currentAmount must be <= targetAmount
 */
export function guardGoalProgress(input: GoalProgressInput): GuardResult<{ currentAmount: number }> {
  if (input.currentAmount < 0) {
    return { ok: false, error: 'Goal progress cannot be negative' }
  }
  if (input.currentAmount > input.targetAmount) {
    return { ok: false, error: 'Goal progress cannot exceed the target amount' }
  }

  return { ok: true, data: { currentAmount: input.currentAmount } }
}

/**
 * Validates debt creation/update.
 * - balance must be >= 0
 * - apr must be >= 0
 * - minimumPayment must be >= 0
 * - name must be non-empty
 */
export function guardDebt(input: DebtInput): GuardResult<DebtInput> {
  const name = sanitizeName(input.name)
  if (!name) {
    return { ok: false, error: 'Debt name is required' }
  }
  if (input.balance < 0) {
    return { ok: false, error: 'Debt balance cannot be negative' }
  }
  if (input.apr < 0) {
    return { ok: false, error: 'APR cannot be negative' }
  }
  if (input.minimumPayment < 0) {
    return { ok: false, error: 'Minimum payment cannot be negative' }
  }

  return { ok: true, data: { ...input, name } }
}

/**
 * Validates sinking fund creation/update.
 * - targetAmount must be >= 0
 * - savedAmount must be >= 0 and <= targetAmount
 * - monthlyReserve must be >= 0
 * - dueDate (if non-empty) must be valid ISO 8601
 * - label must be non-empty
 */
export function guardSinkingFund(input: SinkingFundInput): GuardResult<SinkingFundInput> {
  const label = sanitizeName(input.label)
  if (!label) {
    return { ok: false, error: 'Fund name is required' }
  }
  if (input.targetAmount < 0) {
    return { ok: false, error: 'Target amount cannot be negative' }
  }
  if (input.savedAmount < 0) {
    return { ok: false, error: 'Saved amount cannot be negative' }
  }
  if (input.savedAmount > input.targetAmount) {
    return { ok: false, error: 'Saved amount cannot exceed target amount' }
  }
  if (input.monthlyReserve < 0) {
    return { ok: false, error: 'Monthly reserve cannot be negative' }
  }
  if (input.dueDate && input.dueDate !== '' && !isValidISODate(input.dueDate)) {
    return { ok: false, error: 'Due date must be a valid date (YYYY-MM-DD)' }
  }

  return { ok: true, data: { ...input, label } }
}
