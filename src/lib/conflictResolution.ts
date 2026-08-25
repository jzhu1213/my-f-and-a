/**
 * Conflict Resolution — multi-device sync conflict detection and resolution.
 *
 * Task 524 (Phase 24, Group 177)
 *
 * Strategy:
 * - Server is source of truth (Phase 24 decision)
 * - Last-write-wins for simple field edits (by `updated_at` timestamp)
 * - Delete always wins over edit
 * - Notify user via custom DOM event when a conflict is resolved
 *
 * Requirements: 32.3
 */

// ============================================================================
// Types
// ============================================================================

export type ConflictResult<T> =
  | { conflict: false }
  | { conflict: true; resolution: 'server-wins'; serverData: T }
  | { conflict: true; resolution: 'deleted' }

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Checks if a write is stale by comparing the local `updatedAt` with the
 * server's current `updatedAt`. If the server has a newer timestamp, a
 * conflict exists (another device wrote since we last fetched).
 *
 * @param localUpdatedAt - The client's last-known `updatedAt` (ISO string or undefined)
 * @param serverUpdatedAt - The server's current `updatedAt` (ISO string or undefined)
 * @returns true if the server's data is newer (conflict exists)
 */
export function checkForConflict(
  localUpdatedAt: string | undefined,
  serverUpdatedAt: string | undefined
): boolean {
  // If either timestamp is missing, we can't detect a conflict — allow the write
  if (!localUpdatedAt || !serverUpdatedAt) return false

  const localTime = new Date(localUpdatedAt).getTime()
  const serverTime = new Date(serverUpdatedAt).getTime()

  // If server's timestamp is strictly newer, conflict exists
  return serverTime > localTime
}

// ============================================================================
// Conflict Resolution — Last-Write-Wins
// ============================================================================

/**
 * Resolves a conflict using last-write-wins semantics. The server's version
 * is newer, so it wins. The client re-fetches and uses the server state.
 *
 * @param serverData - The current server-side record
 * @returns The resolved data (always the server's version for last-write-wins)
 */
export function resolveConflictServerWins<T>(serverData: T): ConflictResult<T> {
  return { conflict: true, resolution: 'server-wins', serverData }
}

// ============================================================================
// Delete-Wins Policy
// ============================================================================

/**
 * Handles the case where one device deleted a record while another tries to
 * edit it. The deletion takes precedence — the edit is discarded silently.
 *
 * @param serverRecordExists - Whether the server still has the record
 * @returns ConflictResult indicating deletion wins, or no conflict
 */
export function handleDeleteWins<T>(serverRecordExists: boolean): ConflictResult<T> {
  if (!serverRecordExists) {
    return { conflict: true, resolution: 'deleted' }
  }
  return { conflict: false }
}

// ============================================================================
// Conflict Notification — Custom DOM Event
// ============================================================================

/** Custom event name dispatched when a conflict is resolved */
export const CONFLICT_RESOLVED_EVENT = 'folio-conflict-resolved'

export interface ConflictResolvedDetail {
  /** Type of entity that had a conflict */
  entityType: 'transaction' | 'budget' | 'goal' | 'debt' | 'sinking_fund'
  /** How the conflict was resolved */
  resolution: 'server-wins' | 'deleted'
  /** Human-readable message for the toast */
  message: string
}

/**
 * Dispatches a conflict-resolved event so the UI can show a toast notification.
 * Safe to call in non-browser environments (no-ops on server).
 */
export function notifyConflictResolved(detail: ConflictResolvedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ConflictResolvedDetail>(CONFLICT_RESOLVED_EVENT, { detail })
  )
}
