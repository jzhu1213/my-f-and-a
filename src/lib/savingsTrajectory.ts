/**
 * savingsTrajectory.ts
 *
 * Data contract for the Financial Health / trajectory view (Group 19, task
 * 147.1). It turns the user's savings/investment accounts into an upward
 * "growth line" and their debts into a downward "paydown line" that share a
 * single, aligned month-by-month timeline — so the two can be plotted together
 * without the consumer having to reconcile axes or units.
 *
 * Task 161.1 defines this contract in the Savings & Retirement group so Group
 * 19 can consume it directly when the trajectory chart is built. The savings
 * side is the deliverable owned here; the debt-paydown side is included so the
 * savings line always has a matching axis to sit alongside.
 *
 * Everything is a pure function: given the same accounts, debts, and `now`, the
 * output is fully deterministic and testable. No dollar figure is hidden — the
 * consumer decides whether to render raw values or reframe them as progress.
 */

import type { Debt, SavingsAccount } from "@/types/folio"
import { computeCombinedSavingsInputs } from "@/lib/savingsAccountUtils"

// ============================================================================
// Contract types
// ============================================================================

/** Which way a series is expected to move — drives colour + framing in the UI. */
export type TrajectorySeriesDirection = "up" | "down"

/** Semantic kind of a trajectory series. */
export type TrajectorySeriesKind = "savings-growth" | "debt-paydown"

/** A single point on a trajectory line. */
export interface TrajectorySeriesPoint {
  /** Whole months from the series start (0 = the current month). */
  monthOffset: number
  /** Calendar month key, `"YYYY-MM"`, aligned across every series. */
  month: string
  /** Projected balance in whole dollars at this point (always >= 0). */
  balance: number
}

/** A single named line for the trajectory chart. */
export interface TrajectorySeries {
  /** Stable identifier (e.g. `"savings-growth"`). */
  id: string
  /** Semantic kind, so consumers can style/label without string-matching ids. */
  kind: TrajectorySeriesKind
  /** Short, warm label for a legend (e.g. `"Savings"`). */
  label: string
  /** Emoji used in the legend/marker. */
  emoji: string
  /** Intended direction: savings grows up, debt pays down. */
  direction: TrajectorySeriesDirection
  /** CSS custom-property colour token the UI should use (with a fallback). */
  colorToken: string
  /** Ordered points from start → horizon. Length === `months + 1`. */
  points: TrajectorySeriesPoint[]
  /** Convenience: balance at the first point. */
  startBalance: number
  /** Convenience: balance at the last point. */
  endBalance: number
}

/** Options shared by every series builder. */
export interface TrajectorySeriesOptions {
  /** Projection horizon in months. Defaults to {@link DEFAULT_TRAJECTORY_MONTHS}. */
  months?: number
  /** Reference "now" used to generate month keys. Defaults to `new Date()`. */
  now?: Date
}

/**
 * The full contract the trajectory view (147.1) consumes: an aligned timeline
 * plus an optional upward savings line and downward debt line.
 */
export interface FinancialTrajectorySeries {
  /** Horizon length in months. Each series has `months + 1` points. */
  months: number
  /** Shared month keys (`"YYYY-MM"`), one per point index. Length === `months + 1`. */
  timeline: string[]
  /** Upward savings/investment growth line, or `null` when there's nothing to project. */
  savings: TrajectorySeries | null
  /** Downward debt-paydown line, or `null` when there's no tracked debt. */
  debt: TrajectorySeries | null
}

// ============================================================================
// Constants
// ============================================================================

/** Default projection horizon: 5 years, expressed in months. */
export const DEFAULT_TRAJECTORY_MONTHS = 60

/** Colour token (with fallback) for the savings growth line. */
export const SAVINGS_SERIES_COLOR = "var(--success, #4ade80)"

/** Colour token (with fallback) for the debt paydown line. */
export const DEBT_SERIES_COLOR = "var(--accent, #818cf8)"

// ============================================================================
// Helpers
// ============================================================================

