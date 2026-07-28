import type { Goal } from '@/types'

/**
 * Auto-Contribute to Goals — Pure Utility Module
 * ============================================================================
 *
 * Defines rules for automatically routing a fixed amount to savings goals when
 * income is detected on a payday. Reuses the Theme F pay-schedule model
 * conceptually — when the PaycheckSheet opens, it checks for active rules and
 * computes contributions respecting goal capacity.
 *
 * This module is intentionally PURE: no I/O, no localStorage, no side effects.
 * Persistence is handled by a companion settings layer below.
 *
 * **Validates: Requirements 12.4, new**
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single auto-contribute rule: route `amount` to a specific goal on each
 * payday, as long as the rule is enabled.
 */
export interface AutoContributeRule {
  /** The goal to contribute to */
  goalId: string
  /** Fixed dollar amount to contribute each payday */
  amount: number
  /** Whether the rule is currently active */
  enabled: boolean
}

/**
 * A computed contribution ready to apply.
 */
export interface AutoContribution {
  goalId: string
  goalName: string
  goalEmoji: string
  /** The actual amount to contribute (may be less than rule.amount if goal is near capacity) */
  amount: number
}

// ============================================================================
// Pure Computation
// ============================================================================

/**
 * Round to 2 decimal places (cents).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Compute the list of auto-contributions to apply for a given set of rules,
 * goals, and income amount. Respects goal capacity — never contributes beyond
 * a goal's target. Also ensures total contributions don't exceed the income.
 *
 * Pure: no side effects, no persistence.
 *
 * @param rules         Active auto-contribute rules.
 * @param goals         The user's current goals (with up-to-date currentAmount).
 * @param incomeAmount  The paycheck amount just logged.
 * @returns             Ordered list of contributions to apply.
 */
export function computeAutoContributions(
  rules: AutoContributeRule[],
  goals: Goal[],
  incomeAmount: number
): AutoContribution[] {
  if (!rules.length || !goals.length || incomeAmount <= 0) {
    return []
  }

  const goalMap = new Map(goals.map(g => [g.id, g]))
  const contributions: AutoContribution[] = []
  let totalContributed = 0

  for (const rule of rules) {
    if (!rule.enabled || rule.amount <= 0) continue

    const goal = goalMap.get(rule.goalId)
    if (!goal) continue

    // Don't contribute beyond the goal's target
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
    if (remaining <= 0) continue

    // Cap at goal capacity and remaining income
    const budgetLeft = Math.max(0, incomeAmount - totalContributed)
    if (budgetLeft <= 0) break

    const actualAmount = round2(Math.min(rule.amount, remaining, budgetLeft))
    if (actualAmount <= 0) continue

    contributions.push({
      goalId: goal.id,
      goalName: goal.name,
      goalEmoji: goal.emoji,
      amount: actualAmount,
    })

    totalContributed += actualAmount
  }

  return contributions
}

/**
 * Compute the total amount that would be auto-contributed.
 * Convenience helper for UI display.
 */
export function computeAutoContributeTotal(contributions: AutoContribution[]): number {
  return round2(contributions.reduce((sum, c) => sum + c.amount, 0))
}

// ============================================================================
// Persistence (localStorage-based settings)
// ============================================================================

const STORAGE_KEY = 'folio_auto_contribute_rules'

/**
 * Load persisted auto-contribute rules from localStorage.
 * Returns an empty array if nothing is stored or if running server-side.
 */
export function loadAutoContributeRules(): AutoContributeRule[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Basic shape validation
    return parsed.filter(
      (r: unknown): r is AutoContributeRule =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as AutoContributeRule).goalId === 'string' &&
        typeof (r as AutoContributeRule).amount === 'number' &&
        typeof (r as AutoContributeRule).enabled === 'boolean'
    )
  } catch {
    return []
  }
}

/**
 * Persist auto-contribute rules to localStorage.
 */
export function saveAutoContributeRules(rules: AutoContributeRule[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Add or update an auto-contribute rule for a specific goal.
 * If a rule for the goalId already exists, it's updated; otherwise a new one is added.
 */
export function upsertAutoContributeRule(
  rules: AutoContributeRule[],
  goalId: string,
  amount: number,
  enabled: boolean = true
): AutoContributeRule[] {
  const existing = rules.findIndex(r => r.goalId === goalId)
  const updated = [...rules]
  if (existing >= 0) {
    updated[existing] = { goalId, amount, enabled }
  } else {
    updated.push({ goalId, amount, enabled })
  }
  return updated
}

/**
 * Remove the auto-contribute rule for a specific goal.
 */
export function removeAutoContributeRule(
  rules: AutoContributeRule[],
  goalId: string
): AutoContributeRule[] {
  return rules.filter(r => r.goalId !== goalId)
}
