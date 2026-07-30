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
  createdAt: string
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
 */
export function saveCategorizationRule(
  keyword: string,
  category: TransactionCategory
): CategorizationRule {
  const rules = getCategorizationRules()
  const rule: CategorizationRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    keyword: keyword.toLowerCase().trim(),
    category,
    createdAt: new Date().toISOString(),
  }
  rules.push(rule)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  return rule
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
 * Check whether a keyword already has an existing rule.
 */
export function hasExistingRule(keyword: string, rules: CategorizationRule[]): boolean {
  const lower = keyword.toLowerCase().trim()
  return rules.some(r => r.keyword === lower)
}
