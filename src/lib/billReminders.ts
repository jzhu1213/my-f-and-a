/**
 * Bill Reminders — Smart pre-fill, variable detection, and payment confirmation.
 *
 * This module provides:
 * 1. Bill amount pre-fill from transaction history (last payment or average of 3)
 * 2. Variable bill detection (shows range when amounts fluctuate)
 * 3. Post-due-date payment confirmation (gentle check-in if no matching tx logged)
 *
 * Requirements: 23.6
 */

import type { Transaction, TransactionCategory } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'

// ============================================================================
// Types
// ============================================================================

/** Result of analyzing a bill's payment history for pre-fill. */
export interface BillPreFill {
  /** The bill this pre-fill relates to */
  billId: string
  /** Suggested amount (last payment or average of last 3 if variable) */
  suggestedAmount: number
  /** Whether the bill has variable amounts */
  isVariable: boolean
  /** Source of the suggestion */
  source: 'last-payment' | 'average-of-3'
  /** How many historical payments were found */
  historyCount: number
}

/** Result of variable bill detection — range and context copy. */
export interface VariableBillInfo {
  /** The bill this info relates to */
  billId: string
  /** Bill label for display */
  label: string
  /** Category for emoji/icon */
  category: TransactionCategory
  /** Minimum amount in recent history */
  min: number
  /** Maximum amount in recent history */
  max: number
  /** Last payment amount */
  lastAmount: number
  /** Average across recent payments */
  average: number
  /** Standard deviation of amounts */
  stdDev: number
  /** Due day of month */
  dueDay: number
  /** Human-readable range message */
  displayMessage: string
}

/** A pending payment confirmation prompt. */
export interface BillConfirmation {
  /** The bill this confirmation is for */
  billId: string
  /** Bill label */
  label: string
  /** Category for emoji/icon */
  category: TransactionCategory
  /** Expected amount */
  expectedAmount: number
  /** The due date that passed (YYYY-MM-DD) */
  dueDate: string
  /** Friendly prompt copy */
  message: string
}

/** Tracks which confirmations have been dismissed (persisted in localStorage). */
export interface DismissedConfirmations {
  /** Map of billId → month key (YYYY-MM) when dismissed */
  [billId: string]: string
}

// ============================================================================
// Constants
// ============================================================================

const DISMISSED_CONFIRMATIONS_KEY = 'folio-bill-confirmations-dismissed'

/**
 * Threshold for variable bill detection.
 * If standard deviation > 15% of mean, the bill is considered variable.
 */
const VARIABILITY_THRESHOLD = 0.15

/**
 * Number of recent payments to consider for history analysis.
 */
const HISTORY_WINDOW = 6

// ============================================================================
// Bill Matching — find past payments for a bill
// ============================================================================

/**
 * Finds past transactions that match a given bill using the same heuristics
 * as `isScheduledForKnownBill`:
 * 1. recurringId match
 * 2. Same category + amount within 30% (wider for history matching)
 * 3. Note/label keyword overlap
 *
 * Returns matches sorted by date descending (most recent first).
 */
export function findBillPayments(
  bill: FixedExpense,
  transactions: Transaction[]
): Transaction[] {
  const expenses = transactions.filter(tx => tx.type === 'expense')

  const matches = expenses.filter(tx => {
    // 1. Definitive: recurringId match
    if (tx.recurringId && tx.recurringId === bill.recurringId) {
      return true
    }

    // 2. Category + amount proximity (within 30% for history — wider than real-time)
    if (tx.category === bill.category) {
      const diff = Math.abs(tx.amount - bill.amount)
      if (diff <= bill.amount * 0.30) {
        return true
      }
    }

    // 3. Note/label keyword overlap
    if (tx.note) {
      const noteLower = tx.note.toLowerCase()
      const labelWords = bill.label.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      if (labelWords.some(word => noteLower.includes(word))) {
        return true
      }
    }

    return false
  })

  // Sort by date descending (most recent first)
  return matches.sort((a, b) => b.date.localeCompare(a.date))
}

// ============================================================================
// 415.1 — Pre-fill bill amounts from history
// ============================================================================

/**
 * Computes a pre-fill suggestion for a bill based on transaction history.
 *
 * - If the bill has consistent amounts, returns the last payment amount.
 * - If the bill has variable amounts (utilities, etc.), returns the average
 *   of the last 3 payments.
 *
 * Returns null if no historical payments are found.
 */
export function getBillPreFill(
  bill: FixedExpense,
  transactions: Transaction[]
): BillPreFill | null {
  const payments = findBillPayments(bill, transactions)
  if (payments.length === 0) return null

  const recentPayments = payments.slice(0, HISTORY_WINDOW)
  const amounts = recentPayments.map(tx => tx.amount)

  const isVariable = isAmountVariable(amounts)

  if (isVariable && amounts.length >= 3) {
    // Average of last 3 for variable bills
    const last3 = amounts.slice(0, 3)
    const avg = last3.reduce((sum, a) => sum + a, 0) / last3.length
    return {
      billId: bill.id,
      suggestedAmount: Math.round(avg * 100) / 100,
      isVariable: true,
      source: 'average-of-3',
      historyCount: amounts.length,
    }
  }

  // Use last payment for consistent bills (or when < 3 payments exist)
  return {
    billId: bill.id,
    suggestedAmount: amounts[0],
    isVariable: false,
    source: 'last-payment',
    historyCount: amounts.length,
  }
}

// ============================================================================
// 415.2 — Variable bill detection
// ============================================================================

/**
 * Determines if a set of amounts represents a variable bill.
 * Uses standard deviation > 15% of mean as the threshold.
 */
