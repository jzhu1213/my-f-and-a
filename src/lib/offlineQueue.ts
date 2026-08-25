import type { TransactionCategory, TransactionType } from '@/types'
import { insertTransaction, updateTransaction, deleteTransaction, getTransactionFull } from '@/lib/supabaseData'
import { notifyConflictResolved } from '@/lib/conflictResolution'
import { z } from 'zod'
import { TransactionCategorySchema, TransactionTypeSchema } from './schemas/transaction'
import {
  isIndexedDBAvailable,
  getAllItems,
  getItemsByUser,
  addItem as idbAddItem,
  updateItem as idbUpdateItem,
  removeItem as idbRemoveItem,
  clearAll as idbClearAll,
  getCount as idbGetCount,
  findPendingByTransactionId,
  replaceItemPayload,
  migrateFromLocalStorage,
  type QueueItemWithSeq,
} from './offlineQueueDB'

// ============================================================================
// Offline Queue — IndexedDB-backed transaction queue with background retry
// Requirements: 10.2, 10.3, 10.4, 13.7, 32.5
// Task 526 — IndexedDB persistence, ordering, deduplication, size limits
// ============================================================================

const STORAGE_KEY = 'folio-offline-queue'

/** Maximum queue size before warning (Task 526.5) */
export const QUEUE_SIZE_LIMIT = 100

/** Event dispatched when queue exceeds size limit */
export const QUEUE_SIZE_WARNING_EVENT = 'folio-queue-size-warning'

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
// Pending Transaction — expanded with seq for ordering (526.2)
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
  /** Exponential backoff: earliest time this item should be retried (ISO string) */
  nextRetryAt?: string
  /** Sequence number for ordering guarantees (Task 526.2) */
  seq?: number
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
// Initialization — migrate localStorage to IndexedDB on first use
// ============================================================================

let _migrationPromise: Promise<void> | null = null

/** Ensure IndexedDB migration has run. Call once at app startup. */
export function ensureQueueMigration(): Promise<void> {
  if (!isIndexedDBAvailable()) return Promise.resolve()
  if (!_migrationPromise) {
    _migrationPromise = migrateFromLocalStorage()
  }
  return _migrationPromise
}

// ============================================================================
// Queue CRUD helpers — dual storage (IndexedDB primary, localStorage fallback)
// ============================================================================

/**
 * Reads the offline queue synchronously from localStorage.
 * Used for backward compatibility with synchronous consumers and SSR.
 * Migrates legacy items on the fly.
 */
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
            date: legacy.createdAt.slice(0, 10),
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

/**
 * Async queue read from IndexedDB — preferred for new code paths.
 * Falls back to localStorage if IndexedDB is unavailable.
 * Items are returned ordered by seq (Task 526.2).
 */
export async function getOfflineQueueAsync(): Promise<PendingTransaction[]> {
  if (!isIndexedDBAvailable()) return getOfflineQueue()
  try {
    await ensureQueueMigration()
    return await getAllItems()
  } catch {
    return getOfflineQueue()
  }
}

/**
 * Async queue read for a specific user, ordered by seq.
 */
export async function getOfflineQueueForUser(userId: string): Promise<PendingTransaction[]> {
  if (!isIndexedDBAvailable()) {
    return getOfflineQueue().filter((item) => item.userId === userId)
  }
  try {
    await ensureQueueMigration()
    return await getItemsByUser(userId)
  } catch {
    return getOfflineQueue().filter((item) => item.userId === userId)
  }
}

/**
 * Adds a new operation to the offline queue.
 * Task 526.4 — deduplicates update operations (keeps latest payload per transactionId).
 * Task 526.5 — dispatches warning event if queue exceeds QUEUE_SIZE_LIMIT.
 */
export async function addToOfflineQueueAsync(
  userId: string,
  operation: OfflineOperation
): Promise<PendingTransaction> {
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

  if (isIndexedDBAvailable()) {
    try {
      await ensureQueueMigration()

      // Task 526.4 — Deduplication: if this is an update for a transaction
      // that already has a pending update, replace the payload in-place
      if (operation.kind === 'update') {
        const existing = await findPendingByTransactionId(
          userId,
          operation.payload.transactionId,
          'update'
        )
        if (existing) {
          await replaceItemPayload(existing.id, operation, now)
          // Also update localStorage fallback
          _syncToLocalStorage(userId)
          dispatchQueueChange()
          return { ...existing, operation, queuedAt: now, retryCount: 0, status: 'pending', nextRetryAt: undefined }
        }
      }

      // If this is a delete and there's a pending update for the same ID, remove the update
      if (operation.kind === 'delete') {
        const existingUpdate = await findPendingByTransactionId(
          userId,
          operation.payload.transactionId,
          'update'
        )
        if (existingUpdate) {
          await idbRemoveItem(existingUpdate.id)
        }
      }

      const result = await idbAddItem(item)

      // Task 526.5 — Check queue size and warn if exceeded
      const count = await idbGetCount()
      if (count >= QUEUE_SIZE_LIMIT) {
        dispatchQueueSizeWarning(count)
      }

      // Sync to localStorage as fallback
      _syncToLocalStorage(userId)
      dispatchQueueChange()
      return result
    } catch {
      // Fall through to localStorage
    }
  }

  // localStorage fallback (synchronous path)
  return addToOfflineQueue(userId, operation)
}

