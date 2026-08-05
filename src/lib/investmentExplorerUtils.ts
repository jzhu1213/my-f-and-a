/**
 * investmentExplorerUtils.ts
 *
 * Pure utility for the Investment Explorer "what-if" tool (task 173.1).
 *
 * Produces projection data from user inputs (monthly contribution, annual
 * return, starting balance, years) and outputs both a detailed breakdown
 * (for the interactive chart) and a TrajectoryTimeline (for overlay on the
 * trajectory chart).
 *
 * Uses `computeCompoundGrowth` from compoundGrowthUtils under the hood.
 */

import { computeCompoundGrowth } from '@/lib/compoundGrowthUtils'
import type { TrajectoryDataPoint, TrajectoryTimeline } from '@/lib/trajectoryDataContract'
import type { CompoundGrowthResult } from '@/types'

// ============================================================================
// Types
// ============================================================================

/** Month-level data point for the interactive chart. */
export interface MonthlyProjectionPoint {
  /** Month index from start (0 = today). */
  month: number
  /** Projected balance at end of this month. */
  balance: number
  /** Cumulative contributions (including starting balance). */
  totalContributed: number
  /** Cumulative growth from returns. */
  totalGrowth: number
}

/** Full projection output for the Investment Explorer UI. */
export interface InvestmentProjection {
  /** Summary result from compound growth calculation. */
  summary: CompoundGrowthResult
  /** Month-by-month breakdown for the interactive chart. */
  monthlyPoints: MonthlyProjectionPoint[]
  /** TrajectoryTimeline compatible output for overlay on trajectory chart. */
  trajectoryTimeline: TrajectoryTimeline
}

// ============================================================================
// Core projection function
// ============================================================================

/**
 * Compute a full investment projection given user inputs.
 *
 * @param monthlyContribution - Dollar amount contributed each month
 * @param annualRate          - Expected annual return as a percentage (e.g. 7 for 7%)
 * @param startingBalance     - Lump-sum starting balance (default 0)
 * @param years               - Projection horizon in years (default 10)
 * @returns InvestmentProjection with summary, monthly points, and trajectory timeline
 */
export function computeInvestmentProjection(
  monthlyContribution: number,
  annualRate: number,
  startingBalance: number = 0,
  years: number = 10
): InvestmentProjection {
  // Use core compound growth util for the summary
  const rateDecimal = annualRate / 100
  const summary = computeCompoundGrowth(startingBalance, monthlyContribution, rateDecimal, years)

  // Build month-by-month breakdown
  const totalMonths = years * 12
  const monthlyRate = rateDecimal / 12
  const monthlyPoints: MonthlyProjectionPoint[] = []
  const dataPoints: TrajectoryDataPoint[] = []

  let balance = startingBalance

  // Month 0 = current state
  monthlyPoints.push({
    month: 0,
    balance: Math.round(startingBalance),
    totalContributed: Math.round(startingBalance),
    totalGrowth: 0,
  })
  dataPoints.push({ month: 0, balance: Math.round(startingBalance) })

  for (let m = 1; m <= totalMonths; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    const contributed = startingBalance + monthlyContribution * m
    const growth = balance - contributed

    monthlyPoints.push({
      month: m,
      balance: Math.round(balance),
      totalContributed: Math.round(contributed),
      totalGrowth: Math.round(growth),
    })
    dataPoints.push({ month: m, balance: Math.round(balance) })
  }

  const trajectoryTimeline: TrajectoryTimeline = {
    label: 'Investment Explorer',
    direction: 'growth',
    dataPoints,
  }

  return { summary, monthlyPoints, trajectoryTimeline }
}
