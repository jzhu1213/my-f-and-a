import type { Transaction, TransactionCategory } from '@/types'
import type { ContextualTip, DailyAllowance } from '@/types/folio'
import type { FundingSource } from '@/lib/fundingSources'
import { TIP_EMOJI, TIP_TITLES } from '@/lib/vocabulary'

// ============================================================================
// Tip Cooldown & Throttle (Task 75)
// ============================================================================

/** localStorage key for the timestamp of the last tip shown. */
const LAST_TIP_SHOWN_KEY = 'folio-last-tip-shown-ts'
/** localStorage key for the ID of the last tip shown. */
const LAST_TIP_ID_KEY = 'folio-last-tip-id'
/** localStorage key for the "spending-high shown today" date guard. */
const SPENDING_HIGH_SHOWN_KEY = 'folio-spending-high-shown-date'
/** localStorage key tracking how many app opens since first open (for educational tip). */
const APP_OPEN_COUNT_KEY = 'folio-app-open-count'
/** Minimum cooldown in milliseconds between showing tips (6 hours). */
const TIP_COOLDOWN_MS = 6 * 60 * 60 * 1000
/** Maximum number of opens that will show the educational tip. */
const EDUCATIONAL_TIP_MAX_OPENS = 3
/** Streak milestones at which the celebration tip fires. */
const STREAK_MILESTONES = new Set([3, 7, 14, 30])

// ── Per-session state (resets on page reload / app open) ────────────────────
let sessionTipShown = false

/**
 * Marks that a tip was shown in the current session. Called from the HomeScreen
 * after rendering a ContextualTipCard.
 */
export function markSessionTipShown(): void {
  sessionTipShown = true
}

/**
 * Returns whether a tip has already been shown in the current session.
 */
export function hasSessionTipBeenShown(): boolean {
  return sessionTipShown
}

/**
 * Records the timestamp and ID of the last tip shown (persisted to localStorage).
 */
export function recordTipShown(tipId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_TIP_SHOWN_KEY, String(Date.now()))
    localStorage.setItem(LAST_TIP_ID_KEY, tipId)
  } catch {
    // localStorage unavailable — best-effort
  }
}

/**
 * Checks whether the cooldown period has elapsed since the last tip was shown.
 * Returns true if a new tip may be displayed.
 */
export function isTipCooldownElapsed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const lastShown = localStorage.getItem(LAST_TIP_SHOWN_KEY)
    if (!lastShown) return true
    return Date.now() - Number(lastShown) >= TIP_COOLDOWN_MS
  } catch {
    return true
  }
}

/**
 * Returns the tip ID that was last shown to the user (or null if unknown).
 */
export function getLastTipId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_TIP_ID_KEY)
  } catch {
    return null
  }
}

/**
 * Gate function: determines if contextual content should render at all.
 * Combines cooldown, session, and novelty checks.
 *
 * @param candidateTipId - The ID of the tip that would be shown (for novelty check)
 */
export function shouldShowContextualContent(candidateTipId: string | null): boolean {
  if (!candidateTipId) return false
  // Already shown a tip this session — keep the home screen clean.
  if (sessionTipShown) return false
  // Cooldown not elapsed — too soon since last tip.
  if (!isTipCooldownElapsed()) return false
  // Same tip as last time — not genuinely new/relevant.
  if (candidateTipId === getLastTipId()) return false
  return true
}

/**
 * Increments the app-open counter (called once per mount in HomeScreen).
 * Returns the new count.
 */
export function incrementAppOpenCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const current = Number(localStorage.getItem(APP_OPEN_COUNT_KEY) ?? '0')
    const next = current + 1
    localStorage.setItem(APP_OPEN_COUNT_KEY, String(next))
    return next
  } catch {
    return 0
  }
}

/**
 * Returns the current app-open count without incrementing.
 */
export function getAppOpenCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    return Number(localStorage.getItem(APP_OPEN_COUNT_KEY) ?? '0')
  } catch {
    return 0
  }
}

/**
 * Marks the spending-high tip as shown today (date-based guard).
 */
function markSpendingHighShownToday(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SPENDING_HIGH_SHOWN_KEY, new Date().toISOString().slice(0, 10))
  } catch {
    // best-effort
  }
}

/**
 * Returns true if the spending-high tip has already been shown today.
 */
