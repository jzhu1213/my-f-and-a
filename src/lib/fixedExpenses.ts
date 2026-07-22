import type { Transaction, TransactionCategory } from '@/types'

/**
 * Represents a recurring fixed obligation (rent, subscriptions, utilities, etc.)
 * These are predictable monthly bills that should be "sunk" before computing
 * the daily discretionary allowance.
 */
export interface FixedExpense {
  id: string
  userId: string
  category: TransactionCategory
  label: string
  amount: number
  dueDay: number // 1–31
  recurringId: string
  isActive: boolean
}

/**
 * Alias for clarity — a recurring bill is a fixed expense.
 */
export type RecurringBill = FixedExpense

/**
 * Categories that are commonly fixed/recurring obligations.
 * Used as a heuristic when no explicit isRecurring flag is set.
 */
const FIXED_CATEGORIES: ReadonlySet<TransactionCategory> = new Set([
  'rent',
])

/**
 * Extended list of label keywords that indicate a fixed obligation,
 * useful for heuristic detection on transaction notes.
 */
const FIXED_LABEL_KEYWORDS: readonly string[] = [
  'rent',
  'subscription',
  'utilities',
  'utility',
  'phone',
  'insurance',
  'loan',
  'internet',
  'wifi',
  'electric',
  'water',
  'gas',
]

/**
 * Returns true if the given category is commonly associated with fixed obligations.
 */
export function isFixedCategory(category: TransactionCategory): boolean {
  return FIXED_CATEGORIES.has(category)
}

/**
 * Determines whether a transaction represents a fixed/recurring obligation.
 *
 * Checks in order:
 * 1. Explicit `isRecurring` flag on the transaction
 * 2. Whether the transaction's category is a known fixed category
 */
export function isFixedTransaction(tx: Transaction): boolean {
  if (tx.isRecurring) {
    return true
  }
  return isFixedCategory(tx.category)
}

/**
 * Sums the monthly total of all active fixed expenses.
 */
export function getTotalFixedMonthly(bills: FixedExpense[]): number {
  return bills
    .filter(bill => bill.isActive)
    .reduce((sum, bill) => sum + bill.amount, 0)
}

/**
 * Returns bills that are due after `today` within the current month.
 * Useful for reserving upcoming obligations from the spendable pool.
 */
export function getUpcomingBills(bills: FixedExpense[], today: Date): number[] {
  const currentDay = today.getDate()
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate()

  return bills
    .filter(bill => bill.isActive && bill.dueDay > currentDay && bill.dueDay <= daysInMonth)
    .map(bill => bill.dueDay)
}

/**
 * Returns the list of active bills due after today in the current month.
 */
export function getUpcomingBillsList(bills: FixedExpense[], today: Date): FixedExpense[] {
  const currentDay = today.getDate()
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate()

  return bills.filter(
    bill => bill.isActive && bill.dueDay > currentDay && bill.dueDay <= daysInMonth
  )
}

/**
 * Checks whether a label matches common fixed-expense keywords.
 * Case-insensitive partial match.
 */
export function matchesFixedKeyword(label: string): boolean {
  const lower = label.toLowerCase()
  return FIXED_LABEL_KEYWORDS.some(keyword => lower.includes(keyword))
}
