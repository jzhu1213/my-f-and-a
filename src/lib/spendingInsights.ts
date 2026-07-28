import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import { toMonthString, shiftMonth } from '@/lib/budgetUtils'

// ============================================================================
// Types
// ============================================================================

export interface LargestExpense {
  /** Transaction id */
  id: string
  /** Transaction amount */
  amount: number
  /** Transaction category */
  category: TransactionCategory
  /** Category emoji */
  emoji: string
  /** Transaction note (or category label as fallback) */
  label: string
  /** Transaction date */
  date: string
}

export interface CategoryBreakdownRow {
  category: TransactionCategory
  emoji: string
  label: string
  /** Total spent in this category */
  amount: number
  /** Percent of total expenses (0-100) */
  percent: number
}

export interface MonthOverMonthTrend {
  /** Current month total expenses */
  currentTotal: number
  /** Prior month total expenses */
  priorTotal: number
  /** Percent change (positive = spent more, negative = spent less) */
  percentChange: number
  /** Direction: 'up' | 'down' | 'flat' */
  direction: 'up' | 'down' | 'flat'
  /** Warm, non-judgmental summary message */
  message: string
}

export interface CategoryComparison {
  category: TransactionCategory
  emoji: string
  label: string
  /** Current month spending in this category */
  currentAmount: number
  /** Prior month spending in this category */
  priorAmount: number
  /** Percent change */
  percentChange: number
  /** Direction */
  direction: 'up' | 'down' | 'flat'
  /** Warm, human-friendly message for this category */
  message: string
}

// ============================================================================
// Pure Helpers
// ============================================================================

/**
 * Computes overall month-over-month spending trend.
 *
 * Compares total expenses in `currentMonth` vs the prior month.
 * Returns a warm, non-judgmental message.
 *
 * @param transactions - All user transactions
 * @param currentMonth - The month to analyze in YYYY-MM format (defaults to today)
 */
export function computeMonthOverMonthTrend(
  transactions: Transaction[],
  currentMonth?: string,
): MonthOverMonthTrend {
  const month = currentMonth ?? toMonthString(new Date())
  const priorMonth = shiftMonth(month, -1)

  const currentTotal = sumExpenses(transactions, month)
  const priorTotal = sumExpenses(transactions, priorMonth)

  const { percentChange, direction } = computeChange(currentTotal, priorTotal)
  const message = buildOverallMessage(percentChange, direction, currentTotal, priorTotal)

  return {
    currentTotal,
    priorTotal,
    percentChange,
    direction,
    message,
  }
}

/**
 * Computes per-category spending comparison between current and prior month.
 *
 * Only returns categories that have activity in either month.
 * Sorted by absolute percent change (biggest movers first).
 *
 * @param transactions - All user transactions
 * @param currentMonth - The month to analyze in YYYY-MM format (defaults to today)
 */
export function computeCategoryComparison(
  transactions: Transaction[],
  currentMonth?: string,
): CategoryComparison[] {
  const month = currentMonth ?? toMonthString(new Date())
  const priorMonth = shiftMonth(month, -1)

  const currentByCategory = sumExpensesByCategory(transactions, month)
  const priorByCategory = sumExpensesByCategory(transactions, priorMonth)

  // Build comparison for each known category that has activity
  const comparisons: CategoryComparison[] = []

  for (const cat of BUDGET_CATEGORIES) {
    const currentAmount = currentByCategory[cat.category] ?? 0
    const priorAmount = priorByCategory[cat.category] ?? 0

    // Skip categories with no activity in either month
    if (currentAmount === 0 && priorAmount === 0) continue

    const { percentChange, direction } = computeChange(currentAmount, priorAmount)
    const message = buildCategoryMessage(cat.label, percentChange, direction, currentAmount, priorAmount)

    comparisons.push({
      category: cat.category,
      emoji: cat.emoji,
      label: cat.label,
      currentAmount,
      priorAmount,
      percentChange,
      direction,
      message,
    })
  }

  // Sort by absolute percent change, biggest movers first
  comparisons.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))

  return comparisons
}

/**
 * Returns the top N largest individual expense transactions for a given month.
 *
 * Sorted by amount descending. Useful for surfacing "where did the money go"
 * at a glance.
 *
 * @param transactions - All user transactions
 * @param currentMonth - YYYY-MM format (defaults to today)
 * @param limit - Max results to return (default 5)
 */
