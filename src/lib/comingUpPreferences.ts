// ============================================================================
// Coming Up Preferences — control for the upcoming expenses section
// ============================================================================

/** localStorage key for the coming-up section toggle. */
const COMING_UP_KEY = 'folio-coming-up-enabled'

/** localStorage key for the collapsed state of the coming-up section. */
const COMING_UP_COLLAPSED_KEY = 'folio-coming-up-collapsed'

/** localStorage key for dismissed items (comma-separated recurrence IDs for this week). */
const COMING_UP_DISMISSED_KEY = 'folio-coming-up-dismissed'

/**
 * Returns whether the user has the "Coming up" section enabled on the home
 * screen. Defaults to `true` (on by default since it's helpful and
 * non-intrusive).
 */
export function getComingUpEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(COMING_UP_KEY)
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

/**
 * Persists the user's preference for showing the "Coming up" upcoming
 * expenses section on the home screen.
 */
export function setComingUpEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COMING_UP_KEY, String(enabled))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Returns whether the "Coming up" section is collapsed.
 * Defaults to `false` (expanded by default).
 */
export function getComingUpCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(COMING_UP_COLLAPSED_KEY)
    if (stored === null) return false
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Persists the collapsed state of the "Coming up" section.
 */
export function setComingUpCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COMING_UP_COLLAPSED_KEY, String(collapsed))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Returns the set of recurrence IDs that the user has dismissed from
 * this week's "Coming up" view.
 */
export function getComingUpDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(COMING_UP_DISMISSED_KEY)
    if (!stored) return new Set()
    return new Set(stored.split(',').filter(Boolean))
  } catch {
    return new Set()
  }
}

/**
 * Dismiss a recurrence from the current "Coming up" view.
 */
export function dismissComingUpItem(recurrenceId: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = getComingUpDismissed()
    current.add(recurrenceId)
    localStorage.setItem(COMING_UP_DISMISSED_KEY, Array.from(current).join(','))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Clears all dismissed items (call at start of each week if desired).
 */
export function clearComingUpDismissed(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(COMING_UP_DISMISSED_KEY)
  } catch {
    // localStorage unavailable — fail silently
  }
}
