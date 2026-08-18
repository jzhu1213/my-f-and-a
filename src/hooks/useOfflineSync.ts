import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getOfflineQueue,
  processOfflineQueue,
  clearOfflineQueue,
  updateQueueItem,
  getPendingTransactionIds,
  getRecentlySyncedIds,
  markRecentlySynced,
  hasRetryableItems,
  getNextRetryTime,
  QUEUE_CHANGE_EVENT,
  dispatchQueueChange,
} from '@/lib/offlineQueue'

// ============================================================================
// useOfflineSync — React hook for managing offline transaction queue
// Requirements: 10.2, 10.3, 10.4, 13.7, 28.6
// Extends Phase 1 task 7 — exposes per-item sync state
// Phase 20 task 474.3 — exponential backoff, persistent syncing indicator
// ============================================================================

export interface UseOfflineSyncReturn {
  /** Number of transactions pending sync */
  pendingCount: number
  /** Whether any items have permanently failed (3 retries exhausted) */
  hasFailed: boolean
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Whether the queue is in a backoff retry cycle (for persistent indicator) */
  isRetrying: boolean
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
  const [isRetrying, setIsRetrying] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  // Ref for the backoff scheduler timer so we can cancel it
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    const queue = getOfflineQueue()
    setPendingCount(queue.length)
    setHasFailed(queue.some((item) => item.status === 'failed'))
    if (userId) {
      setPendingIds(getPendingTransactionIds(userId))
    }
    setRecentlySyncedIds(getRecentlySyncedIds())

    // Update isRetrying based on whether items are in backoff
    if (userId) {
      const hasPending = queue.some(
        (item) => item.userId === userId && item.status === 'pending' && item.retryCount > 0
      )
      setIsRetrying(hasPending)
    }
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

  /**
   * Core sync + schedule function.
   * Processes retryable items, then schedules the next retry based on
   * the earliest `nextRetryAt` in the queue. Never drops mutations.
   */
  const syncAndSchedule = useCallback(async () => {
    if (!userId) return

    // Check if there are items ready to process
    if (!hasRetryableItems(userId)) {
      // Nothing ready now — schedule for when the next item is due
      scheduleNextRetry()
      return
    }

    setIsSyncing(true)
    setIsRetrying(true)

    const preProcessIds = getOfflineQueue()
      .filter((i) => i.userId === userId && i.status === 'pending')
      .map((i) => i.id)

    const result = await processOfflineQueue(userId)

    if (result.succeeded > 0) {
      const postProcessIds = new Set(getOfflineQueue().map((i) => i.id))
      const syncedIds = preProcessIds.filter((id) => !postProcessIds.has(id))
      markRecentlySynced(syncedIds)
    }

    refresh()
    setIsSyncing(false)

    // Schedule next retry if there are still pending items
    scheduleNextRetry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refresh])

  /** Schedule the next processOfflineQueue call based on earliest nextRetryAt */
  const scheduleNextRetry = useCallback(() => {
    if (!userId) return

    // Clear any existing timer
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    const queue = getOfflineQueue()
    const hasPending = queue.some(
      (item) => item.userId === userId && item.status === 'pending'
    )

    if (!hasPending) {
      setIsRetrying(false)
      return
    }

    // Find the earliest retry time
    const nextTime = getNextRetryTime(userId)
    if (nextTime === null) {
      setIsRetrying(false)
      return
    }

    const delayMs = Math.max(0, nextTime - Date.now())

    // Schedule the next processing attempt
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      syncAndSchedule()
    }, delayMs)

    setIsRetrying(true)
  }, [userId, syncAndSchedule])

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
        syncAndSchedule()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [userId, syncAndSchedule])

  // Retry pending items in the background as soon as connectivity returns.
  // This is what clears the sync indicator after an offline write eventually
  // succeeds. (Requirements 10.2, 10.4, 28.6)
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    const handleOnline = () => {
      // When coming back online, reset nextRetryAt on all pending items
      // so they retry immediately
      const queue = getOfflineQueue()
      for (const item of queue) {
        if (item.userId === userId && item.status === 'pending' && item.nextRetryAt) {
          updateQueueItem(item.id, { nextRetryAt: undefined })
        }
      }
      syncAndSchedule()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [userId, syncAndSchedule])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [])

  const retryAll = useCallback(async () => {
    if (!userId || isSyncing) return
    setIsSyncing(true)

    // Reset all items back to pending with no backoff delay
    const queue = getOfflineQueue()
    for (const item of queue) {
      if (item.userId === userId && (item.status === 'failed' || item.status === 'pending')) {
        updateQueueItem(item.id, { status: 'pending', retryCount: 0, nextRetryAt: undefined })
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

    // If items remain, schedule with backoff
    scheduleNextRetry()
  }, [userId, isSyncing, refresh, scheduleNextRetry])

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
    isRetrying,
    pendingIds,
    recentlySyncedIds,
    retryAll,
    dismissFailed,
    refresh,
  }
}
