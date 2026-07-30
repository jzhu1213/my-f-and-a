/**
 * Lightweight tag utilities for Folio transactions.
 *
 * Tags are short user-defined labels (e.g. "trip", "birthday", "splitwithAlex")
 * attached to transactions for personal organization. They don't affect budgets
 * or the daily allowance — purely for filtering/searching.
 *
 * Constraints:
 * - Max 5 tags per transaction
 * - Max 20 characters per tag
 * - Stored in localStorage until a DB column is available
 */

import type { Transaction } from '@/types'

// ============================================================================
// Constants
// ============================================================================

export const MAX_TAGS_PER_TRANSACTION = 5
export const MAX_TAG_LENGTH = 20
const STORAGE_KEY = 'folio-tags'

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse raw user input into a normalized tag array.
 *
 * - Splits on commas and spaces
 * - Strips leading # prefixes
 * - Lowercases and trims
 * - Removes duplicates
 * - Enforces max 20 chars per tag, max 5 tags total
 * - Filters out empty strings
 */
export function parseTagInput(input: string): string[] {
  const raw = input
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#+/, '').trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
    .filter((t) => t.length > 0)

  // Deduplicate preserving order
  const unique = [...new Set(raw)]
  return unique.slice(0, MAX_TAGS_PER_TRANSACTION)
}

// ============================================================================
// Suggestions
// ============================================================================

/**
 * Returns the most recently used unique tags across all transactions.
 * Ordered by most recent usage (transactions are expected to be sorted
 * newest-first). Useful for suggestion chips.
 */
export function getRecentTags(transactions: Transaction[], limit: number = 8): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const tx of transactions) {
    const tags = tx.tags ?? getTagsForTransaction(tx.id)
    if (!tags) continue
    for (const tag of tags) {
      if (seen.has(tag)) continue
      seen.add(tag)
      result.push(tag)
      if (result.length >= limit) return result
    }
  }

  return result
}

// ============================================================================
// localStorage persistence
// ============================================================================

/**
 * Get the full tag map from localStorage.
 */
function getTagMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Save the full tag map to localStorage.
 */
function saveTagMap(map: Record<string, string[]>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Get tags for a specific transaction from localStorage.
 */
export function getTagsForTransaction(txId: string): string[] | undefined {
  const map = getTagMap()
  return map[txId]
}

/**
 * Save tags for a transaction to localStorage.
 * Pass an empty array or undefined to clear tags.
 */
export function saveTagsForTransaction(txId: string, tags: string[] | undefined): void {
  const map = getTagMap()
  if (!tags || tags.length === 0) {
    delete map[txId]
  } else {
    map[txId] = tags.slice(0, MAX_TAGS_PER_TRANSACTION)
  }
  saveTagMap(map)
}

/**
 * Load tags from localStorage into a transactions array (hydration helper).
 * Merges localStorage tags with any tags already on the transaction objects.
 */
export function hydrateTransactionTags(transactions: Transaction[]): Transaction[] {
  const map = getTagMap()
  if (Object.keys(map).length === 0) return transactions

  return transactions.map((tx) => {
    const stored = map[tx.id]
    if (!stored || stored.length === 0) return tx
    // Don't overwrite if transaction already has tags (e.g. from DB)
    if (tx.tags && tx.tags.length > 0) return tx
    return { ...tx, tags: stored }
  })
}
