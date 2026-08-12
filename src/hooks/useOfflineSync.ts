import { useState, useEffect, useCallback } from 'react'
import {
  getOfflineQueue,
  processOfflineQueue,
  clearOfflineQueue,
  updateQueueItem,
  getPendingTransactionIds,
  getRecentlySyncedIds,
  markRecentlySynced,
  QUEUE_CHANGE_EVENT,
  dispatchQueueChange,
} from '@/lib/offlineQueue'

// ============================================================================
// useOfflineSync — React hook for managing offline transaction queue
// Requirements: 10.2, 10.3, 10.4, 13.7
// Extends Phase 1 task 7 — exposes per-item sync state
// ============================================================================

export interface UseOfflineSyncReturn {
  /** Number of transactions pending sync */
  pendingCount: number
  /** Whether any items have permanently failed (3 retries exhausted) */
  hasFailed: boolean
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Set of transaction IDs currently pending in the offline queue (for per-item indicators) */
  pendingIds: Set<string>
  /** Set of IDs recently synced (briefly shows "synced ✓" state) */
  recentlySyncedIds: Set<string>
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
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => {
    const queue = getOfflineQueue()
    setPendingCount(queue.length)
    setHasFailed(queue.some((item) => item.status === 'failed'))
    if (userId) {
      setPendingIds(getPendingTransactionIds(userId))
    }
    setRecentlySyncedIds(getRecentlySyncedIds())
  }, [userId])

  // Read queue state on mount and when userId changes
  useEffect(() => {
    refresh()
  }, [refresh, userId])

  // Listen for queue-change events so pending count updates within 500ms
  // of any addToOfflineQueue / removeFromOfflineQueue call (Req 17.8)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleQueueChange = () => refresh()
    window.addEventListener(QUEUE_CHANGE_EVENT, handleQueueChange)
    return () => window.removeEventListener(QUEUE_CHANGE_EVENT, handleQueueChange)
  }, [refresh])

  // Expire recently-synced indicators after the display window
  useEffect(() => {
    if (recentlySyncedIds.size === 0) return
    const timer = setTimeout(() => {
      setRecentlySyncedIds(getRecentlySyncedIds())
    }, 5500)
    return () => clearTimeout(timer)
  }, [recentlySyncedIds])

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
        const preProcessIds = getOfflineQueue()
          .filter((i) => i.userId === userId && i.status === 'pending')
          .map((i) => i.id)
        processOfflineQueue(userId).then((result) => {
          if (result.succeeded > 0) {
            // Mark only the items that were actually removed (succeeded)
            const postProcessIds = new Set(getOfflineQueue().map((i) => i.id))
            const syncedIds = preProcessIds.filter((id) => !postProcessIds.has(id))
            markRecentlySynced(syncedIds)
          }
          refresh()
        })
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
      const preProcessIds = getOfflineQueue()
        .filter((i) => i.userId === userId && i.status !== 'failed')
        .map((i) => i.id)
      processOfflineQueue(userId).then((result) => {
        if (result.succeeded > 0) {
          // Mark only the items that were actually removed (succeeded)
          const postProcessIds = new Set(getOfflineQueue().map((i) => i.id))
          const syncedIds = preProcessIds.filter((id) => !postProcessIds.has(id))
          markRecentlySynced(syncedIds)
        }
        refresh()
      })
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

    const preProcessIds = getOfflineQueue()
      .filter((i) => i.userId === userId)
      .map((i) => i.id)
    const result = await processOfflineQueue(userId)
    if (result.succeeded > 0) {
      const postProcessIds = new Set(getOfflineQueue().map((i) => i.id))
      const syncedIds = preProcessIds.filter((id) => !postProcessIds.has(id))
      markRecentlySynced(syncedIds)
    }
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
      // Remove failed items by filtering and re-persisting
      const remaining = queue.filter((item) => item.status !== 'failed')
      if (typeof window !== 'undefined') {
        localStorage.setItem('folio-offline-queue', JSON.stringify(remaining))
        dispatchQueueChange()
      }
    }
    refresh()
  }, [refresh])

  return {
    pendingCount,
    hasFailed,
    isSyncing,
    pendingIds,
    recentlySyncedIds,
    retryAll,
    dismissFailed,
    refresh,
  }
}
