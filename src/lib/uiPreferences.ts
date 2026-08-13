// ============================================================================
// UI Preferences — consolidated opt-in toggles for lightweight UI features
// ============================================================================
//
// Merges the thin localStorage getter/setter pairs that were previously spread
// across insightPreferences.ts, savingsBadgePreferences.ts, and
// peerContextPreferences.ts. Each toggle is off by default (opt-in).

// ---------------------------------------------------------------------------
// Insight Preferences — opt-in control for home screen tips/insights
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Savings-rate Badge Preferences — opt-in control for the home screen badge
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Peer Context Preferences — opt-in control for encouraging student benchmarks
// ---------------------------------------------------------------------------
//
// Task 186.1 — "Typical for a student" framing.
//
// This is a strictly OPT-IN feature. Encouraging, anonymized peer context is
// OFF by default and only surfaces once the user turns it on in Settings. It is
// never competitive, never a leaderboard, and never shown on the home screen.

/** localStorage key for the peer-context opt-in toggle. */
const PEER_CONTEXT_ENABLED_KEY = 'folio-peer-context-enabled'

/**
 * Returns whether the user has opted in to seeing encouraging, anonymized
 * "typical for a student" context alongside their spending. Defaults to
 * `false` — this feature is off until the user explicitly enables it.
 */
export function getPeerContextEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(PEER_CONTEXT_ENABLED_KEY)
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Persists the user's preference for showing encouraging peer context.
 */
export function setPeerContextEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PEER_CONTEXT_ENABLED_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ---------------------------------------------------------------------------
// Credit Score Check-in Preferences — opt-in control for credit score tracking
// ---------------------------------------------------------------------------

/** localStorage key for the credit score check-in toggle. */
const CREDIT_SCORE_CHECKIN_KEY = 'folio-credit-score-checkin-enabled'

/**
 * Returns whether the user has opted in to tracking their credit score over
 * time. Defaults to `true` — this feature is on by default.
 */
export function getCreditScoreCheckinEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(CREDIT_SCORE_CHECKIN_KEY)
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

/**
 * Persists the user's preference for tracking credit score over time.
 */
export function setCreditScoreCheckinEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CREDIT_SCORE_CHECKIN_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ---------------------------------------------------------------------------
// Home Style Preferences — compact (minimal) vs. comfortable (dashboard)
// ---------------------------------------------------------------------------
//
// Task 345.1 — "Home style" setting.
//
// Minimal: hero + quick log + recent + tip, no pinned cards (today's default).
// Dashboard: hero + pinned cards + quick log + recent (tips suppressed when
// pinned cards are present to avoid overcrowding).

/** The two available home screen layout styles. */
export type HomeStyle = 'minimal' | 'dashboard'

/** localStorage key for the home style preference. */
const HOME_STYLE_KEY = 'folio-home-style'

/**
 * Returns the user's preferred home screen style. Defaults to `'minimal'`
 * (preserves current behavior — no change for users who haven't configured it).
 */
export function getHomeStyle(): HomeStyle {
  if (typeof window === 'undefined') return 'minimal'
  try {
    const stored = localStorage.getItem(HOME_STYLE_KEY)
    if (stored === 'dashboard') return 'dashboard'
    return 'minimal'
  } catch {
    return 'minimal'
  }
}

/**
 * Persists the user's preferred home screen style.
 */
export function setHomeStyle(style: HomeStyle): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HOME_STYLE_KEY, style)
  } catch {
    // localStorage unavailable — fail silently
  }
}
