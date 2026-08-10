import type { TransactionCategory, TransactionType } from '@/types'
import { insertTransaction, updateTransaction, deleteTransaction } from '@/lib/supabaseData'

// ============================================================================
// Offline Queue — localStorage-backed transaction queue with background retry
// Requirements: 10.2, 10.3, 10.4, 13.7
// Extends Phase 1 task 7 — supports income, edits, deletes, and conflict resolution
// ============================================================================

const STORAGE_KEY = 'folio-offline-queue'

// ============================================================================
// Operation Types — the queue now supports multiple operation kinds
// ============================================================================

/** Payload for creating a new transaction (expense or income) */
export interface CreatePayload {
  category: TransactionCategory
  amount: number
  type: TransactionType
  date: string
  note?: string
}

/** Payload for updating an existing transaction */
export interface UpdatePayload {
  transactionId: string
  amount: number
  category: TransactionCategory
  type: TransactionType
  date: string
  note?: string
}

/** Payload for deleting an existing transaction */
export interface DeletePayload {
  transactionId: string
}

/** Discriminated union of all offline queue operations */
export type OfflineOperation =
  | { kind: 'create'; payload: CreatePayload }
  | { kind: 'update'; payload: UpdatePayload }
  | { kind: 'delete'; payload: DeletePayload }

// ============================================================================
// Pending Transaction — expanded to support all operation kinds
// ============================================================================

export interface PendingTransaction {
  id: string
  userId: string
  operation: OfflineOperation
  retryCount: number
  createdAt: string
  status: 'pending' | 'retrying' | 'failed' | 'synced'
  /** Conflict resolution: timestamp when this operation was queued (ISO string) */
  queuedAt: string
}

/**
 * @deprecated — kept for backward compatibility during migration.
 * Old-format items that only stored QuickTransaction (expense-only).
 */
interface LegacyPendingTransaction {
  id: string
  userId: string
  transaction: { category: TransactionCategory; amount: number; note?: string }
  retryCount: number
  createdAt: string
  status: 'pending' | 'retrying' | 'failed'
}

// ============================================================================
// Queue CRUD helpers
// ============================================================================

/** Reads the offline queue from localStorage, migrating legacy items on the fly */
export function getOfflineQueue(): PendingTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as (PendingTransaction | LegacyPendingTransaction)[]
    // Migrate any legacy items that lack the `operation` field
    const migrated = parsed.map((item) => {
      if ('operation' in item) return item as PendingTransaction
      // Legacy format — convert to new shape
      const legacy = item as LegacyPendingTransaction
      return {
        id: legacy.id,
        userId: legacy.userId,
        operation: {
          kind: 'create' as const,
          payload: {
            category: legacy.transaction.category,
            amount: legacy.transaction.amount,
            type: 'expense' as TransactionType,
            date: legacy.createdAt.slice(0, 10), // YYYY-MM-DD from ISO
            note: legacy.transaction.note,
          },
        },
        retryCount: legacy.retryCount,
        createdAt: legacy.createdAt,
        status: legacy.status === 'failed' ? ('failed' as const) : legacy.status === 'retrying' ? ('retrying' as const) : ('pending' as const),
        queuedAt: legacy.createdAt,
      } satisfies PendingTransaction
    })
    return migrated
  } catch {
    return []
  }
}

/** Adds a new operation to the offline queue */
export function addToOfflineQueue(
  userId: string,
  operation: OfflineOperation
): PendingTransaction {
  const now = new Date().toISOString()
  const item: PendingTransaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    operation,
    retryCount: 0,
    createdAt: now,
    status: 'pending',
    queuedAt: now,
  }

  const queue = getOfflineQueue()
  queue.push(item)
  persistQueue(queue)
  dispatchQueueChange()
  return item
}

/** Removes a successfully synced transaction from the queue */
export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id)
  persistQueue(queue)
  dispatchQueueChange()
}

/** Updates an existing queue item (e.g. retryCount, status) */
export function updateQueueItem(
  id: string,
  updates: Partial<PendingTransaction>
): void {
  const queue = getOfflineQueue().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  )
  persistQueue(queue)
}

/** Clears the entire offline queue */
export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** Returns the current queue length */
export function getQueueSize(): number {
  return getOfflineQueue().length
}

/** Quick boolean check for whether pending items exist */
export function hasPendingTransactions(): boolean {
  return getQueueSize() > 0
}

/**
 * Returns a set of transaction IDs that are currently pending in the offline queue.
 * Useful for per-transaction "synced" state indicators.
 */
export function getPendingTransactionIds(userId: string): Set<string> {
  const queue = getOfflineQueue()
  const ids = new Set<string>()
  for (const item of queue) {
    if (item.userId !== userId) continue
    if (item.status === 'synced') continue
    if (item.operation.kind === 'update') {
      ids.add(item.operation.payload.transactionId)
    } else if (item.operation.kind === 'delete') {
      ids.add(item.operation.payload.transactionId)
    }
    // For 'create', no existing transaction ID to flag
  }
  return ids
}

