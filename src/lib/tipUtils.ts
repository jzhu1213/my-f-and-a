import type { TransactionCategory } from '@/types'
import type { ContextualTip } from '@/types/folio'
import { TIP_EMOJI, TIP_TITLES } from '@/lib/vocabulary'

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
  /** Average daily discretionary spending over the last 7 days (or days available) */
  recentBurnRate?: number
  /** How much discretionary money is left for the rest of the month */
  discretionaryPoolRemaining?: number
  /** Days left in the current month */
  daysRemainingInMonth?: number
  /** Bills due within the next 3 days (for bill-due reminders) */
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  /**
   * Whether the projected balance is expected to dip below the configured
   * minimum-balance buffer before the next payday (overdraft-risk signal).
   */
  willDipBelowBuffer?: boolean
  /** The lowest projected balance between now and the next payday. */
  projectedLowBalance?: number
  /** The configured minimum-balance buffer the projection is compared against. */
  minBalanceBuffer?: number
  /** Whole days until the balance is first projected to fall below the buffer. */
  daysUntilBalanceDip?: number
  /** Detected subscriptions summary for subscription audit nudge */
  detectedSubscriptions?: { count: number; monthlyTotal: number }
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
      title: TIP_TITLES.celebration,
      message: `${context.underBudgetStreak} days under budget! Keep it up.`,
      emoji: TIP_EMOJI.celebration,
      priority: 'high',
      triggerCondition: { type: 'under_budget_streak', days: context.underBudgetStreak },
    })
  }

  // Step 2: Gentle nudge trigger — spent more than 80% of daily budget (medium priority)
  if (context.todaySpentPercent > 80 && context.allowance.amount > 0) {
    candidates.push({
      id: 'spending-high-today',
      type: 'gentle_nudge',
      title: TIP_TITLES.gentle_nudge,
      message: "You've used most of today's budget. Maybe save the rest for later?",
      emoji: TIP_EMOJI.gentle_nudge,
      priority: 'medium',
      actionLabel: 'See breakdown',
      actionType: 'view_insight',
      triggerCondition: { type: 'category_spike', category: context.topCategory, percentIncrease: 80 },
    })
  }

  // Step 2b: Burn-rate velocity warning — spending pace would exhaust pool early (medium priority)
  if (
    context.recentBurnRate != null &&
    context.discretionaryPoolRemaining != null &&
    context.daysRemainingInMonth != null &&
    context.daysRemainingInMonth > 0 &&
    context.recentBurnRate > 0
  ) {
    const projectedSpend = context.recentBurnRate * context.daysRemainingInMonth
    if (projectedSpend > context.discretionaryPoolRemaining * 1.2) {
      candidates.push({
        id: 'burn-rate-warning',
        type: 'gentle_nudge',
        title: 'Pacing check',
        message:
          "At your recent pace, things might get tight before month-end. No stress — just a heads up so you can plan ahead.",
        emoji: TIP_EMOJI.pacing_check,
        priority: 'medium',
        actionLabel: 'See breakdown',
        actionType: 'view_insight',
        triggerCondition: {
          type: 'burn_rate_warning',
          projectedOverspend: projectedSpend - context.discretionaryPoolRemaining,
        },
      })
    }
  }

  // Step 2c-lb: Low-balance / overdraft heads-up — projected dip below the
  // configured buffer before payday (medium priority). Warm and non-shaming:
  // it's a gentle nudge to plan ahead, not a scolding about being "low".
  if (
    context.willDipBelowBuffer === true &&
    context.projectedLowBalance != null &&
    context.minBalanceBuffer != null
  ) {
    candidates.push({
      id: 'low-balance-until-payday',
      type: 'gentle_nudge',
      title: TIP_TITLES.gentle_nudge,
      message:
        "Money's a little tight until payday. No stress — spacing things out a bit will keep you comfortable.",
      emoji: TIP_EMOJI.low_balance,
      priority: 'medium',
      actionLabel: 'See breakdown',
      actionType: 'view_insight',
      triggerCondition: {
        type: 'low_balance_warning',
        projectedLowBalance: context.projectedLowBalance,
        buffer: context.minBalanceBuffer,
        daysUntilDip: context.daysUntilBalanceDip,
      },
    })
  }

  // Step 2c: Bill due-date reminder — soonest bill due within 3 days (medium priority)
  if (context.upcomingBills && context.upcomingBills.length > 0) {
    // Pick the soonest bill (lowest dueDay relative to today)
    const today = new Date()
    const currentDay = today.getDate()
    const sorted = [...context.upcomingBills].sort((a, b) => a.dueDay - b.dueDay)
    const soonest = sorted[0]
    const daysUntil = soonest.dueDay - currentDay

    if (daysUntil >= 0 && daysUntil <= 3) {
      const dayLabel = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
      candidates.push({
        id: `bill-due-${soonest.label}-${soonest.dueDay}`,
        type: 'gentle_nudge',
        title: 'Bill reminder',
        message: `Reminder — ${soonest.label} ($${soonest.amount}) is due ${dayLabel}. You've got this!`,
        emoji: TIP_EMOJI.bill_reminder,
        priority: 'medium',
        actionLabel: 'View details',
        actionType: 'view_insight',
        triggerCondition: { type: 'bill_due_soon', label: soonest.label, dueDay: soonest.dueDay, daysUntil },
      })
    }
  }

  // Step 2d: Subscription audit nudge — detected subscriptions the user hasn't reviewed (medium priority)
  if (
    context.detectedSubscriptions &&
    context.detectedSubscriptions.count > 0 &&
    context.detectedSubscriptions.monthlyTotal > 0
  ) {
    const { count, monthlyTotal } = context.detectedSubscriptions
    candidates.push({
      id: 'subscription-audit-nudge',
      type: 'gentle_nudge',
      title: 'Subscription check-in',
      message: `You have ${count} subscription${count !== 1 ? 's' : ''} totaling $${Math.round(monthlyTotal)}/mo — want to check they're all worth keeping?`,
      emoji: TIP_EMOJI.subscription_audit,
      priority: 'medium',
      actionLabel: 'Review subscriptions',
      actionType: 'view_insight',
      triggerCondition: { type: 'subscription_audit', count, monthlyTotal },
    })
  }

  // Step 3: Educational trigger — fewer than 10 total transactions (low priority)
  if (context.totalTransactions < 10) {
    candidates.push({
      id: 'getting-started-tip',
      type: 'did_you_know',
      title: TIP_TITLES.did_you_know,
      message: 'Tap any category to log an expense. Your most common amounts will appear automatically.',
      emoji: TIP_EMOJI.did_you_know,
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
