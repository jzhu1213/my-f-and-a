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

// ============================================================================
// Roth IRA annual contribution tracking (159.1)
// ============================================================================

/**
 * IRS annual Roth IRA contribution limit for savers under 50, tax year 2024.
 * (Those 50+ get a catch-up; we track the standard limit for the student
 * audience this app serves.)
 */
export const ROTH_IRA_ANNUAL_LIMIT_UNDER_50 = 7000

/** Where the account stands relative to an even pace through the year. */
export type RothIraContributionStatus = 'complete' | 'ahead' | 'on_track' | 'behind'

/**
 * A pure snapshot of how far an account has progressed toward the annual
 * Roth IRA contribution limit, plus a warm, non-judgmental message.
 */
export interface RothIraContributionProgress {
  /** Estimated dollars contributed so far this calendar year (capped at the limit). */
  contributed: number
  /** The annual contribution limit used for the comparison. */
  limit: number
  /** contributed / limit, clamped to [0, 1] — ready to drive a progress bar. */
  fractionOfLimit: number
  /** Fraction of the calendar year elapsed, in [0, 1] — the expected pace. */
  yearFraction: number
  /** True when the saver is at or ahead of an even pace (or already maxed out). */
  onTrack: boolean
  /** Coarse status bucket used to pick colour + copy. */
  status: RothIraContributionStatus
  /** Warm encouragement when on track; a gentle nudge when behind. */
  message: string
}

/** Number of contribution months that fall within the current calendar year. */
function monthsContributingThisYear(account: SavingsAccount, now: Date): number {
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const created = new Date(account.createdAt)
  // Contributions only count from whichever is later: Jan 1 or when the
  // account was opened. Guard against an unparseable createdAt.
  const start = !isNaN(created.getTime()) && created > yearStart ? created : yearStart

  const monthSpan =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    1 // inclusive of the current month

  return Math.max(0, monthSpan)
}

/**
 * Compute progress toward the annual Roth IRA contribution limit for a single
 * account, using its monthly contribution to estimate what has gone in so far
 * this calendar year.
 *
 * Pure and deterministic given `now`. `contributed` is estimated as the monthly
 * contribution times the number of contribution months elapsed this year, then
 * capped at the limit. Pace is judged against the fraction of the year elapsed.
 *
 * @param account - The account to evaluate (intended for `roth_ira` accounts)
 * @param now     - The reference date (defaults to the current time)
 * @param limit   - The annual limit to compare against (defaults to the 2024 under-50 limit)
 */
export function computeRothIraContributionProgress(
  account: SavingsAccount,
  now: Date = new Date(),
  limit: number = ROTH_IRA_ANNUAL_LIMIT_UNDER_50
): RothIraContributionProgress {
  const months = monthsContributingThisYear(account, now)
  const rawContributed = Math.max(0, account.monthlyContribution) * months
  const contributed = Math.min(rawContributed, limit)

  // Fraction of the year elapsed (day-level granularity).
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1).getTime()
  const yearFraction = Math.min(1, Math.max(0, (now.getTime() - yearStart) / (yearEnd - yearStart)))

  const fractionOfLimit = limit > 0 ? Math.min(1, Math.max(0, contributed / limit)) : 0
  const expectedFraction = yearFraction // even pace toward the limit

  let status: RothIraContributionStatus
  if (contributed >= limit) {
    status = 'complete'
  } else if (fractionOfLimit >= expectedFraction + 0.1) {
    status = 'ahead'
  } else if (fractionOfLimit >= expectedFraction - 0.05) {
    status = 'on_track'
  } else {
    status = 'behind'
  }

  const onTrack = status !== 'behind'

  const message =
    status === 'complete'
      ? "You've maxed it out this year — that's a huge win 🎉"
      : status === 'ahead'
        ? "You're ahead of pace — amazing momentum"
        : status === 'on_track'
          ? "You're right on pace"
          : "A little behind, but there's still time this year"

  return {
    contributed,
    limit,
    fractionOfLimit,
    yearFraction,
    onTrack,
    status,
    message,
  }
}

// ============================================================================
// End-of-month contribution gap (160.2)
// ============================================================================

/**
 * How many days before month-end the contribution gap reminder is eligible to
 * surface. Kept small so it reads as a "before the month closes" nudge rather
 * than nagging all month.
 */
export const CONTRIBUTION_GAP_WINDOW_DAYS = 5

/**
 * A single account's shortfall against its own monthly contribution target.
 */
export interface ContributionGap {
  /** The account that fell short of its monthly target. */
  account: SavingsAccount
  /** The account's monthly contribution target. */
  target: number
  /** Dollars contributed so far this month. */
  contributed: number
  /** Dollars still needed to hit the target (always > 0 for a real gap). */
  remaining: number
}

/**
 * True when `now` falls within the last {@link CONTRIBUTION_GAP_WINDOW_DAYS}
 * days of its calendar month. Pure and deterministic given `now`.
 */
export function isNearEndOfMonth(
  now: Date = new Date(),
  windowDays: number = CONTRIBUTION_GAP_WINDOW_DAYS
): boolean {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()
  return daysRemaining >= 0 && daysRemaining < windowDays
}

/**
 * Find the single most significant month-to-date contribution shortfall across
 * all accounts — the one with the largest remaining gap against its own
 * `monthlyContribution` target. Returns null when no account has a positive
 * target that fell short.
 *
 * Pure: month-to-date contributions are supplied via `contributedByAccount`
 * (the caller reads the local contribution history), so this function stays
 * deterministic and testable.
 *
 * Only surfacing one account keeps the reminder gentle and respects the
 * one-tip-at-a-time home screen.
 */
export function findLargestContributionGap(
  accounts: SavingsAccount[],
  contributedByAccount: (accountId: string) => number
): ContributionGap | null {
  let best: ContributionGap | null = null

  for (const account of accounts) {
    const target = account.monthlyContribution
    if (target <= 0) continue

    const contributed = Math.max(0, contributedByAccount(account.id))
    const remaining = target - contributed
    if (remaining <= 0) continue

    if (!best || remaining > best.remaining) {
      best = { account, target, contributed, remaining }
    }
  }

  return best
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