/** Synchronous add — legacy API, still used by callers that can't be async */
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

  // Task 526.4 — Deduplication for localStorage path
  if (operation.kind === 'update') {
    const existingIdx = queue.findIndex(
      (q) =>
        q.userId === userId &&
        q.status === 'pending' &&
        q.operation.kind === 'update' &&
        q.operation.payload.transactionId === operation.payload.transactionId
    )
    if (existingIdx >= 0) {
      // Replace payload in-place, preserving position
      queue[existingIdx] = {
        ...queue[existingIdx],
        operation,
        queuedAt: now,
        retryCount: 0,
        status: 'pending',
        nextRetryAt: undefined,
      }
      persistQueue(queue)
      dispatchQueueChange()
      return queue[existingIdx]
    }
  }

  // If delete, remove any pending update for the same transaction
  if (operation.kind === 'delete') {
    const filtered = queue.filter(
      (q) =>
        !(
          q.userId === userId &&
          q.status === 'pending' &&
          q.operation.kind === 'update' &&
          q.operation.payload.transactionId === operation.payload.transactionId
        )
    )
    filtered.push(item)
    persistQueue(filtered)

    // Task 526.5 — size warning
    if (filtered.length >= QUEUE_SIZE_LIMIT) {
      dispatchQueueSizeWarning(filtered.length)
    }

    dispatchQueueChange()
    return item
  }

  queue.push(item)
  persistQueue(queue)

  // Task 526.5 — size warning
  if (queue.length >= QUEUE_SIZE_LIMIT) {
    dispatchQueueSizeWarning(queue.length)
  }

  dispatchQueueChange()
  return item
}

/** Removes a successfully synced transaction from the queue */
export async function removeFromOfflineQueueAsync(id: string): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await idbRemoveItem(id)
    } catch {
      // Fall through to localStorage
    }
  }
  // Also remove from localStorage fallback
  const queue = getOfflineQueue().filter((item) => item.id !== id)
  persistQueue(queue)
  dispatchQueueChange()
}

/** Synchronous remove — backward compatible */
export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id)
  persistQueue(queue)
  // Also remove from IndexedDB (fire-and-forget)
  if (isIndexedDBAvailable()) {
    idbRemoveItem(id).catch(() => {})
  }
  dispatchQueueChange()
}

/** Updates an existing queue item (e.g. retryCount, status) */
export async function updateQueueItemAsync(
  id: string,
  updates: Partial<PendingTransaction>
): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await idbUpdateItem(id, updates)
    } catch {
      // Fall through to localStorage
    }
  }
  // Also update localStorage fallback
  const queue = getOfflineQueue().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  )
  persistQueue(queue)
  dispatchQueueChange()
}

/** Synchronous update — backward compatible */
export function updateQueueItem(
  id: string,
  updates: Partial<PendingTransaction>
): void {
  const queue = getOfflineQueue().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  )
  persistQueue(queue)
  // Also update IndexedDB (fire-and-forget)
  if (isIndexedDBAvailable()) {
    idbUpdateItem(id, updates).catch(() => {})
  }
  dispatchQueueChange()
}

/** Clears the entire offline queue */
export async function clearOfflineQueueAsync(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await idbClearAll()
    } catch {
      // Fall through to localStorage
    }
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
  dispatchQueueChange()
}

/** Synchronous clear — backward compatible */
export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  // Also clear IndexedDB (fire-and-forget)
  if (isIndexedDBAvailable()) {
    idbClearAll().catch(() => {})
  }
  dispatchQueueChange()
}

/** Returns the current queue length (synchronous — from localStorage) */
export function getQueueSize(): number {
  return getOfflineQueue().length
}

/** Async queue size — from IndexedDB (more accurate) */
export async function getQueueSizeAsync(): Promise<number> {
  if (!isIndexedDBAvailable()) return getQueueSize()
  try {
    return await idbGetCount()
  } catch {
    return getQueueSize()
  }
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
  }
  return ids
}

