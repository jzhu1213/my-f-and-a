import type { Goal } from '@/types'
import type { SinkingFund } from './sinkingFunds'
import { computeRoundUp } from './roundUpSavings'
import type { AutoContributeRule } from './autoContributeUtils'

/**
 * Rule-driven virtual transfers between buckets/funds — pure engine.
 * ============================================================================
 *
 * Task 188.1. This is the "v2" generalization of two earlier, single-purpose
 * automations:
 *
 *   - `roundUpSavings` (Phase 2 task 112.2): rounds each expense up to the
 *     nearest dollar and routes the spare change to one goal.
 *   - `autoContributeUtils` (Phase 3 task 149.1): moves a fixed amount into a
 *     goal every payday.
 *
 * Both are just special cases of the same idea: *when something happens, move
 * some money into a bucket*. This module unifies them into a single,
 * user-configurable rule model that supports:
 *
 *   - multiple trigger types (payday, monthly cadence, per-expense, manual)
 *   - multiple amount modes (fixed dollars, percentage, round-up spare change)
 *   - any goal OR sinking fund as the destination "bucket"
 *   - an optional source bucket for genuine bucket-to-bucket moves
 *
 * These are *virtual* transfers: they move money between Folio's own
 * containers, never touching a real bank (no linking required). Every rule is
 * user-created, visible, toggleable, and reversible — nothing runs that the
 * user didn't opt into.
 *
 * The computation layer is intentionally PURE and deterministic: no I/O, no
 * `localStorage`, no `Date.now()` inside the math. Persistence lives in the
 * clearly separated section at the bottom, mirroring the pattern established by
 * `categorizationRules.ts` and `autoContributeUtils.ts`.
 */

// ============================================================================
// Model
// ============================================================================

/** The two kinds of money containers a transfer can move between. */
export type TransferBucketType = 'goal' | 'sinkingFund'

/** A reference to a specific goal or sinking fund. */
export interface TransferEndpoint {
  type: TransferBucketType
  id: string
}

/**
 * What kicks a rule off.
 *  - `payday`   : income was just logged (generalizes auto-contribute).
 *  - `expense`  : an expense was just logged (generalizes round-ups).
 *  - `monthly`  : a scheduled once-a-month move (calendar cadence).
 *  - `manual`   : only runs when the user taps "run now".
 */
export type TransferTrigger = 'payday' | 'expense' | 'monthly' | 'manual'

/**
 * How the transfer amount is derived.
 *  - `fixed`   : a flat dollar amount (`amountValue`).
 *  - `percent` : a percentage (`amountValue`, 0–100) of the triggering
 *                income/expense amount.
 *  - `roundup` : the spare change from rounding the triggering expense up to
 *                the next whole dollar (only meaningful with an `expense`
 *                trigger).
 */
export type TransferAmountMode = 'fixed' | 'percent' | 'roundup'

/**
 * A single user-defined transfer rule.
 *
 * Backward-compatibility note: every field beyond the original round-up /
 * auto-contribute concepts is additive, and the persisted shape is validated
 * defensively on load so older/partial records degrade gracefully.
 */
export interface TransferRule {
  id: string
  /** Friendly, user-facing name, e.g. "Round-ups → Travel". */
  label: string
  /** Whether the rule currently runs. Disabling is the reversible "off". */
  enabled: boolean
  trigger: TransferTrigger
  amountMode: TransferAmountMode
  /** Dollars for `fixed`, percent (0–100) for `percent`; ignored for `roundup`. */
  amountValue: number
  /** Where the money lands. */
  destination: TransferEndpoint
  /**
   * Optional source bucket for bucket-to-bucket moves. When omitted, the
   * money comes from the user's general/discretionary pool (same behavior as
   * the original round-up and auto-contribute features).
   */
  source?: TransferEndpoint | null
  /**
   * For `monthly` rules: the last `YYYY-MM` the rule was applied, so a cadence
   * only fires once per month. Undefined until it first runs.
   */
  lastAppliedMonth?: string
  createdAt: string
}

/** Payload for creating a rule (id/createdAt assigned on save). */
export type TransferRuleDraft = Omit<TransferRule, 'id' | 'createdAt' | 'lastAppliedMonth'>

/**
 * A snapshot of a bucket's balance, used by the pure compute layer so it stays
 * decoupled from the concrete `Goal` / `SinkingFund` shapes.
 */
export interface TransferBucket {
  type: TransferBucketType
  id: string
  name: string
  emoji?: string
  /** Money currently in the bucket. */
  currentAmount: number
  /** The bucket's target (used to cap deposits at capacity). */
  targetAmount: number
}

