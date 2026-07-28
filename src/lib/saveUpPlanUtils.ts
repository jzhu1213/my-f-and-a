/**
 * Save-Up Plan Utilities
 *
 * Pure helper functions for computing save-up timelines for big purchases.
 * Given a target amount, current savings, and contribution rate, these
 * functions compute how many weeks/months until the goal is reached and
 * generate friendly, encouraging messaging.
 *
 * No side effects — all functions are pure and deterministic (aside from
 * the target date which anchors to Date.now).
 *
 * Validates: Requirements 12.3, 12.4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContributionPeriod = "weekly" | "monthly"

export interface SaveUpInput {
  /** Total amount needed for the purchase. */
  targetAmount: number
  /** Amount already saved toward this purchase (defaults to 0). */
  currentAmount?: number
  /** The contribution per period. */
  contributionRate: number
  /** Whether the contribution rate is weekly or monthly. */
  period: ContributionPeriod
}

export interface SaveUpResult {
  /** Number of weeks until the goal is reached (rounded up). */
  weeksToGoal: number
  /** Number of months until the goal is reached (rounded up, assumes 4.33 weeks/month). */
  monthsToGoal: number
  /** ISO date string of the estimated completion date. */
  targetDate: string
  /** Effective weekly contribution rate. */
  weeklyRate: number
  /** Effective monthly contribution rate. */
  monthlyRate: number
  /** A warm, encouraging message describing the timeline. */
  message: string
}

export interface SaveUpScenario extends SaveUpResult {
  /** Label for this scenario (e.g., "$50/week"). */
  label: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average weeks per month (365.25 / 12 / 7). */
const WEEKS_PER_MONTH = 4.33

/** Default contribution rates used for scenario generation. */
export const DEFAULT_WEEKLY_RATES = [10, 25, 50, 100]

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Computes a save-up timeline given a target, current savings, and
 * contribution rate.
 */
export function computeSaveUpPlan(input: SaveUpInput): SaveUpResult {
  const { targetAmount, currentAmount = 0, contributionRate, period } = input

  const remaining = Math.max(0, targetAmount - currentAmount)

  // Normalize to weekly rate
  const weeklyRate = period === "weekly" ? contributionRate : contributionRate / WEEKS_PER_MONTH
  const monthlyRate = period === "monthly" ? contributionRate : contributionRate * WEEKS_PER_MONTH

  // Edge case: already reached or zero contribution
  if (remaining <= 0) {
    return {
      weeksToGoal: 0,
      monthsToGoal: 0,
      targetDate: new Date().toISOString(),
      weeklyRate: Math.round(weeklyRate * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      message: "You've already saved enough — nice work! 🎉",
    }
  }

  if (weeklyRate <= 0) {
    return {
      weeksToGoal: Infinity,
      monthsToGoal: Infinity,
      targetDate: "",
      weeklyRate: 0,
      monthlyRate: 0,
      message: "Set a contribution amount to see your timeline.",
    }
  }

  const weeksToGoal = Math.ceil(remaining / weeklyRate)
  const monthsToGoal = Math.ceil(remaining / monthlyRate)

  // Compute target date from today
  const target = new Date()
  target.setDate(target.getDate() + weeksToGoal * 7)
  const targetDate = target.toISOString()

  const message = buildEncouragingMessage(monthsToGoal, weeklyRate, monthlyRate, period)

  return {
    weeksToGoal,
    monthsToGoal,
    targetDate,
    weeklyRate: Math.round(weeklyRate * 100) / 100,
    monthlyRate: Math.round(monthlyRate * 100) / 100,
    message,
  }
}

// ---------------------------------------------------------------------------
// Scenario generation
// ---------------------------------------------------------------------------

/**
 * Generates multiple save-up timeline scenarios at various weekly rates.
 * Useful for showing the user a range of options.
 */
export function generateSaveUpScenarios(
  targetAmount: number,
  currentAmount = 0,
  weeklyRates: number[] = DEFAULT_WEEKLY_RATES
): SaveUpScenario[] {
  return weeklyRates.map((rate) => {
    const result = computeSaveUpPlan({
      targetAmount,
      currentAmount,
      contributionRate: rate,
      period: "weekly",
    })

    return {
      ...result,
      label: `$${rate}/week`,
    }
  })
}

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

function buildEncouragingMessage(
  months: number,
  weeklyRate: number,
  monthlyRate: number,
  period: ContributionPeriod
): string {
  const rateStr =
    period === "weekly"
      ? `$${Math.round(weeklyRate)}/week`
      : `$${Math.round(monthlyRate)}/month`

  if (months <= 1) {
    return `At ${rateStr}, you could have this in about a month — so close! ✨`
  }
  if (months <= 3) {
    return `At ${rateStr}, you'd reach this in about ${months} months. Totally doable!`
  }
  if (months <= 6) {
    return `At ${rateStr}, you'd get there in about ${months} months. Steady saves add up!`
  }
  if (months <= 12) {
    return `At ${rateStr}, that's about ${months} months. A bit of patience pays off! 🌱`
  }
  return `At ${rateStr}, it'd take about ${months} months. Consider bumping up a little if you can!`
}

/**
 * Formats a scenario result into a short, friendly timeline string.
 * E.g., "$50/week → ~3 months"
 */
export function formatScenarioTimeline(scenario: SaveUpScenario): string {
  if (scenario.weeksToGoal === 0) return `${scenario.label} → Already there!`
  if (scenario.monthsToGoal <= 1) return `${scenario.label} → ~${scenario.weeksToGoal} weeks`
  return `${scenario.label} → ~${scenario.monthsToGoal} months`
}
