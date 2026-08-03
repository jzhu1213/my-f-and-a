// ============================================================================
// Savings-rate Badge Preferences — opt-in control for the home screen badge
// ============================================================================

/** localStorage key for the savings-rate badge opt-in toggle. */
const SAVINGS_RATE_BADGE_KEY = 'folio-savings-rate-badge-enabled'

/**
 * Returns whether the user has opted in to showing the monthly savings-rate
 * badge below the Daily Allowance hero. Defaults to `false` (opt-in) to keep
 * the home screen minimal.
 */
export function getSavingsRateBadgeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(SAVINGS_RATE_BADGE_KEY)
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Persists the user's preference for showing the savings-rate badge on the
 * home screen.
 */
export function setSavingsRateBadgeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SAVINGS_RATE_BADGE_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}