// ============================================================================
// Background processing — dispatches based on operation kind
// Task 526.2 — processes in seq order
// Task 526.3 — graceful failure: marks failed items and continues
// ============================================================================

/** In-memory lock to prevent concurrent processOfflineQueue calls */
let _processingLock = false

/**
 * Processes all pending/failed items in the queue sequentially by seq order.
 * Task 526.3 — On failure, marks the item and continues with the rest.
 * Never blocks the queue on a single failed item.
 *
 * Returns counts of succeeded, failed, and skipped items.
 */
export async function processOfflineQueue(
  userId: string
): Promise<{ succeeded: number; failed: number }> {
  if (_processingLock) return { succeeded: 0, failed: 0 }
  _processingLock = true

  try {
    return await _processQueueInternal(userId)
  } finally {
    _processingLock = false
  }
}

// ============================================================================
// Payload Validation (Task 520.4)
// ============================================================================

const CreatePayloadSchema = z.object({
  category: TransactionCategorySchema,
  amount: z.number().nonnegative(),
  type: TransactionTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

const UpdatePayloadSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().nonnegative(),
  category: TransactionCategorySchema,
  type: TransactionTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

const DeletePayloadSchema = z.object({
  transactionId: z.string().min(1),
})

/** Validate an offline operation payload before replay. */
function validateOfflinePayload(operation: OfflineOperation): boolean {
  switch (operation.kind) {
    case 'create':
      return CreatePayloadSchema.safeParse(operation.payload).success
    case 'update':
      return UpdatePayloadSchema.safeParse(operation.payload).success
    case 'delete':
      return DeletePayloadSchema.safeParse(operation.payload).success
    default:
      return false
  }
}

/**
 * Get quarantined (failed-validation) queue items for user review.
 */
export function getQuarantinedItems(userId: string): PendingTransaction[] {
  return getOfflineQueue().filter(
    (item) => item.userId === userId && item.status === 'failed'
  )
}

async function _processQueueInternal(
  userId: string
): Promise<{ succeeded: number; failed: number }> {
  // Prefer IndexedDB (ordered by seq) over localStorage
  let queue: PendingTransaction[]
  if (isIndexedDBAvailable()) {
    try {
      await ensureQueueMigration()
      queue = await getItemsByUser(userId)
    } catch {
      queue = getOfflineQueue().filter((item) => item.userId === userId)
    }
  } else {
    queue = getOfflineQueue().filter((item) => item.userId === userId)
  }

  let succeeded = 0
  let failed = 0
  const now = new Date().toISOString()

  for (const item of queue) {
    // Skip items already marked failed — user must explicitly retry
    if (item.status === 'failed') {
      failed++
      continue
    }

    // Skip already synced items
    if (item.status === 'synced') continue

    // Exponential backoff: skip items whose retry time hasn't arrived
    if (item.nextRetryAt && new Date(item.nextRetryAt) > new Date(now)) {
      continue
    }

    // Schema validation (Task 520.4)
    if (!validateOfflinePayload(item.operation)) {
      updateQueueItem(item.id, { status: 'failed' })
      if (isIndexedDBAvailable()) {
        idbUpdateItem(item.id, { status: 'failed' }).catch(() => {})
      }
      failed++
      // Task 526.3 — continue processing remaining items
      continue
    }

    // Mark as retrying
    updateQueueItem(item.id, { status: 'retrying' })
    if (isIndexedDBAvailable()) {
      idbUpdateItem(item.id, { status: 'retrying' }).catch(() => {})
    }

    let success = false

    try {
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
          // Last-write-wins conflict resolution
          const serverRecord = await getTransactionFull(userId, payload.transactionId)
          if (!serverRecord) {
            // Delete-wins (Task 524.3)
            notifyConflictResolved({
              entityType: 'transaction',
              resolution: 'deleted',
              message: 'Updated from another device',
            })
            removeFromOfflineQueue(item.id)
            if (isIndexedDBAvailable()) {
              idbRemoveItem(item.id).catch(() => {})
            }
            succeeded++
            continue
          }

          const serverCreatedAt = new Date(serverRecord.createdAt).getTime()
          const queuedAt = new Date(item.queuedAt).getTime()

          if (serverCreatedAt > queuedAt) {
            // Record was recreated — server wins
            notifyConflictResolved({
              entityType: 'transaction',
              resolution: 'server-wins',
              message: 'Updated from another device',
            })
            removeFromOfflineQueue(item.id)
            if (isIndexedDBAvailable()) {
              idbRemoveItem(item.id).catch(() => {})
            }
            succeeded++
            continue
          }

          // Task 524.2: Last-write-wins by updatedAt
          if (serverRecord.updatedAt) {
            const serverUpdatedAt = new Date(serverRecord.updatedAt).getTime()
            if (serverUpdatedAt > queuedAt) {
              notifyConflictResolved({
                entityType: 'transaction',
                resolution: 'server-wins',
                message: 'Updated from another device',
              })
              removeFromOfflineQueue(item.id)
              if (isIndexedDBAvailable()) {
                idbRemoveItem(item.id).catch(() => {})
              }
              succeeded++
              continue
            }
          }

          const result = await updateTransaction(userId, payload.transactionId, {
            date: payload.date,
            amount: payload.amount,
            type: payload.type,
            category: payload.category,
            note: payload.note,
          })
          success = result !== null
          if (!success) {
            // Server rejected — treat as conflict resolved
            removeFromOfflineQueue(item.id)
            if (isIndexedDBAvailable()) {
              idbRemoveItem(item.id).catch(() => {})
            }
            succeeded++
            continue
          }
          break
        }

        case 'delete': {
          const { payload } = item.operation
          const result = await deleteTransaction(userId, payload.transactionId)
          success = result
          if (!success) {
            // Already deleted on server — same end state
            removeFromOfflineQueue(item.id)
            if (isIndexedDBAvailable()) {
              idbRemoveItem(item.id).catch(() => {})
            }
            succeeded++
            continue
          }
          break
        }
      }
    } catch {
      // Task 526.3 — Network/unexpected error: don't block the queue
      success = false
    }

    if (success) {
      removeFromOfflineQueue(item.id)
      if (isIndexedDBAvailable()) {
        idbRemoveItem(item.id).catch(() => {})
      }
      succeeded++
    } else {
      // Exponential backoff
      const newRetryCount = item.retryCount + 1
      const backoffMs = Math.min(1000 * Math.pow(2, newRetryCount - 1), 60000)
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()

      const updates = {
        retryCount: newRetryCount,
        status: 'pending' as const,
        nextRetryAt,
      }
      updateQueueItem(item.id, updates)
      if (isIndexedDBAvailable()) {
        idbUpdateItem(item.id, updates).catch(() => {})
      }

      // Task 526.3 — Continue processing remaining items, don't stop here
    }
  }

  // Sync localStorage fallback after processing
  if (isIndexedDBAvailable()) {
    _syncToLocalStorage(userId)
  }

  return { succeeded, failed }
}

