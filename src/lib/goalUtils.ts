import type { Goal } from '@/types'

// ============================================================================
// Goal Utilities — Pure Functions
// ============================================================================

/**
 * Computes the progress percentage toward a goal, clamped to 0–100.
 */
export function computeGoalProgress(currentAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0
  return Math.min((currentAmount / targetAmount) * 100, 100)
}

/**
 * Returns the remaining amount needed to reach a goal target.
 * Never returns a negative value (goal is already met if remainder would be ≤ 0).
 */
export function computeGoalRemaining(currentAmount: number, targetAmount: number): number {
  return Math.max(0, targetAmount - currentAmount)
}

/**
 * Convenience overload: accepts a Goal object directly.
 */
export function goalProgress(goal: Goal): number {
  return computeGoalProgress(goal.currentAmount, goal.targetAmount)
}

/**
 * A goal is complete once it reaches or passes its (positive) target.
 */
export function isGoalComplete(goal: Goal): boolean {
  return goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount
}
