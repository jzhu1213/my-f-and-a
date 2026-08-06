/**
 * If-this-then-that trigger engine — event-driven suggestions.
 * ============================================================================
 *
 * Task 189.1. A tiny, deterministic rules engine that maps *events* the app
 * detects (a paycheck landing, a day running over budget) to at most **one**
 * gentle, opt-in suggestion — and never more than one at a time.
 *
 * This is the "teach the app once" idea from Group 26 applied to nudges: when
 * something happens, offer a single helpful next step. It deliberately reuses
 * the existing notification / reminder centre (Phase 3 task 134.1,
 * `smartNotifications.ts` / `useSmartNotifications`) as its surface rather than
 * inventing a new one — the engine only *decides* what to suggest; firing and
 * permission handling stay in the notification layer.
 *
 * Guardrails baked into every rule:
 *   - **Opt-in.** Every rule is off by default; the user turns it on.
 *   - **One at a time.** `selectTriggerSuggestion` returns a single suggestion,
 *     picking the highest-priority eligible rule. Prompts never stack.
 *   - **Gentle & shame-free.** Copy is warm and non-judgemental (a rough day is
 *     "ran a little high", never "you overspent").
 *   - **Reversible.** Suggestions only ever *offer* an action; nothing is moved
 *     or changed without the user tapping through.
 *   - **Deduped.** Each rule fires at most once per its natural cadence (payday
 *     nudge once per month, overspend nudge once per day).
 *
 * The computation layer is intentionally PURE and deterministic: no I/O, no
 * `localStorage`, no wall-clock reads inside the decision (`now` is passed in).
 * Persistence lives in the clearly separated section at the bottom, mirroring
 * the pattern established by `reminderPreferences.ts` and `smartNotifications.ts`.
 *
 * Requirements: new (extends Phase 3 tasks 160.1, 134.1)
 */

// ============================================================================
// Events
// ============================================================================

/** The kinds of events the engine can react to. */
export type TriggerEventType = "payday_detected" | "overspend"

/**
 * A paycheck just landed (income logged today, or a scheduled payday). Carries
 * the retirement accounts (Roth IRA / 401k) that still have room toward their
 * monthly contribution target, so the engine can offer to top the biggest gap.
 */
export interface PaydayDetectedEvent {
  type: "payday_detected"
  /** Under-funded retirement accounts, each with dollars still to contribute. */
  underfundedRetirement: {
    accountId: string
    name: string
    /** Remaining toward this month's contribution target (> 0). */
    remaining: number
  }[]
}

/**
 * Today's spending ran over the daily budget. Carries how far over, plus
 * whether the user already has a buffer/sinking fund to route toward (changes
 * the copy between "top up" and "set one up").
 */
export interface OverspendEvent {
  type: "overspend"
  /** Dollars spent beyond today's daily budget (> 0). */
  overspendAmount: number
  /** Whether the user has at least one existing sinking fund / buffer. */
  hasBufferFund: boolean
}

/** Any event the engine understands. */
export type TriggerEvent = PaydayDetectedEvent | OverspendEvent

// ============================================================================
// Suggestions
// ============================================================================

/** Stable identifiers for each rule — used for prefs, dedupe, and engagement. */
export type TriggerRuleId = "payday_roth" | "overspend_fund"

/**
 * A single suggestion produced by the engine. The `title` / `body` / `tag`
 * fields are shaped to drop straight into the notification centre's
 * `NotificationPayload`, so no adapter is needed at the call site.
 */
export interface TriggerSuggestion {
  /** Which rule produced this suggestion. */
  ruleId: TriggerRuleId
  /** The event type that fired it. */
  eventType: TriggerEventType
  /** Notification title (always the app name, matching existing notifications). */
  title: string
  /** Warm, shame-free body copy. */
  body: string
  /** Notification tag (dedupe/replace key for the browser). */
  tag: string
  /** Suggested action label the UI/notification can surface. */
  actionLabel: string
  /**
   * The dedupe key for this firing (e.g. `YYYY-MM` for payday, `YYYY-MM-DD` for
   * overspend). Persisted on fire so the same rule won't re-fire this cadence.
   */
  dedupeKey: string
}

