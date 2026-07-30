/**
 * trajectoryUtils.ts
 *
 * Computes a user's "financial trajectory" — directional trends in spending,
 * savings, and debt paydown — without revealing raw net-worth numbers.
 *
 * The goal is warm, encouraging framing: "Are things getting better?" not
 * "What's your net worth?"
 *
 * All outputs are percentages, ratios, or directional indicators so the UI
 * can present progress without ever showing a raw dollar figure that might
 * feel discouraging to a college student.
 */

import type { Transaction } from "@/types"
import type { Goal } from "@/types"
import type { Debt } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

/** Overall direction of the user's financial health. */
export type TrajectoryDirection = "improving" | "steady" | "declining"

/** A single insight about a trend — rendered as a card in the UI. */
export interface TrajectoryInsight {
  id: string
  emoji: string
  headline: string
  detail: string
  direction: TrajectoryDirection
}

/** Full trajectory analysis result. */
export interface TrajectoryResult {
  /** Overall direction based on all signals. */
  overall: TrajectoryDirection
  /** Human-friendly headline for the hero area. */
  headline: string
  /** Individual insight cards (3-4 max). */
  insights: TrajectoryInsight[]
}

// ============================================================================
// Helpers
// ============================================================================

function getMonthKey(date: string): string {
  return date.slice(0, 7) // "YYYY-MM"
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function getPreviousMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  const prev = new Date(year, month - 2, 1) // month is 0-indexed, -2 for prev
  return prev.toISOString().slice(0, 7)
}

/**
 * Determines direction from a percentage change.
 * Positive = improving, near zero = steady, negative = declining.
 */
function directionFromChange(change: number, threshold = 3): TrajectoryDirection {
  if (change > threshold) return "improving"
  if (change < -threshold) return "declining"
  return "steady"
}

// ============================================================================
// Core computation
// ============================================================================

export interface TrajectoryInput {
  transactions: Transaction[]
  goals?: Goal[]
  debts?: Debt[]
  savingsRate?: number
  previousSavingsRate?: number
}

/**
 * Compute the user's financial trajectory from available data.
 *
 * Returns an overall direction + 3-4 insight cards with friendly copy.
 * Never exposes raw dollar amounts — only percentages and directions.
 */