/** A computed, ready-to-apply transfer. */
export interface PlannedTransfer {
  ruleId: string
  ruleLabel: string
  /** Resolved destination bucket. */
  destination: TransferBucket
  /** Resolved source bucket, when the rule moves between buckets. */
  source?: TransferBucket
  /** The actual amount to move (already capped by capacity/availability). */
  amount: number
}

/** Context describing the event that may trigger rules. */
export interface TransferContext {
  /** Income just logged — enables `payday` (and percent-of-income) rules. */
  incomeAmount?: number
  /** Expense just logged — enables `expense`/round-up rules. */
  expenseAmount?: number
  /** Reference date for scheduled `monthly` rules. Defaults to now. */
  now?: Date
}

/** Result of validating a draft. */
export interface TransferRuleValidation {
  valid: boolean
  errors: string[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-transfer-rules'

/** Matches the app's transaction amount ceiling. */
const MAX_AMOUNT = 99999

// ============================================================================
// Small pure helpers
// ============================================================================

/** Round to 2 decimal places (cents). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** `YYYY-MM` for a given date (UTC), consistent with the rest of the app. */
function monthKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Remaining capacity of a bucket before it hits its target. Never negative. */
function remainingCapacity(bucket: TransferBucket): number {
  if (bucket.targetAmount <= 0) return Infinity // no target => no cap
  return Math.max(0, bucket.targetAmount - bucket.currentAmount)
}

// ============================================================================
// Bucket adapters — bridge concrete models into the generic TransferBucket
// ============================================================================

/** Adapt a savings/emergency/shared `Goal` into a generic bucket. */
export function goalToBucket(goal: Goal): TransferBucket {
  return {
    type: 'goal',
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    currentAmount: goal.currentAmount,
    targetAmount: goal.targetAmount,
  }
}

/** Adapt a `SinkingFund` into a generic bucket. */
export function sinkingFundToBucket(fund: SinkingFund): TransferBucket {
  return {
    type: 'sinkingFund',
    id: fund.id,
    name: fund.label,
    currentAmount: fund.savedAmount,
    targetAmount: fund.targetAmount,
  }
}

/**
 * Build the full bucket list from the user's goals and sinking funds. This is
 * the input the compute layer resolves rule endpoints against.
 */
export function buildTransferBuckets(
  goals: Goal[] = [],
  funds: SinkingFund[] = []
): TransferBucket[] {
  return [...goals.map(goalToBucket), ...funds.map(sinkingFundToBucket)]
}

/** Find a bucket by endpoint reference. */
function findBucket(
  buckets: TransferBucket[],
  endpoint: TransferEndpoint | null | undefined
): TransferBucket | undefined {
  if (!endpoint) return undefined
  return buckets.find(b => b.type === endpoint.type && b.id === endpoint.id)
}

// ============================================================================
// Trigger matching
// ============================================================================

/**
 * Whether a `monthly` rule is due given the reference date. A rule is due when
 * it has never run, or was last applied in an earlier month. Non-monthly rules
 * are always "not scheduled" (they fire on their event instead).
 *
 * Pure: the caller passes the reference date.
 */
export function isMonthlyRuleDue(rule: TransferRule, now: Date): boolean {
  if (rule.trigger !== 'monthly') return false
  if (!rule.lastAppliedMonth) return true
  return rule.lastAppliedMonth < monthKey(now)
}

/**
 * Does a rule's trigger fire for the given context?
 *  - `payday`  fires when income was logged.
 *  - `expense` fires when an expense was logged.
 *  - `monthly` fires when the cadence is due.
 *  - `manual`  never fires automatically (only via an explicit run).
 */
function triggerFires(rule: TransferRule, ctx: TransferContext): boolean {
  const now = ctx.now ?? new Date()
  switch (rule.trigger) {
    case 'payday':
      return (ctx.incomeAmount ?? 0) > 0
    case 'expense':
      return (ctx.expenseAmount ?? 0) > 0
    case 'monthly':
      return isMonthlyRuleDue(rule, now)
    case 'manual':
      return false
    default:
      return false
  }
}

// ============================================================================
// Amount derivation
// ============================================================================

/**
 * The raw (uncapped) amount a rule wants to move for the given context, before
 * capacity/availability limits are applied.
 */
function rawAmountFor(rule: TransferRule, ctx: TransferContext): number {
  switch (rule.amountMode) {
    case 'fixed':
      return Math.max(0, rule.amountValue)
    case 'percent': {
      // Percent applies to the triggering income (payday) or expense.
      const base =
        rule.trigger === 'payday'
          ? ctx.incomeAmount ?? 0
          : rule.trigger === 'expense'
          ? ctx.expenseAmount ?? 0
          : 0
      const pct = Math.max(0, Math.min(100, rule.amountValue))
      return round2((base * pct) / 100)
    }
    case 'roundup': {
      // Reuses the round-up math from the Phase 2 feature we're generalizing.
      const expense = ctx.expenseAmount ?? 0
      if (expense <= 0) return 0
      return round2(computeRoundUp(expense).roundUpDifference)
    }
    default:
      return 0
  }
}

// ============================================================================
// Core pure computation
// ============================================================================

/**
 * Compute the list of virtual transfers to apply for a set of rules, the
 * current buckets, and a triggering context.
 *
 * Rules are evaluated in order. For each firing, enabled rule:
 *  1. derive the raw amount (fixed / percent / round-up),
 *  2. cap it at the destination's remaining capacity,
 *  3. if a source bucket is set, cap it at that source's available balance and
 *     skip self-transfers (source === destination),
 *  4. emit a `PlannedTransfer` and virtually debit the source / credit the
 *     destination so later rules in the same pass see updated balances.
 *
 * Pure: no side effects, no persistence, no wall-clock reads (pass `ctx.now`).
 */
export function computeTransfers(
  rules: TransferRule[],
  buckets: TransferBucket[],
  ctx: TransferContext
): PlannedTransfer[] {
  if (!rules.length || !buckets.length) return []

  // Work on a mutable copy of balances so chained rules stay consistent.
  const working = new Map<string, TransferBucket>(
    buckets.map(b => [`${b.type}:${b.id}`, { ...b }])
  )
  const key = (e: TransferEndpoint) => `${e.type}:${e.id}`

  const planned: PlannedTransfer[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!triggerFires(rule, ctx)) continue

    const destination = working.get(key(rule.destination))
    if (!destination) continue

    // Guard against a rule that points its source at its destination.
    if (rule.source && key(rule.source) === key(rule.destination)) continue

    let amount = rawAmountFor(rule, ctx)
    if (amount <= 0) continue

    // Cap at how much room the destination has left.
    amount = round2(Math.min(amount, remainingCapacity(destination)))
    if (amount <= 0) continue

    let source: TransferBucket | undefined
    if (rule.source) {
      source = working.get(key(rule.source))
      if (!source) continue // referenced source no longer exists
      // Can't move more than the source actually holds.
      amount = round2(Math.min(amount, Math.max(0, source.currentAmount)))
      if (amount <= 0) continue
    }

    planned.push({
      ruleId: rule.id,
      ruleLabel: rule.label,
      destination: { ...destination },
      source: source ? { ...source } : undefined,
      amount,
    })

    // Reflect the move so subsequent rules see the updated balances.
    destination.currentAmount = round2(destination.currentAmount + amount)
    if (source) {
      source.currentAmount = round2(source.currentAmount - amount)
    }
  }

  return planned
}

/** Total dollars across a set of planned transfers. Convenience for UI. */
export function computeTransfersTotal(transfers: PlannedTransfer[]): number {
  return round2(transfers.reduce((sum, t) => sum + t.amount, 0))
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a draft rule, returning every problem so the UI can surface them.
 * Copy is short and plain — this feeds inline form hints.
 */
export function validateTransferRule(draft: Partial<TransferRuleDraft>): TransferRuleValidation {
  const errors: string[] = []

  if (!(draft.label ?? '').trim()) {
    errors.push('Give your rule a name.')
  }

  if (!draft.destination || !draft.destination.id) {
    errors.push('Pick where the money goes.')
  }

  // Round-up only makes sense on a per-expense trigger.
  if (draft.amountMode === 'roundup' && draft.trigger && draft.trigger !== 'expense') {
    errors.push('Round-ups work with the “each expense” trigger.')
  }

  if (draft.amountMode === 'fixed') {
    const amt = draft.amountValue ?? 0
    if (!(amt > 0)) {
      errors.push('Set an amount above $0.')
    } else if (amt > MAX_AMOUNT) {
      errors.push(`Amount can't exceed $${MAX_AMOUNT.toLocaleString('en-US')}.`)
    }
  }

  if (draft.amountMode === 'percent') {
    const pct = draft.amountValue ?? 0
    if (!(pct > 0) || pct > 100) {
      errors.push('Set a percentage between 1 and 100.')
    }
  }

  if (
    draft.source &&
    draft.destination &&
    draft.source.type === draft.destination.type &&
    draft.source.id === draft.destination.id
  ) {
    errors.push('Source and destination must be different.')
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================================
// Persistence (localStorage) — mirrors categorizationRules / autoContribute
// ============================================================================

function isTransferEndpoint(v: unknown): v is TransferEndpoint {
  return (
    typeof v === 'object' &&
    v !== null &&
    (typeof (v as TransferEndpoint).id === 'string') &&
    ((v as TransferEndpoint).type === 'goal' || (v as TransferEndpoint).type === 'sinkingFund')
  )
}

/** Defensive shape check so partial/legacy records don't crash the app. */
function isTransferRule(v: unknown): v is TransferRule {
  if (typeof v !== 'object' || v === null) return false
  const r = v as TransferRule
  return (
    typeof r.id === 'string' &&
    typeof r.label === 'string' &&
    typeof r.enabled === 'boolean' &&
    typeof r.amountValue === 'number' &&
    (r.trigger === 'payday' ||
      r.trigger === 'expense' ||
      r.trigger === 'monthly' ||
      r.trigger === 'manual') &&
    (r.amountMode === 'fixed' || r.amountMode === 'percent' || r.amountMode === 'roundup') &&
    isTransferEndpoint(r.destination) &&
    (r.source == null || isTransferEndpoint(r.source))
  )
}

/** Load all transfer rules from localStorage. Returns `[]` server-side. */
export function loadTransferRules(): TransferRule[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTransferRule)
  } catch {
    return []
  }
}

/** Persist the full set of transfer rules. Fails silently if storage is full. */
export function saveTransferRules(rules: TransferRule[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // Storage unavailable — non-fatal.
  }
}

/** Create a new rule from a draft, returning the updated list. */
export function addTransferRule(
  rules: TransferRule[],
  draft: TransferRuleDraft
): TransferRule[] {
  const rule: TransferRule = {
    ...draft,
    source: draft.source ?? null,
    id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  }
  return [...rules, rule]
}

/** Patch an existing rule by id. No-op when the id isn't found. */
export function updateTransferRule(
  rules: TransferRule[],
  id: string,
  updates: Partial<TransferRuleDraft & { lastAppliedMonth: string }>
): TransferRule[] {
  return rules.map(r => (r.id === id ? { ...r, ...updates } : r))
}

/** Toggle a rule on/off (the reversible switch). */
export function setTransferRuleEnabled(
  rules: TransferRule[],
  id: string,
  enabled: boolean
): TransferRule[] {
  return rules.map(r => (r.id === id ? { ...r, enabled } : r))
}

/** Remove a rule by id. */
export function removeTransferRule(rules: TransferRule[], id: string): TransferRule[] {
  return rules.filter(r => r.id !== id)
}

/**
 * Stamp `monthly` rules that just fired so they don't run again this month.
 * Pass the ids that were actually applied and the reference date.
 */
export function markMonthlyRulesApplied(
  rules: TransferRule[],
  appliedRuleIds: string[],
  now: Date = new Date()
): TransferRule[] {
  if (!appliedRuleIds.length) return rules
  const applied = new Set(appliedRuleIds)
  const key = monthKey(now)
  return rules.map(r =>
    r.trigger === 'monthly' && applied.has(r.id) ? { ...r, lastAppliedMonth: key } : r
  )
}

// ============================================================================
// Backward-compatible bridge from the Phase 3 auto-contribute rules
// ============================================================================

/**
 * Convert legacy `AutoContributeRule[]` (Phase 3 task 149.1) into v2 transfer
 * rules so existing payday auto-contributions keep working under the unified
 * engine. Each becomes a `payday` + `fixed` rule targeting the same goal.
 *
 * This is a pure adapter — it does not read or write storage.
 */
export function fromAutoContributeRules(
  legacy: AutoContributeRule[],
  goalNameById: (goalId: string) => string = () => 'Goal'
): TransferRule[] {
  return legacy.map(r => ({
    id: `transfer_ac_${r.goalId}`,
    label: `Payday → ${goalNameById(r.goalId)}`,
    enabled: r.enabled,
    trigger: 'payday' as const,
    amountMode: 'fixed' as const,
    amountValue: r.amount,
    destination: { type: 'goal' as const, id: r.goalId },
    source: null,
    createdAt: new Date(0).toISOString(),
  }))
}
