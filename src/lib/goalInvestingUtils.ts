import type { Goal } from '@/types'
import type { SavingsAccount } from '@/types/folio'

/**
 * goalInvestingUtils — pure utilities for linking savings goals to investment
 * accounts. When a goal is backed by an account, its progress reflects the
 * account's real balance rather than manual contributions.
 */

/**
 * Returns the SavingsAccount linked to a goal, or undefined if none is linked
 * or the account no longer exists.
 */
export function getLinkedAccountForGoal(
  goal: Goal,
  accounts: SavingsAccount[]
): SavingsAccount | undefined {
  if (!goal.linkedAccountId) return undefined
  return accounts.find(a => a.id === goal.linkedAccountId)
}

/**
 * Computes the effective current amount for a goal. If the goal is backed by a
 * savings account, uses the account balance; otherwise falls back to the goal's
 * own currentAmount field.
 */
export function computeLinkedGoalProgress(
  goal: Goal,
  account: SavingsAccount | undefined
): number {
  if (account) return account.balance
  return goal.currentAmount
}
