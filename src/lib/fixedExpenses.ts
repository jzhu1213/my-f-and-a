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

// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIATION: Scheduled Transactions vs Fixed/Recurring Bills (Task 90.2)
// ─────────────────────────────────────────────────────────────────────────────
//
// When a user logs a future-dated transaction for a bill that ALSO exists as a
// FixedExpense, we must avoid double-counting. The fixed expense is already
// subtracted from the monthly pool (Step 1b) and shown in reservedForBills
// (Step 7). If the same bill also appears in reservedForScheduled (Step 9), the
// user would see it twice — once as a recurring obligation and once as a
// scheduled one-off.
//
// `isScheduledForKnownBill` detects this overlap using three heuristics:
//   1. Matching recurringId (definitive link)
//   2. Same category + amount within 10% tolerance (likely the same bill)
//   3. Note/label keyword overlap with the bill's label
//
// This ensures reservedForScheduled only shows truly additional one-off items.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a future-dated transaction likely corresponds to an
 * existing fixed/recurring bill, indicating it should NOT appear in
 * reservedForScheduled (to prevent double-counting with reservedForBills).
 *
 * Checks in priority order:
 * 1. `tx.recurringId` matches a bill's `recurringId` (definitive)
 * 2. `tx.category` matches a bill's category AND amount is within 10%
 * 3. `tx.note` contains keywords from a bill's label (fuzzy heuristic)
 *
 * @param tx - The future-dated transaction to check
 * @param bills - Active fixed expenses to match against
 * @returns true if the transaction is likely a duplicate of a known bill
 */
export function isScheduledForKnownBill(tx: Transaction, bills: FixedExpense[]): boolean {
  const activeBills = bills.filter(b => b.isActive)
  if (activeBills.length === 0) return false

  // 1. Definitive: recurringId match
  if (tx.recurringId) {
    if (activeBills.some(bill => bill.recurringId === tx.recurringId)) {
      return true
    }
  }

  // 2. Category + amount proximity (within 10%)
  const AMOUNT_TOLERANCE = 0.10
  const categoryMatch = activeBills.some(bill => {
    if (bill.category !== tx.category) return false
    const diff = Math.abs(bill.amount - tx.amount)
    return diff <= bill.amount * AMOUNT_TOLERANCE
  })
  if (categoryMatch) return true

  // 3. Note/label keyword overlap — tx.note contains part of a bill label
  if (tx.note) {
    const noteLower = tx.note.toLowerCase()
    const labelMatch = activeBills.some(bill => {
      const labelWords = bill.label.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      return labelWords.some(word => noteLower.includes(word))
    })
    if (labelMatch) return true
  }

  return false
}

/**
 * A unified reservation item representing either a recurring bill or a
 * scheduled one-off transaction. Used for combined display in the UI.
 */
export interface ReservationItem {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Amount reserved */
  amount: number
  /** Day of month when the item is due/scheduled */
  dueDay: number
  /** Whether this is a recurring bill or a one-off scheduled item */
  type: 'recurring' | 'scheduled'
  /** Category for icon/color mapping */
  category: TransactionCategory
}

/**
 * Computes a combined list of upcoming reservations — both recurring bills and
 * scheduled one-off transactions — without double-counting.
 *
 * Recurring bills come from the FixedExpense list (active, due after today).
 * Scheduled transactions are future-dated expenses that do NOT match a known
 * bill (i.e., they pass both `!isFixedTransaction` and `!isScheduledForKnownBill`).
 *
 * The result is sorted by due day ascending.
 *
 * @param bills - Fixed/recurring expenses
 * @param scheduledTransactions - Future-dated expense transactions within the month,
 *   already filtered to type === 'expense' && date > today && within current month
 * @param today - Current date
 * @returns Unified list of reservation items, sorted by dueDay
 */
export function getCombinedReservations(
  bills: FixedExpense[],
  scheduledTransactions: Transaction[],
  today: Date
): ReservationItem[] {
  const items: ReservationItem[] = []

  // Add upcoming recurring bills
  const upcomingBills = getUpcomingBillsList(bills, today)
  for (const bill of upcomingBills) {
    items.push({
      id: bill.id,
      label: bill.label,
      amount: bill.amount,
      dueDay: bill.dueDay,
      type: 'recurring',
      category: bill.category,
    })
  }

  // Add scheduled one-offs (already deduplicated by caller — items that are
  // NOT fixed and NOT matching a known bill)
  for (const tx of scheduledTransactions) {
    const txDate = new Date(tx.date + 'T00:00:00Z')
    items.push({
      id: tx.id,
      label: tx.note || tx.category,
      amount: tx.amount,
      dueDay: txDate.getUTCDate(),
      type: 'scheduled',
      category: tx.category,
    })
  }

  // Sort by due day (ascending)
  items.sort((a, b) => a.dueDay - b.dueDay)

  return items
}
