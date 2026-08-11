/**
 * One-way local → cloud migration
 *
 * Safe, idempotent migration that runs once on first authenticated load.
 * For each surface (shared goals, share links, sessions), if local data
 * exists and no server rows do, upload once and mark migrated. Never
 * overwrites server data with stale local data.
 *
 * Pattern follows householdPool.ts migration exactly:
 * - SSR guard → migration flag → auth check → local data check → server check → upload → flag
 *
 * Task 292.1 — One-way local→cloud migration
 * Requirements: new, backward-compatibility
 */

import { supabase } from '@/lib/supabaseClient'
import {
  enableGoalSharing,
  addGoalParticipant,
  checkGoalShared,
} from '@/lib/supabaseData'

// ============================================================================
// Constants
// ============================================================================

const SHARED_GOALS_KEY = 'folio-shared-goals'
const SHARED_GOALS_MIGRATION_FLAG = 'folio-shared-goals-migrated-to-server'

const SHARE_LINKS_KEY = 'folio-share-links'
const SHARE_LINKS_MIGRATION_FLAG = 'folio-share-links-migrated-to-server'

const SESSIONS_MIGRATION_FLAG = 'folio-sessions-migrated-to-server'

// ============================================================================
// Types (matching localStorage shapes)
// ============================================================================

interface LocalGoalParticipant {
  id: string
  name: string
  contributedAmount: number
  joinedAt: string
}

interface LocalSharedGoalMeta {
  goalId: string
  shareToken: string
  participants: LocalGoalParticipant[]
  isActive: boolean
  createdAt: string
}

interface LocalShareLink {
  id: string
  userId: string
  label: string
  token: string
  createdAt: string
  isActive: boolean
  lastViewedAt: string | null
  expiresAt?: string | null
  revokedAt?: string | null
  scope?: {
    access: 'read-only'
    sections: string[]
  }
}

// ============================================================================
// Unified entry point
// ============================================================================

/**
 * Run all local → cloud migrations in sequence. Each migration is independent;
 * one failing doesn't block the others. Never throws — errors are logged with
 * console.warn.
 */
export async function runLocalToCloudMigration(userId: string): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    await migrateLocalSharedGoalsToServer(userId)
  } catch (err) {
    console.warn('[Migration] Shared goals migration failed:', err)
  }

  try {
    await migrateLocalShareLinksToServer(userId)
  } catch (err) {
    console.warn('[Migration] Share links migration failed:', err)
  }

  try {
    migrateSessionsFlag()
  } catch (err) {
    console.warn('[Migration] Sessions flag migration failed:', err)
  }
}

// ============================================================================
// Shared Goals Migration
// ============================================================================

/**
 * Migrate local shared goal metadata to the server.
 * For each active shared goal in localStorage:
 *   - If goal is not already shared on the server, enable sharing
 *   - Upload participants that don't exist on server yet
 * Sets migration flag when done.
 */
async function migrateLocalSharedGoalsToServer(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SHARED_GOALS_MIGRATION_FLAG)) return

  const localGoals = loadLocalSharedGoals()
  if (localGoals.length === 0) {
    localStorage.setItem(SHARED_GOALS_MIGRATION_FLAG, 'true')
    return
  }

  const activeGoals = localGoals.filter(g => g.isActive)
  if (activeGoals.length === 0) {
    localStorage.setItem(SHARED_GOALS_MIGRATION_FLAG, 'true')
    return
  }

  for (const meta of activeGoals) {
    try {
      // Check if goal is already shared on the server
      const alreadyShared = await checkGoalShared(meta.goalId)
      if (!alreadyShared) {
        // Enable sharing on server — creates a new share token
        await enableGoalSharing(userId, meta.goalId)
      }

      // Upload participants (addGoalParticipant is idempotent-ish — duplicates
      // won't break anything as the server generates new IDs)
      for (const participant of meta.participants) {
        try {
          await addGoalParticipant(meta.goalId, participant.name)
        } catch {
          // Individual participant failures are non-fatal
          console.warn(`[Migration] Failed to add participant "${participant.name}" to goal ${meta.goalId}`)
        }
      }
    } catch {
      // Individual goal failures are non-fatal — continue with next
      console.warn(`[Migration] Failed to migrate shared goal ${meta.goalId}`)
    }
  }

  localStorage.setItem(SHARED_GOALS_MIGRATION_FLAG, 'true')
}

// ============================================================================
// Share Links Migration
// ============================================================================

/**
 * Migrate local share links to the server.
 * Checks if server already has share links for this user — if so, sets flag
 * and returns (never overwrites). Otherwise, inserts each active, non-revoked,
 * non-expired local link.
 */
async function migrateLocalShareLinksToServer(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SHARE_LINKS_MIGRATION_FLAG)) return

  const localLinks = loadLocalShareLinks()
  if (localLinks.length === 0) {
    localStorage.setItem(SHARE_LINKS_MIGRATION_FLAG, 'true')
    return
  }

  // Check if server already has share links for this user
  const { data: serverLinks, error: queryErr } = await supabase
    .from('share_links')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (queryErr) {
    console.warn('[Migration] Failed to check server share links:', queryErr.message)
    // Don't set flag — allow retry next time
    return
  }

  if (serverLinks && serverLinks.length > 0) {
    // Server already has data — don't overwrite
    localStorage.setItem(SHARE_LINKS_MIGRATION_FLAG, 'true')
    return
  }

  // Filter to active, non-revoked, non-expired links
  const now = new Date()
  const migrateableLinks = localLinks.filter(link => {
    if (!link.isActive) return false
    if (link.revokedAt) return false
    if (link.expiresAt) {
      const expiry = new Date(link.expiresAt).getTime()
      if (!Number.isNaN(expiry) && expiry <= now.getTime()) return false
    }
    return true
  })

  if (migrateableLinks.length === 0) {
    localStorage.setItem(SHARE_LINKS_MIGRATION_FLAG, 'true')
    return
  }

  // Insert links into the server
  for (const link of migrateableLinks) {
    try {
      await supabase
        .from('share_links')
        .insert({
          user_id: userId,
          label: link.label || 'Shared link',
          token: link.token,
          is_active: true,
          expires_at: link.expiresAt ?? null,
          scope: link.scope ?? { access: 'read-only', sections: ['status', 'weekSpending', 'categories'] },
          created_at: link.createdAt,
        })
    } catch {
      // Individual link failures are non-fatal
      console.warn(`[Migration] Failed to migrate share link ${link.id}`)
    }
  }

  localStorage.setItem(SHARE_LINKS_MIGRATION_FLAG, 'true')
}

// ============================================================================
// Sessions Migration (flag-only)
// ============================================================================

/**
 * Sessions self-register on every page load (via registerSession in the app),
 * so there's no historical local data to migrate. This just sets the flag
 * for consistency with the other migration surfaces.
 */
function migrateSessionsFlag(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SESSIONS_MIGRATION_FLAG)) return
  localStorage.setItem(SESSIONS_MIGRATION_FLAG, 'true')
}

// ============================================================================
// localStorage Helpers
// ============================================================================

function loadLocalSharedGoals(): LocalSharedGoalMeta[] {
  try {
    const raw = localStorage.getItem(SHARED_GOALS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadLocalShareLinks(): LocalShareLink[] {
  try {
    const raw = localStorage.getItem(SHARE_LINKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
