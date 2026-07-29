/**
 * Expense-splitting utility functions.
 *
 * Provides a pure helper to compute a user's share when an expense is
 * split among multiple people (roommates, friends, etc.).
 *
 * Requirements: 3.1, 10.1, new
 */

/**
 * Computes the user's share of an expense split among `splitCount` people.
 *
 * @param totalAmount - The full expense amount (e.g., a dinner bill)
 * @param splitCount  - Number of people sharing the expense (including the user)
 * @returns The user's share rounded to 2 decimal places.
 *          Returns `totalAmount` when splitCount < 2 (no meaningful split).
 *
 * Edge cases:
 * - splitCount <= 0: returns totalAmount (treated as no split)
 * - splitCount === 1: returns totalAmount (only the user, no split)
 * - splitCount >= 2: returns totalAmount / splitCount, rounded to 2 decimals
 */
export function computeSplitAmount(totalAmount: number, splitCount: number): number {
  if (!Number.isFinite(splitCount) || splitCount < 2) {
    return totalAmount
  }
  // Round to 2 decimal places using Math.round to avoid floating-point drift
  return Math.round((totalAmount / splitCount) * 100) / 100
}

/**
 * Computes the amount others owe the user after a split.
 *
 * @param totalAmount - The full expense amount
 * @param splitCount  - Number of people sharing the expense (including the user)
 * @returns The combined amount that OTHER people owe (total - user's share),
 *          rounded to 2 decimal places.
 *          Returns 0 when splitCount < 2 (no meaningful split / no one else owes).
 */
export function computeOwedAmount(totalAmount: number, splitCount: number): number {
  if (!Number.isFinite(splitCount) || splitCount < 2) {
    return 0
  }
  const userShare = computeSplitAmount(totalAmount, splitCount)
  return Math.round((totalAmount - userShare) * 100) / 100
}
