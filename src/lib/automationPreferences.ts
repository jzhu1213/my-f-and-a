/**
 * Automation preferences — persistence for automation & prediction toggles.
 *
 * Stores user preferences in localStorage. All features default to ON,
 * giving users full control to disable any automation they don't want.
 *
 * Requirements: 23.7
 */

// ============================================================================
// Types
// ============================================================================

export interface AutomationPreferences {
  /** Whether Folio auto-suggests recurring expenses */
  autoSuggestRecurring: boolean
  /** Whether suggestions count toward daily allowance */
  includeSuggestionsInAllowance: boolean
  /** Whether "coming up" bills appear on the home screen */
  showComingUp: boolean
  /** Whether spending pace alerts are enabled */
  spendingPaceAlerts: boolean
  /** Whether bill amounts are pre-filled from history */
  billPreFill: boolean
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_automation_prefs"

const DEFAULT_PREFERENCES: AutomationPreferences = {
  autoSuggestRecurring: true,
  includeSuggestionsInAllowance: true,
  showComingUp: true,
  spendingPaceAlerts: true,
  billPreFill: true,
}

// ============================================================================
// Persistence helpers
// ============================================================================

/**
 * Get the user's automation preferences from localStorage.
 * Returns default preferences (all ON) if none are stored.
 */
export function getAutomationPreferences(): AutomationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(stored) as Partial<AutomationPreferences>
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * Save automation preferences to localStorage.
 */
export function setAutomationPreferences(prefs: AutomationPreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Reset automation preferences to defaults (all ON).
 */
export function resetAutomationPreferences(): void {
  setAutomationPreferences(DEFAULT_PREFERENCES)
}
