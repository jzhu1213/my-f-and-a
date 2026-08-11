/**
 * progressCurveUtils.ts
 *
 * Combines debt paydown + savings growth into a single normalized "progress
 * score" that always trends upward when the user is making payments and
 * contributions.
 *
 * The key insight: both "debt going down" and "savings going up" contribute
 * to the same progress metric. The result reads as *momentum and direction*,
 * never a raw net-worth or shame number.
 *
 * Progress score is 0–100 where:
 * - 0 = starting point (today)
 * - 100 = projected maximum progress within the horizon
 *
 * Both signals are weighted equally so a user with only debt or only savings
 * still sees a full 0→100 curve.
 *
 * ── Related modules (savings-projection cluster) ──────────────────────────
 *   • compoundGrowthUtils.ts         — pure compound interest math
 *   • savingsContributionHistory.ts  — per-account local contribution log
 *   • savingsAccountUtils.ts         — account-level aggregates + projections
 *   • trajectoryUtils.ts             — directional financial health trends
 */

import type { Debt, SavingsAccount } from '@/types/folio'
import { computeCombinedSavingsInputs } from '@/lib/savingsAccountUtils'

// ============================================================================
// Types
// ============================================================================

/** A single point on the unified progress curve. */
export interface ProgressDataPoint {
  /** Month index from today (0 = now). */
  month: number
  /** Normalized progress score (0–100). */
  score: number
}

/** Full progress curve data ready for chart rendering. */
export interface ProgressCurveData {
  /** Monthly progress data points. */
  dataPoints: ProgressDataPoint[]
  /** Total months projected. */
  projectionMonths: number
  /** Projected savings balance at end of horizon. */
  projectedSavings: number
  /** Projected debt balance at end of horizon. */
  projectedDebt: number
  /** Starting savings balance. */
  startingSavings: number
  /** Starting debt balance. */
  startingDebt: number
  /** Whether savings data contributed to the curve. */
  hasSavingsSignal: boolean
  /** Whether debt data contributed to the curve. */
  hasDebtSignal: boolean
}

// ============================================================================
// Core computation
// ============================================================================

/**
 * Compute a unified progress curve combining debt paydown and savings growth
 * into one normalized metric that always trends upward.
 *
 * @param savingsAccounts - All savings/investment accounts
 * @param debts           - All tracked debts
 * @param months          - Projection horizon (default 12)
 * @returns ProgressCurveData with monthly normalized progress points
 */
export function computeProgressCurve(
  savingsAccounts: SavingsAccount[],
  debts: Debt[],
  months: number = 12
): ProgressCurveData {
  const hasSavingsSignal = savingsAccounts.length > 0 &&
    (savingsAccounts.some(a => a.balance > 0) || savingsAccounts.some(a => a.monthlyContribution > 0))
  const hasDebtSignal = debts.length > 0 && debts.some(d => d.balance > 0)

  // Project savings month by month
  const savingsBalances = projectSavings(savingsAccounts, months)

  // Project debt month by month
  const debtBalances = projectDebt(debts, months)

  const startingSavings = savingsBalances[0]
  const startingDebt = debtBalances[0]
  const projectedSavings = savingsBalances[months]
  const projectedDebt = debtBalances[months]

  // Compute raw progress at each month
  // Savings progress: how much savings grew relative to the total growth over the horizon
  // Debt progress: how much debt decreased relative to the total decrease over the horizon
  const savingsGrowth = projectedSavings - startingSavings
  const debtReduction = startingDebt - projectedDebt

  const dataPoints: ProgressDataPoint[] = []

  for (let m = 0; m <= months; m++) {
    let score = 0

    if (hasSavingsSignal && hasDebtSignal) {
      // Both signals: weight them equally (50/50)
      const savingsProgress = savingsGrowth > 0
        ? ((savingsBalances[m] - startingSavings) / savingsGrowth) * 50
        : 0
      const debtProgress = debtReduction > 0
        ? ((startingDebt - debtBalances[m]) / debtReduction) * 50
        : 0
      score = savingsProgress + debtProgress
    } else if (hasSavingsSignal) {
      // Only savings: full 0–100 range
      score = savingsGrowth > 0
        ? ((savingsBalances[m] - startingSavings) / savingsGrowth) * 100
        : 0
    } else if (hasDebtSignal) {
      // Only debt: full 0–100 range
      score = debtReduction > 0
        ? ((startingDebt - debtBalances[m]) / debtReduction) * 100
        : 0
    }

    // Clamp to [0, 100] and ensure monotonic upward trend
    score = Math.max(0, Math.min(100, score))

    // Ensure the curve never dips below the previous point (monotonic)
    if (dataPoints.length > 0) {
      const prevScore = dataPoints[dataPoints.length - 1].score
      score = Math.max(prevScore, score)
    }

    dataPoints.push({ month: m, score: Math.round(score * 10) / 10 })
  }

  return {
    dataPoints,
    projectionMonths: months,
    projectedSavings: Math.round(projectedSavings),
    projectedDebt: Math.round(projectedDebt),
    startingSavings: Math.round(startingSavings),
    startingDebt: Math.round(startingDebt),
    hasSavingsSignal,
    hasDebtSignal,
  }
}

// ============================================================================
// Internal projection helpers
// ============================================================================

/**
 * Project savings balances month by month using compound growth.
 * Returns an array of length (months + 1), index 0 being the current balance.
 */
function projectSavings(accounts: SavingsAccount[], months: number): number[] {
  if (accounts.length === 0) {
    return Array(months + 1).fill(0)
  }

  const { totalBalance, totalMonthlyContribution, weightedAnnualReturn } =
    computeCombinedSavingsInputs(accounts)

  const monthlyRate = weightedAnnualReturn / 12
  const balances: number[] = [totalBalance]

  let balance = totalBalance
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + totalMonthlyContribution
    balances.push(balance)
  }

  return balances
}

/**
 * Project total debt balance month by month.
 * Each debt accrues interest, then minimum payment is applied.
 * Returns an array of length (months + 1), index 0 being the current total.
 */
function projectDebt(debts: Debt[], months: number): number[] {
  if (debts.length === 0) {
    return Array(months + 1).fill(0)
  }

  const debtBalances = debts.map(d => Math.max(0, d.balance))
  const monthlyRates = debts.map(d => (d.apr / 100) / 12)
  const minPayments = debts.map(d => Math.max(0, d.minimumPayment))

  const totals: number[] = [debtBalances.reduce((sum, b) => sum + b, 0)]

  for (let m = 1; m <= months; m++) {
    let totalRemaining = 0

    for (let i = 0; i < debtBalances.length; i++) {
      if (debtBalances[i] <= 0) continue

      // Accrue interest
      debtBalances[i] += debtBalances[i] * monthlyRates[i]

      // Apply minimum payment
      const payment = Math.min(debtBalances[i], minPayments[i])
      debtBalances[i] -= payment

      if (debtBalances[i] < 0.01) debtBalances[i] = 0
      totalRemaining += debtBalances[i]
    }

    totals.push(totalRemaining)
  }

  return totals
}
