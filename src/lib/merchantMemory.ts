/**
 * Merchant/payee memory for Folio.
 *
 * Remembers note→category→amount associations so re-typing a known merchant
 * pre-fills category and amount. Stored in localStorage with LRU eviction.
 *
 * Priority: merchant memory > user categorization rules > built-in keywords
 *
 * Task 130.3
 */

import type { TransactionCategory } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface MerchantEntry {
  /** The normalized note/merchant name */
  note: string
  /** Most recently used category for this merchant */
  category: TransactionCategory
  /** Most recently used amount */
  amount: number
  /** Number of times this merchant has been logged */
  count: number
  /** ISO timestamp of last usage */
  lastUsed: string
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-merchants'
const MAX_ENTRIES = 100

// ============================================================================
// Storage helpers
// ============================================================================

function getMerchantMap(): MerchantEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMerchantMap(entries: MerchantEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full — fail silently
  }
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Normalize a note for matching purposes.
 * Lowercases, trims, and collapses whitespace.
 */
function normalizeNote(note: string): string {
  return note.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Record a merchant interaction after a successful expense log.
 * Updates existing entry or creates a new one. Enforces LRU eviction at MAX_ENTRIES.
 */
export function recordMerchant(
  note: string,
  category: TransactionCategory,
  amount: number
): void {
  if (!note || note.trim().length === 0) return
  if (amount <= 0) return

  const normalized = normalizeNote(note)
  const entries = getMerchantMap()

  const existingIdx = entries.findIndex(
    (e) => normalizeNote(e.note) === normalized
  )

  if (existingIdx >= 0) {
    // Update existing — keep the most recent category and amount
    entries[existingIdx] = {
      ...entries[existingIdx],
      category,
      amount,
      count: entries[existingIdx].count + 1,
      lastUsed: new Date().toISOString(),
    }
  } else {
    // Add new entry
    entries.push({
      note: note.trim(),
      category,
      amount,
      count: 1,
      lastUsed: new Date().toISOString(),
    })
  }

  // LRU eviction: sort by lastUsed desc, keep only MAX_ENTRIES
  entries.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
  const trimmed = entries.slice(0, MAX_ENTRIES)

  saveMerchantMap(trimmed)
}

/**
 * Look up a merchant by note. Uses fuzzy case-insensitive matching.
 * Returns the matching entry or null if no match is found.
 *
 * Matching strategy:
 * 1. Exact match (normalized)
 * 2. Starts-with match (typed text is a prefix of a stored merchant)
 * 3. Contains match (typed text is contained in a stored merchant, or vice versa)
 *
 * Returns the highest-count match if multiple found.
 */
export function lookupMerchant(note: string): MerchantEntry | null {
  if (!note || note.trim().length < 2) return null

  const normalized = normalizeNote(note)
  const entries = getMerchantMap()

  // Exact match first
  const exact = entries.find((e) => normalizeNote(e.note) === normalized)
  if (exact) return exact

  // Starts-with match (input is prefix of stored)
  const startsWithMatches = entries.filter((e) =>
    normalizeNote(e.note).startsWith(normalized)
  )
  if (startsWithMatches.length > 0) {
    // Return highest count
    return startsWithMatches.sort((a, b) => b.count - a.count)[0]
  }

  // Contains match (stored contains input, or input contains stored)
  const containsMatches = entries.filter((e) => {
    const stored = normalizeNote(e.note)
    return stored.includes(normalized) || normalized.includes(stored)
  })
  if (containsMatches.length > 0) {
    return containsMatches.sort((a, b) => b.count - a.count)[0]
  }

  return null
}

/**
 * Get the top merchants by usage count. Useful for suggestion chips.
 */
export function getTopMerchants(limit: number = 5): MerchantEntry[] {
  const entries = getMerchantMap()
  return entries
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Get recently used merchants, sorted by lastUsed.
 */
export function getRecentMerchants(limit: number = 5): MerchantEntry[] {
  const entries = getMerchantMap()
  return entries
    .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, limit)
}
