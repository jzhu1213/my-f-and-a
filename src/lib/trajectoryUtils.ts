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
import type { Debt, SavingsAccount } from "@/types/folio"
import type { SinkingFund } from "@/lib/sinkingFunds"
import { computeTotalSavingsBalance, computeMonthlyContributions } from "@/lib/savingsAccountUtils"
import { computeGigTaxTrajectory, computeQuarterlyTaxEstimates } from "@/lib/taxSetAside"

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
  savingsAccounts?: SavingsAccount[]
  totalSetAside?: number
  sinkingFunds?: SinkingFund[]
  /**
   * Optional override for the gig tax rate (0–1 scale) used when surfacing the
   * gig tax set-aside insight. Defaults to the standard gig rate (25%).
   */
  gigTaxRate?: number
}

/**
 * Sum of gig/1099 income logged in the given month. Gig income is persisted
 * with the `gig` category (see the income logging flow), which lets the
 * trajectory view surface a tax set-aside insight without any extra plumbing.
 */
function sumGigIncomeForMonth(
  transactions: Transaction[],
  monthKey: string
): number {
  return transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.category === "gig" &&
        getMonthKey(t.date) === monthKey
    )
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Compute the user's financial trajectory from available data.
 *
 * Returns an overall direction + 3-4 insight cards with friendly copy.
 * Never exposes raw dollar amounts — only percentages and directions.
 */