export function getLargestExpenses(
  transactions: Transaction[],
  currentMonth?: string,
  limit = 5,
): LargestExpense[] {
  const month = currentMonth ?? toMonthString(new Date())

  const expenses = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)

  return expenses.map(t => {
    const catInfo = BUDGET_CATEGORIES.find(c => c.category === t.category)
    return {
      id: t.id,
      amount: t.amount,
      category: t.category,
      emoji: catInfo?.emoji ?? '💼',
      label: t.note || catInfo?.label || t.category,
      date: t.date,
    }
  })
}

/**
 * Computes category spending breakdown for a given month.
 *
 * Returns categories sorted by total spending (highest first) with percent of
 * total and dollar amount. Only includes categories with spending > 0.
 *
 * @param transactions - All user transactions
 * @param currentMonth - YYYY-MM format (defaults to today)
 */
export function getCategoryBreakdown(
  transactions: Transaction[],
  currentMonth?: string,
): CategoryBreakdownRow[] {
  const month = currentMonth ?? toMonthString(new Date())
  const byCategory = sumExpensesByCategory(transactions, month)

  const total = Object.values(byCategory).reduce((sum, v) => sum + (v ?? 0), 0)
  if (total === 0) return []

  const rows: CategoryBreakdownRow[] = []

  for (const cat of BUDGET_CATEGORIES) {
    const amount = byCategory[cat.category] ?? 0
    if (amount === 0) continue
    rows.push({
      category: cat.category,
      emoji: cat.emoji,
      label: cat.label,
      amount,
      percent: Math.round((amount / total) * 100),
    })
  }

  // Also include "income" category expenses if any slip through (edge case)
  // but generally BUDGET_CATEGORIES covers the expense categories.

  // Sort by amount descending
  rows.sort((a, b) => b.amount - a.amount)

  return rows
}

// ============================================================================
// Internal Utilities
// ============================================================================

function sumExpenses(transactions: Transaction[], monthPrefix: string): number {
  return transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(monthPrefix))
    .reduce((sum, t) => sum + t.amount, 0)
}

function sumExpensesByCategory(
  transactions: Transaction[],
  monthPrefix: string,
): Partial<Record<TransactionCategory, number>> {
  const result: Partial<Record<TransactionCategory, number>> = {}
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.date.startsWith(monthPrefix)) continue
    result[t.category] = (result[t.category] ?? 0) + t.amount
  }
  return result
}

function computeChange(
  current: number,
  prior: number,
): { percentChange: number; direction: 'up' | 'down' | 'flat' } {
  if (prior === 0 && current === 0) {
    return { percentChange: 0, direction: 'flat' }
  }
  if (prior === 0) {
    // New spending this month where there was none before
    return { percentChange: 100, direction: 'up' }
  }

  const percentChange = Math.round(((current - prior) / prior) * 100)

  // Treat ±3% as flat to avoid noisy messages
  if (Math.abs(percentChange) <= 3) {
    return { percentChange: 0, direction: 'flat' }
  }

  return {
    percentChange,
    direction: percentChange > 0 ? 'up' : 'down',
  }
}

// ============================================================================
// Warm, Non-Judgmental Copy Builders
// ============================================================================

function buildOverallMessage(
  percentChange: number,
  direction: 'up' | 'down' | 'flat',
  _current: number,
  _prior: number,
): string {
  if (direction === 'flat') {
    return 'Spending is about the same as last month — steady as you go.'
  }

  const absChange = Math.abs(percentChange)

  if (direction === 'down') {
    if (absChange >= 30) return `You've spent ${absChange}% less than last month — nice work!`
    if (absChange >= 10) return `A bit less this month — down ${absChange}% from last month.`
    return 'Spending is slightly lower this month. Keep it up!'
  }

  // direction === 'up'
  if (absChange >= 50) return `Spending is up ${absChange}% this month. No stress — just good to know.`
  if (absChange >= 20) return `A bit more this month — up ${absChange}% from last month.`
  return `Spending crept up a little (${absChange}%). Nothing major.`
}

function buildCategoryMessage(
  label: string,
  percentChange: number,
  direction: 'up' | 'down' | 'flat',
  current: number,
  prior: number,
): string {
  if (direction === 'flat') {
    return `${label} is about the same as last month.`
  }

  const absChange = Math.abs(percentChange)

  if (direction === 'down') {
    if (prior > 0 && current === 0) return `No ${label.toLowerCase()} spending this month yet.`
    return `${label} is down ${absChange}% — nice.`
  }

  // direction === 'up'
  if (prior === 0) return `New spending on ${label.toLowerCase()} this month ($${Math.round(current)}).`
  if (absChange >= 40) return `A bit more on ${label.toLowerCase()} this month (+${absChange}%).`
  return `${label} is up a little (+${absChange}%).`
}
