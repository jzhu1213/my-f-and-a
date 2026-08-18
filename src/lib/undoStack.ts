/**
 * undoStack — Pure utility managing a time-boxed undo stack for destructive actions.
 *
 * At most one pending undo action at a time. New actions replace the previous one.
 * Entries expire after a configurable timeout (default 10s, matching toast duration).
 *
 * Supports: delete_transaction, edit_transaction, edit_budget, bulk_delete, bulk_recategorize, refund
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type UndoActionType =
  | 'delete_transaction'
  | 'edit_transaction'
  | 'edit_budget'
  | 'bulk_delete'
  | 'bulk_recategorize'
  | 'refund'

export interface UndoEntry {
  /** Unique ID for this undo entry */
  id: string
  /** Type of destructive action that was performed */
  actionType: UndoActionType
  /** Function to call to reverse the action */
  undoFn: () => Promise<void> | void
  /** Timestamp when the entry was created */
  createdAt: number
  /** Timer ID for auto-expiry */
  timerId: ReturnType<typeof setTimeout> | null
}

// ── Default expiry (matches action toast duration, Req 27.4 — at least 10s) ──
const DEFAULT_EXPIRY_MS = 10000

// ── Undo Stack Singleton ─────────────────────────────────────────────────────

let currentEntry: UndoEntry | null = null

/**
 * Push a new undo entry onto the stack. Replaces any existing entry
 * (the previous undo opportunity is lost).
 */
export function pushUndo(
  actionType: UndoActionType,
  undoFn: () => Promise<void> | void,
  onExpire?: () => void,
  expiryMs: number = DEFAULT_EXPIRY_MS,
): UndoEntry {
  // Clear previous entry if it exists
  if (currentEntry?.timerId) {
    clearTimeout(currentEntry.timerId)
  }

  const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const timerId = setTimeout(() => {
    // Entry expired — commit permanently
    if (currentEntry?.id === id) {
      currentEntry = null
      onExpire?.()
    }
  }, expiryMs)

  currentEntry = { id, actionType, undoFn, createdAt: Date.now(), timerId }
  return currentEntry
}

/**
 * Execute the undo for the current entry (if one exists and hasn't expired).
 * Returns true if undo was performed, false otherwise.
 */
export async function executeUndo(): Promise<boolean> {
  if (!currentEntry) return false

  // Clear the expiry timer
  if (currentEntry.timerId) {
    clearTimeout(currentEntry.timerId)
  }

  const entry = currentEntry
  currentEntry = null

  try {
    await entry.undoFn()
    return true
  } catch (err) {
    console.error('[undoStack] Failed to execute undo:', err)
    return false
  }
}

/**
 * Get the current pending undo entry (if any).
 */
export function getCurrentUndo(): UndoEntry | null {
  return currentEntry
}

/**
 * Clear the current undo entry without executing it.
 */
export function clearUndo(): void {
  if (currentEntry?.timerId) {
    clearTimeout(currentEntry.timerId)
  }
  currentEntry = null
}
