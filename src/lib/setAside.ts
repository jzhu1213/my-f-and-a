/**
 * Money Set Aside — the single source of truth for "reserved / non-spendable" money.
 *
 * ── The unified mental model ────────────────────────────────────────────────
 * Folio has four features that each "reserve" money in a slightly different way:
 * allocation buckets, sinking funds, goals, and the emergency fund. Historically
 * every surface added these up on its own, which drifted and double-counted.
 *
 * We reconcile all four into ONE model with two clearly separated facets:
 *
 *   1. FLOW — "set aside THIS MONTH"
 *      Money the user is routing away from day-to-day spending in the current
 *      month. This is the number that reduces the discretionary daily allowance.
 *        • Allocation buckets: save + invest + setAside from this month's income
 *          allocations.
 *        • Sinking-fund monthly reserves: the amount being sunk toward periodic
 *          costs this month (already subtracted from the daily-allowance pool).
 *
 *   2. BALANCE — "total already parked" (accumulated stock)
 *      Money that has already been reserved and is sitting in a pot. This is a
 *      running balance, NOT a monthly amount, so it must never be mixed into the
 *      monthly flow (doing so would inflate the savings rate and the "this month"
 *      card).
 *        • Goal balances: goal.currentAmount for every goal.
 *        • Sinking-fund saved balances: fund.savedAmount for every fund.
 *
 * ── How each feature maps in ────────────────────────────────────────────────
 *   • Allocation buckets → FLOW (allocationSetAside)
 *   • Sinking funds       → FLOW (sinkingFundReserve) AND BALANCE (sinkingFundSaved)
 *                           These are two DIFFERENT quantities (reserve vs. saved),
 *                           so counting both is not double-counting.
 *   • Goals               → BALANCE (goalsSaved)
 *   • Emergency fund      → it is simply a Goal with type === 'emergency_fund'.
 *                           It is NOT a separate concept and is counted once,
 *                           inside goalsSaved, never again elsewhere.
 *
 * ── Avoiding double-counting ────────────────────────────────────────────────
 *   • Emergency fund is never added separately — it lives inside goals.
 *   • Monthly flow (allocations + sinking reserve) is kept strictly separate from
 *     the accumulated balance (goals + sinking saved). The headline "set aside
 *     this month" number is the FLOW only.
 *
 * Everything here is a pure function with no side effects. This is the ONLY place
 * that defines what "money set aside" means; all surfaces read from `useHomeData`
 * (which calls `computeSetAside` once) rather than re-deriving their own totals.
 *
 * ── Related modules (money-set-aside cluster) ─────────────────────────────
 *   • taxSetAside.ts         — gig/1099 tax reserve computation
 *   • autoEarmarkSavings.ts  — auto-sweep unspent allowance toward savings
 *   • allocationUtils.ts     — allocation-bucket slice + savings rate
 */

import type { IncomeAllocation } from '@/types/folio'
import type { Goal } from '@/types'
import type { SinkingFund } from './sinkingFunds'
import { getTotalMonthlyReserve } from './sinkingFunds'

/** Inputs required to compute the full set-aside picture. */
export interface SetAsideInput {
  /** This month's income allocations (spend/save/invest/setAside buckets). */
  allocations: IncomeAllocation[]
  /** The user's sinking funds. */
  sinkingFunds: SinkingFund[]
  /** The user's goals (includes emergency-fund goals — do not count separately). */
  goals: Goal[]
  /** "Now" override for deterministic sinking-fund reserve math. */
  now?: Date
}

/**
 * A fully reconciled breakdown of money set aside, so every surface can read the
 * exact slice it needs without recomputing anything.
 */
export interface SetAsideBreakdown {
  // ── FLOW (this month) ──────────────────────────────────────────────────────
  /** save + invest + setAside from this month's allocations. */
  allocationSetAside: number
  /** Monthly reserve being sunk toward sinking funds this month. */
  sinkingFundReserve: number
  /**
   * Headline "set aside this month" number = allocationSetAside + sinkingFundReserve.
   * This is the value surfaced in the UI and used for the savings rate.
   */
  reservedThisMonth: number

  // ── BALANCE (accumulated stock) ─────────────────────────────────────────────
  /** Sum of every goal's currentAmount (includes emergency-fund goals). */
  goalsSaved: number
  /** Sum of every sinking fund's savedAmount. */
  sinkingFundSaved: number
  /**
   * Total money already parked across goals and sinking funds.
   * A running balance — NOT a monthly amount.
   */
  reservedBalance: number
}

/**
 * Compute the full, reconciled set-aside breakdown from the raw feature data.
 * This is the single source of truth — compute it once (in `useHomeData`) and
 * pass the result down; never re-derive these totals per surface.
 */
export function computeSetAside(input: SetAsideInput): SetAsideBreakdown {
  const { allocations, sinkingFunds, goals, now } = input

  // FLOW — money routed away from spending this month.
  const allocationSetAside = allocations.reduce(
    (total, a) => total + a.save + a.invest + a.setAside,
    0
  )
  const sinkingFundReserve = getTotalMonthlyReserve(sinkingFunds, now)
  const reservedThisMonth = allocationSetAside + sinkingFundReserve

  // BALANCE — money already accumulated. Emergency fund is a goal, so it is
  // captured inside goalsSaved and never counted again.
  const goalsSaved = goals.reduce((total, g) => total + g.currentAmount, 0)
  const sinkingFundSaved = sinkingFunds.reduce((total, f) => total + f.savedAmount, 0)
  const reservedBalance = goalsSaved + sinkingFundSaved

  return {
    allocationSetAside,
    sinkingFundReserve,
    reservedThisMonth,
    goalsSaved,
    sinkingFundSaved,
    reservedBalance,
  }
}

/**
 * Convenience accessor for the headline "set aside this month" number.
 * Equivalent to `computeSetAside(input).reservedThisMonth`.
 */
export function computeTotalSetAsideThisMonth(input: SetAsideInput): number {
  return computeSetAside(input).reservedThisMonth
}
