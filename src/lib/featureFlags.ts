/**
 * Feature flag system for Folio.
 *
 * Allows advanced/power features to be individually toggled on or off.
 * All flags default to `true` (enabled) — this is progressive disclosure,
 * not removal. Users can hide tools they don't use to keep their experience
 * lean.
 *
 * Persists overrides in localStorage under 'folio-feature-flags'.
 */

// ============================================================================
// Types
// ============================================================================

export interface FeatureFlags {
  debtTracking: boolean
  recurringBills: boolean
  reimbursements: boolean
  sinkingFunds: boolean
  subscriptionAudit: boolean
  savingsProjections: boolean
  compoundGrowthCalculator: boolean
  creditPayoffCalculator: boolean
  lessons: boolean
  goals: boolean
  /**
   * Financial Trajectory view — reframes "net worth" as directional progress.
   * Shows spending trends, savings rate direction, and goal velocity without
   * ever displaying a raw dollar net-worth figure.
   */
  financialTrajectory: boolean
  /**
   * Cash-flow forecast — projects the balance forward through next payday or
   * end of term using income schedule, recurring bills, and sinking-fund reserves.
   */
  cashFlowForecast: boolean
  /**
   * Optional bank/card account linking (e.g. Plaid). Disabled by default —
   * Folio's positioning is "free core + no-linking-required", so this is a
   * strictly opt-in power feature living behind Settings → Tools.
   */
  accountLinking: boolean
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  debtTracking: true,
  recurringBills: true,
  reimbursements: true,
  sinkingFunds: true,
  subscriptionAudit: true,
  savingsProjections: true,
  compoundGrowthCalculator: true,
  creditPayoffCalculator: true,
  lessons: true,
  goals: true,
  financialTrajectory: true,
  cashFlowForecast: true,
  // Account linking is OFF by default — opt-in only (task 107.1).
  accountLinking: false,
}

// ============================================================================
// Storage key
// ============================================================================

const STORAGE_KEY = 'folio-feature-flags'

// ============================================================================
// Public API
// ============================================================================

/**
 * Read feature flags from localStorage, merged with defaults.
 * Any key not present in storage falls back to `true`.
 */
export function getFeatureFlags(): FeatureFlags {
  if (typeof window === 'undefined') return { ...DEFAULT_FEATURE_FLAGS }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FEATURE_FLAGS }
    const overrides = JSON.parse(raw) as Partial<FeatureFlags>
    return { ...DEFAULT_FEATURE_FLAGS, ...overrides }
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
}

/**
 * Persist a single feature flag override.
 */
export function setFeatureFlag(key: keyof FeatureFlags, enabled: boolean): void {
  if (typeof window === 'undefined') return

  const current = getFeatureFlags()
  const updated = { ...current, [key]: enabled }

  // Only store keys that differ from defaults to keep storage minimal
  const overrides: Partial<FeatureFlags> = {}
  for (const k of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
    if (updated[k] !== DEFAULT_FEATURE_FLAGS[k]) {
      overrides[k] = updated[k]
    }
  }

  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  }
}

/**
 * Clear all overrides, resetting every flag back to its default (true).
 */
export function resetFeatureFlags(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Convenience check for a single flag.
 */
export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return getFeatureFlags()[key]
}
