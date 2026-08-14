/**
 * What's New — version-gated feature announcements.
 *
 * Shows a single "What's new" card on first open after a major feature ships.
 * Max one per version. Dismissible in 1 tap. Never a full re-onboarding flow.
 *
 * Validates: Task 395.2 — Re-onboarding for major updates
 */

// ============================================================================
// Types
// ============================================================================

export interface WhatsNewItem {
  /** Semver-style version tag (compared lexicographically) */
  version: string
  /** Short headline */
  title: string
  /** 1-line description */
  message: string
  /** Decorative emoji */
  emoji: string
  /** Optional deep link target (tool/overlay ID to open) */
  linkTo?: string
}

// ============================================================================
// What's New Registry — add new items at the TOP
// ============================================================================

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    version: "1.13.0",
    title: "Welcome-back experience",
    message: "Returning after a break? Folio now greets you warmly and lets you backfill missed days in one tap.",
    emoji: "👋",
  },
]

// ============================================================================
// Persistence
// ============================================================================

const STORAGE_KEY = "folio_last_seen_version"

/**
 * Get the latest What's New item that the user hasn't seen yet.
 * Returns null if there's nothing new or no items are registered.
 */
export function getUnseenWhatsNew(): WhatsNewItem | null {
  if (typeof window === "undefined") return null
  if (WHATS_NEW_ITEMS.length === 0) return null

  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY)
    const latest = WHATS_NEW_ITEMS[0] // items are ordered newest-first

    // If the user has never seen any version, show the latest
    if (!lastSeen) return latest

    // If the latest version is newer than what the user has seen, show it
    if (latest.version > lastSeen) return latest

    return null
  } catch {
    return null
  }
}

/**
 * Mark a version's What's New as dismissed — won't show again.
 */
export function dismissWhatsNew(version: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // fail silently
  }
}
