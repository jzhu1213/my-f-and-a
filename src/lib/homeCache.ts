import type { Transaction, Budget, Goal } from '@/types'
import type { DailyAllowance } from '@/types/folio'
import { TransactionSchema } from './schemas/transaction'
import { BudgetSchema } from './schemas/budget'
import { GoalSchema } from './schemas/goal'
import { validateArray } from './schemas/validate'

// ============================================================================
// Home Screen Cache — Zero Perceptible Load
// ============================================================================
// Implements stale-while-revalidate (470.1), incremental updates (470.2),
// and size management with LRU eviction (470.3).
// Requirement 28.4: SWR caching with incremental mutation sync.

/** Default stale threshold: 5 minutes */
const DEFAULT_STALE_THRESHOLD_MS = 300_000

/** Maximum cache size in bytes (~5MB) */
const MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024

/** Cache key prefix (user-specific) */
const CACHE_KEY_PREFIX = 'folio-home-cache-'

/**
 * Shape of the cached home screen state.
 * Includes everything needed to paint the hero + recent transactions + budgets + goals instantly.
 * The cache uses a version field for future migration support (Task 522.3).
 */
export interface HomeCachePayload {
  version: number
  allowance: DailyAllowance
  recentTransactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  cachedAt: number // Date.now() timestamp
  lastSyncedAt: number | null // timestamp of last successful background sync
}

/** Current home cache version */
const HOME_CACHE_VERSION = 1

/** Build the localStorage key for a given user */
function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

/**
 * Retrieve the cached home screen state for a user.
 * Returns null if no cache exists, cache is corrupted, or running on server.
 */
export function getHomeCache(userId: string): HomeCachePayload | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as HomeCachePayload

    // Basic shape validation
    if (
      typeof parsed.cachedAt !== 'number' ||
      !parsed.allowance ||
      !Array.isArray(parsed.recentTransactions) ||
      !Array.isArray(parsed.budgets)
    ) {
      return null
    }

    // Backfill version for older cache entries (Task 522.3)
    if (typeof parsed.version !== 'number') {
      parsed.version = HOME_CACHE_VERSION
    }

    // Backfill optional fields for older cache entries
    if (!Array.isArray(parsed.goals)) {
      parsed.goals = []
    }
    if (parsed.lastSyncedAt === undefined) {
      parsed.lastSyncedAt = null
    }

    // Schema-validate sub-collections (Task 520.3)
    // If any sub-collection is entirely invalid, clear cache to trigger refetch
    const txResult = validateArray(parsed.recentTransactions, TransactionSchema, 'homeCache.transactions')
    const budgetResult = validateArray(parsed.budgets, BudgetSchema, 'homeCache.budgets')
    const goalResult = validateArray(parsed.goals, GoalSchema, 'homeCache.goals')

    // If all transactions or all budgets are quarantined, treat cache as invalid
    if (parsed.recentTransactions.length > 0 && txResult.valid.length === 0) {
      localStorage.removeItem(cacheKey(userId))
      return null
    }
    if (parsed.budgets.length > 0 && budgetResult.valid.length === 0) {
      localStorage.removeItem(cacheKey(userId))
      return null
    }

    // Use only validated data
    parsed.recentTransactions = txResult.valid as Transaction[]
    parsed.budgets = budgetResult.valid as Budget[]
    parsed.goals = goalResult.valid as Goal[]

    return parsed
  } catch {
    // Corrupted cache — treat as no cache
    return null
  }
}

/**
 * Persist a snapshot of the home screen state to localStorage.
 * Stores up to 50 recent transactions for offline access.
 * Enforces cache size limit with eviction (Task 470.3).
 */
