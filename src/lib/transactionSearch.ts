/**
 * Client-side transaction search index with memoization.
 *
 * Indexes transactions by note (tokenized), category name, amount (numeric),
 * and date (natural language: "last week", "january", "yesterday").
 * Returns ranked results. Rebuilds the index only when the transactions array
 * reference changes.
 *
 * Requirements: 22.1
 */

import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction, TransactionCategory } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  transaction: Transaction
  score: number
  /** Which fields matched (for highlighting) */
  matchedFields: ('note' | 'category' | 'amount' | 'date')[]
}

interface IndexEntry {
  transaction: Transaction
  /** Lowercased, tokenized note words */
  noteTokens: string[]
  /** Lowercased category label */
  categoryLabel: string
  /** Lowercased category key */
  categoryKey: string
  /** Amount as string for partial matching */
  amountStr: string
  /** Amount rounded string */
  amountRounded: string
  /** Date string YYYY-MM-DD */
  dateStr: string
}

// ============================================================================
// Natural language date parsing
// ============================================================================

interface DateRange {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const MONTH_ABBREVS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Parse natural language date queries into date ranges.
 * Returns null if the query doesn't match a known date pattern.
 */
export function parseNaturalDate(query: string): DateRange | null {
  const q = query.toLowerCase().trim()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // "today"
  if (q === 'today') {
    return { start: toDateStr(today), end: toDateStr(today) }
  }

  // "yesterday"
  if (q === 'yesterday') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return { start: toDateStr(d), end: toDateStr(d) }
  }

  // "this week" — Monday through today
  if (q === 'this week') {
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
    return { start: toDateStr(monday), end: toDateStr(today) }
  }

  // "last week" — previous Monday through Sunday
  if (q === 'last week') {
    const dayOfWeek = today.getDay()
    const thisMonday = new Date(today)
    thisMonday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(thisMonday.getDate() - 7)
    const lastSunday = new Date(thisMonday)
    lastSunday.setDate(thisMonday.getDate() - 1)
    return { start: toDateStr(lastMonday), end: toDateStr(lastSunday) }
  }

  // "this month"
  if (q === 'this month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: toDateStr(start), end: toDateStr(today) }
  }

  // "last month"
  if (q === 'last month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0) // last day of prev month
    return { start: toDateStr(start), end: toDateStr(end) }
  }

  // Month name: "january", "jan", "february", etc.
  const monthIdx = MONTH_NAMES.indexOf(q)
  const monthAbbrIdx = MONTH_ABBREVS.indexOf(q)
  const resolvedMonth = monthIdx !== -1 ? monthIdx : monthAbbrIdx
  if (resolvedMonth !== -1) {
    // Use current year, or previous year if that month hasn't started yet
    let year = today.getFullYear()
    if (resolvedMonth > today.getMonth()) {
      year -= 1
    }
    const start = new Date(year, resolvedMonth, 1)
    const end = new Date(year, resolvedMonth + 1, 0) // last day of month
    return { start: toDateStr(start), end: toDateStr(end) }
  }

  return null
}

// ============================================================================
// Index building
// ============================================================================

/** Category label lookup — built once */
const CATEGORY_LABEL_MAP: Record<string, string> = {}
for (const cat of TRANSACTION_CATEGORIES) {
  CATEGORY_LABEL_MAP[cat.category] = cat.label.toLowerCase()
}

function buildIndex(transactions: Transaction[]): IndexEntry[] {
  return transactions.map(tx => ({
    transaction: tx,
    noteTokens: (tx.note ?? '').toLowerCase().split(/\s+/).filter(Boolean),
    categoryLabel: CATEGORY_LABEL_MAP[tx.category] ?? tx.category.toLowerCase(),
    categoryKey: tx.category.toLowerCase(),
    amountStr: tx.amount.toFixed(2),
    amountRounded: String(Math.round(tx.amount)),
    dateStr: tx.date,
  }))
}

// ============================================================================
// Memoized index (Task 472.2: deferred index building)
// ============================================================================

let cachedTransactions: Transaction[] | null = null
let cachedIndex: IndexEntry[] = []
let pendingBuildId: number | ReturnType<typeof setTimeout> | null = null

/**
 * Get the search index, building it synchronously if needed for immediate search.
 * Only rebuilds when the transactions array reference changes.
 */
function getIndex(transactions: Transaction[]): IndexEntry[] {
  if (transactions !== cachedTransactions) {
    // Cancel any pending deferred build
    if (pendingBuildId !== null) {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(pendingBuildId as number)
      } else {
        clearTimeout(pendingBuildId as ReturnType<typeof setTimeout>)
      }
      pendingBuildId = null
    }
    cachedTransactions = transactions
    cachedIndex = buildIndex(transactions)
  }
  return cachedIndex
}