/** Build a `"YYYY-MM"` key `offset` whole months after `base`. */
function monthKey(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/** Normalise the horizon to a whole number of months >= 1. */
function normalizeMonths(months: number | undefined): number {
  if (months === undefined || !Number.isFinite(months)) return DEFAULT_TRAJECTORY_MONTHS
  return Math.max(1, Math.floor(months))
}

/**
 * Build the aligned month-key timeline shared by every series.
 *
 * Length is `months + 1` so the first entry is the current month (offset 0)
 * and the last entry is the horizon.
 */
export function buildTrajectoryTimeline(
  options: TrajectorySeriesOptions = {}
): string[] {
  const months = normalizeMonths(options.months)
  const now = options.now ?? new Date()
  const timeline: string[] = []
  for (let i = 0; i <= months; i++) {
    timeline.push(monthKey(now, i))
  }
  return timeline
}

// ============================================================================
// Savings growth line (the deliverable for task 161.1)
// ============================================================================

/**
 * Build the upward savings/investment growth line from all accounts.
 *
 * Collapses every account into a combined starting balance, monthly
 * contribution, and balance-weighted annual return (via
 * {@link computeCombinedSavingsInputs}), then projects month-by-month with
 * monthly compounding — the same math the compound-growth calculator uses, but
 * emitted as one point per month so it can be drawn as a line.
 *
 * Returns `null` when there are no accounts and nothing to project (no balance
 * and no contributions), so the consumer can cleanly omit the line.
 */
export function buildSavingsGrowthSeries(
  accounts: SavingsAccount[],
  options: TrajectorySeriesOptions = {}
): TrajectorySeries | null {
  if (!accounts || accounts.length === 0) return null

  const { totalBalance, totalMonthlyContribution, weightedAnnualReturn } =
    computeCombinedSavingsInputs(accounts)

  // Nothing to draw if there's no balance and no ongoing contributions.
  if (totalBalance <= 0 && totalMonthlyContribution <= 0) return null

  const months = normalizeMonths(options.months)
  const now = options.now ?? new Date()
  const monthlyRate = weightedAnnualReturn / 12

  const points: TrajectorySeriesPoint[] = []
  let balance = totalBalance
  points.push({ monthOffset: 0, month: monthKey(now, 0), balance: Math.round(balance) })

  for (let month = 1; month <= months; month++) {
    balance = balance * (1 + monthlyRate) + totalMonthlyContribution
    points.push({
      monthOffset: month,
      month: monthKey(now, month),
      balance: Math.max(0, Math.round(balance)),
    })
  }

  return {
    id: "savings-growth",
    kind: "savings-growth",
    label: "Savings",
    emoji: "🌱",
    direction: "up",
    colorToken: SAVINGS_SERIES_COLOR,
    points,
    startBalance: points[0].balance,
    endBalance: points[points.length - 1].balance,
  }
}

// ============================================================================
// Debt paydown line (so savings has a matching axis to sit alongside)
// ============================================================================

/**
 * Build the downward debt-paydown line from all tracked debts.
 *
 * Aggregates balances, blends the APR weighted by balance, and applies the
 * combined minimum payments each month (interest accrues first, then the
 * payment is applied). Balance is floored at 0 once a debt is cleared.
 *
 * Returns `null` when there's no tracked debt to pay down. If the combined
 * minimum payment can't cover the accruing interest, the line will (honestly)
 * trend flat or upward — the consumer can surface that as a gentle nudge.
 */
export function buildDebtPaydownSeries(
  debts: Debt[] | undefined,
  options: TrajectorySeriesOptions = {}
): TrajectorySeries | null {
  if (!debts || debts.length === 0) return null

  const totalBalance = debts.reduce((sum, d) => sum + Math.max(0, d.balance ?? 0), 0)
  if (totalBalance <= 0) return null

  const totalPayment = debts.reduce(
    (sum, d) => sum + Math.max(0, d.minimumPayment ?? 0),
    0
  )

  // Balance-weighted blended APR (as a decimal), falling back to a simple mean.
  const blendedApr =
    totalBalance > 0
      ? debts.reduce(
          (sum, d) => sum + Math.max(0, d.balance ?? 0) * ((d.apr ?? 0) / 100),
          0
        ) / totalBalance
      : debts.reduce((sum, d) => sum + (d.apr ?? 0) / 100, 0) / debts.length
  const monthlyRate = blendedApr / 12

  const months = normalizeMonths(options.months)
  const now = options.now ?? new Date()

  const points: TrajectorySeriesPoint[] = []
  let balance = totalBalance
  points.push({ monthOffset: 0, month: monthKey(now, 0), balance: Math.round(balance) })

  for (let month = 1; month <= months; month++) {
    if (balance > 0) {
      const withInterest = balance * (1 + monthlyRate)
      balance = Math.max(0, withInterest - totalPayment)
    }
    points.push({
      monthOffset: month,
      month: monthKey(now, month),
      balance: Math.round(balance),
    })
  }

  return {
    id: "debt-paydown",
    kind: "debt-paydown",
    label: "Debt",
    emoji: "📤",
    direction: "down",
    colorToken: DEBT_SERIES_COLOR,
    points,
    startBalance: points[0].balance,
    endBalance: points[points.length - 1].balance,
  }
}

// ============================================================================
// Combined contract builder
// ============================================================================

/** Inputs for {@link buildFinancialTrajectorySeries}. */
export interface FinancialTrajectorySeriesInput {
  /** Savings/investment accounts to project as the upward growth line. */
  savingsAccounts?: SavingsAccount[]
  /** Debts to project as the downward paydown line. */
  debts?: Debt[]
  /** Projection horizon in months. Defaults to {@link DEFAULT_TRAJECTORY_MONTHS}. */
  months?: number
  /** Reference "now". Defaults to `new Date()`. */
  now?: Date
}

/**
 * Build the full {@link FinancialTrajectorySeries} contract: an aligned
 * timeline plus the savings and debt lines, both projected over the same
 * horizon so the trajectory view can plot them together directly.
 *
 * Pure and deterministic given the inputs and `now`.
 */
export function buildFinancialTrajectorySeries(
  input: FinancialTrajectorySeriesInput
): FinancialTrajectorySeries {
  const months = normalizeMonths(input.months)
  const now = input.now ?? new Date()
  const options: TrajectorySeriesOptions = { months, now }

  return {
    months,
    timeline: buildTrajectoryTimeline(options),
    savings: buildSavingsGrowthSeries(input.savingsAccounts ?? [], options),
    debt: buildDebtPaydownSeries(input.debts, options),
  }
}
