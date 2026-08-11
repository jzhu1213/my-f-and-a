/**
 * Friend Invite Links (task 280.2).
 *
 * Provides an invite-link fallback for connecting with users who aren't
 * discoverable via handle search. A one-time token is generated locally,
 * shared via URL, and when accepted triggers a friend request between
 * the inviter and the recipient.
 *
 * This folds the existing roommateInvite.ts link-building pattern into
 * the friend system. Storage is localStorage for now — each invite record
 * maps a token to the inviter's user ID so the recipient can resolve it.
 *
 * TODO: Migrate invite records to Supabase with RLS so tokens survive
 * across devices and can expire server-side.
 */

import { sendFriendRequest } from './friends'
import { supabase } from '../supabaseClient'

// ============================================================================
// Types
// ============================================================================

/** A locally-stored friend invite record */
export interface FriendInviteRecord {
  /** UUID token used in the invite URL */
  id: string
  /** User ID of the person who created this invite */
  inviterUserId: string
  /** Display name of the inviter (for warm messaging) */
  inviterName: string
  /** ISO timestamp when the invite was created */
  createdAt: string
  /** Whether this invite has been accepted */
  accepted: boolean
  /** ISO timestamp when accepted, if applicable */
  acceptedAt: string | null
  /** Whether the inviter has revoked this invite */
  revoked: boolean
}

// ============================================================================
// Constants
// ============================================================================

const INVITES_KEY = 'folio-friend-invites'
const INVITE_PATH_PREFIX = '/shared/friend-invite'

// ============================================================================
// Pure Builders (deterministic — safe to use in SSR or tests)
// ============================================================================

/**
 * Build a relative path for a friend invite URL.
 * Pattern: `/shared/friend-invite/{token}`
 */
export function buildFriendInvitePath(token: string): string {
  return `${INVITE_PATH_PREFIX}/${token}`
}

/**
 * Build a full, shareable friend invite URL.
 * Falls back to a relative path during SSR where `window` is unavailable.
 */
export function buildFriendInviteUrl(token: string): string {
  const path = buildFriendInvitePath(token)
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/**
 * Compose a warm, friendly invite message the user can share.
 * Keeps the Folio tone: encouraging, casual, never pushy.
 */
export function buildFriendInviteMessage(inviterName: string, url: string): string {
  const who = inviterName.trim() || 'I'
  const opener = who === 'I' ? 'Hey!' : `Hey, it's ${who}!`
  return (
    `${opener} Want to connect on Folio? We can share goals and ` +
    `keep each other on track — no pressure, just vibes.\n\n` +
    `Join here: ${url}`
  )
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a unique invite token (UUID v4).
 * Uses `crypto.randomUUID()` in modern browsers.
 */
export function generateInviteToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============================================================================
// Storage Helpers (localStorage-backed — migrate to Supabase later)
// ============================================================================

function loadInvites(): FriendInviteRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INVITES_KEY)
    return raw ? (JSON.parse(raw) as FriendInviteRecord[]) : []
  } catch {
    return []
  }
}

function saveInvites(invites: FriendInviteRecord[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites))
}

// ============================================================================
// Invite CRUD
// ============================================================================

/**
 * Create and store a new friend invite.
 * Returns the invite record including the generated token.
 */
export function createFriendInvite(inviterUserId: string, inviterName: string): FriendInviteRecord {
  const token = generateInviteToken()
  const record: FriendInviteRecord = {
    id: token,
    inviterUserId,
    inviterName: inviterName.trim() || 'A friend',
    createdAt: new Date().toISOString(),
    accepted: false,
    acceptedAt: null,
    revoked: false,
  }

  const invites = loadInvites()
  invites.push(record)
  saveInvites(invites)
  return record
}

/**
 * Get all sent friend invites for display, most recent first.
 * Excludes revoked invites from the list.
 */
export function getSentFriendInvites(): FriendInviteRecord[] {
  return loadInvites()
    .filter((inv) => !inv.revoked)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Revoke a friend invite by its token ID.
 * The invite remains in storage (marked revoked) so accepting it later
 * will gracefully fail with a friendly message.
 */
export function revokeFriendInvite(id: string): boolean {
  const invites = loadInvites()
  const invite = invites.find((inv) => inv.id === id)
  if (!invite) return false
  invite.revoked = true
  saveInvites(invites)
  return true
}

/**
 * Resolve an invite token to the inviter's user ID.
 * Returns null if the token is unknown, already accepted, or revoked.
 */
export function resolveInviteToken(token: string): FriendInviteRecord | null {
  const invites = loadInvites()
  const invite = invites.find((inv) => inv.id === token)
  if (!invite) return null
  if (invite.revoked) return null
  if (invite.accepted) return null
  return invite
}

// ============================================================================
// Accept Flow
// ============================================================================

/** Result of attempting to accept a friend invite */
export interface AcceptInviteResult {
  success: boolean
  /** Friendly message for the UI */
  message: string
  /** The inviter's user ID (if resolved) */
  inviterUserId?: string
}

/**
 * Accept a friend invite by token.
 *
 * Resolves the token to the inviter's user ID and sends a friend request
 * from the current user to the inviter. If both parties have sent invites
 * to each other, the friendship is auto-accepted (handled by the DB's
 * unique index conflict or a follow-up respondToRequest call).
 *
 * Returns a result with a friendly message suitable for display.
 */
export async function acceptFriendInvite(token: string): Promise<AcceptInviteResult> {
  // Resolve the token
  const invite = resolveInviteToken(token)
  if (!invite) {
    return {
      success: false,
      message: "This invite link isn't valid anymore — ask your friend to send a new one.",
    }
  }

  // Check the current user is authenticated
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    return {
      success: false,
      message: 'Sign in first, then tap the invite link again.',
    }
  }

  // Don't let people accept their own invite
  if (userId === invite.inviterUserId) {
    return {
      success: false,
      message: "This is your own invite link — share it with a friend instead!",
    }
  }

  // Send a friend request to the inviter
  const friendship = await sendFriendRequest(invite.inviterUserId)

  if (!friendship) {
    // The request was queued for retry — still mark partial success
    return {
      success: true,
      inviterUserId: invite.inviterUserId,
      message: "We're connecting you two — it might take a moment if you're offline.",
    }
  }

  // Mark the invite as accepted
  const invites = loadInvites()
  const stored = invites.find((inv) => inv.id === token)
  if (stored) {
    stored.accepted = true
    stored.acceptedAt = new Date().toISOString()
    saveInvites(invites)
  }

  return {
    success: true,
    inviterUserId: invite.inviterUserId,
    message: "Friend request sent! They'll see it next time they open Folio.",
  }
}
