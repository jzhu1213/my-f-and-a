/**
 * Roommate Invite Utilities
 *
 * A warm "invite a roommate" referral loop that connects into the existing
 * shared-money surfaces — household pools (task 170.1) and shared goals
 * (task 169.1). Rather than inventing a new token scheme, an invite simply
 * references an existing share token for a pool or goal, so accepting an
 * invite lands the roommate on the same shared view they'd get from a
 * plain share link.
 *
 * The referral records themselves are tracked locally so the inviter can
 * see who they've invited and follow up warmly — never a growth-hacky
 * leaderboard, never shame.
 *
 * Design notes:
 * - Message + path builders are PURE and deterministic so they're easy to
 *   test. Only the storage helpers touch localStorage / window.
 * - Persistence: localStorage for MVP (same pattern as householdPool.ts and
 *   sharedGoalUtils.ts). In production this would live in Supabase with RLS.
 *
 * Task 201.1 — Invite-a-roommate loop (referral tied to shared money)
 */

// ============================================================================
// Types
// ============================================================================

/** Which kind of shared-money surface an invite connects into. */
export type InviteTargetType = "pool" | "goal"

/** A warm roommate invite tied to a specific shared-money target. */
export interface RoommateInvite {
  id: string
  /** Display name of the person sending the invite (the current user). */
  inviterName: string
  /** Optional name of the roommate being invited (for the inviter's records). */
  roommateName: string
  /** Whether this invite points at a pool or a shared goal. */
  targetType: InviteTargetType
  /** The existing share token for the pool/goal this invite reuses. */
  targetToken: string
  /** Human-friendly name of the pool/goal (e.g. "Groceries", "Spring Trip"). */
  targetName: string
  /** Emoji for the target, for warm display. */
  targetEmoji: string
  createdAt: string
  /** Whether the roommate has been marked as joined. */
  joined: boolean
  joinedAt: string | null
}

/** A shared-money surface the user can invite a roommate into. */
export interface InviteTarget {
  type: InviteTargetType
  token: string
  name: string
  emoji: string
}

// ============================================================================
// Constants
// ============================================================================

const INVITES_KEY = "folio-roommate-invites"

const TARGET_PATH: Record<InviteTargetType, string> = {
  pool: "/shared/pool",
  goal: "/shared/goal",
}

// ============================================================================
// Pure builders (deterministic — safe to unit test without a DOM)
// ============================================================================

/**
 * Build the relative path a roommate lands on when accepting an invite.
 * Reuses the existing shared pool / shared goal routes.
 */
export function buildInvitePath(targetType: InviteTargetType, token: string): string {
  return `${TARGET_PATH[targetType]}/${token}`
}

/**
 * Build a full, shareable invite URL. Falls back to a relative path during
 * SSR where `window` is unavailable.
 */
export function buildInviteUrl(targetType: InviteTargetType, token: string): string {
  const path = buildInvitePath(targetType, token)
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

/**
 * Compose a warm, short, shame-free invite message the user can send.
 * Deterministic given its inputs so it's easy to test.
 */
export function buildInviteMessage(
  inviterName: string,
  targetType: InviteTargetType,
  targetName: string,
  url: string
): string {
  const who = inviterName.trim() || "I"
  const name = targetName.trim() || (targetType === "pool" ? "our shared pool" : "our goal")
  const subject =
    targetType === "pool"
      ? `Want to split "${name}" with me on Folio? We can log shared costs together — it stays separate from our own budgets.`
      : `Want to chip in on "${name}" with me on Folio? We can watch it grow together, no pressure.`

  const opener = who === "I" ? "Hey!" : `Hey, it's ${who}!`
  return `${opener} ${subject}\n\nJoin here: ${url}`
}

// ============================================================================
// Storage helpers
// ============================================================================

function loadInvites(): RoommateInvite[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(INVITES_KEY)
    return raw ? (JSON.parse(raw) as RoommateInvite[]) : []
  } catch {
    return []
  }
}

function saveInvites(invites: RoommateInvite[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites))
}

// ============================================================================
// Referral record management
// ============================================================================

/**
 * Record a roommate invite tied to an existing shared-money target.
 * Returns the created invite record.
 */
export function recordSentInvite(
  inviterName: string,
  target: InviteTarget,
  roommateName?: string
): RoommateInvite {
  const invites = loadInvites()
  const invite: RoommateInvite = {
    id: crypto.randomUUID(),
    inviterName: inviterName.trim() || "A friend",
    roommateName: roommateName?.trim() ?? "",
    targetType: target.type,
    targetToken: target.token,
    targetName: target.name.trim() || (target.type === "pool" ? "Shared pool" : "Shared goal"),
    targetEmoji: target.emoji || (target.type === "pool" ? "🏠" : "🎯"),
    createdAt: new Date().toISOString(),
    joined: false,
    joinedAt: null,
  }
  invites.push(invite)
  saveInvites(invites)
  return invite
}

/**
 * Get all sent invites, most recent first.
 */
export function getSentInvites(): RoommateInvite[] {
  return loadInvites().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Mark an invite as joined (the roommate accepted). Returns the updated
 * invite, or null if it wasn't found.
 */
export function markInviteJoined(inviteId: string): RoommateInvite | null {
  const invites = loadInvites()
  const invite = invites.find(i => i.id === inviteId)
  if (!invite) return null
  invite.joined = true
  invite.joinedAt = new Date().toISOString()
  saveInvites(invites)
  return { ...invite }
}

/**
 * Remove a sent invite from the local record (does not revoke the underlying
 * pool/goal share token — that's managed on its own surface).
 */
export function removeSentInvite(inviteId: string): boolean {
  const invites = loadInvites()
  const idx = invites.findIndex(i => i.id === inviteId)
  if (idx === -1) return false
  invites.splice(idx, 1)
  saveInvites(invites)
  return true
}

/**
 * Count how many invited roommates have joined — for a warm, encouraging
 * summary line (never a competitive metric).
 */
export function getJoinedCount(): number {
  return loadInvites().filter(i => i.joined).length
}
