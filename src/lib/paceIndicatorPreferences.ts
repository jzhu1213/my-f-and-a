// ============================================================================
// Pace Indicator Preferences — control for the spending-velocity sparkline
// ============================================================================

/** localStorage key for the pace indicator toggle. */
const PACE_INDICATOR_KEY = 'folio-pace-indicator-enabled'

/**
 * Returns whether the user has the spending-pace indicator enabled beneath the
 * Daily Allowance hero. Defaults to `true` (on by default since it's subtle
 * and informative, not intrusive).
 */
export function getPaceIndicatorEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(PACE_INDICATOR_KEY)
    // Default to true when no preference has been set
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

/**
 * Persists the user's preference for showing the spending-pace indicator on
 * the home screen.
 */
export function setPaceIndicatorEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PACE_INDICATOR_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}
