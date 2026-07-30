/**
 * Spending Mode — a lightweight preference that shapes how Folio
 * communicates budget signals to the user.
 *
 * Persisted in localStorage only (no Supabase table needed).
 * Pattern mirrors `src/lib/insightPreferences.ts` and `src/lib/featureFlags.ts`.
 *
 * The mode never blocks logging — it is a display/signal preference only.
 */

// ============================================================================
// Types
// ============================================================================

export type SpendingMode = 'tracker' | 'guided' | 'structured'

/**
 * Over-limit response — controls what the app shows when the user goes over
 * their daily allowance. All options are shame-free.
 *
 * - `'quiet'`   : color change only (existing behavior) — default for tracker
 * - `'gentle'`  : one-line calm message near the hero — default for guided
 * - `'headsup'` : one-line message + a small actionable chip — default for structured
 */
export type OverLimitResponse = 'quiet' | 'gentle' | 'headsup'

// ============================================================================
// Labels & Descriptions (used in SettingsScreen)
// ============================================================================

export const SPENDING_MODE_LABELS: Record<
  SpendingMode,
  { label: string; description: string }
> = {
  tracker: {
    label: 'Just tracking',
    description: "Records what you spend — no limits, no nudges, just a clear picture.",
  },
  guided: {
    label: 'Guided',
    description: "Gentle nudges when you're spending more than usual. Relaxed and flexible.",
  },
  structured: {
    label: 'Structured',
    description: "Firm per-area caps with clear signals when you're close to or over the limit.",
  },
}

// ============================================================================
// Over-limit response labels & descriptions (used in SettingsScreen)
// ============================================================================

export const OVER_LIMIT_RESPONSE_LABELS: Record<
  OverLimitResponse,
  { label: string; description: string }
> = {
  quiet: {
    label: 'Just show the color',
    description: "Only the ring and amount change color — no extra text.",
  },
  gentle: {
    label: 'A calm one-liner',
    description: "One brief, encouraging line below the hero. Nothing alarming.",
  },
  headsup: {
    label: 'A clear nudge with a suggestion',
    description: "A short line plus a quick-action chip so you can do something about it.",
  },
}

/**
 * Returns the default OverLimitResponse for a given SpendingMode.
 * - tracker → quiet (no limits, so no over-limit messaging)
 * - guided  → gentle (soft nudge)
 * - structured → headsup (clearer signal)
 */
export function defaultOverLimitResponse(mode: SpendingMode): OverLimitResponse {
  if (mode === 'tracker') return 'quiet'
  if (mode === 'structured') return 'headsup'
  return 'gentle'
}

// ============================================================================
// Storage key
// ============================================================================

const KEY = 'folio-spending-mode'

// ============================================================================
// Public API
// ============================================================================

/**
 * Read the user's spending mode from localStorage.
 * Defaults to `'guided'` when no value is stored or storage is unavailable.
 */
export function getSpendingMode(): SpendingMode {
  if (typeof window === 'undefined') return 'guided'
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'tracker' || raw === 'guided' || raw === 'structured') return raw
    return 'guided'
  } catch {
    return 'guided'
  }
}

/**
 * Persist the user's spending mode to localStorage.
 * Fails silently if storage is unavailable.
 */
export function setSpendingMode(mode: SpendingMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Over-limit response persistence
// ============================================================================

const OVER_LIMIT_KEY = 'folio-over-limit-response'

/**
 * Read the user's over-limit response preference from localStorage.
 * When no explicit value is stored, derives the default from the current
 * spending mode so the preference starts reasonable out-of-the-box.
 */
export function getOverLimitResponse(): OverLimitResponse {
  if (typeof window === 'undefined') return 'gentle'
  try {
    const raw = localStorage.getItem(OVER_LIMIT_KEY)
    if (raw === 'quiet' || raw === 'gentle' || raw === 'headsup') return raw
    // No explicit value set — derive from current spending mode
    return defaultOverLimitResponse(getSpendingMode())
  } catch {
    return 'gentle'
  }
}

/**
 * Persist the user's over-limit response preference to localStorage.
 * Fails silently if storage is unavailable.
 */
export function setOverLimitResponsePref(response: OverLimitResponse): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OVER_LIMIT_KEY, response)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}
