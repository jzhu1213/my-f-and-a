'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Friendship } from '@/lib/social/friends'
import {
  listFriends,
  listPendingRequests,
  listOutgoingRequests,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  blockUser,
  getOptimisticRequests,
  type OptimisticFriendRequest,
} from '@/lib/social/friends'

// ============================================================================
// useFriends — lightweight hook for friend data
// Requirements: Task 294.1 — keep social data in dedicated hooks, not useHomeData
// ============================================================================

export interface UseFriendsReturn {
  /** Accepted friends list */
  friends: Friendship[]
  /** Incoming pending requests (addressee is current user) */
  pendingRequests: Friendship[]
  /** Outgoing pending requests (requester is current user) */
  outgoingRequests: Friendship[]
  /** Optimistic friend requests not yet confirmed by server */
  optimisticRequests: OptimisticFriendRequest[]
  /** Whether any fetch is in progress */
  loading: boolean
  /** Send a friend request to another user */
  sendRequest: (addresseeId: string) => Promise<Friendship | null>
  /** Respond to a pending request (accept or decline) */
  respond: (friendshipId: string, response: 'accepted' | 'declined') => Promise<Friendship | null>
  /** Remove (unfriend) an existing friendship */
  remove: (friendshipId: string) => Promise<boolean>
  /** Block a user */
  block: (targetUserId: string) => Promise<boolean>
  /** Manually refresh all friend data */
  refresh: () => Promise<void>
}

export function useFriends(): UseFriendsReturn {
  const [friends, setFriends] = useState<Friendship[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<Friendship[]>([])
  const [optimisticRequests, setOptimisticRequests] = useState<OptimisticFriendRequest[]>([])
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsList, pending, outgoing] = await Promise.all([
        listFriends(),
        listPendingRequests(),
        listOutgoingRequests(),
      ])
      if (mountedRef.current) {
        setFriends(friendsList)
        setPendingRequests(pending)
        setOutgoingRequests(outgoing)
        setOptimisticRequests(getOptimisticRequests())
      }
    } catch {
      // Offline or network error — keep existing state
      console.error('[useFriends] refresh failed')
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
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  // ── Actions ────────────────────────────────────────────────────────────────

  const sendRequest = useCallback(
    async (addresseeId: string): Promise<Friendship | null> => {
      const result = await sendFriendRequest(addresseeId)
      // Refresh optimistic state immediately
      if (mountedRef.current) {
        setOptimisticRequests(getOptimisticRequests())
      }
      // Full refresh to sync server state
      await refresh()
      return result
    },
    [refresh]
  )

  const respond = useCallback(
    async (friendshipId: string, response: 'accepted' | 'declined'): Promise<Friendship | null> => {
      // Optimistic: remove from pending
      setPendingRequests((prev) => prev.filter((r) => r.id !== friendshipId))

      const result = await respondToRequest(friendshipId, response)
      if (!result) {
        // Revert on failure — re-fetch
        await refresh()
      } else if (response === 'accepted') {
        // Add to friends list optimistically
        setFriends((prev) => [...prev, result])
      }
      return result
    },
    [refresh]
  )

  const remove = useCallback(
    async (friendshipId: string): Promise<boolean> => {
      // Optimistic: remove from friends list
      const removedFriend = friends.find((f) => f.id === friendshipId)
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId))

      const success = await removeFriend(friendshipId)
      if (!success && removedFriend) {
        // Revert on failure
        setFriends((prev) => [...prev, removedFriend])
      }
      return success
    },
    [friends]
  )

  const block = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      const success = await blockUser(targetUserId)
      if (success) {
        // Remove from friends/pending if present
        setFriends((prev) =>
          prev.filter((f) => f.requesterId !== targetUserId && f.addresseeId !== targetUserId)
        )
        setPendingRequests((prev) =>
          prev.filter((r) => r.requesterId !== targetUserId)
        )
      }
      return success
    },
    []
  )

  return {
    friends,
    pendingRequests,
    outgoingRequests,
    optimisticRequests,
    loading,
    sendRequest,
    respond,
    remove,
    block,
    refresh,
  }
}