// ============================================================================
// Recently synced tracking — brief "synced ✓" indicators
// ============================================================================

const RECENTLY_SYNCED_KEY = 'folio-recently-synced'
const SYNCED_DISPLAY_DURATION_MS = 5000

/** Mark a set of queue item IDs as recently synced (for UI feedback) */
export function markRecentlySynced(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  const now = Date.now()
  const entries: Array<{ id: string; at: number }> = []
  try {
    const raw = localStorage.getItem(RECENTLY_SYNCED_KEY)
    if (raw) {
      const existing = JSON.parse(raw) as Array<{ id: string; at: number }>
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
// Exponential backoff helper
// ============================================================================

/** Calculate the backoff delay in ms for a given retry count (1-indexed) */
export function getBackoffDelayMs(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, Math.max(0, retryCount - 1)), 60000)
}

/** Check if the queue has items that are ready to retry (nextRetryAt has passed) */
export function hasRetryableItems(userId: string): boolean {
  const queue = getOfflineQueue()
  const now = Date.now()
  return queue.some(
    (item) =>
      item.userId === userId &&
      item.status === 'pending' &&
      (!item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now)
  )
}

/** Get the earliest nextRetryAt timestamp for pending items (for scheduling) */
export function getNextRetryTime(userId: string): number | null {
  const queue = getOfflineQueue()
  let earliest: number | null = null
  for (const item of queue) {
    if (item.userId !== userId || item.status !== 'pending') continue
    const retryAt = item.nextRetryAt ? new Date(item.nextRetryAt).getTime() : 0
    if (earliest === null || retryAt < earliest) {
      earliest = retryAt
    }
  }
  return earliest
}

// ============================================================================
// Internal helpers
// ============================================================================

function persistQueue(queue: PendingTransaction[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

/**
 * Sync the IndexedDB state back to localStorage as a fallback.
 * This keeps the synchronous getOfflineQueue() in sync for consumers
 * that haven't migrated to async yet.
 */
async function _syncToLocalStorage(_userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!isIndexedDBAvailable()) return
  try {
    const items = await getAllItems()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Silently ignore — localStorage is just a fallback
  }
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

/** Dispatch a queue size warning event (Task 526.5) */
function dispatchQueueSizeWarning(count: number): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(QUEUE_SIZE_WARNING_EVENT, { detail: { count } })
  )
}