function wasSpendingHighShownToday(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SPENDING_HIGH_SHOWN_KEY) === new Date().toISOString().slice(0, 10)
  } catch {
    return false
  }
}

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
  /**
   * Signals a lump-sum income spike: a single income transaction in the current
   * month that is more than 2× the trailing-average monthly income. When set,
   * the lump_income_spike tip is eligible to fire.
   */
  lumpIncomeSpikeAmount?: number
  /** The trailing-average monthly income used as baseline for spike detection. */
  lumpIncomeBaselineAverage?: number
  /**
   * Source-spending breakdown for the current month. When set, the
   * source_breakdown tip is eligible to fire. Computed upstream from this
   * month's expense transactions matched against credit-kind funding sources.
   */
  sourceBreakdown?: { creditPercent: number; creditTotal: number; monthlyIncome: number }
}

/** Inputs required to derive a {@link UserContext} for tip selection. */
export interface BuildUserContextParams {
  /** All of the user's transactions (any order). */
  transactions: Transaction[]
  /** The computed daily allowance, or null while loading. */
  allowance: DailyAllowance | null
  /** Consecutive days under budget (already derived elsewhere). */
  underBudgetStreak: number
  /** Bills due within the next 3 days. */
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  /**
   * The "today" date as a `YYYY-MM-DD` string. Injected so callers can memoize
   * it once per render pass and keep this function pure/deterministic.
   */
  today: string
  /** User's funding sources (used to compute source-spending breakdown). */
  fundingSources?: FundingSource[]
}

/**
 * Derives the {@link UserContext} used to pick a contextual tip.
 *
 * This is a pure function: given the same inputs it always returns the same
 * result and performs no I/O. It makes a single pass over `transactions` to
 * accumulate today's spend-by-category (avoiding a separate filter + reduce),
 * then derives the top category and today's spent percentage.
 *
 * Business logic lives here (per the Folio guidelines) rather than inline in
 * the HomeScreen component body, and keeping it out of the component means it
 * only re-runs when its memo dependencies actually change.
 */
