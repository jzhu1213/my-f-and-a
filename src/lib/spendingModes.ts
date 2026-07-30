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
