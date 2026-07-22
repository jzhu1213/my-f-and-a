import type { IncomeAllocation } from '@/types/folio'

/**
 * Computes the total "set aside" (reserved, non-spendable) money for a collection of allocations.
 * Set aside = save + invest + setAside from each allocation.
 *
 * @param allocations - Array of income allocations (typically for the current month)
 * @returns Total reserved money across all allocations
 */
export function computeTotalSetAside(allocations: IncomeAllocation[]): number {
  return allocations.reduce(
    (total, a) => total + a.save + a.invest + a.setAside,
    0
  )
}

/**
 * Compute the savings rate as a percentage (0-100).
 * savings rate = (totalSetAside + monthlyContributions) / totalMonthlyIncome * 100
 * Returns 0 if no income logged.
 *
 * @param totalSetAside - Total reserved (save + invest + setAside) for the month
 * @param monthlyContributions - Total monthly contributions across savings accounts
 * @param totalMonthlyIncome - Total income logged for the current month
 * @returns Savings rate clamped to 0-100, rounded to 1 decimal place
 */
export function computeSavingsRate(
  totalSetAside: number,
  monthlyContributions: number,
  totalMonthlyIncome: number
): number {
  if (totalMonthlyIncome <= 0) return 0

  const rate = ((totalSetAside + monthlyContributions) / totalMonthlyIncome) * 100

  // Clamp to 0-100 and round to 1 decimal place
  const clamped = Math.max(0, Math.min(100, rate))
  return Math.round(clamped * 10) / 10
}
