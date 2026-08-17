// ============================================================================
// Travel Mode — lightweight utility for detecting active travel currency
// ============================================================================
//
// Task 422.3 — Foreign currency logging (Group 122: Multi-currency foundation).
// Task 424.1 — Travel mode as a spending mode extension.
//
// This file provides the data layer for travel mode. Travel mode is a lightweight
// extension of the spending/budget mode system: it sets a destination currency,
// optionally overrides the daily budget, and tracks trip dates/destination label.
//
// Contract:
//   • `getTravelCurrency()` returns the active travel currency code, or null.
//   • `isTravelModeActive()` returns true when a travel currency is set.
//   • `setTravelCurrency(code)` activates travel mode with the given currency.
//   • `clearTravelCurrency()` deactivates travel mode.
//   • `getTravelModeConfig()` returns the full travel config, or null.
//   • `setTravelModeConfig(config)` saves the full config (and syncs legacy key).
//   • `clearTravelMode()` clears all travel mode data.
//
// Requirements: 24.2, 24.4

import { normalizeCode } from './currencyUtils'
import { getHomeCurrency } from './currencyPreferences'

// ============================================================================
// Types
// ============================================================================

/**
 * Full travel mode configuration — extends the simple currency with optional
 * budget override and trip metadata.
 */
export interface TravelModeConfig {
  /** ISO 4217 destination currency code (e.g., "EUR", "GBP"). */
  currency: string
  /** Optional daily budget override in home currency (replaces normal allowance). */
  dailyBudgetOverride?: number
  /** Optional trip start date (ISO string, e.g., "2024-06-15"). */
  startDate?: string
  /** Optional trip end date (ISO string). */
  endDate?: string
  /** Optional human-friendly destination label (e.g., "London", "Tokyo"). */
  destinationLabel?: string
}

// ============================================================================
// Constants
// ============================================================================

const TRAVEL_CURRENCY_KEY = 'folio-travel-currency'
const TRAVEL_CONFIG_KEY = 'folio-travel-config'

// ============================================================================
// Public API — legacy (backward compatible)
// ============================================================================

/**
 * Get the active travel currency code, or null if travel mode is inactive.
 * Returns null if the stored currency matches the home currency (no point
 * in "traveling" to your own currency).
 */
export function getTravelCurrency(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TRAVEL_CURRENCY_KEY)
    const code = normalizeCode(raw)
    if (!code) return null
    // If travel currency equals home currency, treat as inactive
    if (code === normalizeCode(getHomeCurrency())) return null
    return code
  } catch {
    return null
  }
}

/**
 * Whether travel mode is currently active (a foreign travel currency is set).
 */
export function isTravelModeActive(): boolean {
  return getTravelCurrency() !== null
}

/**
 * Activate travel mode by setting a travel currency.
 * Passing a falsy code or the home currency clears travel mode.
 * Also syncs to the config store for consistency.
 */
export function setTravelCurrency(code: string | undefined | null): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = normalizeCode(code)
    if (!normalized || normalized === normalizeCode(getHomeCurrency())) {
      localStorage.removeItem(TRAVEL_CURRENCY_KEY)
    } else {
      localStorage.setItem(TRAVEL_CURRENCY_KEY, normalized)
    }
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Deactivate travel mode by clearing the stored travel currency.
 * @deprecated Use `clearTravelMode()` instead — clears both legacy and config.
 */
export function clearTravelCurrency(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TRAVEL_CURRENCY_KEY)
  } catch {
    // fail silently
  }
}

// ============================================================================
// Public API — full config (Task 424.1)
// ============================================================================

/**
 * Get the full travel mode configuration, or null if travel mode is inactive.
 * Falls back to the legacy currency key if no config is stored but a travel
 * currency is set (backward compat with task 422.3 activations).
 */
export function getTravelModeConfig(): TravelModeConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TRAVEL_CONFIG_KEY)
    if (raw) {
      const config = JSON.parse(raw) as TravelModeConfig
      const code = normalizeCode(config.currency)
      if (!code || code === normalizeCode(getHomeCurrency())) return null
      return { ...config, currency: code }
    }
    // Fallback: if legacy key is set but no config, create a minimal config
    const legacyCurrency = getTravelCurrency()
    if (legacyCurrency) {
      return { currency: legacyCurrency }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Save the full travel mode configuration. Also syncs the legacy travel
 * currency key for backward compatibility with existing consumers
 * (DailyAllowanceHero, currency logging, etc.).
 */
export function setTravelModeConfig(config: TravelModeConfig): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = normalizeCode(config.currency)
    if (!normalized || normalized === normalizeCode(getHomeCurrency())) {
      // Invalid config — clear everything
      clearTravelMode()
      return
    }
    const stored: TravelModeConfig = { ...config, currency: normalized }
    localStorage.setItem(TRAVEL_CONFIG_KEY, JSON.stringify(stored))
    // Sync legacy key
    localStorage.setItem(TRAVEL_CURRENCY_KEY, normalized)
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Clear all travel mode data — both the full config and the legacy currency key.
 * Use this when ending a trip or deactivating travel mode.
 */
export function clearTravelMode(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TRAVEL_CURRENCY_KEY)
    localStorage.removeItem(TRAVEL_CONFIG_KEY)
  } catch {
    // fail silently
  }
}
