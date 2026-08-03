// Folio — Goal ↔ Priority Mapping (Task 212.3)
//
// Reconciles `UserGoal` (the canonical, broader onboarding goal enum) with
// `UserPriority` (the profile field used for tip tone and feature emphasis).

import type { UserGoal, UserPriority } from '@/types'

/**
 * Maps a canonical UserGoal to the closest UserPriority for the profile.
 *
 * Mapping rationale:
 * - 'save'             → 'save'              (direct match)
 * - 'track_spending'   → 'save'              (tracking is savings-adjacent)
 * - 'reduce_spending'  → 'avoid_overdraft'   (spending control maps to overdraft prevention)
 * - 'avoid_overdraft'  → 'avoid_overdraft'   (direct match)
 * - 'pay_debt'         → 'pay_debt'          (direct match)
 * - 'learn_investing'  → 'learn_investing'   (direct match)
 */
export function mapGoalToPriority(goal: UserGoal): UserPriority {
  switch (goal) {
    case 'save':
      return 'save'
    case 'track_spending':
      return 'save'
    case 'reduce_spending':
      return 'avoid_overdraft'
    case 'avoid_overdraft':
      return 'avoid_overdraft'
    case 'pay_debt':
      return 'pay_debt'
    case 'learn_investing':
      return 'learn_investing'
  }
}

/**
 * Maps a UserPriority back to the closest canonical UserGoal.
 *
 * Mapping rationale:
 * - 'save'             → 'save'
 * - 'avoid_overdraft'  → 'avoid_overdraft'
 * - 'pay_debt'         → 'pay_debt'
 * - 'learn_investing'  → 'learn_investing'
 */
export function mapPriorityToGoal(priority: UserPriority): UserGoal {
  switch (priority) {
    case 'save':
      return 'save'
    case 'avoid_overdraft':
      return 'avoid_overdraft'
    case 'pay_debt':
      return 'pay_debt'
    case 'learn_investing':
      return 'learn_investing'
  }
}
