/**
 * portfolioAllocationUtils.ts
 *
 * Pure utility functions for portfolio allocation views (Task 172.1).
 *
 * Extends savingsAccountUtils with allocation-focused computations:
 * - Grouping accounts by type with per-type totals
 * - Computing growth vs. contribution splits using contribution history
 *
 * All functions are pure, typed, and side-effect-free (aside from the
 * localStorage read in getContributionHistory, which is SSR-safe).
 */

import type { SavingsAccount, SavingsAccountType } from '@/types/folio'
import { SAVINGS_ACCOUNT_TYPES } from '@/types/folio'
import { getContributionHistory } from '@/lib/savingsContributionHistory'

// ============================================================================
// Types
// ============================================================================

/** Per-type allocation summary. */
export interface TypeAllocation {
  /** The account type key. */
  type: SavingsAccountType
  /** Human-friendly label (e.g. "High-Yield Savings"). */
  label: string
  /** Emoji for display. */
  emoji: string
  /** Sum of all account balances of this type. */
  totalBalance: number
  /** Sum of all monthly contributions for this type. */
  totalMonthlyContribution: number
  /** Percentage of the total portfolio this type represents (0–100). */
  percentage: number
  /** Number of accounts of this type. */
  accountCount: number
}

/** Growth vs. contribution breakdown for a single account. */
export interface GrowthVsContribution {
  /** The account this refers to. */
  accountId: string
  /** Account name for display. */
  accountName: string
  /** Account type. */
  accountType: SavingsAccountType
  /** Current balance. */
  currentBalance: number
  /** Total positive contributions recorded in history. */
  totalContributions: number
  /** Estimated growth: currentBalance - totalContributions (can be negative). */
  estimatedGrowth: number
  /** Whether this account has any contribution history. */
  hasHistory: boolean
}

/** Portfolio-level growth vs. contribution summary. */
export interface PortfolioGrowthSummary {
  /** Total balance across all accounts. */
  totalBalance: number
  /** Sum of all positive contributions across all accounts. */
  totalContributions: number
  /** Total estimated growth: totalBalance - totalContributions. */
  totalEstimatedGrowth: number
  /** Per-account breakdowns. */
  perAccount: GrowthVsContribution[]
}

// ============================================================================
// computeAllocationByType
// ============================================================================

/**
 * Group accounts by SavingsAccountType and return per-type totals.
 *
 * Only types that have at least one account are returned. Results are sorted
 * by total balance descending (largest allocation first).
 */
export function computeAllocationByType(
  accounts: SavingsAccount[]
): TypeAllocation[] {
  if (accounts.length === 0) return []

  const totalPortfolioBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  // Group by type
  const grouped = new Map<SavingsAccountType, SavingsAccount[]>()
  for (const account of accounts) {
    const existing = grouped.get(account.type) ?? []
    existing.push(account)
    grouped.set(account.type, existing)
  }

  const allocations: TypeAllocation[] = []

  for (const [type, typeAccounts] of grouped) {
    const meta = SAVINGS_ACCOUNT_TYPES.find(t => t.type === type) ??
      SAVINGS_ACCOUNT_TYPES[SAVINGS_ACCOUNT_TYPES.length - 1]

    const totalBalance = typeAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalMonthlyContribution = typeAccounts.reduce(
      (sum, a) => sum + a.monthlyContribution,
      0
    )
    const percentage =
      totalPortfolioBalance > 0
        ? (totalBalance / totalPortfolioBalance) * 100
        : 0

    allocations.push({
      type,
      label: meta.label,
      emoji: meta.emoji,
      totalBalance,
      totalMonthlyContribution,
      percentage,
      accountCount: typeAccounts.length,
    })
  }

  // Sort by balance descending
  allocations.sort((a, b) => b.totalBalance - a.totalBalance)

  return allocations
}

// ============================================================================
// computeGrowthVsContribution
// ============================================================================

/**
 * For each account, compute estimated growth vs. total contributions using
 * the locally-stored contribution history.
 *
 * Growth is estimated as: currentBalance - sum(positive contributions).
 * This is an approximation since we don't have historical market data.
 *
 * Returns a portfolio-level summary plus per-account breakdowns.
 */
export function computeGrowthVsContribution(
  accounts: SavingsAccount[]
): PortfolioGrowthSummary {
  if (accounts.length === 0) {
    return {
      totalBalance: 0,
      totalContributions: 0,
      totalEstimatedGrowth: 0,
      perAccount: [],
    }
  }

  const perAccount: GrowthVsContribution[] = []
  let totalBalance = 0
  let totalContributions = 0

  for (const account of accounts) {
    const history = getContributionHistory(account.id)
    const positiveContributions = history
      .filter(entry => entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0)

    const hasHistory = history.length > 0
    const estimatedGrowth = account.balance - positiveContributions

    perAccount.push({
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currentBalance: account.balance,
      totalContributions: positiveContributions,
      estimatedGrowth,
      hasHistory,
    })

    totalBalance += account.balance
    totalContributions += positiveContributions
  }

  return {
    totalBalance,
    totalContributions,
    totalEstimatedGrowth: totalBalance - totalContributions,
    perAccount,
  }
}
