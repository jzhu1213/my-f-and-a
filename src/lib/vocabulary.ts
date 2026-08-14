/**
 * Canonical Emoji & Microcopy Vocabulary
 *
 * Single source of truth for all emojis and short-form status messages across
 * the Folio app. Every surface (HomeScreen, QuickLogArea, ContextualTipCard,
 * CelebrationOverlay, ExpenseSheet, etc.) should import from here rather than
 * defining its own emoji/message constants.
 *
 * Guidelines:
 * - One emoji per category — used everywhere without exception
 * - Status messages are warm, short, human, and non-judgmental
 * - Numbers should be displayed large with tabular-nums for column alignment
 * - Tone is encouraging across all surfaces (hero, tips, celebrations)
 */

import type { TransactionCategory } from '@/types'
import type { AllowanceStatus } from '@/types/folio'

// ============================================================================
// Category Emoji Vocabulary
// ============================================================================

/**
 * Canonical emoji for each spending/income category.
 * This is THE single lookup — if you need an emoji for a category, use this.
 */
export const CATEGORY_EMOJI: Record<TransactionCategory, string> = {
  food: '🍕',
  drinks: '☕',
  rent: '🏠',
  transport: '🚲',
  school: '📚',
  fun: '🎶',
  health: '💪',
  subscriptions: '🔄',
  other: '📦',
  gig: '⚡',
  income: '💵',
}

/** Fallback emoji when category is unknown or custom */
export const FALLBACK_CATEGORY_EMOJI = '💰'

/**
 * Returns the canonical emoji for a category.
 * Falls back to 💰 for unknown/custom categories.
 */
export function getCategoryEmoji(category: string): string {
  return (CATEGORY_EMOJI as Record<string, string>)[category] ?? FALLBACK_CATEGORY_EMOJI
}

// ============================================================================
// Status Emoji & Message Vocabulary
// ============================================================================

/**
 * Canonical emoji for each allowance status level.
 *
 * @deprecated Structural status indicators now render themeable icons via the
 * central icon registry — use `getStatusIconName` from `@/lib/icons` with the
 * {@link Icon} wrapper instead. These emoji are retained only for reference /
 * backward compatibility and are no longer rendered in the UI (Phase 6 task
 * 235.2). Expressive emoji live on in celebration surfaces.
 */
export const STATUS_EMOJI: Record<AllowanceStatus, string> = {
  healthy: '✨',
  caution: '💡',
  warning: '⚠️',
  over: '🫶',
}

/**
 * Returns the canonical emoji for a given allowance status.
 *
 * @deprecated Use `getStatusIconName` from `@/lib/icons` with the {@link Icon}
 * wrapper for structural status indicators (Phase 6 task 235.2).
 */
export function getStatusEmoji(status: AllowanceStatus): string {
  return STATUS_EMOJI[status]
}

// ============================================================================
// Celebration Emoji Vocabulary
// ============================================================================

/**
 * Canonical emoji for each celebration type.
 * Celebrations should always use these — no drift between triggers.
 */
export const CELEBRATION_EMOJI = {
  under_budget_today: '🌟',
  streak_3_days: '🔥',
  streak_7_days: '🏆',
  streak_14_days: '💎',
  streak_30_days: '👑',
  goal_progress: '🎯',
  goal_complete: '🎉',
  first_transaction: '✨',
  weekly_win: '🎊',
  logging_streak: '📝',
  lowest_spend_day: '🌱',
  no_spend_streak: '🌿',
  no_spend_weekend: '🎯',
  // Milestone journeys (Phase 4 task 199.1)
  first_month: '📅',
  first_goal_met: '🥳',
  first_no_spend_week: '🍃',
  // Income encouragement (Phase 11 task 356)
  income_growth: '💪',
  income_record: '🎉',
  // New user first-week milestones (Phase 13 task 393.1)
  new_user_first_expense: '✨',
  new_user_first_day: '🌟',
  new_user_3_day_streak: '🔥',
  new_user_first_week: '🏆',
} as const

// ============================================================================
// Tip Emoji Vocabulary
// ============================================================================

/**
 * Canonical emoji for each tip type.
 * Tips should always pair their type with the matching emoji.
 */
export const TIP_EMOJI = {
  celebration: '🎉',
  gentle_nudge: '💡',
  did_you_know: '✨',
  smart_suggestion: '🧠',
  bill_reminder: '📬',
  pacing_check: '📊',
  subscription_audit: '🔄',
  renewal_soon: '📆',
  trial_ending: '⏳',
  low_balance: '🫶',
  lump_income: '🎉',
  source_breakdown: '💳',
} as const

// ============================================================================
// Microcopy: Status Messages
// ============================================================================

/**
 * Short status labels displayed alongside the daily allowance hero.
 * These are the one-line taglines for each state — warm and encouraging.
 */
export const STATUS_LABELS: Record<AllowanceStatus, string> = {
  healthy: 'Looking good',
  caution: 'Heads up',
  warning: 'Almost there',
  over: 'A little tight today',
}

/**
 * Generates a context-aware encouraging message for the daily allowance hero.
 * All messages follow the same warm, human tone regardless of surface.
 *
 * Rules:
 * - Never shame the user
 * - Keep it under ~60 characters
 * - Include the amount when relevant
 * - Tomorrow always resets — remind them gently when over
 */
