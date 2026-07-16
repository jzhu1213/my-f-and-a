import type { QuickTransaction } from '@/types/folio'
import { insertTransaction } from '@/lib/supabaseData'

// ============================================================================
// Offline Queue — localStorage-backed transaction queue with background retry
// Requirements: 10.2, 10.3, 10.4, 13.7
// ============================================================================

const STORAGE_KEY = 'folio-offline-queue'

export interface PendingTransaction {
  id: string
  userId: string
  transaction: QuickTransaction
  retryCount: number
  createdAt: string
  status: 'pending' | 'retrying' | 'failed'
}

// ============================================================================
// Queue CRUD helpers
// ============================================================================

/** Reads the offline queue from localStorage */
export function getOfflineQueue(): PendingTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingTransaction[]) : []
  } catch {
    return []
  }
}

/** Adds a pending transaction to the queue and returns it */
export function addToOfflineQueue(
  userId: string,
  transaction: QuickTransaction
): PendingTransaction {
  const item: PendingTransaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    transaction,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  const queue = getOfflineQueue()
  queue.push(item)
  persistQueue(queue)
  return item
}

/** Removes a successfully synced transaction from the queue */
export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id)
  persistQueue(queue)
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

// ============================================================================
// Background processing
// ============================================================================

/**
 * Processes all pending/failed items in the queue sequentially.
 * - On success: removes from queue
 * - On failure: increments retryCount; marks 'failed' after 3 attempts
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

    // Mark as retrying
    updateQueueItem(item.id, { status: 'retrying' })

    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const result = await insertTransaction(userId, {
      date,
      amount: item.transaction.amount,
      type: 'expense',
      category: item.transaction.category,
      note: item.transaction.note,
      accountType: 'personal',
    })

    if (result) {
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
// Internal helpers
// ============================================================================

function persistQueue(queue: PendingTransaction[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}
