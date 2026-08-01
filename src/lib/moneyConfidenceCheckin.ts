/**
 * Money Confidence Check-In (Task 155.1)
 *
 * A gentle, optional, and *infrequent* "how's it going?" reflection that
 * celebrates the user's progress and points to a single warm next step.
 *
 * It deliberately reuses the existing contextual-tip infrastructure
 * (see `tipUtils.selectContextualTip` + `ContextualTipCard`) rather than
 * introducing any new UI or state patterns:
 *   - Frequency is throttled here with a localStorage "last shown" timestamp
 *     (at most once every {@link CHECKIN_INTERVAL_DAYS} days).
 *   - Dismissal is handled by the shared dismissed-tips mechanism; the tip id
 *     embeds the current cycle token so a dismissal only suppresses the current
 *     window, never the feature forever.
 *
 * Everything here is warm and shame-free — it only ever celebrates and
 * encourages, never scolds.
 */

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for the timestamp (ms) the check-in was last shown. */
const LAST_SHOWN_KEY = 'folio-money-confidence-last-shown'

/** Minimum spacing between check-ins, in days (infrequent by design). */
export const CHECKIN_INTERVAL_DAYS = 14

/** Milliseconds in the check-in interval. */
const CHECKIN_INTERVAL_MS = CHECKIN_INTERVAL_DAYS * 24 * 60 * 60 * 1000

/**
 * Minimum number of logged transactions before the check-in is eligible.
 * Ensures brand-new users aren't reflected at before they have anything to
 * reflect on — the moment should feel earned, not premature.
 */
const MIN_TRANSACTIONS_FOR_CHECKIN = 8

// ============================================================================
// Frequency / throttle guards
// ============================================================================

/**
 * Returns true when a money-confidence check-in is eligible to show:
 *   - the user has enough history to make a reflection meaningful, and
 *   - it's been at least {@link CHECKIN_INTERVAL_DAYS} days since the last one.
 *
 * Purely optional — callers gate on this before ever surfacing the check-in.
 */
export function shouldShowMoneyConfidenceCheckin(totalTransactions: number): boolean {
  if (totalTransactions < MIN_TRANSACTIONS_FOR_CHECKIN) return false
  if (typeof window === 'undefined') return false
  try {
    const lastShown = localStorage.getItem(LAST_SHOWN_KEY)
    if (!lastShown) return true
    return Date.now() - Number(lastShown) >= CHECKIN_INTERVAL_MS
  } catch {
    return false
  }
}

/**
 * Records that the check-in was shown, resetting the interval timer so the
 * next one is at least {@link CHECKIN_INTERVAL_DAYS} days away.
 */
export function markMoneyConfidenceCheckinShown(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
  } catch {
    // best-effort — throttling degrades gracefully if storage is unavailable
  }
}

/**
 * Returns a stable token identifying the current check-in "cycle" (a
 * {@link CHECKIN_INTERVAL_DAYS}-day window). Embedded in the tip id so that a
 * dismissal only hides the current cycle's check-in, never all future ones.
 */
export function getMoneyConfidenceCycle(now: Date = new Date()): string {
  const periodIndex = Math.floor(now.getTime() / CHECKIN_INTERVAL_MS)
  return `c${periodIndex}`
}

// ============================================================================
// Copy generation (pure)
// ============================================================================

/** Inputs used to craft a warm, personalised check-in message + next step. */
export interface MoneyConfidenceInput {
  /** Consecutive days under budget (0 in tracker mode / when over budget). */
  underBudgetStreak: number
  /** Total transactions the user has ever logged. */
  totalTransactions: number
  /** Whether the user has at least one active savings goal. */
  hasGoals: boolean
}

/** The pieces the tip needs, derived from the user's current state. */
export interface MoneyConfidenceContent {
  /** Warm, progress-celebrating message with one gentle next step. */
  message: string
  /** Label for the single suggested next step (optional). */
  actionLabel?: string
  /** Action type routed by the ContextualTipCard/HomeScreen. */
  actionType?: 'set_goal' | 'adjust_budget' | 'view_insight' | 'learn_more'
  /** Related lesson id when the next step is "learn more". */
  relatedLessonId?: string
}

/**
 * Builds the check-in copy from the user's current state.
 *
 * Always leads with something genuine to celebrate, then offers exactly ONE
 * next step. Tone is warm and shame-free — there is no "bad" branch.
 *
 * This is a pure function (no I/O) so it's trivial to reason about and reuse.
 */
export function buildMoneyConfidenceCheckin(input: MoneyConfidenceInput): MoneyConfidenceContent {
  const { underBudgetStreak, totalTransactions, hasGoals } = input

  // ── Lead with a genuine, specific win ────────────────────────────────────
  let celebration: string
  if (underBudgetStreak >= 3) {
    celebration = `You've stayed comfy for ${underBudgetStreak} days straight — that's real momentum.`
  } else if (totalTransactions >= 50) {
    celebration = `You've logged ${totalTransactions} times now. Knowing where your money goes is a superpower.`
  } else {
    celebration = "You've been showing up and keeping an eye on things — that's what builds confidence."
  }

  // ── Offer exactly one gentle next step ───────────────────────────────────
  // The next step is routed through the shared "learn_more" action (the path
  // wired end-to-end in HomeScreen → onOpenLesson), so the suggestion always
  // leads somewhere useful without adding any new navigation plumbing.
  if (!hasGoals) {
    return {
      message: `${celebration} Ready for a gentle next step? Pointing a little aside for something you want can feel great.`,
      actionLabel: 'Show me how',
      actionType: 'learn_more',
      relatedLessonId: 'emergency-fund',
    }
  }

  return {
    message: `${celebration} Ready for a gentle next step? A quick refresher can make next month feel even easier.`,
    actionLabel: 'Quick tip',
    actionType: 'learn_more',
    relatedLessonId: 'budgeting-101',
  }
}
