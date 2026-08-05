// ============================================================================
// Peer Context Preferences — opt-in control for encouraging student benchmarks
// ============================================================================
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
