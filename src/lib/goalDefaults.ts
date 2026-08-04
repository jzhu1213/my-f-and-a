// Folio — Goal Defaults Configuration (Task 222.2)
//
// Maps a user's chosen goal to sensible starting defaults for budget preset,
// savings target, and tip tone. Each mapping still produces a working daily
// number via the existing computation pipeline.

import type { UserGoal } from '@/types'
import type { BudgetPreset } from '@/types/folio'

/**
 * Tip tone influences which tips get priority boosting in selectContextualTip.
 * - 'encouraging' → savings celebrations, milestone nudges
 * - 'cautious' → spend-focused observations, near-limit heads-ups
 * - 'debt-focused' → debt payoff tips, credit-related education
 * - 'neutral' → balanced mix, no strong preference
 */
export type TipTone = 'encouraging' | 'cautious' | 'debt-focused' | 'neutral'

export interface GoalDefaults {
  /** Suggested budget preset — only applied if user hasn't manually chosen one */
  budgetPreset: BudgetPreset
  /** Monthly savings target suggestion in dollars (null = no specific target) */
  savingsTarget: number | null
  /** Tip tone that drives ongoing tip selection priority */
  tipTone: TipTone
}

/**
 * Maps a UserGoal to sensible starting configuration defaults.
 *
 * - "Save more" → moderate savings preset + gentle starter savings target
 * - "Stop overspending / stay out of overdraft" → tighter preset + spend-focused tips
 * - "Pay down debt" → tighter preset + debt-first tip tone
 * - "Just track" → light-touch, no imposed savings %, estimate-based number
 *
 * Each mapping still produces a working daily number because the budget preset
 * feeds directly into computeDailyAllowance via the savings percentage.
 *
 * Validates: Task 222.2, Requirements 7.4, 7.6
 */
export function getGoalDefaults(goal: UserGoal): GoalDefaults {
  switch (goal) {
    case 'save':
      return {
        budgetPreset: 'student_moderate' as BudgetPreset,
        savingsTarget: 50,
        tipTone: 'encouraging',
      }
    case 'reduce_spending':
    case 'avoid_overdraft':
      return {
        budgetPreset: 'student_tight' as BudgetPreset,
        savingsTarget: null,
        tipTone: 'cautious',
      }
    case 'pay_debt':
      return {
        budgetPreset: 'student_tight' as BudgetPreset,
        savingsTarget: null,
        tipTone: 'debt-focused',
      }
    case 'track_spending':
    case 'learn_investing':
      return {
        budgetPreset: 'custom' as BudgetPreset,
        savingsTarget: null,
        tipTone: 'neutral',
      }
  }
}

/**
 * Returns a user-facing description of what the chosen goal configures,
 * for display in settings or confirmation screens.
 */
export function getGoalDescription(goal: UserGoal): string {
  switch (goal) {
    case 'save':
      return 'Folio emphasises savings milestones and gentle encouragement.'
    case 'reduce_spending':
      return 'Folio keeps an eye on spending patterns and nudges you when things run high.'
    case 'avoid_overdraft':
      return 'Folio watches your balance and warns early when things get tight.'
    case 'pay_debt':
      return 'Folio surfaces debt tools and tips to help you chip away at what you owe.'
    case 'track_spending':
      return 'Folio stays light-touch — just tracking, no pressure.'
    case 'learn_investing':
      return 'Folio stays light-touch and surfaces investing education when relevant.'
  }
}
