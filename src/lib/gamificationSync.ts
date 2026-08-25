/**
 * Gamification Sync — coordinates syncing streak/challenge data between
 * localStorage (instant) and Supabase (cross-device).
 *
 * Design:
 * - Writes are fire-and-forget (don't block UI)
 * - Reads merge server + local, taking the "best" values
 * - Works gracefully without auth (logged-out users just use local)
 *
 * Requirements: 32.4
 * Task: 525.2, 525.3
 */

import type { StreakData } from './streaks'
import type { ChallengeData } from './challenges'
import { getGamificationState, upsertGamificationState } from './supabaseData'
import { getStreakData, saveStreakData } from './streaks'
import { getChallengeData, saveChallengeData } from './challenges'

// ============================================================================
// Module-level userId (set by the app when auth state is known)
// ============================================================================

let _userId: string | null = null

/**
 * Set the current user ID for sync operations.
 * Call this when auth state resolves (login/logout).
 */
export function setGamificationSyncUserId(userId: string | null): void {
  _userId = userId
}

/**
 * Get the current user ID for sync operations.
 */
export function getGamificationSyncUserId(): string | null {
  return _userId
}

// ============================================================================
// 525.2: Sync on Change (fire-and-forget)
// ============================================================================

/**
 * Syncs streak data to Supabase in the background.
 * Fire-and-forget: errors are logged but don't affect the caller.
 */
export function syncStreakToServer(streakData: StreakData): void {
  const userId = _userId
  if (!userId) return

  // Fire-and-forget async
  upsertGamificationState(userId, {
    streakData,
    zeroSpendDays: streakData.zeroSpendDays,
  }).catch((err) => {
    console.warn('[GamificationSync] Failed to sync streak data:', err)
  })
}

/**
 * Syncs challenge data to Supabase in the background.
 * Fire-and-forget: errors are logged but don't affect the caller.
 */
export function syncChallengeToServer(challengeData: ChallengeData): void {
  const userId = _userId
  if (!userId) return

  // Fire-and-forget async
  upsertGamificationState(userId, {
    challengeProgress: challengeData,
  }).catch((err) => {
    console.warn('[GamificationSync] Failed to sync challenge data:', err)
  })
}

// ============================================================================
// 525.3: Merge on Load
// ============================================================================

/**
 * Merges server streak data with local streak data.
 *
 * Strategy:
 * - Take the higher currentStreak and longestStreak
 * - Take the higher totalActiveDays
 * - Union zeroSpendDays arrays (deduplicated)
 * - Use the most recent lastActiveDate
 * - Grace day state follows the most recent lastActiveDate source
 *
 * Returns the merged StreakData, or null if no data exists anywhere.
 */
export async function mergeStreakDataOnLoad(userId: string): Promise<StreakData | null> {
  const local = getStreakData()

  let server: StreakData | null = null
  try {
    const serverState = await getGamificationState(userId)
    if (serverState?.streakData) {
      server = serverState.streakData
    }
  } catch (err) {
    console.warn('[GamificationSync] Failed to fetch server streak data:', err)
  }

  // If only one source has data, use it
  if (!local && !server) return null
  if (!local && server) {
    saveStreakData(server)
    return server
  }
  if (local && !server) {
    // Push local to server for the first time
    syncStreakToServer(local)
    return local
  }

  // Both exist — merge
  const localData = local!
  const serverData = server!

  // Determine which has the more recent activity
  const localDate = localData.lastActiveDate ?? ''
  const serverDate = serverData.lastActiveDate ?? ''
  const serverIsMoreRecent = serverDate > localDate

  // Union zero-spend days (deduplicated)
  const mergedZeroSpendDays = Array.from(
    new Set([...localData.zeroSpendDays, ...serverData.zeroSpendDays])
  ).sort()

  const merged: StreakData = {
    currentStreak: Math.max(localData.currentStreak, serverData.currentStreak),
    longestStreak: Math.max(localData.longestStreak, serverData.longestStreak),
    totalActiveDays: Math.max(localData.totalActiveDays, serverData.totalActiveDays),
    // Grace day state from the most recent source
    graceDaysRemaining: serverIsMoreRecent
      ? serverData.graceDaysRemaining
      : localData.graceDaysRemaining,
    graceDaysUsedThisWeek: serverIsMoreRecent
      ? serverData.graceDaysUsedThisWeek
      : localData.graceDaysUsedThisWeek,
    lastActiveDate: localDate > serverDate ? localDate : serverDate,
    zeroSpendDays: mergedZeroSpendDays,
  }

  // Persist merged result to both stores
  saveStreakData(merged)
  syncStreakToServer(merged)

  return merged
}

/**
 * Merges server challenge data with local challenge data.
 *
 * Strategy:
 * - Union challenges by ID (server wins on conflicts for same ID)
 * - Take the higher lastSuggestionWeek
 *
 * Returns the merged ChallengeData, or null if no data exists anywhere.
 */
export async function mergeChallengeDataOnLoad(userId: string): Promise<ChallengeData | null> {
  const local = getChallengeData()

  let server: ChallengeData | null = null
  try {
    const serverState = await getGamificationState(userId)
    if (serverState?.challengeProgress) {
      server = serverState.challengeProgress
    }
  } catch (err) {
    console.warn('[GamificationSync] Failed to fetch server challenge data:', err)
  }

  // If only one source has data, use it
  if (!local && !server) return null
  if (!local && server) {
    saveChallengeData(server)
    return server
  }
  if (local && !server) {
    syncChallengeToServer(local)
    return local
  }

  // Both exist — merge by challenge ID
  const localData = local!
  const serverData = server!

  // Build map: server challenges win on ID conflicts
  const challengeMap = new Map<string, (typeof localData.challenges)[number]>()
  for (const ch of localData.challenges) {
    challengeMap.set(ch.id, ch)
  }
  for (const ch of serverData.challenges) {
    challengeMap.set(ch.id, ch) // Server wins on conflict
  }

  const merged: ChallengeData = {
    challenges: Array.from(challengeMap.values()),
    lastSuggestionWeek: Math.max(
      localData.lastSuggestionWeek,
      serverData.lastSuggestionWeek
    ),
  }

  // Persist merged result to both stores
  saveChallengeData(merged)
  syncChallengeToServer(merged)

  return merged
}
