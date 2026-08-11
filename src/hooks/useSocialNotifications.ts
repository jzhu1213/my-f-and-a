"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { SocialNotification } from "@/lib/social/notifications"
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as deleteNotificationApi,
  getUnreadCount,
} from "@/lib/social/notifications"

/**
 * useSocialNotifications — fetches and manages in-app social notifications.
 *
 * Fetches notifications on mount and on window focus (visibilitychange).
 * No realtime/websocket — just fetch on open/focus. Gracefully handles
 * offline state by keeping the last known list in memory.
 *
 * Requirements: 14.4 (in-app notifications), task 286.2
 */
export function useSocialNotifications() {
  const [notifications, setNotifications] = useState<SocialNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [items, count] = await Promise.all([
        fetchNotifications(),
        getUnreadCount(),
      ])
      if (mountedRef.current) {
        setNotifications(items)
        setUnreadCount(count)
      }
    } catch {
      // Offline or network error — keep existing state
      console.error('[useSocialNotifications] refresh failed')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  // Re-fetch on window focus (visibilitychange)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refresh])

  // ── Actions ────────────────────────────────────────────────────────────────

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      const success = await markNotificationRead(id)
      if (!success) {
        // Revert optimistic update on failure — queued for retry
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n))
        )
        setUnreadCount((prev) => prev + 1)
      }
    },
    []
  )

  const markAllRead = useCallback(async () => {
    // Optimistic update
    const previousNotifications = notifications
    const previousCount = unreadCount
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)

    const success = await markAllNotificationsRead()
    if (!success) {
      // Revert on failure
      setNotifications(previousNotifications)
      setUnreadCount(previousCount)
    }
  }, [notifications, unreadCount])

  const removeNotification = useCallback(
    async (id: string) => {
      // Optimistic removal
      const removedItem = notifications.find((n) => n.id === id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (removedItem && !removedItem.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }

      const success = await deleteNotificationApi(id)
      if (!success) {
        // Revert on failure
        if (removedItem) {
          setNotifications((prev) => [...prev, removedItem].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ))
          if (!removedItem.read) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      }
    },
    [notifications]
  )

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    deleteNotification: removeNotification,
    refresh,
  }
}
