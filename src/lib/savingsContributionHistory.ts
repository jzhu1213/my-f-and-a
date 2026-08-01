/**
 * Per-account savings/investment contribution history.
 *
 * Folio's `SavingsAccount` stores only a single running `balance` — there is no
 * server-side log of how that balance changed over time. This module keeps a
 * lightweight, local record of every balance change (a "contribution") so users
 * can see their account grow over time, using the same visual language as the
 * transaction list.
 *
 * Follows the established localStorage-only pattern (see `tagUtils.ts` and
 * `categorizationRules.ts`): a pure module with get/append helpers keyed by
 * account id, guarded for SSR with `typeof window` checks. No Supabase table is
 * involved — this stays backward-compatible and fully local.
 *
 * Task 158.2
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single recorded change to a savings/investment account balance.
 */
export interface SavingsContributionEntry {
  /** Unique identifier for this history entry. */
  id: string
  /** The savings account this entry belongs to. */
  accountId: string
  /**
   * The change in balance. Positive for a contribution/gain, negative for a
   * withdrawal/correction.
   */
  amount: number
  /** The account balance after this change was applied. */
  resultingBalance: number
  /** ISO 8601 timestamp of when the change was recorded. */
  timestamp: string
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio-savings-contribution-history"

/** Cap per account to keep localStorage bounded (newest kept). */
const MAX_ENTRIES_PER_ACCOUNT = 200

// ============================================================================
// localStorage persistence
// ============================================================================

/** Map of accountId → entries (unsorted, insertion order). */
type HistoryMap = Record<string, SavingsContributionEntry[]>

function getHistoryMap(): HistoryMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as HistoryMap) : {}
  } catch {
    return {}
  }
}

function saveHistoryMap(map: HistoryMap): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Storage full or unavailable — fail silently, history is non-critical.
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the contribution history for a specific account, newest entry first.
 * Returns an empty array when there is no recorded history (or during SSR).
 */
export function getContributionHistory(accountId: string): SavingsContributionEntry[] {
  const map = getHistoryMap()
  const entries = map[accountId]
  if (!entries || entries.length === 0) return []
  // Return a sorted copy (newest first) so callers can render directly.
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/**
 * Record a balance change for an account. Returns the created entry.
 *
 * A no-op zero-delta change is still ignored to avoid cluttering the log with
 * meaningless entries (e.g. a name-only edit).
 */
export function recordContribution(
  accountId: string,
  amount: number,
  resultingBalance: number
): SavingsContributionEntry | null {
  if (typeof window === "undefined") return null
  if (!accountId || !Number.isFinite(amount) || amount === 0) return null

  const entry: SavingsContributionEntry = {
    id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    amount,
    resultingBalance,
    timestamp: new Date().toISOString(),
  }

  const map = getHistoryMap()
  const existing = map[accountId] ?? []
  const next = [...existing, entry]
  // Keep only the most recent MAX_ENTRIES_PER_ACCOUNT entries.
  map[accountId] =
    next.length > MAX_ENTRIES_PER_ACCOUNT ? next.slice(next.length - MAX_ENTRIES_PER_ACCOUNT) : next
  saveHistoryMap(map)

  return entry
}

/**
 * Remove all recorded history for an account. Useful when an account is deleted
 * so orphaned entries don't accumulate.
 */
export function clearContributionHistory(accountId: string): void {
  const map = getHistoryMap()
  if (map[accountId]) {
    delete map[accountId]
    saveHistoryMap(map)
  }
}
