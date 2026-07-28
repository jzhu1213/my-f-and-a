import type { Transaction, Budget } from '@/types'
import type { DailyAllowance } from '@/types/folio'

// ============================================================================
// Home Screen Cache — Zero Perceptible Load
// ============================================================================

/** Default stale threshold: 5 minutes */
const DEFAULT_STALE_THRESHOLD_MS = 300_000

/** Cache key prefix (user-specific) */
const CACHE_KEY_PREFIX = 'folio-home-cache-'

/**
 * Shape of the cached home screen state.
 * Includes everything needed to paint the hero + recent transactions instantly.
 */
export interface HomeCachePayload {
  allowance: DailyAllowance
  recentTransactions: Transaction[]
  budgets: Budget[]
  cachedAt: number // Date.now() timestamp
}

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

    return parsed
  } catch {
    // Corrupted cache — treat as no cache
    return null
  }
}

/**
 * Persist a snapshot of the home screen state to localStorage.
 * Stores the 5 most recent transactions to keep payload small.
 */
export function setHomeCache(
  userId: string,
  data: {
    allowance: DailyAllowance
    transactions: Transaction[]
    budgets: Budget[]
  }
): void {
  if (typeof window === 'undefined') return

  try {
    const payload: HomeCachePayload = {
      allowance: data.allowance,
      recentTransactions: data.transactions.slice(0, 5),
      budgets: data.budgets,
      cachedAt: Date.now(),
    }

    localStorage.setItem(cacheKey(userId), JSON.stringify(payload))
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