export function buildUserContext(params: BuildUserContextParams): UserContext {
  const { transactions, allowance, underBudgetStreak, upcomingBills, today, fundingSources } = params

  // Single pass: accumulate today's expense spend per category.
  const categorySpend: Partial<Record<TransactionCategory, number>> = {}
  let topCategory: TransactionCategory = 'food'
  let topCategoryTotal = 0
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date.startsWith(today)) continue
    const next = (categorySpend[tx.category] ?? 0) + tx.amount
    categorySpend[tx.category] = next
    if (next > topCategoryTotal) {
      topCategoryTotal = next
      topCategory = tx.category
    }
  }

  const dailyBudget = allowance?.dailyBudget ?? 0
  const spentToday = allowance?.spentToday ?? 0
  const todaySpentPercent = dailyBudget > 0 ? (spentToday / dailyBudget) * 100 : 0

  // Compute source-spending breakdown for the current month if funding sources are available.
  let sourceBreakdown: UserContext['sourceBreakdown']
  if (fundingSources && fundingSources.length > 0) {
    const currentMonthPrefix = today.slice(0, 7) // "YYYY-MM"
    const creditSourceIds = new Set(
      fundingSources.filter(s => s.kind === 'credit').map(s => s.id)
    )

    if (creditSourceIds.size > 0) {
      let totalMonthSpending = 0
      let creditSpending = 0
      let monthlyIncome = 0

      for (const tx of transactions) {
        if (!tx.date.startsWith(currentMonthPrefix)) continue
        if (tx.type === 'expense') {
          totalMonthSpending += tx.amount
          if (tx.fundingSourceId && creditSourceIds.has(tx.fundingSourceId)) {
            creditSpending += tx.amount
          }
        } else if (tx.type === 'income') {
          monthlyIncome += tx.amount
        }
      }

      if (totalMonthSpending > 0) {
        const creditPercent = Math.round((creditSpending / totalMonthSpending) * 100)
        if (creditPercent >= 40) {
          sourceBreakdown = { creditPercent, creditTotal: creditSpending, monthlyIncome }
        }
      }
    }
  }

  return {
    underBudgetStreak,
    todaySpentPercent,
    totalTransactions: transactions.length,
    topCategory,
    allowance: {
      amount: allowance?.amount ?? 0,
      dailyBudget,
    },
    upcomingBills,
    sourceBreakdown,
  }
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

  // Step 1: Celebration trigger — streak at milestone days under budget (high priority).
  // Only fires at meaningful milestones (3, 7, 14, 30) — not every day after day 3.
  // Note: when the user is over budget today their `underBudgetStreak` resets to 0,
  // so celebration tips naturally won't fire on over-budget days — no extra guard needed.
  if (context.underBudgetStreak >= 3 && STREAK_MILESTONES.has(context.underBudgetStreak)) {
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

  // Step 2a: Over-budget tip — spent >= 100% of daily budget (medium priority).
  // The near-budget message ("save the rest for later") is inaccurate when there is
  // nothing left, so we use a distinct tip ID and shame-free copy that points to a
  // practical next step (logging income extends today's pool).
  if (context.todaySpentPercent >= 100) {
    candidates.push({
      id: 'over-budget-today',
      type: 'gentle_nudge',
      title: TIP_TITLES.gentle_nudge,
      message:
        "Today's a little tight — tomorrow resets fresh. Logging income adds to today's pool if you need it.",
      emoji: TIP_EMOJI.low_balance,
      priority: 'medium',
      actionLabel: 'See breakdown',
      actionType: 'view_insight',
      triggerCondition: { type: 'over_budget_today' },
    })
  }

  // Step 2b: Near-budget nudge — spent 80–99% of daily budget (medium priority).
  // Only fires when the user is close but has something left to preserve.
  // Guard: only show once per day to avoid nagging on every open.
  if (
    context.todaySpentPercent > 80 &&
    context.todaySpentPercent < 100 &&
    context.allowance.amount > 0 &&
    !wasSpendingHighShownToday()
  ) {
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

  // Step 2c: Burn-rate velocity warning — spending pace would exhaust pool early (medium priority)
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
          "At your recent pace, things might get tight before month-end. Spacing out big purchases will keep you comfortable.",
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

  // Step 2d-lb: Low-balance / overdraft heads-up — projected dip below the
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
        "Money's a little tight until payday. Spacing things out will keep you comfortable — and you can always log income to add to today's pool.",
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

  // Step 2e: Bill due-date reminder — soonest bill due within 3 days (medium priority)
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

  // Step 2f-li: Lump-sum income spike — a single income transaction > 2× trailing average (medium priority).
  // Use a per-month tip ID so it fires at most once per income event (dismissed-tips pattern).
  if (
    context.lumpIncomeSpikeAmount != null &&
    context.lumpIncomeSpikeAmount > 0 &&
    context.lumpIncomeBaselineAverage != null
  ) {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7)
    candidates.push({
      id: `lump-income-${currentMonthPrefix}`,
      type: 'celebration',
      title: 'Big payment landed',
      message:
        "Looks like a big payment came in 🎉 Your daily budget uses a 3-month average, so the number stays steady. You can save the extra or adjust the split in Settings.",
      emoji: TIP_EMOJI.lump_income,
      priority: 'medium',
      actionLabel: 'Adjust in Settings',
      actionType: 'view_insight',
      triggerCondition: {
        type: 'lump_income_spike',
        spikeAmount: context.lumpIncomeSpikeAmount,
        averageMonthlyIncome: context.lumpIncomeBaselineAverage,
      },
    })
  }

  // Step 2g: Subscription audit nudge — detected subscriptions the user hasn't reviewed (medium priority)
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

  // Step 2h: Source-spending breakdown — credit spending >= 40% of month (low priority, once/month)
  // Uses a month-prefix tip ID so the dismissed-tips mechanism ensures at most once per month.
  if (context.sourceBreakdown) {
    const { creditPercent, creditTotal, monthlyIncome } = context.sourceBreakdown
    const currentMonthPrefix = new Date().toISOString().slice(0, 7)
    const creditExceedsIncome = monthlyIncome > 0 && creditTotal > monthlyIncome

    const message = creditExceedsIncome
      ? `Credit spending ($${Math.round(creditTotal)}) is outpacing your income this month ($${Math.round(monthlyIncome)}). Worth a look to stay ahead of it.`
      : `${creditPercent}% of this month's spending went on credit ($${Math.round(creditTotal)}). Not a problem if you clear it monthly!`

    candidates.push({
      id: `source-breakdown-${currentMonthPrefix}`,
      type: 'did_you_know',
      title: 'Source check-in',
      message,
      emoji: TIP_EMOJI.source_breakdown,
      priority: 'low',
      actionLabel: 'See breakdown',
      actionType: 'view_insight',
      triggerCondition: { type: 'source_breakdown', creditPercent, creditTotal, monthlyIncome },
    })
  }

  // Step 3: Educational trigger — fewer than 10 total transactions (low priority)
  // Only shows on the first few app opens to avoid nagging new users.
  if (context.totalTransactions < 10 && getAppOpenCount() <= EDUCATIONAL_TIP_MAX_OPENS) {
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
  const winner = available[0] ?? null

  // Side-effect: mark spending-high as shown today so it doesn't nag on re-opens.
  if (winner?.id === 'spending-high-today') {
    markSpendingHighShownToday()
  }

  return winner
}
