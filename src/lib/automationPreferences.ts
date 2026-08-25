/**
 * Automation preferences — persistence for automation & prediction toggles.
 *
 * Stores user preferences in localStorage via the versioned storage wrapper.
 * All features default to ON, giving users full control to disable any
 * automation they don't want.
 *
 * Requirements: 23.7
 */

import { z } from 'zod'
import * as versionedStorage from './versionedStorage'

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
// Schema
// ============================================================================

const AutomationPreferencesSchema = z.object({
  autoSuggestRecurring: z.boolean(),
  includeSuggestionsInAllowance: z.boolean(),
  showComingUp: z.boolean(),
  spendingPaceAlerts: z.boolean(),
  billPreFill: z.boolean(),
})

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
 * Uses versioned storage with schema validation.
 * Returns default preferences (all ON) if none are stored or validation fails.
 */
export function getAutomationPreferences(): AutomationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  const stored = versionedStorage.get(STORAGE_KEY, AutomationPreferencesSchema)
  if (!stored) return DEFAULT_PREFERENCES
  return { ...DEFAULT_PREFERENCES, ...stored }
}

/**
 * Save automation preferences to localStorage via versioned storage.
 */
export function setAutomationPreferences(prefs: AutomationPreferences): void {
  versionedStorage.set(STORAGE_KEY, prefs, AutomationPreferencesSchema)
}

/**
 * Reset automation preferences to defaults (all ON).
 */
export function resetAutomationPreferences(): void {
  setAutomationPreferences(DEFAULT_PREFERENCES)
}
