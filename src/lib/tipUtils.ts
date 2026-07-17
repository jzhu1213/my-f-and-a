import type { TransactionCategory } from '@/types'
import type { ContextualTip } from '@/types/folio'

/**
 * Context data needed to evaluate which tip to show.
 * Assembled by the HomeScreen from user state before calling selectContextualTip.
 */
export interface UserContext {
  /** Consecutive days the user has stayed under budget */
  underBudgetStreak: number
  /** Percentage of today's daily budget already spent (0–100+) */
  todaySpentPercent: number
  /** Total number of transactions the user has ever logged */
  totalTransactions: number
  /** The highest-spending category today (used in nudge tip metadata) */
  topCategory: TransactionCategory
  /** Current allowance state */
  allowance: { amount: number; dailyBudget: number }
}

/**
 * Selects the most relevant contextual tip to display on the Home Screen.
 *
 * Algorithm:
 * 1. Evaluate celebration triggers (streak >= 3 days) — high priority
 * 2. Evaluate gentle nudge triggers (spent > 80% of daily budget) — medium priority
 * 3. Evaluate educational triggers (< 10 total transactions) — low priority
 * 4. Filter out any tips the user previously dismissed
 * 5. Sort remaining candidates by priority (high > medium > low)
 * 6. Return the top candidate, or null if none qualify
 *
 * This is a pure utility function with no side effects.
 *
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6
 */
export function selectContextualTip(
  context: UserContext,
  dismissedTips: Set<string>
): ContextualTip | null {
  const candidates: ContextualTip[] = []

  // Step 1: Celebration trigger — streak of 3+ days under budget (high priority)
  if (context.underBudgetStreak >= 3) {
    candidates.push({
      id: `streak-${context.underBudgetStreak}`,
      type: 'celebration',
      title: "You're on fire! 🔥",
      message: `${context.underBudgetStreak} days under budget! Keep it up.`,
      emoji: '🎉',
      priority: 'high',
      triggerCondition: { type: 'under_budget_streak', days: context.underBudgetStreak },
    })
  }

  // Step 2: Gentle nudge trigger — spent more than 80% of daily budget (medium priority)
  if (context.todaySpentPercent > 80 && context.allowance.amount > 0) {
    candidates.push({
      id: 'spending-high-today',
      type: 'gentle_nudge',
      title: 'Heads up',
      message: "You've used most of today's budget. Maybe save the rest for later?",
      emoji: '💡',
      priority: 'medium',
      actionLabel: 'See breakdown',
      actionType: 'view_insight',
      triggerCondition: { type: 'category_spike', category: context.topCategory, percentIncrease: 80 },
    })
  }

  // Step 3: Educational trigger — fewer than 10 total transactions (low priority)
  if (context.totalTransactions < 10) {
    candidates.push({
      id: 'getting-started-tip',
      type: 'did_you_know',
      title: 'Quick tip',
      message: 'Tap any category to log an expense. Your most common amounts will appear automatically.',
      emoji: '✨',
      priority: 'low',
      triggerCondition: { type: 'first_goal_progress' },
    })
  }

  // Step 4: Filter out previously dismissed tips
  const available = candidates.filter((t) => !dismissedTips.has(t.id))

  // Step 5: Sort by priority (high first, then medium, then low)
  const priorityOrder: Record<ContextualTip['priority'], number> = { high: 0, medium: 1, low: 2 }
  available.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // Step 6: Return top candidate or null
  return available[0] ?? null
}
