import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import { toMonthString, shiftMonth } from '@/lib/budgetUtils'

// ============================================================================
// Types
// ============================================================================

/** Tone classification for advanced spending insights. */
export type InsightTone = 'positive' | 'neutral' | 'cautionary'

/** An advanced spending pattern insight detected from transaction data. */
export interface SpendingInsight {
  id: string
  type: 'day_of_week' | 'under_budget_streak' | 'category_trend' | 'spending_velocity' | 'merchant_frequency'
  title: string
  message: string
  emoji: string
  tone: InsightTone
  /** Priority for cadence selection (1 = highest priority) */
  priority: number
  /** ISO date string when this insight was detected */
  detectedAt: string
}

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


// ============================================================================
// Advanced Pattern Detection (Task 357.1)
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Detects if one day of the week consistently has higher spending.
 *
 * Analyzes the last 4 weeks of expenses, computes average spend per day-of-week,
 * and flags if one day stands out (>30% above the overall daily average).
 *
 * @param transactions - All user transactions
 * @param currentDate - Reference date (defaults to now)
 */
export function detectDayOfWeekPattern(
  transactions: Transaction[],
  currentDate: Date = new Date(),
): SpendingInsight | null {
  // Look back 28 days (4 weeks)
  const lookbackMs = 28 * 24 * 60 * 60 * 1000
  const cutoff = new Date(currentDate.getTime() - lookbackMs)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const todayStr = currentDate.toISOString().slice(0, 10)

  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && t.date >= cutoffStr && t.date <= todayStr
  )

  if (recentExpenses.length < 7) return null // Not enough data

  // Sum spending per day-of-week
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0]
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0]

  for (const t of recentExpenses) {
    const [y, m, d] = t.date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    dayTotals[dow] += t.amount
    dayCounts[dow]++
  }

  // Calculate average spend per day-of-week (weighted by occurrences of that day in range)
  // Count how many of each weekday appeared in the 28-day window
  const dayOccurrences: number[] = [0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < 28; i++) {
    const d = new Date(cutoff.getTime() + i * 24 * 60 * 60 * 1000)
    dayOccurrences[d.getDay()]++
  }

  const dayAverages = dayTotals.map((total, i) =>
    dayOccurrences[i] > 0 ? total / dayOccurrences[i] : 0
  )

  const overallAvg = dayAverages.reduce((a, b) => a + b, 0) / 7

  if (overallAvg === 0) return null

  // Find the highest-spending day
  let maxDay = 0
  let maxAvg = 0
  for (let i = 0; i < 7; i++) {
    if (dayAverages[i] > maxAvg) {
      maxAvg = dayAverages[i]
      maxDay = i
    }
  }

  // Only surface if >30% above average
  const ratio = (maxAvg - overallAvg) / overallAvg
  if (ratio < 0.3) return null

  const dayName = DAY_NAMES[maxDay]
  const dayNamePlural = dayName + 's'

  return {
    id: `dow-${dayName.toLowerCase()}-${todayStr}`,
    type: 'day_of_week',
    title: `${dayNamePlural} are your big-spend day`,
    message: `You tend to spend about ${Math.round(ratio * 100)}% more on ${dayNamePlural}. Nothing wrong with that — just good to know.`,
    emoji: '📅',
    tone: 'neutral',
    priority: 3,
    detectedAt: currentDate.toISOString(),
  }
}

/**
 * Detects consecutive days where the user stayed at or under their daily budget.
 *
 * Works backward from the current date counting days where total daily expenses
 * didn't exceed the daily budget.
 *
 * @param transactions - All user transactions
 * @param dailyBudget - The user's daily allowance/budget amount
 * @param currentDate - Reference date (defaults to now)
 */
