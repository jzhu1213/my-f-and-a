/**
 * Friend graph data access layer (tasks 279, 280).
 *
 * Provides TypeScript types and Supabase CRUD functions for the `friendships`
 * table. Mutations are offline-queue compatible — if a network call fails, the
 * operation is stored locally for background retry.
 *
 * RLS ensures only the two parties involved can see or mutate a friendship row.
 */

import { supabase } from '../supabaseClient'
import { searchPublicProfiles, type PublicProfile } from './profiles'

// ============================================================================
// Types
// ============================================================================

/** Possible states for a friendship row */
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

/** Optimistic update status for UI feedback */
export type OptimisticStatus = 'pending' | 'sending' | 'failed'

/** An optimistic friend request displayed before server confirmation */
export interface OptimisticFriendRequest {
  id: string
  addresseeId: string
  status: OptimisticStatus
  createdAt: string
}

// ============================================================================
// Friendly Error Copy
// ============================================================================

/** Warm, shame-free error messages for the friends UI */
export const FRIEND_ERRORS = {
  noConnection: "Couldn't reach the server — we'll try again when you're back online.",
  alreadyFriends: 'You two are already connected!',
  alreadyRequested: "You've already sent a request — hang tight while they decide.",
  selfRequest: "You can't send a friend request to yourself, silly.",
  blocked: "This connection isn't available right now.",
  unknown: 'Something went wrong on our end — give it another try in a moment.',
} as const

/** Raw row shape as stored in the `friendships` table */
export interface DbFriendship {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  responded_at: string | null
}

/** App-level friendship type (camelCase) */
export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: FriendshipStatus
  createdAt: string
  respondedAt: string | null
}

// ============================================================================
// Mappers
// ============================================================================

/** Map a DB row to the app-level Friendship shape */
function mapDbFriendship(row: DbFriendship): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }
}

// ============================================================================
// Offline Queue Integration
// ============================================================================

const FRIEND_QUEUE_KEY = 'folio-friend-queue'
const OPTIMISTIC_KEY = 'folio-friend-optimistic'

interface FriendQueueItem {
  id: string
  action: 'send' | 'respond' | 'remove' | 'block'
  payload: Record<string, unknown>
  createdAt: string
}

/** Enqueue a failed friend mutation for background retry */
function enqueueFriendOp(action: FriendQueueItem['action'], payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(FRIEND_QUEUE_KEY)
    const queue: FriendQueueItem[] = raw ? JSON.parse(raw) : []
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(FRIEND_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ============================================================================
// Optimistic Updates — localStorage-backed for immediate UI feedback
// ============================================================================

/**
 * Store an optimistic friend request so the UI can show it immediately
 * while the network call completes (or retries in the background).
 */
export function addOptimisticRequest(addresseeId: string): OptimisticFriendRequest {
  const item: OptimisticFriendRequest = {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    addresseeId,
    status: 'sending',
    createdAt: new Date().toISOString(),
  }
  if (typeof window === 'undefined') return item
  try {
    const raw = localStorage.getItem(OPTIMISTIC_KEY)
    const list: OptimisticFriendRequest[] = raw ? JSON.parse(raw) : []
    list.push(item)
    localStorage.setItem(OPTIMISTIC_KEY, JSON.stringify(list))
  } catch {
    // silent
  }
  return item
}

/** Remove an optimistic request once the server confirms or after retry succeeds */
export function removeOptimisticRequest(addresseeId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(OPTIMISTIC_KEY)
    if (!raw) return
    const list: OptimisticFriendRequest[] = JSON.parse(raw)
    const filtered = list.filter((r) => r.addresseeId !== addresseeId)
    localStorage.setItem(OPTIMISTIC_KEY, JSON.stringify(filtered))
  } catch {
    // silent
  }
}

/** Mark an optimistic request as failed (so UI can show retry affordance) */
export function markOptimisticFailed(addresseeId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(OPTIMISTIC_KEY)
    if (!raw) return
    const list: OptimisticFriendRequest[] = JSON.parse(raw)
    const updated = list.map((r) =>
      r.addresseeId === addresseeId ? { ...r, status: 'failed' as const } : r
    )
    localStorage.setItem(OPTIMISTIC_KEY, JSON.stringify(updated))
  } catch {
    // silent
  }
}