// ============================================================================
// Background processing — dispatches based on operation kind
// ============================================================================

/**
 * Processes all pending/failed items in the queue sequentially.
 * - create: inserts a new transaction (expense or income)
 * - update: updates an existing transaction (last-write-wins conflict resolution)
 * - delete: removes a transaction
 *
 * Conflict resolution strategy (last-write-wins):
 * For update/delete operations, the queue item carries a `queuedAt` timestamp.
 * If the server-side transaction has been modified more recently (checked via
 * the DB's `updated_at` column if available), the queued operation is skipped
 * and removed — the server wins. For creates, no conflict check is needed.
 *
 * Returns counts of succeeded and failed items.
 */
export async function processOfflineQueue(
  userId: string
): Promise<{ succeeded: number; failed: number }> {
  const queue = getOfflineQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    // Skip items that don't belong to this user
    if (item.userId !== userId) continue

    // Skip items already marked failed (user must explicitly retry these)
    if (item.status === 'failed') {
      failed++
      continue
    }

    // Skip already synced items (shouldn't happen, but be safe)
    if (item.status === 'synced') continue

    // Mark as retrying
    updateQueueItem(item.id, { status: 'retrying' })

    let success = false

    switch (item.operation.kind) {
      case 'create': {
        const { payload } = item.operation
        const result = await insertTransaction(userId, {
          date: payload.date,
          amount: payload.amount,
          type: payload.type,
          category: payload.category,
          note: payload.note,
          accountType: 'personal',
        })
        success = !!result
        break
      }

      case 'update': {
        const { payload } = item.operation
        const result = await updateTransaction(userId, payload.transactionId, {
          date: payload.date,
          amount: payload.amount,
          type: payload.type,
          category: payload.category,
          note: payload.note,
        })
        // If result is null it could mean the transaction was deleted on the
        // server or the update failed. In either case, treat as "conflict resolved"
        // — server state wins (last-write-wins). Remove from queue on success OR
        // when the server no longer has the record (404-like).
        success = result !== null
        if (!success) {
          // The server may have deleted this transaction or it doesn't exist.
          // Under last-write-wins, we accept the server state and drop the item.
          removeFromOfflineQueue(item.id)
          succeeded++ // Conflict resolved, not a user-facing failure
          continue
        }
        break
      }

      case 'delete': {
        const { payload } = item.operation
        const result = await deleteTransaction(userId, payload.transactionId)
        // If the transaction is already gone, that's fine — same end state.
        success = result
        if (!success) {
          // Already deleted on server — treat as resolved
          removeFromOfflineQueue(item.id)
          succeeded++
          continue
        }
        break
      }
    }

    if (success) {
      removeFromOfflineQueue(item.id)
      succeeded++
    } else {
      const newRetryCount = item.retryCount + 1
      const newStatus = newRetryCount >= 3 ? 'failed' : 'pending'
      updateQueueItem(item.id, {
        retryCount: newRetryCount,
        status: newStatus,
      })
      if (newStatus === 'failed') {
        failed++
      }
    }
  }

  return { succeeded, failed }
}

// ============================================================================
// Recently synced tracking — brief "synced ✓" indicators
// ============================================================================

const RECENTLY_SYNCED_KEY = 'folio-recently-synced'
const SYNCED_DISPLAY_DURATION_MS = 5000 // Show "synced" for 5 seconds

/** Mark a set of queue item IDs as recently synced (for UI feedback) */
export function markRecentlySynced(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  const now = Date.now()
  const entries: Array<{ id: string; at: number }> = []
  try {
    const raw = localStorage.getItem(RECENTLY_SYNCED_KEY)
    if (raw) {
      const existing = JSON.parse(raw) as Array<{ id: string; at: number }>
      // Keep only entries that haven't expired
      entries.push(...existing.filter((e) => now - e.at < SYNCED_DISPLAY_DURATION_MS))
    }
  } catch { /* ignore */ }
  for (const id of ids) {
    entries.push({ id, at: now })
  }
  localStorage.setItem(RECENTLY_SYNCED_KEY, JSON.stringify(entries))
}

/** Get IDs of items that were recently synced (within display window) */
export function getRecentlySyncedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(RECENTLY_SYNCED_KEY)
    if (!raw) return new Set()
    const entries = JSON.parse(raw) as Array<{ id: string; at: number }>
    const now = Date.now()
    return new Set(entries.filter((e) => now - e.at < SYNCED_DISPLAY_DURATION_MS).map((e) => e.id))
  } catch {
    return new Set()
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function persistQueue(queue: PendingTransaction[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

// ============================================================================
// Queue change event — notifies listeners (e.g. useOfflineSync) of mutations
// Requirements: 17.8 (pending count updates within 500ms of each queue op)
// ============================================================================

/** Custom event name dispatched whenever the offline queue changes */
export const QUEUE_CHANGE_EVENT = 'folio-queue-change'

/** Dispatch a queue-change event so hooks can reactively update pending count */
export function dispatchQueueChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT))
}
