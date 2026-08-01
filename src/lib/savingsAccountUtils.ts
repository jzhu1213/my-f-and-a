import type { SavingsAccount, SavingsAccountType } from '@/types/folio'
import type { CompoundGrowthResult } from '@/types'
import { SAVINGS_ACCOUNT_TYPES } from '@/types/folio'
import { computeCompoundGrowth, computeProjectionHorizons } from '@/lib/compoundGrowthUtils'

/**
 * Compute the total balance across all savings/investment accounts.
 */
export function computeTotalSavingsBalance(accounts: SavingsAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0)
}

/**
 * Compute the total monthly contributions across all accounts.
 */
export function computeMonthlyContributions(accounts: SavingsAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.monthlyContribution, 0)
}

/**
 * Get the metadata entry for a given savings account type.
 * Falls back to the 'other' type if not found.
 */
export function getAccountTypeMetadata(type: SavingsAccountType) {
  return (
    SAVINGS_ACCOUNT_TYPES.find(entry => entry.type === type) ??
    SAVINGS_ACCOUNT_TYPES[SAVINGS_ACCOUNT_TYPES.length - 1]
  )
}

/**
 * Aggregated inputs describing the whole savings/investment portfolio as a
 * single account, ready to feed into the compound-growth calculator.
 */
export interface CombinedSavingsInputs {
  /** Sum of every account balance — the combined starting principal. */
  totalBalance: number
  /** Sum of every account's monthly contribution. */
  totalMonthlyContribution: number
  /**
   * Blended expected annual return as a decimal (e.g. 0.07 for 7%).
   *
   * Weighted by balance so larger accounts influence the blended rate more.
   * When no balances exist yet, falls back to a simple average across accounts
   * so a portfolio of brand-new (zero-balance) accounts still projects growth.
   */
  weightedAnnualReturn: number
}

/**
 * Collapse all savings/investment accounts into a single set of inputs.
 *
 * Pure function: sums balances and contributions, and computes a
 * balance-weighted average expected return. Used by both the combined
 * projection math and the combined outlook UI so the two never drift apart.
 */
export function computeCombinedSavingsInputs(
  accounts: SavingsAccount[]
): CombinedSavingsInputs {
  if (accounts.length === 0) {
    return { totalBalance: 0, totalMonthlyContribution: 0, weightedAnnualReturn: 0 }
  }

  const totalBalance = computeTotalSavingsBalance(accounts)
  const totalMonthlyContribution = computeMonthlyContributions(accounts)

  // Balance-weighted average annual return (as decimal, e.g. 0.07)
  const weightedAnnualReturn =
    totalBalance > 0
      ? accounts.reduce(
          (sum, a) => sum + a.balance * (a.expectedAnnualReturn / 100),
          0
        ) / totalBalance
      : accounts.reduce((sum, a) => sum + a.expectedAnnualReturn / 100, 0) /
        accounts.length

  return { totalBalance, totalMonthlyContribution, weightedAnnualReturn }
}

/**
 * Compute a combined projection across all savings/investment accounts.
 *
 * Aggregates balances as the starting principal, sums monthly contributions,
 * and calculates a balance-weighted average annual return. Then delegates to
 * computeCompoundGrowth for the trajectory math.
 *
 * @param accounts - All savings/investment accounts
 * @param years    - Projection horizon (default 30)
 * @returns CompoundGrowthResult representing the combined trajectory
 */
export function computeCombinedProjection(
  accounts: SavingsAccount[],
  years: number = 30
): CompoundGrowthResult {
  if (accounts.length === 0) {
    return {
      finalAmount: 0,
      totalContributions: 0,
      totalInterest: 0,
      yearlyBreakdown: [],
    }
  }

  const { totalBalance, totalMonthlyContribution, weightedAnnualReturn } =
    computeCombinedSavingsInputs(accounts)

  return computeCompoundGrowth(
    totalBalance,
    totalMonthlyContribution,
    weightedAnnualReturn,
    years
  )
}

/**
 * Compute the combined portfolio's projected balances at fixed horizons
 * (1, 5, 10, 30 years) for compact display.
 *
 * @param accounts - All savings/investment accounts
 * @returns Array of { years, amount } across the standard horizons
 */
export function computeCombinedProjectionHorizons(
  accounts: SavingsAccount[]
): { years: number; amount: number }[] {
  const { totalBalance, totalMonthlyContribution, weightedAnnualReturn } =
    computeCombinedSavingsInputs(accounts)

  return computeProjectionHorizons(
    totalBalance,
    totalMonthlyContribution,
    weightedAnnualReturn
  )
}
