/**
 * Shared Goal Utilities
 *
 * Functions for managing shared goals — goals that multiple people contribute
 * toward (e.g., a trip with friends, splitting an apartment deposit).
 *
 * Persistence: Supabase (goals.is_shared + goal_participants table).
 * Falls back to localStorage when offline or unauthenticated.
 *
 * Task 169.1 — Shared goals
 * Task 288.1 — Persist shared goals & participants server-side
 */

import type { Goal, GoalParticipant } from '@/types'
import {
  enableGoalSharing,
  disableGoalSharing,
  checkGoalShared,
  getGoalShareToken,
  getGoalByShareToken,
  addGoalParticipant,
  removeGoalParticipant as removeGoalParticipantDb,
  recordGoalParticipantContribution,
  getGoalParticipants,
} from '@/lib/supabaseData'

// ============================================================================
// Constants
// ============================================================================

const SHARED_GOALS_KEY = 'folio-shared-goals'

/**
 * Internal localStorage shape: maps goalId → shared goal metadata.
 * Used as fallback when Supabase is unavailable.
 */
interface SharedGoalMeta {
  goalId: string
  shareToken: string
  participants: GoalParticipant[]
  isActive: boolean
  createdAt: string
}

// ============================================================================
// localStorage Fallback Helpers
// ============================================================================

