'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getFriendQueue, processFriendQueue } from '@/lib/social/friends'
import { getSplitQueue, processSplitQueue } from '@/lib/social/splits'
import {
  getNotificationQueue,
  processNotificationQueue,
} from '@/lib/social/notifications'

// ============================================================================
// useSocialSync — processes social offline queues on reconnect
// Requirements: Task 294.2 — offline queue parity for all social mutations
// Companion to useOfflineSync (which handles the core transaction queue)
// ============================================================================

export interface UseSocialSyncReturn {
  /** Total pending items across all social queues */
  pendingCount: number
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Retry all pending social operations */
  retryAll: () => Promise<void>
  /** Refresh the queue state */
  refresh: () => void
}

export function useSocialSync(): UseSocialSyncReturn {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

  // ── Read queue sizes ───────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    const friendCount = getFriendQueue().length
    const splitCount = getSplitQueue().length
    const notifCount = getNotificationQueue().length
    setPendingCount(friendCount + splitCount + notifCount)
  }, [])

  // Read state on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // ── Process all queues ─────────────────────────────────────────────────────

  const processAll = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setIsSyncing(true)

    try {
      // Process all three queues in parallel
      await Promise.all([
        processFriendQueue(),
        processSplitQueue(),
        processNotificationQueue(),
      ])
    } catch {
      console.error('[useSocialSync] queue processing failed')
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
      refresh()
    }
  }, [refresh])

  // ── Auto-sync on mount if items are pending ────────────────────────────────

  useEffect(() => {
    const total =
      getFriendQueue().length +
      getSplitQueue().length +
      getNotificationQueue().length

    if (total > 0) {
      // Slight delay to avoid blocking initial render
      const timer = setTimeout(() => {
        processAll()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [processAll])

  // ── Auto-sync on reconnect ─────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      // Small delay to let connectivity stabilize
      setTimeout(() => {
        processAll()
      }, 1000)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [processAll])

  // ── Auto-sync on window focus (for items queued in other tabs) ─────────────

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refresh()
        const total =
          getFriendQueue().length +
          getSplitQueue().length +
          getNotificationQueue().length
        if (total > 0) {
          processAll()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [processAll, refresh])

  // ── Manual retry ───────────────────────────────────────────────────────────

  const retryAll = useCallback(async () => {
    await processAll()
  }, [processAll])

  return {
    pendingCount,
    isSyncing,
    retryAll,
    refresh,
  }
}
