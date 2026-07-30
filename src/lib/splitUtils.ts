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

/**
 * Computes each friend's owed amount when the user specifies a custom (uneven) share.
 *
 * @param totalAmount - The full expense amount
 * @param userShare   - The amount the user is paying (custom input)
 * @param friendCount - Number of friends splitting the remainder (not including the user)
 * @returns The amount each friend owes, rounded to 2 decimal places.
 *          Returns 0 if the user's share exceeds the total or friendCount < 1.
 */
export function computeCustomSplitOwed(
  totalAmount: number,
  userShare: number,
  friendCount: number
): number {
  if (!Number.isFinite(friendCount) || friendCount < 1) return 0
  if (!Number.isFinite(userShare) || userShare < 0) return 0
  const remainder = totalAmount - userShare
  if (remainder <= 0) return 0
  return Math.round((remainder / friendCount) * 100) / 100
}

/**
 * Computes per-friend breakdown for an even split.
 *
 * @param totalAmount - The full expense amount
 * @param friends     - Array of friend names
 * @returns Array of { name, owes } objects. Empty if no friends or invalid amount.
 */
export function computePerFriendOwed(
  totalAmount: number,
  friends: string[],
  splitCount: number
): { name: string; owes: number }[] {
  if (!friends.length || !Number.isFinite(totalAmount) || totalAmount <= 0) return []
  const perPerson = computeSplitAmount(totalAmount, splitCount)
  return friends.map((name) => ({ name, owes: perPerson }))
}

/**
 * Computes per-friend breakdown for a custom (uneven) split.
 *
 * @param totalAmount - The full expense amount
 * @param userShare   - The user's custom share
 * @param friends     - Array of friend names
 * @returns Array of { name, owes } objects. Empty if invalid.
 */
export function computePerFriendOwedCustom(
  totalAmount: number,
  userShare: number,
  friends: string[]
): { name: string; owes: number }[] {
  if (!friends.length || !Number.isFinite(totalAmount) || totalAmount <= 0) return []
  const perFriend = computeCustomSplitOwed(totalAmount, userShare, friends.length)
  if (perFriend <= 0) return []
  return friends.map((name) => ({ name, owes: perFriend }))
}
