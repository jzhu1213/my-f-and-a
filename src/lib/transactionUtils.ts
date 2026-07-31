import type { Transaction, TransactionCategory, TransactionType } from '@/types'
import type { QuickTransaction, DailyAllowance } from '@/types/folio'
import { insertTransaction } from '@/lib/supabaseData'
import { getStatus, generateEncouragingMessage } from '@/lib/dailyAllowanceUtils'
import { addToOfflineQueue } from '@/lib/offlineQueue'

export interface TransactionRepeat {
  category: TransactionCategory
  amount: number
  note?: string
  type: TransactionType
  label: string
}

/** Last N unique transactions for one-tap repeat logging */
export function getRecentRepeats(transactions: Transaction[], limit = 3): TransactionRepeat[] {
  const seen   = new Set<string>()
  const result: TransactionRepeat[] = []

  for (const tx of transactions) {
    const key = `${tx.type}|${tx.category}|${tx.amount}|${tx.note ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)

    const notePart = tx.note ? tx.note : ''
    const label    = notePart
      ? `${notePart} · $${tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(2)}`
      : `$${tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(2)}`

    result.push({
      category: tx.category,
      amount: tx.amount,
      note: tx.note,
      type: tx.type,
      label,
    })
    if (result.length >= limit) break
  }

  return result
}

/**
 * Result of a quick transaction log attempt.
 * - success + transaction: persisted to DB immediately
 * - !success + queued: stored offline for background retry
 */
export interface LogTransactionResult {
  success: boolean
  transaction: Transaction | null
  queued: boolean
}

/**
 * Logs a quick transaction to Supabase.
 * On network failure, queues the transaction locally for background retry.
 * Defaults to 'personal' account and 'expense' type.
 *
 * **Validates: Requirements 3.8, 10.1, 10.2**
 */
export async function logQuickTransaction(
  userId: string,
  transaction: QuickTransaction
): Promise<LogTransactionResult> {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const result = await insertTransaction(userId, {
    date,
    amount: transaction.amount,
    type: 'expense',
    category: transaction.category,
    note: transaction.note,
    accountType: 'personal',
  })

  if (result) {
    return { success: true, transaction: result, queued: false }
  }

  // Network/DB failure — queue locally for background retry
  addToOfflineQueue(userId, {
    kind: 'create',
    payload: {
      category: transaction.category,
      amount: transaction.amount,
      type: 'expense',
      date,
      note: transaction.note,
    },
  })
  return { success: false, transaction: null, queued: true }
}

/**
 * Applies an optimistic update to the daily allowance after an expense.
 * Returns a new DailyAllowance reflecting the deducted amount without mutating the original.
 *
 * **Validates: Requirements 3.8, 10.1**
 */
export function applyOptimisticUpdate(
  allowance: DailyAllowance,
  amount: number
): DailyAllowance {
  const newSpentToday = allowance.spentToday + amount
  const newAmount = Math.max(0, allowance.amount - amount)

  // Use raw amount (can be negative) for accurate status calculation
  const rawAmount = allowance.amount - amount
  const status = getStatus(rawAmount, allowance.dailyBudget)
  const message = generateEncouragingMessage(status, newAmount, newSpentToday)

  return {
    ...allowance,
    amount: newAmount,
    spentToday: newSpentToday,
    status,
    message,
  }
}

/**
 * Reverts an optimistic update when the network call fails.
 * Restores the daily allowance to its pre-optimistic state.
 *
 * **Validates: Requirements 3.8, 10.1**
 */
export function revertOptimisticUpdate(
  allowance: DailyAllowance,
  amount: number
): DailyAllowance {
  const revertedSpentToday = allowance.spentToday - amount
  const revertedAmount = allowance.amount + amount

  const rawAmount = revertedAmount // already positive since we're restoring
  const status = getStatus(rawAmount, allowance.dailyBudget)
  const message = generateEncouragingMessage(status, revertedAmount, revertedSpentToday)

  return {
    ...allowance,
    amount: revertedAmount,
    spentToday: revertedSpentToday,
    status,
    message,
  }
}

// ============================================================================
// Extracted Business Logic — Pure Functions
// ============================================================================

/** Categories that are commonly expense categories (excludes income-only). */
const EXPENSE_CATEGORIES: ReadonlySet<TransactionCategory> = new Set([
  'food', 'transport', 'fun', 'school', 'rent', 'other'
])

/**
 * Finds the most recently used expense category from a transaction list.
 * Returns null if no qualifying transaction is found.
 *
 * Used to default the expense sheet's category selection to the user's
 * most recent choice for a smoother logging flow.
 */
export function getMostRecentExpenseCategory(
  transactions: Transaction[] | undefined
): TransactionCategory | null {
  if (!transactions || transactions.length === 0) return null
  const sorted = [...transactions]
    .filter((t) => t.type === 'expense' && EXPENSE_CATEGORIES.has(t.category))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return sorted.length > 0 ? sorted[0].category : null
}

/**
 * Computes the total expense amount for a given set of transactions.
 * Only sums transactions with type === 'expense'.
 */
export function computeDailyTotal(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
}

/**
 * Logs multiple transactions with the same amount/category across different dates.
 * Used for bulk/repeat entry (e.g., "daily coffee last week").
 * 
 * Returns an array of results indicating success/failure for each transaction.
 * 
 * **Validates: Task 93.1 (Bulk/repeat entry for past periods)**
 */
export async function logBulkRepeatTransactions(
  userId: string,
  transactions: Array<{
    amount: number
    category: TransactionCategory
    note?: string
    date: string
  }>
): Promise<Array<{ success: boolean; transaction: Transaction | null; date: string }>> {
  const results = await Promise.all(
    transactions.map(async (tx) => {
      const result = await insertTransaction(userId, {
        date: tx.date,
        amount: tx.amount,
        type: 'expense',
        category: tx.category,
        note: tx.note,
        accountType: 'personal',
      })
      
      return {
        success: !!result,
        transaction: result,
        date: tx.date,
      }
    })
  )
  
  return results
}
