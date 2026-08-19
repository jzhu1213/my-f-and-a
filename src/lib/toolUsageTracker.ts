// ============================================================================
// Tool Usage Tracker — localStorage-backed tracking of which tools a user has
// opened and when, enabling smart section collapse and "Recently Used" display.
// ============================================================================
//
// Follows the same localStorage getter/setter pattern as uiPreferences.ts and
// gamificationPreferences.ts.
//
// Requirements: 29.6

// ============================================================================
// Constants
// ============================================================================

/** Prefix for individual tool usage keys in localStorage. */
const TOOL_USAGE_PREFIX = 'folio-tool-used-' as const

// ============================================================================
// Core API
// ============================================================================

/**
 * Record that a user opened a tool. Stores the current timestamp under
 * `folio-tool-used-{toolId}` in localStorage.
 */
export function recordToolUsage(toolId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${TOOL_USAGE_PREFIX}${toolId}`, String(Date.now()))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Returns the timestamp (ms since epoch) when a tool was last used, or null
 * if the tool has never been used.
 */
export function getToolUsage(toolId: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(`${TOOL_USAGE_PREFIX}${toolId}`)
    if (!stored) return null
    const ts = Number(stored)
    return Number.isFinite(ts) ? ts : null
  } catch {
    return null
  }
}

/**
 * Returns an array of tool IDs sorted by most-recent usage, limited to
 * `maxCount` entries. Only includes tools that have actually been used.
 *
 * @param allToolIds — The full list of tool IDs to consider
 * @param maxCount — Maximum number of tools to return (default 4)
 */
export function getRecentlyUsedTools(allToolIds: string[], maxCount: number = 4): string[] {
  if (typeof window === 'undefined') return []

  const usedTools: Array<{ id: string; timestamp: number }> = []

  for (const toolId of allToolIds) {
    const ts = getToolUsage(toolId)
    if (ts !== null) {
      usedTools.push({ id: toolId, timestamp: ts })
    }
  }

  // Sort by most recent first
  usedTools.sort((a, b) => b.timestamp - a.timestamp)

  return usedTools.slice(0, maxCount).map((entry) => entry.id)
}

/**
 * Returns whether ANY tool in the given list of tool IDs has been used.
 * Used to determine whether a section should default to expanded or collapsed.
 */
export function hasSectionBeenUsed(toolIds: string[]): boolean {
  if (typeof window === 'undefined') return false

  for (const toolId of toolIds) {
    if (getToolUsage(toolId) !== null) return true
  }
  return false
}
