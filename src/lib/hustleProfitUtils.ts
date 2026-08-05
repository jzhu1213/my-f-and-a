/**
 * Hustle Profit Utilities — pure functions for side-hustle profit tracking.
 *
 * Computes net profit per income stream by subtracting attributed expenses
 * from income transactions linked to that stream. Expenses are attributed
 * via the optional `incomeStreamId` field on Transaction (task 178.1).
 *
 * Intentionally PURE: no I/O, no localStorage, no side effects.
 */

import type { Transaction } from '@/types'
import type { IncomeStream } from '@/types/folio'

// ============================================================================
// Types
// ============================================================================

/** Date range filter for profit calculations. */
export interface DateRange {
  /** ISO date string (YYYY-MM-DD) — inclusive start. */
  start: string
  /** ISO date string (YYYY-MM-DD) — inclusive end. */
  end: string
}

/** Profit summary for a single income stream. */
export interface HustleProfitSummary {
  /** The income stream this summary is for. */
  streamId: string
  /** Stream display name (passed through for convenience). */
  streamName: string
  /** Total revenue (sum of income transactions for this stream). */
  revenue: number
  /** Total expenses attributed to this stream. */
  expenses: number
  /** Net profit: revenue - expenses. Negative means a loss. */
  netProfit: number
  /** Number of expense transactions attributed to this stream. */
  expenseCount: number
  /** Number of income transactions for this stream. */
  incomeCount: number
}

// ============================================================================
// Filtering helpers
// ============================================================================

/**
 * Filter transactions to only those within the given date range (inclusive).
 * If no date range is provided, returns all transactions unchanged.
 */
export function filterByDateRange(
  transactions: Transaction[],
  dateRange?: DateRange
): Transaction[] {
  if (!dateRange) return transactions
  return transactions.filter(
    (tx) => tx.date >= dateRange.start && tx.date <= dateRange.end
  )
}

/**
 * Get all transactions (income or attributed expenses) for a specific stream.
 *
 * Income transactions are matched by `incomeStreamId` on the transaction.
 * Expense transactions are matched by having `incomeStreamId` set to this stream.
 */
export function getTransactionsForStream(
  transactions: Transaction[],
  streamId: string
): Transaction[] {
  return transactions.filter((tx) => tx.incomeStreamId === streamId)
}

// ============================================================================
// Core profit computation
// ============================================================================

/**
 * Compute the profit summary for a single income stream.
 *
 * Revenue = sum of all `type: 'income'` transactions linked to this stream.
 * Expenses = sum of all `type: 'expense'` transactions linked to this stream.
 * Net profit = revenue - expenses.
 */
export function computeHustleProfit(
  transactions: Transaction[],
  stream: IncomeStream,
  dateRange?: DateRange
): HustleProfitSummary {
  const filtered = filterByDateRange(transactions, dateRange)
  const streamTxns = getTransactionsForStream(filtered, stream.id)

  let revenue = 0
  let expenses = 0
  let incomeCount = 0
  let expenseCount = 0

  for (const tx of streamTxns) {
    if (tx.type === 'income') {
      revenue += tx.amount
      incomeCount++
    } else if (tx.type === 'expense') {
      expenses += tx.amount
      expenseCount++
    }
  }

  return {
    streamId: stream.id,
    streamName: stream.name,
    revenue,
    expenses,
    netProfit: revenue - expenses,
    expenseCount,
    incomeCount,
  }
}

/**
 * Compute profit summaries for all provided income streams.
 *
 * Returns an array of summaries, one per stream, sorted by net profit
 * descending (most profitable first).
 */
export function computeAllHustleProfits(
  transactions: Transaction[],
  streams: IncomeStream[],
  dateRange?: DateRange
): HustleProfitSummary[] {
  return streams
    .map((stream) => computeHustleProfit(transactions, stream, dateRange))
    .sort((a, b) => b.netProfit - a.netProfit)
}

// ============================================================================
// Date range helpers
// ============================================================================

/**
 * Build a date range for the current month (or a specified month).
 *
 * @param year  Full year (e.g. 2024)
 * @param month 1-indexed month (1 = January, 12 = December)
 */
export function getMonthDateRange(year: number, month: number): DateRange {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // last day of month

  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
  }
}

/**
 * Build a date range for the current calendar month based on a reference date.
 */
export function getCurrentMonthRange(today: Date = new Date()): DateRange {
  return getMonthDateRange(today.getFullYear(), today.getMonth() + 1)
}
