// ============================================================================
// Insight Preferences — opt-in control for home screen tips/insights
// ============================================================================

/** localStorage key for the insights opt-in toggle. */
const INSIGHTS_ENABLED_KEY = 'folio-insights-enabled'

/**
 * Returns whether the user has opted in to showing daily insights on the
 * home screen. Defaults to `false` (opt-in, not always-on).
 */
export function getInsightsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(INSIGHTS_ENABLED_KEY)
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Persists the user's preference for showing daily insights on the home screen.
 */
export function setInsightsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INSIGHTS_ENABLED_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}