export function detectUnderBudgetStreak(
  transactions: Transaction[],
  dailyBudget: number,
  currentDate: Date = new Date(),
): SpendingInsight | null {
  if (dailyBudget <= 0) return null

  const todayStr = currentDate.toISOString().slice(0, 10)

  // Build a map of date → total expense amount
  const dailySpend: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    dailySpend[t.date] = (dailySpend[t.date] ?? 0) + t.amount
  }

  // Count streak backward from yesterday (today is still in progress)
  let streak = 0
  for (let i = 1; i <= 90; i++) { // Look back up to 90 days
    const d = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const spent = dailySpend[dateStr] ?? 0
    if (spent <= dailyBudget) {
      streak++
    } else {
      break
    }
  }

  // Only surface if streak is noteworthy (3+ days)
  if (streak < 3) return null

  const messages: Record<string, string> = {
    short: `Under budget ${streak} days running — nice rhythm.`,
    medium: `${streak} days under budget in a row! That takes consistency.`,
    long: `${streak}-day streak under budget. You're in a great flow.`,
  }

  const msgKey = streak >= 14 ? 'long' : streak >= 7 ? 'medium' : 'short'

  return {
    id: `streak-${streak}-${todayStr}`,
    type: 'under_budget_streak',
    title: `Under budget ${streak} days running`,
    message: messages[msgKey],
    emoji: '🔥',
    tone: 'positive',
    priority: 1, // Positive streaks are high-priority
    detectedAt: currentDate.toISOString(),
  }
}

/**
 * Detects notable category spending trends (current month vs prior month).
 *
 * Returns insights for categories with >15% change. Leverages existing
 * computeChange logic but reframes for insight delivery.
 *
 * @param transactions - All user transactions
 * @param currentDate - Reference date (defaults to now)
 */
export function detectCategoryTrends(
  transactions: Transaction[],
  currentDate: Date = new Date(),
): SpendingInsight[] {
  const month = toMonthString(currentDate)
  const priorMonth = shiftMonth(month, -1)
  const todayStr = currentDate.toISOString().slice(0, 10)

  const currentByCategory = sumExpensesByCategory(transactions, month)
  const priorByCategory = sumExpensesByCategory(transactions, priorMonth)

  const insights: SpendingInsight[] = []

  for (const cat of BUDGET_CATEGORIES) {
    const currentAmount = currentByCategory[cat.category] ?? 0
    const priorAmount = priorByCategory[cat.category] ?? 0

    // Skip categories with little activity
    if (currentAmount === 0 && priorAmount === 0) continue
    if (priorAmount < 5 && currentAmount < 5) continue // Ignore trivially small amounts

    const { percentChange, direction } = computeChange(currentAmount, priorAmount)
    const absChange = Math.abs(percentChange)

    // Only surface if >15% change
    if (absChange <= 15) continue

    if (direction === 'down') {
      insights.push({
        id: `cat-trend-${cat.category}-down-${todayStr}`,
        type: 'category_trend',
        title: `${cat.label} spending down ${absChange}%`,
        message: `${cat.label} spending is down ${absChange}% vs. last month — nice.`,
        emoji: cat.emoji,
        tone: 'positive',
        priority: 2,
        detectedAt: currentDate.toISOString(),
      })
    } else if (direction === 'up') {
      insights.push({
        id: `cat-trend-${cat.category}-up-${todayStr}`,
        type: 'category_trend',
        title: `${cat.label} is up ${absChange}% this month`,
        message: `A bit more on ${cat.label.toLowerCase()} this month (+${absChange}%). No stress — just a heads-up.`,
        emoji: cat.emoji,
        tone: absChange >= 40 ? 'cautionary' : 'neutral',
        priority: absChange >= 40 ? 4 : 3,
        detectedAt: currentDate.toISOString(),
      })
    }
  }

  // Sort by priority (lower = higher priority)
  insights.sort((a, b) => a.priority - b.priority)
  return insights
}

/**
 * Detects shifts in spending velocity (this week vs last week).
 *
 * Compares daily spend rate between the current 7-day window and the prior
 * 7-day window. Surfaces if there's a >20% shift.
 *
 * @param transactions - All user transactions
 * @param currentDate - Reference date (defaults to now)
 */
