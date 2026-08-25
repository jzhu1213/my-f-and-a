import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getOfflineQueue,
  getOfflineQueueAsync,
  processOfflineQueue,
  clearOfflineQueue,
  updateQueueItem,
  getPendingTransactionIds,
  getRecentlySyncedIds,
  markRecentlySynced,
  hasRetryableItems,
  getNextRetryTime,
  ensureQueueMigration,
  QUEUE_CHANGE_EVENT,
  QUEUE_SIZE_WARNING_EVENT,
  QUEUE_SIZE_LIMIT,
  dispatchQueueChange,
} from '@/lib/offlineQueue'

// ============================================================================
// useOfflineSync — React hook for managing offline transaction queue
// Requirements: 10.2, 10.3, 10.4, 13.7, 28.6, 32.5
// Task 526 — IndexedDB support, failure messaging, size warning
// ============================================================================

export interface UseOfflineSyncReturn {
  /** Number of transactions pending sync */
  pendingCount: number
  /** Whether any items have permanently failed (3 retries exhausted) */
  hasFailed: boolean
  /** Number of items that failed to sync (Task 526.3) */
  failedCount: number
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Whether the queue is in a backoff retry cycle (for persistent indicator) */
  isRetrying: boolean
  /** Whether queue size exceeds limit (Task 526.5) */
  hasQueueSizeWarning: boolean
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
  const [failedCount, setFailedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [hasQueueSizeWarning, setHasQueueSizeWarning] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  // Ref for the backoff scheduler timer so we can cancel it
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    const queue = getOfflineQueue()
    setPendingCount(queue.length)
    const failedItems = queue.filter((item) => item.status === 'failed')
    setHasFailed(failedItems.length > 0)
    setFailedCount(failedItems.length)
    setHasQueueSizeWarning(queue.length >= QUEUE_SIZE_LIMIT)
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

  // Trigger IndexedDB migration on mount, then refresh from async source
  useEffect(() => {
    if (typeof window === 'undefined') return
    ensureQueueMigration().then(() => {
      // After migration, do an async refresh to get accurate IndexedDB data
      getOfflineQueueAsync().then((queue) => {
        setPendingCount(queue.length)
        const failedItems = queue.filter((item) => item.status === 'failed')
        setHasFailed(failedItems.length > 0)
        setFailedCount(failedItems.length)
        setHasQueueSizeWarning(queue.length >= QUEUE_SIZE_LIMIT)
      }).catch(() => {
        // Fallback already handled by synchronous refresh
      })
    }).catch(() => {})
  }, [])

  // Read queue state on mount and when userId changes
  useEffect(() => {
    refresh()
  }, [refresh, userId])

  // Listen for queue-change events so pending count updates within 500ms
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleQueueChange = () => refresh()
    window.addEventListener(QUEUE_CHANGE_EVENT, handleQueueChange)
    return () => window.removeEventListener(QUEUE_CHANGE_EVENT, handleQueueChange)
  }, [refresh])

  // Listen for queue size warning events (Task 526.5)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleSizeWarning = () => {
      setHasQueueSizeWarning(true)
    }
    window.addEventListener(QUEUE_SIZE_WARNING_EVENT, handleSizeWarning)
    return () => window.removeEventListener(QUEUE_SIZE_WARNING_EVENT, handleSizeWarning)
  }, [])

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

  // Retry pending items in the background as soon as connectivity returns
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    const handleOnline = () => {
      // When coming back online, reset nextRetryAt on all pending items
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
      clearOfflineQueue()
    } else {
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
    failedCount,
    isSyncing,
    isRetrying,
    hasQueueSizeWarning,
    pendingIds,
    recentlySyncedIds,
    retryAll,
    dismissFailed,
    refresh,
  }
}
