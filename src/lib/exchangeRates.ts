// ============================================================================
// Exchange Rates — daily rates with 24h cache and offline fallback
// ============================================================================
//
// Task 421 — Exchange rate service (Group 122: Multi-currency foundation).
//
// Provides a lightweight exchange rate provider backed by the frankfurter.app
// free API. Rates are cached in localStorage with a 24-hour TTL. If the network
// is unavailable, falls back to the last-known cached rates.
//
// Design contract:
//   • Rates are fetched relative to a base currency (defaults to USD).
//   • `getRate(from, to)` returns the rate (to-units per 1 from-unit).
//   • `convert(amount, from, to)` converts an amount between currencies.
//   • Manual overrides are stored per currency pair in localStorage and take
//     precedence over API rates until cleared.
//
// Requirements: 24.1

import { normalizeCode, DEFAULT_HOME_CURRENCY } from './currencyUtils'

// ============================================================================
// Types
// ============================================================================

/** Cached rate data stored in localStorage. */
export interface CachedRates {
  /** Base currency code the rates are relative to. */
  base: string
  /** ISO date string of when rates were fetched. */
  date: string
  /** Timestamp (ms) of when the cache was written. */
  fetchedAt: number
  /** Rate map: currency code → units per 1 base unit. */
  rates: Record<string, number>
}

/** A manual rate override for a specific currency pair. */
export interface RateOverride {
  /** Source currency. */
  from: string
  /** Target currency. */
  to: string
  /** User-entered rate (to-units per 1 from-unit). */
  rate: number
  /** Timestamp when the override was set. */
  setAt: number
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY = 'folio-exchange-rates'
const OVERRIDES_KEY = 'folio-rate-overrides'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const API_BASE = 'https://api.frankfurter.app'

// ============================================================================
// localStorage helpers
// ============================================================================

function readCache(): CachedRates | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedRates
  } catch {
    return null
  }
}

function writeCache(data: CachedRates): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

function readOverrides(): Record<string, RateOverride> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, RateOverride>
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Record<string, RateOverride>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Build a canonical key for a currency pair. */
function pairKey(from: string, to: string): string {
  return `${normalizeCode(from)}_${normalizeCode(to)}`
}

// ============================================================================
// Cache freshness
// ============================================================================