export function isAmountVariable(amounts: number[]): boolean {
  if (amounts.length < 3) return false

  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
  if (mean === 0) return false

  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length
  const stdDev = Math.sqrt(variance)

  return (stdDev / mean) > VARIABILITY_THRESHOLD
}

/**
 * Computes detailed variable bill information for display.
 * Returns null if the bill is not variable or has insufficient history.
 */
export function getVariableBillInfo(
  bill: FixedExpense,
  transactions: Transaction[]
): VariableBillInfo | null {
  const payments = findBillPayments(bill, transactions)
  if (payments.length < 3) return null

  const recentPayments = payments.slice(0, HISTORY_WINDOW)
  const amounts = recentPayments.map(tx => tx.amount)

  if (!isAmountVariable(amounts)) return null

  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const lastAmount = amounts[0]
  const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / amounts.length
  const stdDev = Math.sqrt(variance)

  // Round for clean display
  const displayMin = Math.round(min)
  const displayMax = Math.round(max)
  const displayLast = Math.round(lastAmount)

  const displayMessage =
    `${bill.label} due tomorrow — usually $${displayMin}–${displayMax}, last month was $${displayLast}.`

  return {
    billId: bill.id,
    label: bill.label,
    category: bill.category,
    min: displayMin,
    max: displayMax,
    lastAmount: displayLast,
    average: Math.round(average * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    dueDay: bill.dueDay,
    displayMessage,
  }
}

// ============================================================================
// 415.3 — Bill payment confirmation
// ============================================================================

/**
 * Checks which bills are past due without a matching transaction logged,
 * and returns gentle follow-up confirmation prompts.
 *
 * Only returns confirmations for bills that:
 * - Are active
 * - Have a due date that has passed in the current month
 * - Have no matching transaction logged after the due date
 * - Have not been dismissed this month
 */
export function getPendingBillConfirmations(
  bills: FixedExpense[],
  transactions: Transaction[],
  today: Date
): BillConfirmation[] {
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  const dismissed = loadDismissedConfirmations()
  const confirmations: BillConfirmation[] = []

  for (const bill of bills) {
    if (!bill.isActive) continue
    // Bill due date must have passed this month
    if (bill.dueDay >= currentDay) continue
    // Already dismissed this month
    if (dismissed[bill.id] === monthKey) continue

    // Check if there's a matching transaction logged this month after the due date
    const dueDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(bill.dueDay).padStart(2, '0')}`
    const hasMatchingTx = transactions.some(tx => {
      if (tx.type !== 'expense') return false
      // Transaction must be in the same month
      if (!tx.date.startsWith(monthKey)) return false
      // Use same matching logic
      if (tx.recurringId && tx.recurringId === bill.recurringId) return true
      if (tx.category === bill.category) {
        const diff = Math.abs(tx.amount - bill.amount)
        if (diff <= bill.amount * 0.30) return true
      }
      if (tx.note) {
        const noteLower = tx.note.toLowerCase()
        const labelWords = bill.label.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        if (labelWords.some(word => noteLower.includes(word))) return true
      }
      return false
    })

    if (hasMatchingTx) continue

    confirmations.push({
      billId: bill.id,
      label: bill.label,
      category: bill.category,
      expectedAmount: bill.amount,
      dueDate: dueDateStr,
      message: `Looks like ${bill.label} was due — want to log it?`,
    })
  }

  return confirmations
}

// ============================================================================
// Dismissed confirmations persistence
// ============================================================================

/**
 * Loads dismissed bill confirmations from localStorage.
 */
export function loadDismissedConfirmations(): DismissedConfirmations {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(DISMISSED_CONFIRMATIONS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DismissedConfirmations
  } catch {
    return {}
  }
}

/**
 * Dismisses a bill confirmation for the current month.
 * Stores in localStorage so it won't appear again this month.
 */
export function dismissBillConfirmation(billId: string, today: Date): void {
  if (typeof window === 'undefined') return
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  try {
    const dismissed = loadDismissedConfirmations()
    dismissed[billId] = monthKey
    localStorage.setItem(DISMISSED_CONFIRMATIONS_KEY, JSON.stringify(dismissed))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Cleans up old dismissed confirmations (keep only current and previous month).
 */
export function cleanupDismissedConfirmations(today: Date): void {
  if (typeof window === 'undefined') return
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  try {
    const dismissed = loadDismissedConfirmations()
    const cleaned: DismissedConfirmations = {}
    for (const [billId, month] of Object.entries(dismissed)) {
      if (month === currentMonth || month === prevMonth) {
        cleaned[billId] = month
      }
    }
    localStorage.setItem(DISMISSED_CONFIRMATIONS_KEY, JSON.stringify(cleaned))
  } catch {
    // fail silently
  }
}

// ============================================================================
// Helpers for generating display messages
// ============================================================================

/**
 * Generates the bill reminder message based on variable detection.
 * For variable bills: "Electric bill due tomorrow — usually $80–120, last month was $95."
 * For fixed bills: "Electric bill due tomorrow — $95"
 */
export function getBillReminderMessage(
  bill: FixedExpense,
  variableInfo: VariableBillInfo | null,
  daysUntilDue: number
): string {
  const timeFrame = daysUntilDue === 0
    ? 'due today'
    : daysUntilDue === 1
      ? 'due tomorrow'
      : `due in ${daysUntilDue} days`

  if (variableInfo) {
    return `${bill.label} ${timeFrame} — usually $${variableInfo.min}–${variableInfo.max}, last month was $${variableInfo.lastAmount}.`
  }

  return `${bill.label} ${timeFrame} — expected ~$${bill.amount}`
}