/** Get all optimistic friend requests (for UI display alongside real data) */
export function getOptimisticRequests(): OptimisticFriendRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OPTIMISTIC_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Read pending friend operations (for retry logic) */
export function getFriendQueue(): FriendQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FRIEND_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Remove a successfully processed queue item */
export function removeFriendQueueItem(id: string): void {
  if (typeof window === 'undefined') return
  const queue = getFriendQueue().filter((item) => item.id !== id)
  localStorage.setItem(FRIEND_QUEUE_KEY, JSON.stringify(queue))
}

// ============================================================================
// Rate Limiting — friend requests (localStorage-backed)
// ============================================================================

const FRIEND_REQUEST_RATE_KEY = 'folio-friend-request-rate'
const FRIEND_REQUEST_MAX_PER_HOUR = 10
const FRIEND_REQUEST_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/** Warm error copy for friend request rate limit */
export const FRIEND_REQUEST_RATE_LIMIT_MSG =
  "You've been adding friends quickly — take a breather and try again in a bit."

interface FriendRequestRateEntry {
  timestamps: number[]
}

/**
 * Check if the user can send another friend request.
 * Rate limited to 10 requests per hour (sliding window).
 */
function canSendFriendRequest(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(FRIEND_REQUEST_RATE_KEY)
    if (!raw) return true
    const entry: FriendRequestRateEntry = JSON.parse(raw)
    const cutoff = Date.now() - FRIEND_REQUEST_WINDOW_MS
    const recentTimestamps = entry.timestamps.filter((t) => t > cutoff)
    return recentTimestamps.length < FRIEND_REQUEST_MAX_PER_HOUR
  } catch {
    return true // fail open if localStorage unavailable
  }
}

/**
 * Record that a friend request was just sent (for rate limiting).
 */
function recordFriendRequestSent(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(FRIEND_REQUEST_RATE_KEY)
    const entry: FriendRequestRateEntry = raw ? JSON.parse(raw) : { timestamps: [] }
    const cutoff = Date.now() - FRIEND_REQUEST_WINDOW_MS
    // Keep only timestamps within the window + the new one
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    entry.timestamps.push(Date.now())
    localStorage.setItem(FRIEND_REQUEST_RATE_KEY, JSON.stringify(entry))
  } catch {
    // silent
  }
}

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Send a friend request to another user.
 * The current user becomes the requester; the target becomes the addressee.
 *
 * Supports optimistic updates: the UI can immediately show a "sending" state
 * via `addOptimisticRequest`. On success the optimistic entry is cleared.
 * On failure, the request is queued for background retry and the optimistic
 * entry is marked as failed with a friendly message.
 *
 * Returns the new Friendship on success, or null on failure (queued for retry).
 */
export async function sendFriendRequest(addresseeId: string): Promise<Friendship | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[sendFriendRequest] No authenticated user')
    return null
  }

  // Rate limit: max 10 friend requests per hour
  if (!canSendFriendRequest()) {
    console.warn('[sendFriendRequest] Rate limited')
    markOptimisticFailed(addresseeId)
    return null
  }

  // Optimistic: mark as sending
  addOptimisticRequest(addresseeId)

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: addresseeId })
    .select()
    .single()

  if (error) {
    console.error('[sendFriendRequest]', error.message)
    markOptimisticFailed(addresseeId)
    enqueueFriendOp('send', { addresseeId })
    return null
  }

  // Success — clear the optimistic entry and record for rate limiting
  removeOptimisticRequest(addresseeId)
  recordFriendRequestSent()
  return data ? mapDbFriendship(data as unknown as DbFriendship) : null
}

/**
 * Respond to a pending friend request (accept or decline).
 * Only the addressee of a pending request can call this.
 * Returns the updated Friendship on success, or null on failure.
 */
export async function respondToRequest(
  friendshipId: string,
  response: 'accepted' | 'declined'
): Promise<Friendship | null> {
  const { data, error } = await supabase
    .from('friendships')
    .update({
      status: response,
      responded_at: new Date().toISOString(),
    })
    .eq('id', friendshipId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    console.error('[respondToRequest]', error.message)
    enqueueFriendOp('respond', { friendshipId, response })
    return null
  }

  return data ? mapDbFriendship(data as unknown as DbFriendship) : null
}

/**
 * List all accepted friends for the current user.
 * Returns friendships where status = 'accepted' and the user is either party.
 */