export function getStatusMessage(
  status: AllowanceStatus,
  amount: number,
  spentToday: number
): string {
  const amountStr = amount > 0 ? `$${Math.round(amount)}` : '$0'

  switch (status) {
    case 'healthy':
      if (amount >= 50) return `Nice! You've got ${amountStr} left today.`
      if (amount >= 20) return `You're doing great — ${amountStr} to go.`
      return `Still ${amountStr} left. You're on track!`

    case 'caution':
      if (amount >= 10) return `Heads up — ${amountStr} left today.`
      return `Getting close — ${amountStr} left. You've got this.`

    case 'warning':
      if (amount > 0) return `Almost there — just ${amountStr} left today.`
      return `Right at your limit. Nice job staying on track.`

    case 'over':
      if (spentToday <= 20) return 'A little tight today — tomorrow resets.'
      if (spentToday <= 50) return "Over today, but no stress. Tomorrow's a fresh start."
      return `Big day for spending — tomorrow gives you a clean ${amountStr === '$0' ? 'slate' : 'start'}.`

    default:
      return "No stress — let's keep it simple."
  }
}

// ============================================================================
// Microcopy: Celebration Messages
// ============================================================================

/**
 * Canonical celebration copy. Each celebration type has a fixed title + message
 * so the tone stays consistent across sessions and surfaces.
 */
export const CELEBRATION_COPY = {
  under_budget_today: {
    title: 'Under budget today!',
    message: "Nice work — you spent well below today's limit.",
  },
  streak_3_days: {
    title: '3-day streak!',
    message: "Three days under budget in a row. You're building momentum!",
  },
  streak_7_days: {
    title: 'One whole week!',
    message: "Seven days under budget — that's seriously impressive.",
  },
  streak_14_days: {
    title: 'Two-week streak!',
    message: "Fourteen days under budget. You're in a groove!",
  },
  streak_30_days: {
    title: 'A whole month!',
    message: "Thirty days under budget — you've built a real habit.",
  },
  first_transaction: {
    title: 'First one logged!',
    message: "You've started tracking. That's the hardest part.",
  },
  weekly_win: {
    title: 'Weekly win!',
    message: "You finished the week under budget — great week overall!",
  },
  logging_streak: {
    title: 'Logging streak!',
    message: "You've been logging consistently — keep it up!",
  },
  lowest_spend_day: {
    title: 'Lowest spend day!',
    message: "Today's your lightest spending day this week so far.",
  },
  no_spend_streak: {
    title: 'No-spend streak!',
    message: "You're on a roll — no spending for days straight.",
  },
  no_spend_weekend: {
    title: 'No-spend weekend!',
    message: 'You made it through the whole weekend without spending — nice one!',
  },
  // ── Milestone journeys (Phase 4 task 199.1) ──────────────────────────────
  first_month: {
    title: 'One month with Folio',
    message: "A whole month of showing up for yourself. However it's gone, you're still here — that's what counts.",
  },
  first_goal_met: {
    title: 'First goal reached!',
    message: "You set a goal and got there. That's a real milestone — here's to the next one.",
  },
  first_no_spend_week: {
    title: 'A full no-spend week',
    message: "Seven days in a row without spending — your first. That takes some serious intention.",
  },
  // ── Income encouragement (Phase 11 task 356) ─────────────────────────────
  income_growth: {
    title: 'Income on the rise!',
    message: "You made more this month than last — nice hustle.",
  },
  income_record: {
    title: 'New income record!',
    message: "That's your highest-earning month yet. Way to go!",
  },
  // ── New user first-week milestones (Phase 13 task 393.1) ─────────────────
  new_user_first_expense: {
    title: "You're tracking!",
    message: "That's the hardest part.",
  },
  new_user_first_day: {
    title: 'Day 1 complete',
    message: "You stayed on track — nice start.",
  },
  new_user_3_day_streak: {
    title: '3 days running',
    message: "You're building a habit.",
  },
  new_user_first_week: {
    title: 'One week down',
    message: "You know more about your money than most.",
  },
} as const

// ============================================================================
// Microcopy: Tip Messages
// ============================================================================

/**
 * Default tip titles by type — short, warm, and consistent across all surfaces.
 */
export const TIP_TITLES = {
  celebration: "You're on fire!",
  gentle_nudge: 'Heads up',
  did_you_know: 'Quick tip',
  smart_suggestion: 'Try this',
} as const

// ============================================================================
// Onboarding & Preset Emoji
// ============================================================================

/**
 * Canonical emoji for budget presets used in onboarding.
 */
export const PRESET_EMOJI = {
  student_tight: '🎓',
  student_moderate: '☕',
  young_professional: '💼',
  custom: '✨',
} as const

// ============================================================================
// Number Display Helpers
// ============================================================================

/**
 * Formats a dollar amount for large, tabular display.
 * - Rounds to whole dollars for hero/headline numbers
 * - Keeps cents for transaction-level detail
 */
export function formatHeroAmount(amount: number): string {
  return `$${Math.round(amount)}`
}

/**
 * Formats a dollar amount with cents for transaction display.
 */
export function formatTransactionAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}
