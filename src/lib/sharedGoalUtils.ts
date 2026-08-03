/**
 * Shared Goal Utilities
 *
 * Functions for managing shared goals — goals that multiple people contribute
 * toward (e.g., a trip with friends, splitting an apartment deposit).
 *
 * Persistence: localStorage for MVP (same pattern as sharingUtils.ts).
 * In production, this would use a Supabase table with RLS.
 *
 * Task 169.1 — Shared goals
 */

import type { Goal, GoalParticipant } from '@/types'

// ============================================================================
// Constants
// ============================================================================

const SHARED_GOALS_KEY = 'folio-shared-goals'

/**
 * Internal storage shape: maps goalId → shared goal metadata.
 * We keep participants and shareToken in localStorage separately so the
 * existing Goal persistence (Supabase) doesn't need schema changes for MVP.
 */
interface SharedGoalMeta {
  goalId: string
  shareToken: string
  participants: GoalParticipant[]
  isActive: boolean
  createdAt: string
}

// ============================================================================
// Storage Helpers
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
// Public API
// ============================================================================

/**
 * Make a goal shared by generating a share token.
 * If the goal already has a token, returns the existing one.
 */
export function createSharedGoalToken(goalId: string): string {
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
    // Re-activate with new token
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
 */
export function addParticipant(goalId: string, name: string): GoalParticipant | null {
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
export function recordParticipantContribution(
  goalId: string,
  participantId: string,
  amount: number
): GoalParticipant | null {
  if (amount <= 0) return null
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
export function getParticipantBreakdown(goalId: string): GoalParticipant[] {
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId)
  if (!meta) return []
  return [...meta.participants]
}

/**
 * Retrieve a shared goal's metadata by its share token.
 * Returns null if not found or revoked.
 */
export function getSharedGoalByToken(token: string): SharedGoalMeta | null {
  const metas = loadSharedGoals()
  return metas.find(m => m.shareToken === token && m.isActive) ?? null
}

/**
 * Get the share token for a goal, or null if not shared.
 */
export function getShareTokenForGoal(goalId: string): string | null {
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goalId && m.isActive)
  return meta?.shareToken ?? null
}

/**
 * Check if a goal is shared.
 */
export function isGoalShared(goalId: string): boolean {
  const metas = loadSharedGoals()
  return metas.some(m => m.goalId === goalId && m.isActive)
}

/**
 * Revoke sharing for a goal (deactivates the token).
 */
export function revokeSharedGoalToken(goalId: string): void {
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
export function removeParticipant(goalId: string, participantId: string): boolean {
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
 * Hydrate a Goal object with its shared metadata from localStorage.
 * This merges the stored participant data into the Goal for display.
 */
export function hydrateGoalWithSharedData(goal: Goal): Goal {
  const metas = loadSharedGoals()
  const meta = metas.find(m => m.goalId === goal.id && m.isActive)
  if (!meta) return goal

  return {
    ...goal,
    isShared: true,
    participants: meta.participants,
    shareToken: meta.shareToken,
    type: 'shared',
  }
}

/**
 * Hydrate an array of goals with shared metadata.
 */
export function hydrateGoalsWithSharedData(goals: Goal[]): Goal[] {
  return goals.map(hydrateGoalWithSharedData)
}
