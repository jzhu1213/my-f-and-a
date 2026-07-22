import type { CompoundGrowthResult } from '@/types'

/**
 * Compute compound growth with monthly compounding.
 *
 * Extracts the core math from CompoundGrowthCalculator into a pure,
 * reusable function suitable for projections, previews, and testing.
 *
 * @param principal      - Starting balance (lump sum)
 * @param monthlyContribution - Amount added each month
 * @param annualRate     - Expected annual return as a decimal (e.g. 0.07 for 7%)
 * @param years          - Number of years to project
 * @returns CompoundGrowthResult with finalAmount, totalContributions, totalInterest, yearlyBreakdown
 */
export function computeCompoundGrowth(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
): CompoundGrowthResult {
  const monthlyRate = annualRate / 12
  const totalMonths = years * 12
  let balance = principal
  const yearlyBreakdown: { year: number; balance: number }[] = []

  for (let month = 1; month <= totalMonths; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    if (month % 12 === 0) {
      yearlyBreakdown.push({ year: month / 12, balance: Math.round(balance) })
    }
  }

  const totalContributions = principal + monthlyContribution * totalMonths

  return {
    finalAmount: Math.round(balance),
    totalContributions: Math.round(totalContributions),
    totalInterest: Math.round(balance - totalContributions),
    yearlyBreakdown,
  }
}

/**
 * Compute projected balances at fixed horizons (1, 5, 10, 30 years).
 * Returns a compact array of { years, amount } for quick display.
 */
export function computeProjectionHorizons(
  principal: number,
  monthlyContribution: number,
  annualRate: number
): { years: number; amount: number }[] {
  const horizons = [1, 5, 10, 30]
  return horizons.map(y => ({
    years: y,
    amount: computeCompoundGrowth(principal, monthlyContribution, annualRate, y).finalAmount,
  }))
}
