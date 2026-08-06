/**
 * User-defined categorization rules.
 *
 * Allows users to create "always categorize notes containing X as Y" rules
 * that override the built-in keyword map. Rules are stored in localStorage
 * and checked before the built-in autoCategorize logic.
 *
 * Task 113.3
 */

import type { TransactionCategory } from '@/types'
import type { AutoCategorizeResult } from './autoCategorize'

// ============================================================================
// Types
// ============================================================================

export interface CategorizationRule {
  id: string
  keyword: string
  category: TransactionCategory
  /**
   * Optional auto-route target. When set, logging a transaction whose note
   * matches this rule's keyword also pre-selects this funding source
   * (payment method). Null / undefined means "categorize only, don't route".
   */
  fundingSourceId?: string | null
  createdAt: string
}

/** Fields a user can change when editing an existing rule. */
export interface CategorizationRuleUpdate {
  keyword?: string
  category?: TransactionCategory
  fundingSourceId?: string | null
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-categorization-rules'

// ============================================================================
// Persistence helpers
// ============================================================================

/**
 * Load all user-defined categorization rules from localStorage.
 */
export function getCategorizationRules(): CategorizationRule[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Save a new categorization rule. Returns the created rule.
 *
 * @param keyword - The note keyword to match (case-insensitive "contains").
 * @param category - The category to always apply on a match.
 * @param fundingSourceId - Optional funding source to auto-route to on a match.
 */
export function saveCategorizationRule(
  keyword: string,
  category: TransactionCategory,
  fundingSourceId?: string | null
): CategorizationRule {
  const rules = getCategorizationRules()
  const rule: CategorizationRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    keyword: keyword.toLowerCase().trim(),
    category,
    fundingSourceId: fundingSourceId ?? null,
    createdAt: new Date().toISOString(),
  }
  rules.push(rule)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  return rule
}

/**
 * Update an existing categorization rule in place. Returns the updated rule,
 * or null when no rule matches the given id.
 */
export function updateCategorizationRule(
  id: string,
  updates: CategorizationRuleUpdate
): CategorizationRule | null {
  const rules = getCategorizationRules()
  const index = rules.findIndex(r => r.id === id)
  if (index === -1) return null

  const existing = rules[index]
  const updated: CategorizationRule = {
    ...existing,
    ...(updates.keyword !== undefined
      ? { keyword: updates.keyword.toLowerCase().trim() }
      : {}),
    ...(updates.category !== undefined ? { category: updates.category } : {}),
    ...(updates.fundingSourceId !== undefined
      ? { fundingSourceId: updates.fundingSourceId }
      : {}),
  }
  rules[index] = updated
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  return updated
}

/**
 * Delete a categorization rule by ID.
 */
export function deleteCategorizationRule(id: string): void {
  const rules = getCategorizationRules()
  const filtered = rules.filter(r => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

// ============================================================================
// Rule application
// ============================================================================

/**
 * Check user-defined rules against a note. Returns the first matching rule's
 * category with confidence 1.0 (user rules always win).
 *
 * Uses simple case-insensitive "contains" matching, same as the built-in map.
 */
export function applyUserRules(
  note: string,
  rules: CategorizationRule[]
): AutoCategorizeResult | null {
  if (!note || note.trim().length === 0 || rules.length === 0) return null

  const lower = note.toLowerCase().trim()

  // Check rules in order — longest keyword match wins for tie-breaking
  let bestMatch: CategorizationRule | null = null

  for (const rule of rules) {
    if (lower.includes(rule.keyword)) {
      if (!bestMatch || rule.keyword.length > bestMatch.keyword.length) {
        bestMatch = rule
      }
    }
  }

  if (!bestMatch) return null

  return { category: bestMatch.category, confidence: 1.0 }
}

/**
 * Check user-defined auto-route rules against a note. Returns the funding
 * source id of the first (longest-keyword) matching rule that has a route
 * target set, or null when nothing matches.
 *
 * Mirrors the matching semantics of `applyUserRules` so category + route stay
 * consistent for the same note.
 */
export function applyRouteRule(
  note: string,
  rules: CategorizationRule[]
): string | null {
  if (!note || note.trim().length === 0 || rules.length === 0) return null

  const lower = note.toLowerCase().trim()

  let bestMatch: CategorizationRule | null = null

  for (const rule of rules) {
    if (!rule.fundingSourceId) continue
    if (lower.includes(rule.keyword)) {
      if (!bestMatch || rule.keyword.length > bestMatch.keyword.length) {
        bestMatch = rule
      }
    }
  }

  return bestMatch?.fundingSourceId ?? null
}

/**
 * Check whether a keyword already has an existing rule.
 */
export function hasExistingRule(keyword: string, rules: CategorizationRule[]): boolean {
  const lower = keyword.toLowerCase().trim()
  return rules.some(r => r.keyword === lower)
}
