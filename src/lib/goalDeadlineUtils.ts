/**
 * Goal Deadline Utilities — pure helpers for computing required contributions
 * and feasibility when a savings goal has an optional target date.
 *
 * All functions are pure (no side effects) and produce warm, encouraging
 * messages appropriate for college students.
 */

export interface DeadlineFeasibility {
  /** Whether the goal is achievable within the deadline given the income threshold */
  feasible: boolean
  /** Total amount still needed */
  remainingAmount: number
  /** Calendar weeks between now and the deadline */
  weeksRemaining: number
  /** Calendar months between now and the deadline (rounded up) */
  monthsRemaining: number
  /** Dollar amount needed per week to hit the target */
  requiredWeekly: number
  /** Dollar amount needed per month to hit the target */
  requiredMonthly: number
  /** Human-readable warm message summarizing the outlook */
  message: string
  /** Whether the deadline has already passed */
  expired: boolean
}

/** Threshold: required monthly contribution must be ≤ 50% of monthly income to be "feasible" */
const FEASIBILITY_THRESHOLD = 0.5

/**
 * Compute required contributions and feasibility for a goal with a deadline.
 *
 * @param goal - Object with currentAmount, targetAmount, and optional targetDate
 * @param monthlyIncome - User's monthly income (used for feasibility check)
 * @param today - Optional override for "now" (useful for determinism)
 * @returns DeadlineFeasibility result, or null if no deadline is set
 */
export function computeDeadlineFeasibility(
  goal: { currentAmount: number; targetAmount: number; targetDate?: string; name?: string },
  monthlyIncome: number,
  today?: Date
): DeadlineFeasibility | null {
  if (!goal.targetDate) return null

  const now = today ?? new Date()
  const deadline = new Date(goal.targetDate)

  // Normalize both dates to start of day for consistent comparison
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())

  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount)

  // If the goal is already complete
  if (remainingAmount === 0) {
    return {
      feasible: true,
      remainingAmount: 0,
      weeksRemaining: 0,
      monthsRemaining: 0,
      requiredWeekly: 0,
      requiredMonthly: 0,
      message: "You've already hit this goal — nice work! 🎉",
      expired: false,
    }
  }

  const diffMs = deadlineStart.getTime() - nowStart.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  // Deadline has passed
  if (diffDays <= 0) {
    return {
      feasible: false,
      remainingAmount,
      weeksRemaining: 0,
      monthsRemaining: 0,
      requiredWeekly: 0,
      requiredMonthly: 0,
      message: "This deadline has passed, but you can still keep saving at your own pace.",
      expired: true,
    }
  }

  const weeksRemaining = Math.max(1, Math.ceil(diffDays / 7))
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30))

  const requiredWeekly = remainingAmount / weeksRemaining
  const requiredMonthly = remainingAmount / monthsRemaining

  // Feasibility: is the required monthly ≤ 50% of income?
  const feasible =
    monthlyIncome > 0 ? requiredMonthly <= monthlyIncome * FEASIBILITY_THRESHOLD : true

  const message = buildWarmMessage({
    feasible,
    requiredWeekly,
    requiredMonthly,
    weeksRemaining,
    monthsRemaining,
    monthlyIncome,
  })

  return {
    feasible,
    remainingAmount,
    weeksRemaining,
    monthsRemaining,
    requiredWeekly: Math.round(requiredWeekly * 100) / 100,
    requiredMonthly: Math.round(requiredMonthly * 100) / 100,
    message,
    expired: false,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface MessageParams {
  feasible: boolean
  requiredWeekly: number
  requiredMonthly: number
  weeksRemaining: number
  monthsRemaining: number
  monthlyIncome: number
}

function buildWarmMessage(params: MessageParams): string {
  const { feasible, requiredWeekly, requiredMonthly, weeksRemaining, monthsRemaining } = params

  const weeklyStr = `$${Math.round(requiredWeekly).toLocaleString()}`
  const monthlyStr = `$${Math.round(requiredMonthly).toLocaleString()}`

  if (feasible) {
    if (monthsRemaining <= 1) {
      return `Almost there — about ${weeklyStr}/week for the next ${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"}. You've got this!`
    }
    return `About ${weeklyStr}/week (or ${monthlyStr}/month) over ${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"}. Totally doable!`
  }

  // Not feasible — still encouraging, just honest
  if (monthsRemaining <= 2) {
    return `That's a stretch at ${monthlyStr}/month — consider extending your deadline or adding what you can. Every bit counts.`
  }
  return `At ${monthlyStr}/month this is ambitious for your income. No pressure — even partial progress is a win.`
}

/**
 * Format a target date for display (e.g. "Sep 1, 2025").
 */
export function formatTargetDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
