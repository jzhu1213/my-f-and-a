import type { Transaction } from "@/types"
import { toMonthString, shiftMonth } from "@/lib/budgetUtils"
import {
  detectUnderBudgetStreak,
  detectCategoryTrends,
  detectSpendingVelocity,
  detectMerchantFrequency,
  computeMonthOverMonthTrend,
} from "@/lib/spendingInsights"

// ============================================================================
// Types
// ============================================================================

export interface MonthlyDigestHighlight {
  /** Emoji for visual flair */
  emoji: string
  /** The highlight text (warm, brief) */
  text: string
  /** Is this a win, a trend observation, or an actionable tip? */
  type: "win" | "trend" | "tip"
}

export interface MonthlyDigest {
  /** Display title, e.g. "Your month in review ✨" */
  title: string
  /** The month this digest covers (YYYY-MM) */
  month: string
  /** 3–5 highlights, ordered: wins first, trends second, tip last */
  highlights: MonthlyDigestHighlight[]
  /** Single actionable suggestion */
  actionableTip: string
}

// ============================================================================
// Constants
// ============================================================================

const DIGEST_DISMISS_PREFIX = "folio-monthly-digest-dismissed-"

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks if the current date is within the last 3 days of the budget period
 * (assumed to be a calendar month).
 *
 * @param currentDate - Reference date (defaults to now)
 * @returns true if the budget period is ending soon (last 3 days of the month)
 */
export function isEndOfBudgetPeriod(currentDate: Date = new Date()): boolean {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const currentDay = currentDate.getDate()
  return currentDay >= lastDayOfMonth - 2
}

/**
 * Checks whether the monthly digest has been dismissed for the given month.
 */
export function isDigestDismissed(month: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DIGEST_DISMISS_PREFIX + month) === "1"
  } catch {
    return false
  }
}

/**
 * Persists the digest dismissal so it only shows once per period.
 */
export function dismissDigest(month: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DIGEST_DISMISS_PREFIX + month, "1")
  } catch {
    // best-effort
  }
}

// ============================================================================
// Digest Compilation
// ============================================================================

/**
 * Compiles the monthly digest from transaction data.
 *
 * Gathers wins (streaks, under-budget days), trends (category changes,
 * velocity), and generates one actionable suggestion. Returns 3–5 highlights.
 *
 * @param transactions - All user transactions
 * @param dailyBudget - User's daily budget amount
 * @param currentDate - Reference date (defaults to now)
 * @returns MonthlyDigest if enough data exists, or null
 */
export function compileMonthlyDigest(
  transactions: Transaction[],
  dailyBudget: number,
  currentDate: Date = new Date(),
): MonthlyDigest | null {
  const month = toMonthString(currentDate)

  // Need some transactions in the current month
  const monthExpenses = transactions.filter(
    (t) => t.type === "expense" && t.date.startsWith(month),
  )
  if (monthExpenses.length < 5) return null

  const highlights: MonthlyDigestHighlight[] = []

  // ── Wins ────────────────────────────────────────────────────────────────

  // 1. Under-budget streak
  const streak = detectUnderBudgetStreak(transactions, dailyBudget, currentDate)
  if (streak) {
    const match = streak.title.match(/(\d+)/)
    const days = match ? match[1] : "several"
    highlights.push({
      emoji: "🔥",
      text: `You stayed under budget ${days} days in a row this month`,
      type: "win",
    })
  }

  // 2. Overall spending trend (positive = win)
  const overallTrend = computeMonthOverMonthTrend(transactions, month)
  if (overallTrend.direction === "down" && overallTrend.priorTotal > 0) {
    const pct = Math.abs(overallTrend.percentChange)
    highlights.push({
      emoji: "📉",
      text: `Spent ${pct}% less than last month — great rhythm`,
      type: "win",
    })
  }

  // 3. Count under-budget days
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  ).getDate()
  const dailySpend: Record<string, number> = {}
  for (const t of monthExpenses) {
    dailySpend[t.date] = (dailySpend[t.date] ?? 0) + t.amount
  }
  let underBudgetDays = 0
  for (let i = 1; i <= currentDate.getDate(); i++) {
    const dateStr = `${month}-${String(i).padStart(2, "0")}`
    const spent = dailySpend[dateStr] ?? 0
    if (spent <= dailyBudget) underBudgetDays++
  }
  if (underBudgetDays >= 5 && !streak) {
    highlights.push({
      emoji: "✅",
      text: `${underBudgetDays} days under your daily budget this month`,
      type: "win",
    })
  }

  // ── Trends ──────────────────────────────────────────────────────────────

  // 4. Category trend (top positive one)
  const categoryTrends = detectCategoryTrends(transactions, currentDate)
  const positiveTrend = categoryTrends.find((t) => t.tone === "positive")
  if (positiveTrend) {
    highlights.push({
      emoji: positiveTrend.emoji,
      text: positiveTrend.message,
      type: "trend",
    })
  }

  // 5. Spending velocity (if notable)
  const velocity = detectSpendingVelocity(transactions, currentDate)
  if (velocity && velocity.tone === "positive") {
    highlights.push({
      emoji: velocity.emoji,
      text: "Your spending pace slowed down recently — nice and steady",
      type: "trend",
    })
  }

  // If we still have fewer than 3, add overall trend as a trend item
  if (highlights.length < 3 && overallTrend.direction === "up" && overallTrend.priorTotal > 0) {
    const pct = Math.abs(overallTrend.percentChange)
    highlights.push({
      emoji: "📊",
      text: `Spending was up ${pct}% this month — no stress, just context`,
      type: "trend",
    })
  }

  // ── Actionable Tip ──────────────────────────────────────────────────────

  const actionableTip = generateActionableTip(
    transactions,
    dailyBudget,
    currentDate,
    overallTrend.direction,
  )

  // Ensure we have at least 3 highlights
  if (highlights.length < 3) {
    // Add total spending as filler
    const totalSpent = monthExpenses.reduce((sum, t) => sum + t.amount, 0)
    highlights.push({
      emoji: "💰",
      text: `Total spending this month: $${Math.round(totalSpent).toLocaleString("en-US")}`,
      type: "trend",
    })
  }

  // Sort: wins first, trends second, tips last — and cap at 5
  highlights.sort((a, b) => {
    const order = { win: 0, trend: 1, tip: 2 }
    return order[a.type] - order[b.type]
  })
  const finalHighlights = highlights.slice(0, 5)

  return {
    title: "Your month in review ✨",
    month,
    highlights: finalHighlights,
    actionableTip,
  }
}

// ============================================================================
// Internal
// ============================================================================

function generateActionableTip(
  transactions: Transaction[],
  dailyBudget: number,
  currentDate: Date,
  overallDirection: "up" | "down" | "flat",
): string {
  // Look at merchant frequency for a concrete tip
  const merchant = detectMerchantFrequency(transactions, currentDate)
  if (merchant) {
    return "Consider batching frequent small purchases — you might find it easier on your daily budget."
  }

  if (overallDirection === "up") {
    return "Try one no-spend day next week — a small reset can feel surprisingly refreshing."
  }

  if (overallDirection === "down") {
    return "You're in a good rhythm — consider moving some surplus toward a savings goal."
  }

  return "Start next month by setting one small spending intention — even just for day one."
}