// ============================================================================
// Preferences
// ============================================================================

/**
 * Opt-in switches and per-rule dedupe state. Every rule defaults to OFF — the
 * engine stays silent until the user turns a rule on in Settings.
 */
export interface TriggerPreferences {
  /** Payday → offer to fund a Roth/retirement account (default: off). */
  paydayRothEnabled: boolean
  /** Overspend → suggest a buffer / sinking fund (default: off). */
  overspendFundEnabled: boolean
  /** The last dedupe key each rule fired for (prevents repeats within cadence). */
  lastFired: {
    /** `YYYY-MM` the payday-Roth nudge last fired. */
    paydayRoth: string | null
    /** `YYYY-MM-DD` the overspend-fund nudge last fired. */
    overspendFund: string | null
  }
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_trigger_prefs"

const DEFAULT_PREFS: TriggerPreferences = {
  paydayRothEnabled: false,
  overspendFundEnabled: false,
  lastFired: {
    paydayRoth: null,
    overspendFund: null,
  },
}

/**
 * Rule priority. When more than one rule is eligible in the same pass, the
 * higher number wins — so at most one suggestion is ever returned. Payday is
 * a positive, forward-looking moment, so it outranks the overspend nudge.
 */
const RULE_PRIORITY: Record<TriggerRuleId, number> = {
  payday_roth: 2,
  overspend_fund: 1,
}

// ============================================================================
// Small pure helpers
// ============================================================================

/** `YYYY-MM` for a date — the payday nudge's once-per-month dedupe key. */
function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7)
}

/** `YYYY-MM-DD` for a date — the overspend nudge's once-per-day dedupe key. */
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Round to a whole-dollar display string (e.g. 50 → "$50"). */
function formatDollars(amount: number): string {
  return `$${Math.max(0, Math.round(amount))}`
}

/** Find events of a given type without losing their narrowed type. */
function findEvent<T extends TriggerEvent["type"]>(
  events: TriggerEvent[],
  type: T
): Extract<TriggerEvent, { type: T }> | undefined {
  return events.find((e) => e.type === type) as
    | Extract<TriggerEvent, { type: T }>
    | undefined
}

// ============================================================================
// Rule evaluation (pure)
// ============================================================================

/**
 * Build the payday → fund-your-Roth suggestion, or null when the rule isn't
 * eligible (disabled, no under-funded retirement account, no payday event, or
 * already nudged this month). Targets the account with the largest remaining
 * gap so a single tap makes the most progress.
 */
function evaluatePaydayRoth(
  events: TriggerEvent[],
  prefs: TriggerPreferences,
  now: Date
): TriggerSuggestion | null {
  if (!prefs.paydayRothEnabled) return null

  const event = findEvent(events, "payday_detected")
  if (!event) return null

  // Only the accounts that still have room, biggest gap first.
  const candidates = event.underfundedRetirement
    .filter((a) => a.remaining > 0.005)
    .sort((a, b) => b.remaining - a.remaining)
  if (candidates.length === 0) return null

  const key = monthKey(now)
  if (prefs.lastFired.paydayRoth === key) return null

  const top = candidates[0]
  const body =
    candidates.length === 1
      ? `Payday 🎉 Want to move ${formatDollars(top.remaining)} toward your ${top.name} this month? Future you will thank you.`
      : `Payday 🎉 Your ${top.name} has ${formatDollars(top.remaining)} of room left this month — want to top it up?`

  return {
    ruleId: "payday_roth",
    eventType: "payday_detected",
    title: "Folio",
    body,
    tag: "folio-trigger-payday-roth",
    actionLabel: "Fund it",
    dedupeKey: key,
  }
}

/**
 * Build the overspend → set-aside-a-buffer suggestion, or null when the rule
 * isn't eligible (disabled, no overspend event, or already nudged today).
 * Copy stays warm — a rough day "ran a little high", never a scolding.
 */
