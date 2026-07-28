import { useState, useEffect, useCallback } from 'react'
import {
  getOfflineQueue,
  processOfflineQueue,
  clearOfflineQueue,
  updateQueueItem,
} from '@/lib/offlineQueue'

// ============================================================================
// useOfflineSync — React hook for managing offline transaction queue
// Requirements: 10.2, 10.3, 10.4, 13.7
// ============================================================================

export interface UseOfflineSyncReturn {
  /** Number of transactions pending sync */
  pendingCount: number
  /** Whether any items have permanently failed (3 retries exhausted) */
  hasFailed: boolean
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Retry all pending and failed transactions */
  retryAll: () => Promise<void>
  /** Dismiss failed items by clearing them from the queue */
  dismissFailed: () => void
  /** Refresh the queue state (call after adding to queue externally) */
  refresh: () => void
}

export function useOfflineSync(userId: string | undefined): UseOfflineSyncReturn {
  const [pendingCount, setPendingCount] = useState(0)
  const [hasFailed, setHasFailed] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const refresh = useCallback(() => {
    const queue = getOfflineQueue()
    setPendingCount(queue.length)
    setHasFailed(queue.some((item) => item.status === 'failed'))
  }, [])

  // Read queue state on mount and when userId changes
  useEffect(() => {
    refresh()
  }, [refresh, userId])

  // Attempt background sync on mount if there are pending items
  useEffect(() => {
    if (!userId) return
    const queue = getOfflineQueue()
    const hasPending = queue.some(
      (item) => item.status === 'pending' && item.userId === userId
    )
    if (hasPending) {
      // Slight delay to avoid blocking initial render
      const timer = setTimeout(() => {
        processOfflineQueue(userId).then(() => refresh())
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [userId, refresh])

  // Retry pending items in the background as soon as connectivity returns.
  // This is what clears the sync indicator after an offline write eventually
  // succeeds. (Requirements 10.2, 10.4)
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    const handleOnline = () => {
      processOfflineQueue(userId).then(() => refresh())
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [userId, refresh])

  const retryAll = useCallback(async () => {
    if (!userId || isSyncing) return
    setIsSyncing(true)

    // Reset failed items back to pending before retrying
    const queue = getOfflineQueue()
    for (const item of queue) {
      if (item.status === 'failed' && item.userId === userId) {
        updateQueueItem(item.id, { status: 'pending', retryCount: 0 })
      }
    }

    await processOfflineQueue(userId)
    refresh()
    setIsSyncing(false)
  }, [userId, isSyncing, refresh])

  const dismissFailed = useCallback(() => {
    // Remove only failed items; keep pending ones
    const queue = getOfflineQueue()
    const failedIds = queue
      .filter((item) => item.status === 'failed')
      .map((item) => item.id)

    if (failedIds.length === queue.length) {
      // All are failed — just clear everything
      clearOfflineQueue()
    } else {
      // Remove failed items individually
      for (const id of failedIds) {
        // We can reuse removeFromOfflineQueue logic but to avoid repeated reads
        // we'll clear failed items by filtering and re-persisting
      }
      const remaining = queue.filter((item) => item.status !== 'failed')
      if (typeof window !== 'undefined') {
        localStorage.setItem('folio-offline-queue', JSON.stringify(remaining))
      }
    }
    refresh()
  }, [refresh])

  return {
    pendingCount,
    hasFailed,
    isSyncing,
    retryAll,
    dismissFailed,
    refresh,
  }
}
