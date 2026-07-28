import type { IncomeAllocation } from '@/types/folio'

/**
 * Computes the allocation-bucket slice of "set aside" money for a collection of
 * allocations: save + invest + setAside from each allocation.
 *
 * NOTE: This is only the *allocation-bucket* portion of money set aside. The
 * unified, reconciled model that maps ALL four features (allocation buckets,
 * sinking funds, goals, and the emergency fund) lives in `src/lib/setAside.ts`
 * (`computeSetAside`). Prefer that single source of truth for anything that
 * needs the overall "money set aside" figure; this helper is kept for callers
 * that specifically want the allocation buckets alone.
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
