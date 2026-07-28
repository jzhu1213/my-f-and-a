import type { Transaction, TransactionCategory } from '@/types'

/**
 * Refund utility functions — pure helpers for creating, detecting, and
 * calculating refund transactions.
 *
 * A refund is modeled as an income transaction in the same category as the
 * original expense, effectively offsetting that category's spending. The note
 * is prefixed with "Refund: " to mark it as a refund.
 *
 * **Validates: Requirements 10.1, 10.5**
 */

const REFUND_PREFIX = 'Refund: '

/**
 * Creates a new transaction object representing a refund of an original expense.
 *
 * - Uses `type: 'income'` to add money back
 * - Keeps the same `category` to offset category spending
 * - Prefixes note with "Refund: " for identification
 * - Defaults to full refund if `refundAmount` is omitted
 *
 * @param originalTransaction - The original expense being refunded
 * @param refundAmount - Optional partial amount (must be > 0 and ≤ original)
 * @param refundDate - Optional override date (defaults to today)
 * @returns A transaction-ready object (missing `id` and `createdAt`)
 */
export function createRefundTransaction(
  originalTransaction: Transaction,
  refundAmount?: number,
  refundDate?: string,
): Omit<Transaction, 'id' | 'createdAt'> {
  const amount = refundAmount ?? originalTransaction.amount

  // Validate amount bounds
  if (amount <= 0 || amount > originalTransaction.amount) {
    throw new Error(
      `Refund amount must be between $0.01 and $${originalTransaction.amount.toFixed(2)}`
    )
  }

  const today = new Date()
  const date =
    refundDate ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const originalNote = originalTransaction.note?.trim()
  const note = originalNote
    ? `${REFUND_PREFIX}${originalNote}`.slice(0, 60)
    : 'Refund'

  return {
    userId: originalTransaction.userId,
    date,
    amount,
    type: 'income',
    category: originalTransaction.category,
    note,
    accountType: originalTransaction.accountType,
  }
}

/**
 * Detects whether a transaction is a refund based on its note prefix.
 */
export function isRefundTransaction(transaction: Transaction): boolean {
  if (transaction.type !== 'income') return false
  const note = transaction.note?.trim() ?? ''
  return note === 'Refund' || note.startsWith(REFUND_PREFIX)
}

/**
 * Calculates the net category spend for a given month, accounting for refunds.
 *
 * Net spend = total expenses in category − refund incomes in same category.
 *
 * @param transactions - All user transactions
 * @param category - The category to calculate
 * @param month - Month string in "YYYY-MM" format
 * @returns Net spend (positive = net outflow, negative = net refund surplus)
 */
export function getNetCategorySpend(
  transactions: Transaction[],
  category: TransactionCategory,
  month: string,
): number {
  let expenses = 0
  let refunds = 0

  for (const tx of transactions) {
    if (tx.category !== category) continue
    if (!tx.date.startsWith(month)) continue

    if (tx.type === 'expense') {
      expenses += tx.amount
    } else if (isRefundTransaction(tx)) {
      refunds += tx.amount
    }
  }

  return expenses - refunds
}