export function computeTrajectory(input: TrajectoryInput): TrajectoryResult {
  const { transactions, goals, debts, savingsRate } = input
  const insights: TrajectoryInsight[] = []

  const currentMonth = getCurrentMonth()
  const prevMonth = getPreviousMonth(currentMonth)

  // ── Spending trend (this month vs last month) ──────────────────
  const currentExpenses = transactions.filter(
    (t) => t.type === "expense" && getMonthKey(t.date) === currentMonth
  )
  const prevExpenses = transactions.filter(
    (t) => t.type === "expense" && getMonthKey(t.date) === prevMonth
  )

  const currentSpend = currentExpenses.reduce((s, t) => s + t.amount, 0)
  const prevSpend = prevExpenses.reduce((s, t) => s + t.amount, 0)

  // Prorate current month spending to a full-month estimate
  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate()
  const projectedSpend =
    dayOfMonth > 0 ? (currentSpend / dayOfMonth) * daysInMonth : 0

  if (prevSpend > 0) {
    const spendChange = ((prevSpend - projectedSpend) / prevSpend) * 100
    const spendDir = directionFromChange(spendChange)
    const absChange = Math.abs(Math.round(spendChange))

    if (spendDir === "improving") {
      insights.push({
        id: "spending-trend",
        emoji: "📉",
        headline: `Spending about ${absChange}% less this month`,
        detail: "You're on track to spend less than last month — nice momentum.",
        direction: "improving",
      })
    } else if (spendDir === "declining") {
      insights.push({
        id: "spending-trend",
        emoji: "📊",
        headline: `Spending trending ${absChange}% higher`,
        detail:
          "A little higher than last month — could be a one-time thing. Keep an eye on it.",
        direction: "declining",
      })
    } else {
      insights.push({
        id: "spending-trend",
        emoji: "➡️",
        headline: "Spending holding steady",
        detail: "Pretty consistent with last month — you've got a stable rhythm.",
        direction: "steady",
      })
    }
  }

  // ── Category-level insight (biggest improvement) ───────────────
  if (prevExpenses.length > 0 && currentExpenses.length > 0) {
    const categorySpend = (
      txs: Transaction[]
    ): Record<string, number> => {
      const map: Record<string, number> = {}
      for (const t of txs) {
        map[t.category] = (map[t.category] ?? 0) + t.amount
      }
      return map
    }

    const prevByCategory = categorySpend(prevExpenses)
    const currByCategory = categorySpend(currentExpenses)

    let bestCategory = ""
    let bestReduction = 0

    for (const [cat, prevAmt] of Object.entries(prevByCategory)) {
      if (prevAmt < 10) continue // skip trivial categories
      const currAmt = currByCategory[cat] ?? 0
      // Prorate current
      const projectedCat =
        dayOfMonth > 0 ? (currAmt / dayOfMonth) * daysInMonth : 0
      const reduction = ((prevAmt - projectedCat) / prevAmt) * 100
      if (reduction > bestReduction) {
        bestReduction = reduction
        bestCategory = cat
      }
    }

    if (bestCategory && bestReduction > 10) {
      const categoryLabel =
        bestCategory.charAt(0).toUpperCase() + bestCategory.slice(1)
      insights.push({
        id: "category-win",
        emoji: "🏆",
        headline: `${categoryLabel} spending down ${Math.round(bestReduction)}%`,
        detail: `You're spending less on ${bestCategory} compared to last month.`,
        direction: "improving",
      })
    }
  }

  // ── Savings rate trend ─────────────────────────────────────────
  if (savingsRate !== undefined && savingsRate > 0) {
    insights.push({
      id: "savings-rate",
      emoji: "💪",
      headline: `Savings rate: ${savingsRate}%`,
      detail:
        savingsRate >= 15
          ? "That's a strong savings habit — keep it up."
          : savingsRate >= 8
            ? "Building a savings habit — every percent counts."
            : "Even a small savings rate adds up over time.",
      direction: savingsRate >= 10 ? "improving" : "steady",
    })
  }

  // ── Goal progress velocity ─────────────────────────────────────
  if (goals && goals.length > 0) {
    const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount)
    const completedGoals = goals.filter(
      (g) => g.currentAmount >= g.targetAmount
    )

    if (completedGoals.length > 0) {
      insights.push({
        id: "goal-progress",
        emoji: "🎯",
        headline: `${completedGoals.length} goal${completedGoals.length > 1 ? "s" : ""} completed`,
        detail: "You've hit targets you set for yourself — that's real progress.",
        direction: "improving",
      })
    } else if (activeGoals.length > 0) {
      // Show average progress percentage
      const avgProgress = Math.round(
        activeGoals.reduce(
          (sum, g) =>
            sum + (g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0),
          0
        ) / activeGoals.length
      )
      insights.push({
        id: "goal-progress",
        emoji: "🎯",
        headline: `Goals are ${avgProgress}% of the way there`,
        detail: `${activeGoals.length} active goal${activeGoals.length > 1 ? "s" : ""} — steady progress builds momentum.`,
        direction: avgProgress > 30 ? "improving" : "steady",
      })
    }
  }

  // ── Debt paydown progress ──────────────────────────────────────
  if (debts && debts.length > 0) {
    const totalDebt = debts.reduce((s, d) => s + (d.balance ?? 0), 0)
    if (totalDebt > 0) {
      insights.push({
        id: "debt-progress",
        emoji: "📤",
        headline: `Tracking ${debts.length} debt${debts.length > 1 ? "s" : ""}`,
        detail: "Having visibility is the first step — you're on top of it.",
        direction: "steady",
      })
    }
  }

  // ── Compute overall direction ──────────────────────────────────
  // Weight the insights: count improving vs declining signals
  const improvingCount = insights.filter(
    (i) => i.direction === "improving"
  ).length
  const decliningCount = insights.filter(
    (i) => i.direction === "declining"
  ).length

  let overall: TrajectoryDirection = "steady"
  if (improvingCount > decliningCount) overall = "improving"
  else if (decliningCount > improvingCount) overall = "declining"

  // ── Overall headline ───────────────────────────────────────────
  const headlines: Record<TrajectoryDirection, string> = {
    improving: "You're trending in the right direction",
    steady: "Holding steady — consistency is a strength",
    declining: "A few things to keep an eye on",
  }

  // Limit to 4 insights max (trim lowest-priority ones)
  const trimmedInsights = insights.slice(0, 4)

  return {
    overall,
    headline: headlines[overall],
    insights: trimmedInsights,
  }
}
