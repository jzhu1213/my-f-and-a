/**
 * Merchant/payee memory for Folio.
 *
 * Remembers note→category→amount associations so re-typing a known merchant
 * pre-fills category and amount. Stored in localStorage with LRU eviction.
 *
 * Priority: merchant memory > user categorization rules > built-in keywords
 *
 * Task 130.3, Task 340.1, Task 340.2
 */

import type { TransactionCategory } from '@/types'

// ============================================================================
// Types
// ============================================================================

/** Tracks how often a category is used for a given merchant. */
export interface CategoryUsage {
  category: TransactionCategory
  count: number
}

export interface MerchantEntry {
  /** The normalized note/merchant name */
  note: string
  /** Most-used category for this merchant (backward-compatible) */
  category: TransactionCategory
  /** Most recent amount (backward-compatible) */
  amount: number
  /** Number of times this merchant has been logged */
  count: number
  /** ISO timestamp of last usage */
  lastUsed: string
  /** Top 3 categories by usage count (task 340.1) */
  categoryHistory?: CategoryUsage[]
  /** Recent amounts for computing averages (task 340.2, last 15) */
  amounts?: number[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-merchants'
const MAX_ENTRIES = 100
const MAX_CATEGORY_HISTORY = 3
const MAX_AMOUNTS_HISTORY = 15

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
 * Returns a display-friendly merchant name (capitalized first letter of each word).
 */
function displayName(note: string): string {
  return note
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Record a merchant interaction after a successful expense log.
 * Updates existing entry or creates a new one. Enforces LRU eviction at MAX_ENTRIES.
 *
 * Enhanced (task 340.1): also tracks categoryHistory and amounts history.
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
    const existing = entries[existingIdx]

    // Update categoryHistory (task 340.1)
    const catHistory = existing.categoryHistory ? [...existing.categoryHistory] : []
    const catIdx = catHistory.findIndex((c) => c.category === category)
    if (catIdx >= 0) {
      catHistory[catIdx] = { ...catHistory[catIdx], count: catHistory[catIdx].count + 1 }
    } else {
      catHistory.push({ category, count: 1 })
    }
    // Sort by count desc, keep top 3
    catHistory.sort((a, b) => b.count - a.count)
    const trimmedCatHistory = catHistory.slice(0, MAX_CATEGORY_HISTORY)

    // Update amounts history (task 340.2)
    const amountsHistory = existing.amounts ? [...existing.amounts, amount] : [amount]
    const trimmedAmounts = amountsHistory.slice(-MAX_AMOUNTS_HISTORY)

    // The top category becomes the backward-compatible `category` field
    const topCategory = trimmedCatHistory[0]?.category ?? category

    entries[existingIdx] = {
      ...existing,
      category: topCategory,
      amount,
      count: existing.count + 1,
      lastUsed: new Date().toISOString(),
      categoryHistory: trimmedCatHistory,
      amounts: trimmedAmounts,
    }
  } else {
    // Add new entry with initial history
    entries.push({
      note: note.trim(),
      category,
      amount,
      count: 1,
      lastUsed: new Date().toISOString(),
      categoryHistory: [{ category, count: 1 }],
      amounts: [amount],
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
 * Get the most-used category for a merchant and a contextual message.
 * Returns null if merchant is not found or has insufficient data.
 *
 * Task 340.1: "You usually file Starbucks under Food."
 */
export function getMerchantCategoryContext(
  note: string
): { category: TransactionCategory; message: string } | null {
  const merchant = lookupMerchant(note)
  if (!merchant || merchant.count < 2) return null

  // Use categoryHistory if available, else fall back to the single category
  const topCategory = merchant.categoryHistory?.[0]?.category ?? merchant.category
  const name = displayName(merchant.note)

  // Format category label with first-letter capitalization
  const categoryLabel = topCategory.charAt(0).toUpperCase() + topCategory.slice(1)

  return {
    category: topCategory,
    message: `You usually file ${name} under ${categoryLabel}.`,
  }
}

/**
 * Get the average amount spent at a merchant and a display label.
 * Returns null if merchant is not found or has only 1 entry.
 *
 * Task 340.2: "Avg at Starbucks: $5.50"
 */
export function getMerchantAverageAmount(
  note: string
): { amount: number; label: string } | null {
  const merchant = lookupMerchant(note)
  if (!merchant || merchant.count < 2) return null

  // Use amounts history if available, else fall back to the single amount
  const amounts = merchant.amounts && merchant.amounts.length > 0
    ? merchant.amounts
    : [merchant.amount]

  if (amounts.length < 2) return null

  const sum = amounts.reduce((a, b) => a + b, 0)
  const avg = Math.round((sum / amounts.length) * 100) / 100
  const name = displayName(merchant.note)
  const amountStr = avg % 1 === 0 ? `$${avg}` : `$${avg.toFixed(2)}`

  return {
    amount: avg,
    label: `Avg at ${name}: ${amountStr}`,
  }
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
