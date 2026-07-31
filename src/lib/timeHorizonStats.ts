/**
 * Time Horizon Stats — unified computation of multi-horizon spending stats.
 *
 * Produces a set of "secondary stats" for students: weekend, until-payday,
 * and until-term-end. Each stat is nullable — only present when the user has
 * the relevant schedule configured AND it's contextually relevant right now.
 *
 * Pure function: no I/O, no side effects, no Date.now() calls.
 */

import type { Transaction } from '@/types'
import type { WeekendAllowanceResult } from '@/lib/weekendAllowance'
import type { TermAllowanceResult } from '@/lib/termAllowance'
import type { PaySchedule } from '@/lib/paySchedule'
import { getDaysUntilPayday, computeSafeToSpendUntilPayday } from '@/lib/paySchedule'

// ============================================================================
// Types
// ============================================================================

export interface PaydayStat {
  /** Amount safe to spend per day until payday */
  dailyAmount: number
  /** Days until next payday */
  daysLeft: number
}

export interface TermStat {
  /** Amount safe to spend per day until term end */
  dailyAmount: number
  /** Days remaining in the term */
  daysLeft: number
  /** User-facing label, e.g. "Until end of Fall 2024" */
  label: string
}

export interface WeekendStat {
  /** Amount safe to spend this weekend */
  amount: number
  /** User-facing label, e.g. "This weekend" */
  label: string
}

export interface TimeHorizonStats {
  /** Weekend spending room — only present on Fri/Sat/Sun */
  weekend: WeekendStat | null
  /** Per-day amount until next payday — only present when paySchedule is set */
  payday: PaydayStat | null
  /** Per-day amount until term end — only present when termSchedule is active */
  term: TermStat | null
}

// ============================================================================
// Core Computation
// ============================================================================

/**
 * Computes all time-horizon stats from existing building blocks.
 *
 * @param weekendAllowance - Pre-computed weekend allowance result (or null)
 * @param paySchedule - User's pay schedule (or null when not configured)
 * @param termAllowance - Pre-computed term allowance result (or null)
 * @param discretionaryAvailable - Remaining discretionary money for payday calc
 * @param transactions - All user transactions (for payday income history)
 * @param currentDate - Current date for payday computation
 * @returns TimeHorizonStats with each horizon nullable
 *
 * @pure No side effects.
 */
export function computeTimeHorizonStats(
  weekendAllowance: WeekendAllowanceResult | null,
  paySchedule: PaySchedule | null,
  termAllowance: TermAllowanceResult | null,
  discretionaryAvailable: number,
  transactions: Transaction[],
  currentDate: Date
): TimeHorizonStats {
  // ── Weekend ──────────────────────────────────────────────────────
  const weekend: WeekendStat | null =
    weekendAllowance && weekendAllowance.daysUntilWeekend === 0
      ? { amount: weekendAllowance.weekendAmount, label: weekendAllowance.label }
      : null

  // ── Payday ───────────────────────────────────────────────────────
  let payday: PaydayStat | null = null
  if (paySchedule) {
    const daysLeft = getDaysUntilPayday(paySchedule, currentDate, transactions)
    // Only show when payday is more than 1 day away (today = payday isn't useful)
    if (daysLeft > 1) {
      const dailyAmount = computeSafeToSpendUntilPayday(discretionaryAvailable, daysLeft)
      payday = {
        dailyAmount: Math.round(dailyAmount * 100) / 100,
        daysLeft,
      }
    }
  }

  // ── Term ─────────────────────────────────────────────────────────
  const term: TermStat | null = termAllowance
    ? {
        dailyAmount: termAllowance.termDailyAmount,
        daysLeft: termAllowance.daysRemaining,
        label: termAllowance.label,
      }
    : null

  return { weekend, payday, term }
}