function evaluateOverspendFund(
  events: TriggerEvent[],
  prefs: TriggerPreferences,
  now: Date
): TriggerSuggestion | null {
  if (!prefs.overspendFundEnabled) return null

  const event = findEvent(events, "overspend")
  if (!event) return null
  if (event.overspendAmount <= 0.005) return null

  const key = dayKey(now)
  if (prefs.lastFired.overspendFund === key) return null

  const body = event.hasBufferFund
    ? "Today ran a little high — no stress, tomorrow resets. Topping up a buffer fund can smooth days like this. Want to add a bit?"
    : "Today ran a little high — no stress, tomorrow resets. A small buffer fund can soften days like this. Want to set one up?"

  return {
    ruleId: "overspend_fund",
    eventType: "overspend",
    title: "Folio",
    body,
    tag: "folio-trigger-overspend-fund",
    actionLabel: event.hasBufferFund ? "Top up a fund" : "Set up a fund",
    dedupeKey: key,
  }
}

/** All rule evaluators, in no particular order (priority sorts the winner). */
const RULE_EVALUATORS: ((
  events: TriggerEvent[],
  prefs: TriggerPreferences,
  now: Date
) => TriggerSuggestion | null)[] = [evaluatePaydayRoth, evaluateOverspendFund]

/**
 * Decide the single suggestion to surface for the given events.
 *
 * Evaluates every rule, keeps only those that are enabled, matched by an event,
 * and not already fired this cadence, then returns the **highest-priority** one
 * (or null when nothing qualifies). This is the "one at a time" guarantee — the
 * engine never returns more than one suggestion.
 *
 * Pure: no side effects, no persistence, no wall-clock reads (pass `now`).
 */
export function selectTriggerSuggestion(
  events: TriggerEvent[],
  prefs: TriggerPreferences,
  now: Date
): TriggerSuggestion | null {
  if (!events.length) return null

  let best: TriggerSuggestion | null = null
  let bestPriority = -Infinity

  for (const evaluate of RULE_EVALUATORS) {
    const suggestion = evaluate(events, prefs, now)
    if (!suggestion) continue
    const priority = RULE_PRIORITY[suggestion.ruleId]
    if (priority > bestPriority) {
      best = suggestion
      bestPriority = priority
    }
  }

  return best
}

// ============================================================================
// Persistence (localStorage) — mirrors reminderPreferences / smartNotifications
// ============================================================================

/**
 * Load trigger preferences from localStorage, merged over defaults so older or
 * partial records degrade gracefully. Returns defaults during SSR.
 */
export function getTriggerPreferences(): TriggerPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFS
    const parsed = JSON.parse(stored) as Partial<TriggerPreferences>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      lastFired: {
        ...DEFAULT_PREFS.lastFired,
        ...(parsed.lastFired ?? {}),
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** Persist trigger preferences. Fails silently if storage is unavailable. */
export function setTriggerPreferences(prefs: TriggerPreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently.
  }
}

/**
 * Mark a rule as fired for a given dedupe key so it won't re-fire within its
 * cadence (payday nudge per month, overspend nudge per day). No-op for unknown
 * rules.
 */
export function markTriggerFired(ruleId: TriggerRuleId, dedupeKey: string): void {
  const prefs = getTriggerPreferences()
  if (ruleId === "payday_roth") {
    prefs.lastFired.paydayRoth = dedupeKey
  } else if (ruleId === "overspend_fund") {
    prefs.lastFired.overspendFund = dedupeKey
  } else {
    return
  }
  setTriggerPreferences(prefs)
}

/** Toggle a single rule on/off (the reversible opt-in switch). */
export function setTriggerRuleEnabled(ruleId: TriggerRuleId, enabled: boolean): void {
  const prefs = getTriggerPreferences()
  if (ruleId === "payday_roth") {
    prefs.paydayRothEnabled = enabled
  } else if (ruleId === "overspend_fund") {
    prefs.overspendFundEnabled = enabled
  } else {
    return
  }
  setTriggerPreferences(prefs)
}
