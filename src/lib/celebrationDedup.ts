/**
 * Celebration dedup helpers — shared between celebrationEngine and
 * incomeEncouragement to avoid circular imports.
 *
 * Extracted from celebrationEngine.ts (Phase 11 task 356).
 */

const STORAGE_KEY = 'folio_triggered_celebrations'

/**
 * Gets the set of previously triggered celebration IDs from localStorage.
 */
function getTriggeredCelebrations(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    return new Set(JSON.parse(stored) as string[])
  } catch {
    return new Set()
  }
}

/**
 * Persists the set of triggered celebration IDs to localStorage.
 */
function saveTriggeredCelebrations(triggered: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...triggered]))
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Marks a celebration as triggered so it won't fire again for the same event.
 */
export function markTriggered(id: string): void {
  const triggered = getTriggeredCelebrations()
  triggered.add(id)
  saveTriggeredCelebrations(triggered)
}

/**
 * Checks whether a celebration has already been triggered.
 */
export function hasBeenTriggered(id: string): boolean {
  return getTriggeredCelebrations().has(id)
}