/**
 * Schedule an index rebuild in the background using requestIdleCallback.
 * Call this when transactions change to pre-warm the index without blocking
 * the render frame. If the user searches before the build completes, getIndex()
 * will build synchronously as a fallback.
 *
 * **Validates: Requirements 28.5** — offloads search indexing from the render path
 */
export function scheduleIndexBuild(transactions: Transaction[]): void {
  // Already up to date
  if (transactions === cachedTransactions) return

  // Cancel previous pending build
  if (pendingBuildId !== null) {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(pendingBuildId as number)
    } else {
      clearTimeout(pendingBuildId as ReturnType<typeof setTimeout>)
    }
  }

  const build = () => {
    pendingBuildId = null
    // Only build if the reference is still the one we were asked to index
    // (prevents stale builds from overwriting a newer index)
    if (transactions === cachedTransactions) return
    cachedTransactions = transactions
    cachedIndex = buildIndex(transactions)
  }

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    pendingBuildId = window.requestIdleCallback(build, { timeout: 3000 })
  } else {
    pendingBuildId = setTimeout(build, 0)
  }
}

// ============================================================================
// Search engine
// ============================================================================

/**
 * Search transactions using the memoized index.
 * Returns ranked results (higher score = better match).
 *
 * Scoring:
 * - Exact note word match: +3
 * - Note prefix match: +2
 * - Note substring match: +1
 * - Category match: +3
 * - Amount match: +3
 * - Date range match: +2
 */
export function searchTransactions(
  transactions: Transaction[],
  query: string
): SearchResult[] {
  const q = query.trim()
  if (!q) return []

  const index = getIndex(transactions)
  const qLower = q.toLowerCase()
  // Strip $ for amount matching
  const qAmount = q.replace(/^\$/, '').trim()
  const dateRange = parseNaturalDate(qLower)

  const results: SearchResult[] = []

  for (const entry of index) {
    let score = 0
    const matchedFields: SearchResult['matchedFields'] = []

    // Note matching (tokenized)
    if (entry.noteTokens.length > 0) {
      const noteText = (entry.transaction.note ?? '').toLowerCase()
      for (const token of entry.noteTokens) {
        if (token === qLower) {
          score += 3
          if (!matchedFields.includes('note')) matchedFields.push('note')
          break
        }
        if (token.startsWith(qLower)) {
          score += 2
          if (!matchedFields.includes('note')) matchedFields.push('note')
          break
        }
      }
      // Substring match on full note
      if (!matchedFields.includes('note') && noteText.includes(qLower)) {
        score += 1
        matchedFields.push('note')
      }
    }

    // Category matching
    if (
      entry.categoryLabel.includes(qLower) ||
      entry.categoryKey.includes(qLower)
    ) {
      score += 3
      matchedFields.push('category')
    }

    // Amount matching
    if (qAmount && !isNaN(Number(qAmount))) {
      if (
        entry.amountStr.includes(qAmount) ||
        entry.amountRounded === qAmount
      ) {
        score += 3
        matchedFields.push('amount')
      }
    }

    // Date range matching (natural language)
    if (dateRange) {
      if (entry.dateStr >= dateRange.start && entry.dateStr <= dateRange.end) {
        score += 2
        matchedFields.push('date')
      }
    }

    if (score > 0) {
      results.push({ transaction: entry.transaction, score, matchedFields })
    }
  }

  // Sort by score descending, then by date descending for ties
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.transaction.date.localeCompare(a.transaction.date)
  })

  return results
}

// ============================================================================
// Recent searches (localStorage)
// ============================================================================

const RECENT_SEARCHES_KEY = 'folio-recent-searches'
const MAX_RECENT_SEARCHES = 5

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function addRecentSearch(query: string): void {
  const q = query.trim()
  if (!q) return
  try {
    const current = getRecentSearches()
    // Remove duplicate if exists, then prepend
    const updated = [q, ...current.filter(s => s !== q)].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Silently fail
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Quick filter definitions
// ============================================================================

export interface QuickFilter {
  label: string
  query: string
  /** If set, apply as a programmatic filter rather than a text query */
  filterType?: 'date' | 'amount' | 'category' | 'type'
}

export const QUICK_FILTERS: QuickFilter[] = [
  { label: 'This week', query: 'this week', filterType: 'date' },
  { label: 'Over $50', query: '$50', filterType: 'amount' },
  { label: 'Food', query: 'food', filterType: 'category' },
  { label: 'Income only', query: 'income', filterType: 'type' },
]