function loadSharedGoals(): SharedGoalMeta[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHARED_GOALS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSharedGoals(metas: SharedGoalMeta[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHARED_GOALS_KEY, JSON.stringify(metas))
}

// ============================================================================
// Public API — async, Supabase-first with localStorage fallback
// ============================================================================

/**
 * Make a goal shared by generating a share token.
 * If the goal already has a token, returns the existing one.
 * @param goalId - The goal to share
 * @param userId - Authenticated user ID (pass null/undefined for offline fallback)
 */
export async function createSharedGoalToken(goalId: string, userId?: string | null): Promise<string> {
  // Try Supabase first
  if (userId) {
    try {
      const token = await enableGoalSharing(userId, goalId)
      if (token) return token
    } catch {
      // Fall through to localStorage
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const existing = metas.find(m => m.goalId === goalId)
  if (existing && existing.isActive) {
    return existing.shareToken
  }

  const token = crypto.randomUUID()
  const meta: SharedGoalMeta = {
    goalId,
    shareToken: token,
    participants: [],
    isActive: true,
    createdAt: new Date().toISOString(),
  }

  if (existing) {
    existing.shareToken = token
    existing.isActive = true
    saveSharedGoals(metas)
  } else {
    metas.push(meta)
    saveSharedGoals(metas)
  }

  return token
}

/**
 * Add a participant to a shared goal by goalId.
 * Returns the new participant, or null if the goal isn't shared.
 * @param goalId - The shared goal
 * @param name - Participant display name
 * @param userId - Authenticated owner user ID (for RLS)
 * @param participantUserId - Optional linked account for the participant
 */
export async function addParticipant(
  goalId: string,
  name: string,
  userId?: string | null,
  participantUserId?: string | null
): Promise<GoalParticipant | null> {
  // Try Supabase
  if (userId) {
    try {
      const p = await addGoalParticipant(goalId, name, participantUserId)
      if (p) return p
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId && m.isActive)
  if (!meta) return null

  const participant: GoalParticipant = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Participant',
    contributedAmount: 0,
    joinedAt: new Date().toISOString(),
  }

  meta.participants.push(participant)
  saveSharedGoals(metas)
  return participant
}

/**
 * Record a contribution from a specific participant.
 * Returns the updated participant or null if not found.
 */
export async function recordParticipantContribution(
  goalId: string,
  participantId: string,
  amount: number,
  userId?: string | null
): Promise<GoalParticipant | null> {
  if (amount <= 0) return null

  // Try Supabase
  if (userId) {
    try {
      const p = await recordGoalParticipantContribution(goalId, participantId, amount)
      if (p) return p
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId && m.isActive)
  if (!meta) return null

  const participant = meta.participants.find(p => p.id === participantId)
  if (!participant) return null

  participant.contributedAmount += amount
  saveSharedGoals(metas)
  return { ...participant }
}

/**
 * Get the per-person contribution breakdown for a shared goal.
 * Returns an empty array if the goal isn't shared.
 */
export async function getParticipantBreakdown(
  goalId: string,
  userId?: string | null
): Promise<GoalParticipant[]> {
  // Try Supabase
  if (userId) {
    try {
      const participants = await getGoalParticipants(goalId)
      if (participants.length > 0) return participants
      // Empty result could mean no participants yet — check if shared
      const shared = await checkGoalShared(goalId)
      if (shared) return []
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId)
  if (!meta) return []
  return [...meta.participants]
}

/**
 * Retrieve a shared goal by its share token.
 * Returns null if not found or revoked.
 */
export async function getSharedGoalByToken(token: string): Promise<Goal | null> {
  try {
    const goal = await getGoalByShareToken(token)
    if (goal) return goal
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback — returns limited info
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.shareToken === token && m.isActive)
  if (!meta) return null
  // We can't reconstruct a full Goal from localStorage alone, return null
  return null
}

/**
 * Get the share token for a goal, or null if not shared.
 */
export async function getShareTokenForGoal(
  goalId: string,
  userId?: string | null
): Promise<string | null> {
  if (userId) {
    try {
      const token = await getGoalShareToken(goalId)
      if (token) return token
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId && m.isActive)
  return meta?.shareToken ?? null
}

/**
 * Check if a goal is shared.
 */
export async function isGoalShared(
  goalId: string,
  userId?: string | null
): Promise<boolean> {
  if (userId) {
    try {
      return await checkGoalShared(goalId)
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  return metas.some(m => m.goalId === goalId && m.isActive)
}

/**
 * Revoke sharing for a goal (deactivates the token).
 */
export async function revokeSharedGoalToken(
  goalId: string,
  userId?: string | null
): Promise<void> {
  if (userId) {
    try {
      await disableGoalSharing(userId, goalId)
      return
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId)
  if (meta) {
    meta.isActive = false
    saveSharedGoals(metas)
  }
}

/**
 * Remove a participant from a shared goal.
 */
export async function removeParticipant(
  goalId: string,
  participantId: string,
  userId?: string | null
): Promise<boolean> {
  if (userId) {
    try {
      const result = await removeGoalParticipantDb(goalId, participantId)
      if (result) return true
    } catch {
      // Fall through
    }
  }

  // localStorage fallback
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId && m.isActive)
  if (!meta) return false

  const idx = meta.participants.findIndex(p => p.id === participantId)
  if (idx === -1) return false

  meta.participants.splice(idx, 1)
  saveSharedGoals(metas)
  return true
}

/**
 * Build the shareable URL for a shared goal token.
 */
export function getSharedGoalUrl(token: string): string {
  if (typeof window === 'undefined') return `/shared/goal/${token}`
  return `${window.location.origin}/shared/goal/${token}`
}

/**
 * Hydrate a Goal object with its shared metadata.
 * When using Supabase, shared data is already on the Goal from getGoals().
 * This function is retained for backward compatibility — it returns the goal as-is
 * since participants are now fetched from Supabase directly.
 */
export function hydrateGoalWithSharedData(goal: Goal): Goal {
  // If goal already has shared data from Supabase, return as-is
  if (goal.isShared) return goal

  // localStorage fallback for offline/unauthenticated
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goal.id && m.isActive)
  if (!meta) return goal

  return {
    ...goal,
    isShared: true,
    participants: meta.participants,
    shareToken: meta.shareToken,
  }
}

/**
 * Hydrate an array of goals with shared metadata.
 */
export function hydrateGoalsWithSharedData(goals: Goal[]): Goal[] {
  return goals.map(hydrateGoalWithSharedData)
}
