import { DEFAULT_MIN_BALANCE_BUFFER } from './paySchedule'

// ============================================================================
// Minimum-Balance Buffer — user preference persistence
// ============================================================================
//
// The low-balance / overdraft warning (task 51.3) fires when the projected
// balance would dip below this cushion before payday. It's a personal comfort
// level, so it's user-editable in Settings.
//
// Persisted client-side via localStorage, matching the existing lightweight
// preference pattern in this codebase (e.g. `roundUpSavings.ts`, theme, and
// onboarding flags). This keeps the setting reversible and available offline
// without requiring a schema change, and it degrades gracefully to a sensible
// default when unset or when storage is unavailable.
// ============================================================================

const STORAGE_KEY = 'folio-min-balance-buffer'

/** Upper bound to keep the stored value sane (a friendly cushion, not a fortune). */
const MAX_BUFFER = 2000

/**
 * Reads the configured minimum-balance buffer.
 * Falls back to {@link DEFAULT_MIN_BALANCE_BUFFER} when unset, unparseable, or
 * when storage is unavailable (e.g. during SSR).
 */
export function getMinBalanceBuffer(): number {
  if (typeof window === 'undefined') return DEFAULT_MIN_BALANCE_BUFFER
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_MIN_BALANCE_BUFFER
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MIN_BALANCE_BUFFER
    return Math.min(MAX_BUFFER, parsed)
  } catch {
    return DEFAULT_MIN_BALANCE_BUFFER
  }
}

/**
 * Persists the minimum-balance buffer.
 * Clamps to a sensible range and silently no-ops when storage is unavailable.
 */
export function setMinBalanceBuffer(value: number): void {
  if (typeof window === 'undefined') return
  const clamped = Number.isFinite(value) ? Math.min(MAX_BUFFER, Math.max(0, value)) : DEFAULT_MIN_BALANCE_BUFFER
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(clamped)))
  } catch {
    // Silently fail if storage is unavailable — the in-memory value still applies.
  }
}
