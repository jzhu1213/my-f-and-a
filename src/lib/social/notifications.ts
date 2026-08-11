/**
 * Social notifications data access layer (task 286).
 *
 * Provides TypeScript types and Supabase CRUD functions for the `notifications`
 * table. Mutations are offline-queue compatible — if a network call fails, the
 * operation is stored locally for background retry.
 *
 * RLS ensures each user can only read/update/delete their own notifications.
 * Cross-user notifications go through the `create_notification()` server-side
 * RPC, which validates a relationship before inserting.
 *
 * Requirements: 14.4 (in-app notifications)
 */

import { supabase } from '../supabaseClient'

// ============================================================================
// Types
// ============================================================================

/** Supported notification types aligned with the DB CHECK constraint */
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'split_added'
  | 'settle_reminder'
  | 'settle_confirmed'

/** Raw row shape as stored in the `notifications` table (snake_case) */
export interface DbNotification {
  id: string
  user_id: string
  actor_id: string | null
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

/** App-level notification shape (camelCase) */
export interface SocialNotification {
  id: string
  userId: string
  actorId: string | null
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  createdAt: string
}

// ============================================================================
// Friendly Error Copy
// ============================================================================

/** Warm, non-shaming error messages for the notifications UI */
export const NOTIFICATION_ERRORS = {
  noConnection: "Couldn't reach the server — we'll try again when you're back online.",
  fetchFailed: "Couldn't load your notifications right now — try again in a moment.",
  markReadFailed: "Hmm, couldn't mark that as read — we'll retry shortly.",
  deleteFailed: "Couldn't remove that notification — give it another try.",
  createFailed: "Couldn't send that notification — we'll retry when you're back online.",
  unknown: 'Something went wrong on our end — give it another try in a moment.',
} as const

// ============================================================================
// Mapper
// ============================================================================

/** Map a DB row to the app-level SocialNotification shape */
export function mapDbNotification(row: DbNotification): SocialNotification {
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    type: row.type,
    payload: row.payload,
    read: row.read,
    createdAt: row.created_at,
  }
}

// ============================================================================
// Offline Queue Integration
// ============================================================================

const NOTIFICATION_QUEUE_KEY = 'folio-notification-queue'

interface NotificationQueueItem {
  id: string
  action: 'mark_read' | 'mark_all_read' | 'delete' | 'create'
  payload: Record<string, unknown>
  createdAt: string
}

/** Enqueue a failed notification mutation for background retry */
function enqueueNotificationOp(
  action: NotificationQueueItem['action'],
  payload: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(NOTIFICATION_QUEUE_KEY)
    const queue: NotificationQueueItem[] = raw ? JSON.parse(raw) : []
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(NOTIFICATION_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage unavailable — silent fail
  }
}

/** Read pending notification operations (for retry logic) */
export function getNotificationQueue(): NotificationQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIFICATION_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Remove a successfully processed queue item */
export function removeNotificationQueueItem(id: string): void {
  if (typeof window === 'undefined') return
  const queue = getNotificationQueue().filter((item) => item.id !== id)
  localStorage.setItem(NOTIFICATION_QUEUE_KEY, JSON.stringify(queue))
}

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Fetch recent notifications for the current user.
 * Returns unread + recent read notifications, ordered by created_at desc.
 */
export async function fetchNotifications(limit = 50): Promise<SocialNotification[]> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[fetchNotifications]', error.message)
    return []
  }

  return (data ?? []).map((row) => mapDbNotification(row as unknown as DbNotification))
}

/**
 * Mark a single notification as read.
 * Returns true on success, false on failure (queued for retry).
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)

  if (error) {
    console.error('[markNotificationRead]', error.message)
    enqueueNotificationOp('mark_read', { notificationId: id })
    return false
  }

  return true
}

/**
 * Mark all unread notifications as read for the current user.
 * Returns true on success, false on failure (queued for retry).
 */
export async function markAllNotificationsRead(): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return false

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('[markAllNotificationsRead]', error.message)
    enqueueNotificationOp('mark_all_read', {})
    return false
  }

  return true
}

/**
 * Delete a single notification.
 * Returns true on success, false on failure (queued for retry).
 */
export async function deleteNotification(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteNotification]', error.message)
    enqueueNotificationOp('delete', { notificationId: id })
    return false
  }

  return true
}

/**
 * Get the count of unread notifications for the current user.
 */
export async function getUnreadCount(): Promise<number> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('[getUnreadCount]', error.message)
    return 0
  }

  return count ?? 0
}

/**
 * Create a notification for another user via the server-side RPC.
 *
 * The `create_notification` function validates that the caller has a
 * legitimate relationship with the recipient (accepted friend, pending
 * friend request, or shared split) before inserting.
 *
 * Returns the new notification ID on success, or null on failure.
 */
export async function createNotification(
  recipientId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {}
): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_notification', {
    p_recipient: recipientId,
    p_type: type,
    p_payload: payload,
  })

  if (error) {
    console.error('[createNotification]', error.message)
    enqueueNotificationOp('create', { recipientId, type, payload })
    return null
  }

  return data as string | null
}

// ============================================================================
// Background Queue Processing
// ============================================================================

/**
 * Process pending items in the notification queue (background retry).
 * Call this when connectivity is restored.
 */
export async function processNotificationQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getNotificationQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    let success = false

    switch (item.action) {
      case 'mark_read': {
        success = await markNotificationRead(item.payload.notificationId as string)
        break
      }
      case 'mark_all_read': {
        success = await markAllNotificationsRead()
        break
      }
      case 'delete': {
        success = await deleteNotification(item.payload.notificationId as string)
        break
      }
      case 'create': {
        const result = await createNotification(
          item.payload.recipientId as string,
          item.payload.type as NotificationType,
          item.payload.payload as Record<string, unknown>
        )
        success = result !== null
        break
      }
    }

    if (success) {
      removeNotificationQueueItem(item.id)
      succeeded++
    } else {
      failed++
    }
  }

  return { succeeded, failed }
}
