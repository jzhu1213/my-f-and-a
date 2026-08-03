/**
 * trajectoryDataContract.ts
 *
 * Data contract for the financial health trajectory visualization (Task 161.1).
 *
 * Defines types and pure functions that Group 19 (task 147.1) can consume
 * directly to render savings growth as an upward-growth line alongside debt
 * paydown in a chart view.
 *
 * All functions are pure, side-effect-free, and return dollar amounts suitable
 * for visualization. Uses existing compound growth utils under the hood.
 */

import type { Debt, SavingsAccount } from '@/types/folio'
import { computeCombinedSavingsInputs } from '@/lib/savingsAccountUtils'

// ============================================================================
// Types — the contract Group 19 renders against
// ============================================================================

/** A single point on a timeline chart — one month's projected balance. */
export interface TrajectoryDataPoint {
  /** Month index from today (0 = current month, 1 = next month, etc.) */
  month: number
  /** Projected dollar balance at this point in time. */
  balance: number
}

/**
 * A named timeline of data points — represents one line on a chart.
 * Could be savings growth (trending up) or debt paydown (trending down).
 */
export interface TrajectoryTimeline {
  /** Human-friendly label for this line (e.g. "Savings Growth", "Debt Paydown"). */
  label: string
  /** The direction this line trends — helps the chart pick colors/styles. */
  direction: 'growth' | 'paydown'
  /** Ordered monthly data points for rendering. */
  dataPoints: TrajectoryDataPoint[]
}

/**
 * The full financial health snapshot — everything a chart component needs
 * to render savings growth alongside debt paydown in one view.
 */
export interface FinancialHealthSnapshot {
  /** Savings/investment growth timeline (trends upward). */
  savingsTimeline: TrajectoryTimeline
  /** Debt paydown timeline (trends downward toward zero). */
  debtTimeline: TrajectoryTimeline
  /** Total months projected (shared x-axis length). */
  projectionMonths: number
  /** Starting total savings balance (month 0). */
  startingSavingsBalance: number
  /** Starting total debt balance (month 0). */
  startingDebtBalance: number
}

// ============================================================================
// Savings trajectory — projects growth month-by-month
// ============================================================================

/**
 * Compute a month-by-month savings growth timeline using compound growth.
 *
 * Uses the combined savings inputs (balance-weighted return, summed
 * contributions) to project forward. Each data point represents the
 * projected portfolio balance at the end of that month.
 *
 * @param accounts - All savings/investment accounts
 * @param months   - How many months to project (default 60 = 5 years)
 * @returns A TrajectoryTimeline with monthly balance data points
 */
export function computeSavingsTrajectoryTimeline(
  accounts: SavingsAccount[],
  months: number = 60
): TrajectoryTimeline {
  if (accounts.length === 0) {
    return {
      label: 'Savings Growth',
      direction: 'growth',
      dataPoints: [{ month: 0, balance: 0 }],
    }
  }

  const { totalBalance, totalMonthlyContribution, weightedAnnualReturn } =
    computeCombinedSavingsInputs(accounts)

  const monthlyRate = weightedAnnualReturn / 12
  const dataPoints: TrajectoryDataPoint[] = []
  let balance = totalBalance

  // Month 0 is "right now"
  dataPoints.push({ month: 0, balance: Math.round(balance) })

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + totalMonthlyContribution
    dataPoints.push({ month: m, balance: Math.round(balance) })
  }

  return {
    label: 'Savings Growth',
    direction: 'growth',
    dataPoints,
  }
}

// ============================================================================
// Debt paydown trajectory — projects balance declining toward zero
// ============================================================================

/**
 * Compute a month-by-month debt paydown timeline.
 *
 * Uses minimum payments and APR to project how debt declines over time.
 * Each debt accrues monthly interest, then the minimum payment is applied.
 * The timeline stops once debt hits zero or the projection horizon is reached.
 *
 * @param debts  - All tracked debts
 * @param months - How many months to project (default 60 = 5 years)
 * @returns A TrajectoryTimeline with monthly total-debt data points
 */
export function computeDebtPaydownTimeline(
  debts: Debt[],
  months: number = 60
): TrajectoryTimeline {
  if (debts.length === 0) {
    return {
      label: 'Debt Paydown',
      direction: 'paydown',
      dataPoints: [{ month: 0, balance: 0 }],
    }
  }

  // Track each debt's balance individually (they have different APRs)
  const balances = debts.map(d => Math.max(0, d.balance))
  const monthlyRates = debts.map(d => (d.apr / 100) / 12)
  const minPayments = debts.map(d => Math.max(0, d.minimumPayment))

  const dataPoints: TrajectoryDataPoint[] = []

  // Month 0 = current total debt
  const startingTotal = balances.reduce((sum, b) => sum + b, 0)
  dataPoints.push({ month: 0, balance: Math.round(startingTotal) })

  for (let m = 1; m <= months; m++) {
    let totalRemaining = 0

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue

      // Accrue interest
      const interest = balances[i] * monthlyRates[i]
      balances[i] += interest

      // Apply minimum payment
      const payment = Math.min(balances[i], minPayments[i])
      balances[i] -= payment

      // Floor at zero
      if (balances[i] < 0.01) balances[i] = 0

      totalRemaining += balances[i]
    }

    dataPoints.push({ month: m, balance: Math.round(totalRemaining) })

    // All debt paid off — fill remaining months with zero for consistent x-axis
    if (totalRemaining <= 0) {
      for (let fill = m + 1; fill <= months; fill++) {
        dataPoints.push({ month: fill, balance: 0 })
      }
      break
    }
  }

  return {
    label: 'Debt Paydown',
    direction: 'paydown',
    dataPoints,
  }
}

// ============================================================================
// Combined snapshot — ready for Group 19 to pass into a chart
// ============================================================================

/**
 * Compute the full financial health snapshot combining savings growth and
 * debt paydown into a single structure ready for chart rendering.
 *
 * Both timelines share the same x-axis (months), making them trivial to
 * overlay in a dual-line chart.
 *
 * @param savingsAccounts - All savings/investment accounts
 * @param debts           - All tracked debts
 * @param months          - Projection horizon in months (default 60 = 5 years)
 * @returns FinancialHealthSnapshot with both timelines aligned
 */
export function computeFinancialHealthTimelines(
  savingsAccounts: SavingsAccount[],
  debts: Debt[],
  months: number = 60
): FinancialHealthSnapshot {
  const savingsTimeline = computeSavingsTrajectoryTimeline(savingsAccounts, months)
  const debtTimeline = computeDebtPaydownTimeline(debts, months)

  const startingSavingsBalance = savingsAccounts.reduce((sum, a) => sum + a.balance, 0)
  const startingDebtBalance = debts.reduce((sum, d) => sum + d.balance, 0)

  return {
    savingsTimeline,
    debtTimeline,
    projectionMonths: months,
    startingSavingsBalance: Math.round(startingSavingsBalance),
    startingDebtBalance: Math.round(startingDebtBalance),
  }
}