export async function listFriends(): Promise<Friendship[]> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (error) {
    console.error('[listFriends]', error.message)
    return []
  }

  return (data ?? []).map((row) => mapDbFriendship(row as unknown as DbFriendship))
}

/**
 * List pending friend requests addressed to the current user.
 * These are requests the user needs to accept or decline.
 */
export async function listPendingRequests(): Promise<Friendship[]> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'pending')
    .eq('addressee_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listPendingRequests]', error.message)
    return []
  }

  return (data ?? []).map((row) => mapDbFriendship(row as unknown as DbFriendship))
}

/**
 * List outgoing friend requests the current user has SENT that are still pending.
 * Useful for the friends UI to show "Waiting for response…" states.
 */
export async function listOutgoingRequests(): Promise<Friendship[]> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'pending')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listOutgoingRequests]', error.message)
    return []
  }

  return (data ?? []).map((row) => mapDbFriendship(row as unknown as DbFriendship))
}

// ============================================================================
// Discovery — search by handle
// ============================================================================

/**
 * Search discoverable users by handle, excluding the current user and
 * anyone already connected (friends, pending requests, blocked).
 *
 * This is a convenience wrapper around `searchPublicProfiles` tailored
 * for the Friends UI — makes it easy to find people to add.
 *
 * PRIVACY/SAFETY: Blocked users are excluded from results because we filter
 * out ALL users who have an existing friendship row (regardless of status).
 * This means blocked users, pending requests, declined requests, and accepted
 * friends all disappear from search. The unique index `uniq_friendship_pair`
 * ensures a blocked row persists and prevents any new request for that pair.
 */
export async function searchByHandle(query: string): Promise<PublicProfile[]> {
  if (!query.trim()) return []

  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id

  // Fetch matching profiles from the public_profiles view
  const profiles = await searchPublicProfiles(query)

  if (!userId) return profiles

  // Exclude the current user
  const withoutSelf = profiles.filter((p) => p.id !== userId)

  // Fetch all existing friendships to exclude connected users
  const { data: existing } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (!existing || existing.length === 0) return withoutSelf

  // Build a set of user IDs we already have a relationship with
  const connectedIds = new Set<string>()
  for (const row of existing) {
    const other = (row.requester_id as string) === userId
      ? (row.addressee_id as string)
      : (row.requester_id as string)
    connectedIds.add(other)
  }

  return withoutSelf.filter((p) => !connectedIds.has(p.id))
}

/**
 * Remove a friendship (unfriend). Either party can do this.
 * Deletes the row entirely — both users lose visibility.
 * Returns true on success, false on failure (queued for retry).
 */
export async function removeFriend(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)

  if (error) {
    console.error('[removeFriend]', error.message)
    enqueueFriendOp('remove', { friendshipId })
    return false
  }

  return true
}

/**
 * Block a user. Sets the friendship status to 'blocked'.
 * If no friendship row exists, creates one with status 'blocked'.
 * Either party can block. Returns true on success.
 */
export async function blockUser(targetUserId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return false

  // Check if a friendship row already exists between the two users
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`
    )
    .limit(1)
    .single()

  if (existing) {
    // Update existing row to blocked
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked', responded_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) {
      console.error('[blockUser] update failed', error.message)
      enqueueFriendOp('block', { targetUserId })
      return false
    }
    return true
  }

  // No existing row — create a new one with status 'blocked'
  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: userId,
      addressee_id: targetUserId,
      status: 'blocked',
      responded_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[blockUser] insert failed', error.message)
    enqueueFriendOp('block', { targetUserId })
    return false
  }

  return true
}

/**
 * Process pending items in the friend queue (background retry).
 * Call this when connectivity is restored.
 */
export async function processFriendQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getFriendQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    let success = false

    switch (item.action) {
      case 'send': {
        const result = await sendFriendRequest(item.payload.addresseeId as string)
        success = result !== null
        break
      }
      case 'respond': {
        const result = await respondToRequest(
          item.payload.friendshipId as string,
          item.payload.response as 'accepted' | 'declined'
        )
        success = result !== null
        break
      }
      case 'remove': {
        success = await removeFriend(item.payload.friendshipId as string)
        break
      }
      case 'block': {
        success = await blockUser(item.payload.targetUserId as string)
        break
      }
    }

    if (success) {
      removeFriendQueueItem(item.id)
      succeeded++
    } else {
      failed++
    }
  }

  return { succeeded, failed }
}