export function computeTrajectory(input: TrajectoryInput): TrajectoryResult {
  const { transactions, goals, debts, savingsRate, savingsAccounts, totalSetAside, sinkingFunds, gigTaxRate } = input
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

  // ── Savings growth insight ─────────────────────────────────────
  if (savingsAccounts && savingsAccounts.length > 0) {
    const totalBalance = computeTotalSavingsBalance(savingsAccounts)
    const monthlyContrib = computeMonthlyContributions(savingsAccounts)

    if (totalBalance > 0 || monthlyContrib > 0) {
      const direction: TrajectoryDirection = monthlyContrib > 0 ? "improving" : "steady"
      insights.push({
        id: "savings-growth",
        emoji: "🌱",
        headline: monthlyContrib > 0
          ? `Saving across ${savingsAccounts.length} account${savingsAccounts.length > 1 ? "s" : ""}`
          : `${savingsAccounts.length} savings account${savingsAccounts.length > 1 ? "s" : ""} tracked`,
        detail: monthlyContrib > 0
          ? "Regular contributions are building momentum — keep it growing."
          : "You've got savings working for you — even holding steady is a win.",
        direction,
      })
    }
  }

  // ── Sinking fund set-aside progress ────────────────────────────
  if (sinkingFunds && sinkingFunds.length > 0) {
    const totalTarget = sinkingFunds.reduce((s, f) => s + f.targetAmount, 0)
    const totalSaved = sinkingFunds.reduce((s, f) => s + f.savedAmount, 0)
    const fundedCount = sinkingFunds.filter(f => f.savedAmount >= f.targetAmount).length

    if (totalTarget > 0) {
      const coverage = Math.round((totalSaved / totalTarget) * 100)
      const direction: TrajectoryDirection =
        fundedCount > 0 || coverage > 50 ? "improving" : "steady"

      insights.push({
        id: "setaside-progress",
        emoji: "🎒",
        headline: fundedCount > 0
          ? `${fundedCount} set-aside${fundedCount > 1 ? "s" : ""} fully funded`
          : `Set-asides ${coverage}% covered`,
        detail: fundedCount > 0
          ? "You've pre-funded upcoming costs — future-you will thank you."
          : "Setting money aside for big costs keeps surprises manageable.",
        direction,
      })
    }
  }

  // ── Gig tax set-aside (surface task 54 in the trajectory) ──────
  {
    const gigIncome = sumGigIncomeForMonth(transactions, currentMonth)
    const gigTax = computeGigTaxTrajectory(
      gigIncome,
      totalSetAside ?? 0,
      gigTaxRate
    )

    if (gigTax) {
      insights.push({
        id: "gig-tax",
        emoji: gigTax.covered ? "🧾" : "💡",
        headline: gigTax.headline,
        detail: gigTax.detail,
        // Covered → improving; otherwise a gentle steady nudge (never shaming).
        direction: gigTax.covered ? "improving" : "steady",
      })
    }
  }

  // ── Quarterly tax deadline (Task 177.1) ────────────────────────
  // Surface a gentle reminder when a quarterly estimated tax deadline is
  // approaching (within 30 days). Never shaming, never professional advice.
  {
    const today = new Date()
    const referenceDate = today.toISOString().slice(0, 10)
    const taxYear = today.getFullYear()

    // Sum gig income per month for the tax year so far
    const monthlyIncome: number[] = []
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${taxYear}-${String(m).padStart(2, "0")}`
      monthlyIncome.push(sumGigIncomeForMonth(transactions, monthKey))
    }

    const hasAnyGigIncome = monthlyIncome.some((v) => v > 0)

    if (hasAnyGigIncome) {
      const estimates = computeQuarterlyTaxEstimates({
        taxYear,
        monthlyIncome,
        totalReserved: totalSetAside ?? 0,
        referenceDate,
        taxRate: gigTaxRate,
      })

      if (estimates.nextDeadline && estimates.nextDeadline.daysUntil <= 30) {
        const { quarter, daysUntil } = estimates.nextDeadline
        const qEstimate = estimates.quarters.find((q) => q.quarter === quarter)

        const alreadyCovered = qEstimate?.covered ?? false
        const daysLabel =
          daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`

        const headline = alreadyCovered
          ? `${quarter} estimate deadline ${daysLabel} — you're set`
          : `${quarter} estimate deadline ${daysLabel}`

        const detail = alreadyCovered
          ? `Your quarterly set-aside looks covered. One less thing to think about.`
          : qEstimate && qEstimate.suggestedReserve > 0
            ? `Consider setting aside ~$${Math.round(qEstimate.suggestedReserve).toLocaleString()} before the deadline. ${estimates.disclaimer}`
            : `A quarterly estimated tax date is coming up. ${estimates.disclaimer}`

        insights.push({
          id: "quarterly-tax-deadline",
          emoji: alreadyCovered ? "✅" : "📅",
          headline,
          detail,
          direction: alreadyCovered ? "improving" : "steady",
        })
      }
    }
  }

  // ── Financial cushion (combined directional indicator) ──────────
  {
    const hasSavings = savingsAccounts && savingsAccounts.length > 0 && computeTotalSavingsBalance(savingsAccounts) > 0
    const hasSetAside = (totalSetAside ?? 0) > 0
    const hasLowDebt = !debts || debts.length === 0 || debts.reduce((s, d) => s + (d.balance ?? 0), 0) === 0

    // Only show the cushion insight if there's meaningful data
    const cushionSignals = [hasSavings, hasSetAside, hasLowDebt].filter(Boolean).length

    if (cushionSignals >= 2) {
      insights.push({
        id: "financial-cushion",
        emoji: "🛡️",
        headline: "Building a solid cushion",
        detail: "Savings, set-asides, and manageable debt — you're creating breathing room.",
        direction: "improving",
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

  // Limit to 6 insights max (trim lowest-priority ones), but always keep the
  // gig tax set-aside insight and quarterly deadline when present so they surface
  // clearly (tasks 154.1 & 177.1).
  const MAX_INSIGHTS = 6
  let trimmedInsights = insights.slice(0, MAX_INSIGHTS)
  const gigTaxInsight = insights.find((i) => i.id === "gig-tax")
  if (gigTaxInsight && !trimmedInsights.some((i) => i.id === "gig-tax")) {
    trimmedInsights = [...trimmedInsights.slice(0, MAX_INSIGHTS - 1), gigTaxInsight]
  }
  const deadlineInsight = insights.find((i) => i.id === "quarterly-tax-deadline")
  if (deadlineInsight && !trimmedInsights.some((i) => i.id === "quarterly-tax-deadline")) {
    trimmedInsights = [...trimmedInsights.slice(0, MAX_INSIGHTS - 1), deadlineInsight]
  }

  return {
    overall,
    headline: headlines[overall],
    insights: trimmedInsights,
  }
}