function isCacheFresh(cache: CachedRates): boolean {
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

// ============================================================================
// API fetching
// ============================================================================

/**
 * Fetch latest rates from frankfurter.app for the given base currency.
 * Returns null if the request fails (network error, API down, etc.).
 */
async function fetchRatesFromAPI(base: string): Promise<CachedRates | null> {
  try {
    const response = await fetch(`${API_BASE}/latest?from=${normalizeCode(base)}`)
    if (!response.ok) return null
    const data = await response.json() as { base: string; date: string; rates: Record<string, number> }
    const cached: CachedRates = {
      base: normalizeCode(data.base),
      date: data.date,
      fetchedAt: Date.now(),
      rates: data.rates,
    }
    writeCache(cached)
    return cached
  } catch {
    return null
  }
}

// ============================================================================
// Core rate resolution
// ============================================================================

/**
 * Load rates, using fresh cache when available, fetching if stale, and falling
 * back to last-known rates if offline.
 */
async function loadRates(base: string = DEFAULT_HOME_CURRENCY): Promise<CachedRates | null> {
  const normalizedBase = normalizeCode(base)
  const cached = readCache()

  // If cache exists, is fresh, and matches the base — use it directly
  if (cached && isCacheFresh(cached) && cached.base === normalizedBase) {
    return cached
  }

  // Try fetching fresh rates
  const fresh = await fetchRatesFromAPI(normalizedBase)
  if (fresh) return fresh

  // Offline fallback: return stale cache if available (even if base differs,
  // we can cross-convert)
  return cached
}

/**
 * Compute a rate from the cached rate map. Handles cross-rates when the
 * desired `from` currency differs from the cache base.
 */
function computeRate(
  rates: CachedRates,
  from: string,
  to: string
): number | null {
  const f = normalizeCode(from)
  const t = normalizeCode(to)

  if (f === t) return 1

  // Direct rate: base → to
  if (f === rates.base && rates.rates[t] !== undefined) {
    return rates.rates[t]
  }

  // Inverse rate: to → base (i.e., from is a non-base currency, to is the base)
  if (t === rates.base && rates.rates[f] !== undefined) {
    return 1 / rates.rates[f]
  }

  // Cross rate: from → base → to
  const fromRate = rates.rates[f] // base → from
  const toRate = rates.rates[t]   // base → to
  if (fromRate !== undefined && toRate !== undefined) {
    return toRate / fromRate
  }

  return null
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the exchange rate for a currency pair. Returns to-units per 1 from-unit.
 * Checks manual overrides first, then cached/fetched rates.
 *
 * Returns `null` if no rate is available (unsupported pair, offline with no cache).
 */
export async function getRate(
  from: string,
  to: string,
  base: string = DEFAULT_HOME_CURRENCY
): Promise<number | null> {
  const f = normalizeCode(from)
  const t = normalizeCode(to)

  if (f === t) return 1

  // Check manual overrides first
  const overrides = readOverrides()
  const key = pairKey(f, t)
  if (overrides[key]) {
    return overrides[key].rate
  }
  // Check inverse override
  const inverseKey = pairKey(t, f)
  if (overrides[inverseKey]) {
    return 1 / overrides[inverseKey].rate
  }

  // Load from cache/API
  const rates = await loadRates(base)
  if (!rates) return null

  return computeRate(rates, f, t)
}

/**
 * Convert an amount from one currency to another.
 * Returns `null` if no rate is available.
 */
export async function convert(
  amount: number,
  from: string,
  to: string,
  base: string = DEFAULT_HOME_CURRENCY
): Promise<number | null> {
  const rate = await getRate(from, to, base)
  if (rate === null) return null
  return amount * rate
}

// ============================================================================
// Manual rate overrides (Task 421.2)
// ============================================================================

/**
 * Set a manual exchange rate override for a specific currency pair.
 * The override takes precedence over API rates until cleared.
 *
 * @param from Source currency code
 * @param to Target currency code
 * @param rate to-units per 1 from-unit
 */
export function setRateOverride(from: string, to: string, rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) return

  const f = normalizeCode(from)
  const t = normalizeCode(to)
  if (!f || !t || f === t) return

  const overrides = readOverrides()
  const key = pairKey(f, t)
  overrides[key] = { from: f, to: t, rate, setAt: Date.now() }
  writeOverrides(overrides)
}

/**
 * Clear a manual rate override for a specific currency pair.
 * After clearing, the pair will use API rates again.
 */
export function clearRateOverride(from: string, to: string): void {
  const f = normalizeCode(from)
  const t = normalizeCode(to)
  const overrides = readOverrides()
  const key = pairKey(f, t)
  delete overrides[key]
  writeOverrides(overrides)
}

/**
 * Clear all manual rate overrides.
 */
export function clearAllOverrides(): void {
  writeOverrides({})
}

/**
 * Get all current manual rate overrides.
 */
export function getAllOverrides(): RateOverride[] {
  const overrides = readOverrides()
  return Object.values(overrides)
}

/**
 * Get the manual override for a specific pair, if one exists.
 */
export function getOverride(from: string, to: string): RateOverride | undefined {
  const overrides = readOverrides()
  return overrides[pairKey(normalizeCode(from), normalizeCode(to))]
}

// ============================================================================
// Cache info (for display purposes)
// ============================================================================

/** Information about the current rate cache state. */
export interface RateCacheInfo {
  /** Whether cached rates exist. */
  hasCachedRates: boolean
  /** Whether the cache is still within the 24h TTL. */
  isFresh: boolean
  /** The date the rates are from (YYYY-MM-DD), or null if no cache. */
  rateDate: string | null
  /** Timestamp of last fetch, or null. */
  lastFetched: number | null
  /** Base currency of cached rates. */
  base: string | null
}

/**
 * Get information about the current cache state. Useful for display
 * ("updated today", "rates from yesterday", etc.).
 */
export function getCacheInfo(): RateCacheInfo {
  const cached = readCache()
  if (!cached) {
    return {
      hasCachedRates: false,
      isFresh: false,
      rateDate: null,
      lastFetched: null,
      base: null,
    }
  }
  return {
    hasCachedRates: true,
    isFresh: isCacheFresh(cached),
    rateDate: cached.date,
    lastFetched: cached.fetchedAt,
    base: cached.base,
  }
}

/**
 * Force a refresh of exchange rates, bypassing the cache TTL.
 * Returns the fresh rates or null if the fetch fails.
 */
export async function refreshRates(
  base: string = DEFAULT_HOME_CURRENCY
): Promise<CachedRates | null> {
  return fetchRatesFromAPI(normalizeCode(base))
}