export function setHomeCache(
  userId: string,
  data: {
    allowance: DailyAllowance
    transactions: Transaction[]
    budgets: Budget[]
    goals?: Goal[]
  }
): void {
  if (typeof window === 'undefined') return

  try {
    const payload: HomeCachePayload = {
      version: HOME_CACHE_VERSION,
      allowance: data.allowance,
      recentTransactions: data.transactions.slice(0, 50),
      budgets: data.budgets,
      goals: data.goals ?? [],
      cachedAt: Date.now(),
      lastSyncedAt: Date.now(),
    }

    const serialized = JSON.stringify(payload)

    // Check if this write would exceed budget — evict if needed
    if (!ensureCacheSpace(userId, serialized.length)) {
      // Even after eviction we can't fit — write a minimal cache
      const minimalPayload: HomeCachePayload = {
        version: HOME_CACHE_VERSION,
        allowance: data.allowance,
        recentTransactions: data.transactions.slice(0, 5),
        budgets: data.budgets,
        goals: data.goals?.slice(0, 10) ?? [],
        cachedAt: Date.now(),
        lastSyncedAt: Date.now(),
      }
      localStorage.setItem(cacheKey(userId), JSON.stringify(minimalPayload))
      return
    }

    localStorage.setItem(cacheKey(userId), serialized)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Remove the cached home screen state for a user.
 */
export function clearHomeCache(userId: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(cacheKey(userId))
  } catch {
    // Fail silently
  }
}

/**
 * Check whether the cached data is older than the given threshold.
 * Returns true if cache is stale or doesn't exist.
 */
export function isCacheStale(
  userId: string,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS
): boolean {
  const cache = getHomeCache(userId)
  if (!cache) return true

  return Date.now() - cache.cachedAt > thresholdMs
}

// ============================================================================
// Incremental Cache Updates (Task 470.2)
// ============================================================================
// After mutations, patch the cache without refetching everything.
// The full cache-write useEffect serves as background reconciliation.

/**
 * Add a transaction to the cache incrementally.
 * Inserts at the front (most recent) and trims to 50 entries.
 */
export function addTransactionToCache(userId: string, transaction: Transaction): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    // Insert at front, deduplicate, trim
    const updated = [transaction, ...cache.recentTransactions.filter(t => t.id !== transaction.id)]
    cache.recentTransactions = updated.slice(0, 50)
    cache.cachedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

/**
 * Update a transaction in the cache incrementally.
 * If the transaction isn't in the cache, it's a no-op.
 */
export function updateTransactionInCache(userId: string, id: string, updates: Partial<Transaction>): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    const idx = cache.recentTransactions.findIndex(t => t.id === id)
    if (idx === -1) return

    cache.recentTransactions[idx] = { ...cache.recentTransactions[idx], ...updates }
    cache.cachedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

/**
 * Remove a transaction from the cache incrementally.
 */
export function removeTransactionFromCache(userId: string, id: string): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    cache.recentTransactions = cache.recentTransactions.filter(t => t.id !== id)
    cache.cachedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

/**
 * Replace a temp transaction ID with the real server-assigned ID in cache.
 * Used after successful persistence to keep cache in sync with optimistic reconciliation.
 */
export function reconcileTransactionInCache(userId: string, tempId: string, realTransaction: Transaction): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    cache.recentTransactions = cache.recentTransactions.map(t =>
      t.id === tempId ? realTransaction : t
    )
    cache.cachedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

/**
 * Update budgets in the cache incrementally.
 */
export function updateBudgetsInCache(userId: string, budgets: Budget[]): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    cache.budgets = budgets
    cache.cachedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

/**
 * Update the lastSyncedAt timestamp (called after successful background refresh).
 */
export function updateLastSyncedAt(userId: string): void {
  if (typeof window === 'undefined') return

  try {
    const cache = getHomeCache(userId)
    if (!cache) return

    cache.lastSyncedAt = Date.now()

    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // Fail silently
  }
}

// ============================================================================
// Cache Size Management (Task 470.3)
// ============================================================================

/**
 * Get the current size of the folio cache for a user in bytes.
 */
export function getCacheSize(userId: string): number {
  if (typeof window === 'undefined') return 0

  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return 0
    // Each character in localStorage is 2 bytes (UTF-16)
    return raw.length * 2
  } catch {
    return 0
  }
}

/**
 * Get total localStorage usage by all folio cache entries (across all users).
 */
export function getTotalCacheSize(): number {
  if (typeof window === 'undefined') return 0

  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          total += (key.length + value.length) * 2
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

/**
 * Ensure there's enough space to write `neededBytes` to cache.
 * Evicts oldest transaction entries first from the cache payload.
 * Critical data (current month transactions, budgets, goals) is never evicted.
 * Returns true if space was made available, false if eviction couldn't free enough.
 */
function ensureCacheSpace(userId: string, neededBytes: number): boolean {
  if (typeof window === 'undefined') return false

  try {
    const totalUsed = getTotalCacheSize()

    // If we're well under the limit, no eviction needed
    if (totalUsed + neededBytes <= MAX_CACHE_SIZE_BYTES) {
      return true
    }

    // Evict from existing cache: trim older transactions (beyond current month)
    const cache = getHomeCache(userId)
    if (!cache) return true // No existing cache to worry about

    const currentMonth = new Date().toISOString().slice(0, 7)

    // Split transactions: current month (protected) vs older (evictable)
    const currentMonthTxns = cache.recentTransactions.filter(t => t.date.startsWith(currentMonth))
    const olderTxns = cache.recentTransactions.filter(t => !t.date.startsWith(currentMonth))

    // Evict oldest transactions first (they're sorted by date desc, so pop from end)
    let evicted = 0
    while (olderTxns.length > 0) {
      const removed = olderTxns.pop()
      if (removed) {
        evicted += JSON.stringify(removed).length * 2
      }
      // Check if we've freed enough
      if (totalUsed - evicted + neededBytes <= MAX_CACHE_SIZE_BYTES) {
        break
      }
    }

    // Write the trimmed cache
    cache.recentTransactions = [...currentMonthTxns, ...olderTxns]
      .sort((a, b) => b.date.localeCompare(a.date))
    cache.cachedAt = Date.now()
    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))

    // Verify we have space now
    const newTotal = getTotalCacheSize()
    return newTotal + neededBytes <= MAX_CACHE_SIZE_BYTES
  } catch {
    return false
  }
}
