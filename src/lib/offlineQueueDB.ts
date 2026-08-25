import type { PendingTransaction } from './offlineQueue'

// ============================================================================
// IndexedDB wrapper for offline queue persistence
// Task 526.1 — larger capacity and better concurrency than localStorage
// Requirements: 32.5
// ============================================================================

const DB_NAME = 'folio-offline-queue-db'
const DB_VERSION = 1
const STORE_NAME = 'queue'

/** Auto-incrementing sequence counter key in a separate store */
const SEQ_STORE_NAME = 'meta'
const SEQ_KEY = 'nextSeq'

// ============================================================================
// Types
// ============================================================================

export interface QueueItemWithSeq extends PendingTransaction {
  /** Auto-incrementing sequence number for ordering guarantees */
  seq: number
}

// ============================================================================
// Database initialization
// ============================================================================

let _dbPromise: Promise<IDBDatabase> | null = null

/** Check if IndexedDB is available (not in SSR or restricted environments) */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof indexedDB === 'undefined') return false
  return true
}

/** Open (or create) the IndexedDB database. Returns cached promise. */
function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Queue store — keyed by item.id, indexed by seq for ordering
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('seq', 'seq', { unique: true })
        store.createIndex('userId', 'userId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }

      // Meta store for sequence counter
      if (!db.objectStoreNames.contains(SEQ_STORE_NAME)) {
        db.createObjectStore(SEQ_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      _dbPromise = null
      reject(request.error)
    }
  })

  return _dbPromise
}

// ============================================================================
// Sequence number management
// ============================================================================

/** Get the next sequence number and increment the counter atomically */
async function getNextSeq(): Promise<number> {
  const db = await openDB()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(SEQ_STORE_NAME, 'readwrite')
    const store = tx.objectStore(SEQ_STORE_NAME)

    const getReq = store.get(SEQ_KEY)
    getReq.onsuccess = () => {
      const current = (getReq.result as number) || 0
      const next = current + 1
      const putReq = store.put(next, SEQ_KEY)
      putReq.onsuccess = () => resolve(next)
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// ============================================================================
// CRUD operations
// ============================================================================

/** Get all queue items ordered by sequence number */
export async function getAllItems(): Promise<QueueItemWithSeq[]> {
  const db = await openDB()
  return new Promise<QueueItemWithSeq[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('seq')
    const request = index.getAll()

    request.onsuccess = () => resolve(request.result as QueueItemWithSeq[])
    request.onerror = () => reject(request.error)
  })
}

/** Get all queue items for a specific user, ordered by seq */
export async function getItemsByUser(userId: string): Promise<QueueItemWithSeq[]> {
  const items = await getAllItems()
  return items.filter((item) => item.userId === userId)
}

/** Get a single queue item by ID */
export async function getItem(id: string): Promise<QueueItemWithSeq | undefined> {
  const db = await openDB()
  return new Promise<QueueItemWithSeq | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result as QueueItemWithSeq | undefined)
    request.onerror = () => reject(request.error)
  })
}

/** Add a new item to the queue with an auto-assigned sequence number */
export async function addItem(item: PendingTransaction): Promise<QueueItemWithSeq> {
  const seq = await getNextSeq()
  const itemWithSeq: QueueItemWithSeq = { ...item, seq }

  const db = await openDB()
  return new Promise<QueueItemWithSeq>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(itemWithSeq)

    request.onsuccess = () => resolve(itemWithSeq)
    request.onerror = () => reject(request.error)
  })
}

/** Update an existing item (preserves seq) */
export async function updateItem(
  id: string,
  updates: Partial<PendingTransaction>
): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)

    getReq.onsuccess = () => {
      const existing = getReq.result as QueueItemWithSeq | undefined
      if (!existing) {
        resolve()
        return
      }
      const updated = { ...existing, ...updates }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/** Remove an item from the queue by ID */
export async function removeItem(id: string): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Clear all items from the queue */
export async function clearAll(): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Get the total count of items in the queue */
export async function getCount(): Promise<number> {
  const db = await openDB()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Find a pending update/delete for a specific transaction ID.
 * Used for deduplication — if user edits the same transaction multiple times
 * offline, only the latest state needs to sync. (Task 526.4)
 */
export async function findPendingByTransactionId(
  userId: string,
  transactionId: string,
  kind: 'update' | 'delete'
): Promise<QueueItemWithSeq | undefined> {
  const items = await getItemsByUser(userId)
  return items.find(
    (item) =>
      item.status === 'pending' &&
      item.operation.kind === kind &&
      ((kind === 'update' && (item.operation.payload as { transactionId: string }).transactionId === transactionId) ||
        (kind === 'delete' && (item.operation.payload as { transactionId: string }).transactionId === transactionId))
  )
}

/**
 * Replace an existing item's payload in-place (preserving seq for ordering).
 * Used for deduplication — updates the operation payload without changing queue position.
 */
export async function replaceItemPayload(
  id: string,
  operation: QueueItemWithSeq['operation'],
  queuedAt: string
): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)

    getReq.onsuccess = () => {
      const existing = getReq.result as QueueItemWithSeq | undefined
      if (!existing) {
        resolve()
        return
      }
      const updated: QueueItemWithSeq = {
        ...existing,
        operation,
        queuedAt,
        // Reset retry state since this is a fresh payload
        retryCount: 0,
        status: 'pending',
        nextRetryAt: undefined,
      }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// ============================================================================
// Migration — move existing localStorage data into IndexedDB on first use
// ============================================================================

const MIGRATION_KEY = 'folio-offline-queue-migrated'

/** Migrate localStorage queue to IndexedDB (one-time, idempotent) */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MIGRATION_KEY) === 'true') return

  const raw = localStorage.getItem('folio-offline-queue')
  if (!raw) {
    localStorage.setItem(MIGRATION_KEY, 'true')
    return
  }

  try {
    const items = JSON.parse(raw) as PendingTransaction[]
    for (const item of items) {
      await addItem(item)
    }
    // Don't remove localStorage data yet — keep as fallback during transition
    localStorage.setItem(MIGRATION_KEY, 'true')
  } catch {
    // Migration failed — will retry on next load
  }
}
