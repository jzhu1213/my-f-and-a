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
 *
 * ── Related modules (savings-projection cluster) ──────────────────────────
 *   • compoundGrowthUtils.ts  — pure compound interest math
 *   • progressCurveUtils.ts   — unified debt+savings progress score
 *   • savingsAccountUtils.ts  — account-level aggregates + projections
 *   • trajectoryUtils.ts      — directional financial health trends
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
 * Sum the positive contributions recorded for a single account within the
 * current calendar month. Withdrawals/corrections (negative deltas) are
 * ignored so the figure reflects money moved *toward* the account this month.
 *
 * Pure read given `now` (aside from the localStorage lookup, which is empty
 * during SSR). Used by the payday contribution reminder to know how much of a
 * user's `monthlyContribution` target has already been met (task 160.1).
 */
export function getMonthToDateContribution(
  accountId: string,
  now: Date = new Date()
): number {
  const monthKey = now.toISOString().slice(0, 7) // YYYY-MM
  return getContributionHistory(accountId)
    .filter(entry => entry.amount > 0 && entry.timestamp.slice(0, 7) === monthKey)
    .reduce((sum, entry) => sum + entry.amount, 0)
}

/**
 * Build a map of accountId → month-to-date contribution total for the given
 * accounts. Convenience wrapper over {@link getMonthToDateContribution} so
 * callers can look up every account in one pass (task 160.1).
 */
export function getMonthToDateContributionsByAccount(
  accountIds: string[],
  now: Date = new Date()
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const id of accountIds) {
    result[id] = getMonthToDateContribution(id, now)
  }
  return result
}

/**
 * Sum the positive contributions recorded for an account within the calendar
 * month of `now` (month-to-date). Withdrawals / negative corrections are
 * ignored so this reflects money actually put in this month.
 *
 * Timestamps are stored as UTC ISO strings; we compare on the `YYYY-MM` prefix
 * so this stays consistent with how entries are recorded.
 *
 * Used by the end-of-month contribution gap reminder (task 160.2).
 */
export function computeMonthToDateContributed(
  accountId: string,
  now: Date = new Date()
): number {
  const monthPrefix = now.toISOString().slice(0, 7) // "YYYY-MM"
  return getContributionHistory(accountId).reduce((sum, entry) => {
    if (entry.amount > 0 && entry.timestamp.slice(0, 7) === monthPrefix) {
      return sum + entry.amount
    }
    return sum
  }, 0)
}

/**
 * Returns true when at least one positive contribution has been recorded across
 * the given accounts. Used to detect the "first contribution" milestone that
 * surfaces a contextual savings micro-lesson (task 162.1).
 *
 * Only positive deltas count — a withdrawal or downward correction is not a
 * contribution.
 */
export function hasAnyRecordedContribution(accountIds: string[]): boolean {
  return accountIds.some(id =>
    getContributionHistory(id).some(entry => entry.amount > 0)
  )
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