export function detectSpendingVelocity(
  transactions: Transaction[],
  currentDate: Date = new Date(),
): SpendingInsight | null {
  const todayStr = currentDate.toISOString().slice(0, 10)

  // This week: last 7 days including today
  const thisWeekStart = new Date(currentDate.getTime() - 6 * 24 * 60 * 60 * 1000)
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10)

  // Last week: 7 days before this week
  const lastWeekStart = new Date(currentDate.getTime() - 13 * 24 * 60 * 60 * 1000)
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10)
  const lastWeekEndStr = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let thisWeekTotal = 0
  let lastWeekTotal = 0

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.date >= thisWeekStartStr && t.date <= todayStr) {
      thisWeekTotal += t.amount
    } else if (t.date >= lastWeekStartStr && t.date <= lastWeekEndStr) {
      lastWeekTotal += t.amount
    }
  }

  // Need both weeks to have some activity
  if (lastWeekTotal < 5) return null

  const thisWeekDaily = thisWeekTotal / 7
  const lastWeekDaily = lastWeekTotal / 7
  const changePct = ((thisWeekDaily - lastWeekDaily) / lastWeekDaily) * 100

  // Only surface if >20% shift
  if (Math.abs(changePct) < 20) return null

  if (changePct < 0) {
    const absPct = Math.round(Math.abs(changePct))
    return {
      id: `velocity-slowed-${todayStr}`,
      type: 'spending_velocity',
      title: "You've slowed down this week",
      message: `Spending pace is down ~${absPct}% compared to last week — nice rhythm.`,
      emoji: '🐢',
      tone: 'positive',
      priority: 2,
      detectedAt: currentDate.toISOString(),
    }
  } else {
    const absPct = Math.round(changePct)
    return {
      id: `velocity-accelerated-${todayStr}`,
      type: 'spending_velocity',
      title: 'Spending picked up this week',
      message: `Pace is up ~${absPct}% vs. last week. No judgment — just keeping you in the loop.`,
      emoji: '⚡',
      tone: absPct >= 50 ? 'cautionary' : 'neutral',
      priority: absPct >= 50 ? 4 : 3,
      detectedAt: currentDate.toISOString(),
    }
  }
}

/**
 * Detects merchants (by transaction note) the user visits frequently this month.
 *
 * Groups current month's expenses by note (as proxy for merchant name),
 * identifies merchants with 5+ visits, and surfaces a friendly awareness message.
 *
 * @param transactions - All user transactions
 * @param currentDate - Reference date (defaults to now)
 */
export function detectMerchantFrequency(
  transactions: Transaction[],
  currentDate: Date = new Date(),
): SpendingInsight | null {
  const month = toMonthString(currentDate)
  const todayStr = currentDate.toISOString().slice(0, 10)

  // Group this month's expenses by note
  const merchantCounts: Record<string, number> = {}
  const monthExpenses = transactions.filter(
    t => t.type === 'expense' && t.date.startsWith(month) && t.note && t.note.trim().length > 0
  )

  for (const t of monthExpenses) {
    const key = t.note!.trim().toLowerCase()
    merchantCounts[key] = (merchantCounts[key] ?? 0) + 1
  }

  // Find the most frequent merchant with 5+ visits
  let topMerchant = ''
  let topCount = 0
  for (const [merchant, count] of Object.entries(merchantCounts)) {
    if (count > topCount) {
      topCount = count
      topMerchant = merchant
    }
  }

  if (topCount < 5) return null

  // Capitalize the merchant name for display
  const displayName = topMerchant
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  // Use ordinal-style: "8th", "5th", etc.
  const ordinal = getOrdinal(topCount)

  return {
    id: `merchant-${topMerchant.replace(/\s+/g, '-')}-${todayStr}`,
    type: 'merchant_frequency',
    title: `Your ${ordinal} ${displayName} this month`,
    message: `This is your ${ordinal} ${displayName} trip this month. You do you — just thought you'd want to know.`,
    emoji: '🏪',
    tone: 'neutral',
    priority: 3,
    detectedAt: currentDate.toISOString(),
  }
}

/**
 * Gathers all detectable advanced insights from the user's transaction data.
 *
 * Convenience function that runs all pattern detectors and returns a flat list
 * of discovered insights, sorted by priority.
 *
 * @param transactions - All user transactions
 * @param dailyBudget - User's daily budget (for streak detection)
 * @param currentDate - Reference date (defaults to now)
 */
export function detectAllPatterns(
  transactions: Transaction[],
  dailyBudget: number,
  currentDate: Date = new Date(),
): SpendingInsight[] {
  const insights: SpendingInsight[] = []

  const dow = detectDayOfWeekPattern(transactions, currentDate)
  if (dow) insights.push(dow)

  const streak = detectUnderBudgetStreak(transactions, dailyBudget, currentDate)
  if (streak) insights.push(streak)

  const categoryTrends = detectCategoryTrends(transactions, currentDate)
  insights.push(...categoryTrends)

  const velocity = detectSpendingVelocity(transactions, currentDate)
  if (velocity) insights.push(velocity)

  const merchant = detectMerchantFrequency(transactions, currentDate)
  if (merchant) insights.push(merchant)

  // Sort by priority (lower number = higher priority)
  insights.sort((a, b) => a.priority - b.priority)

  return insights
}

// ============================================================================
// Internal Helpers (Advanced Patterns)
// ============================================================================

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
