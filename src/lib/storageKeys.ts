/**
 * Storage key registry — defines all versioned localStorage keys and
 * initializes their current versions and migrations.
 *
 * Call `initStorageVersions()` once on app boot to register all keys.
 *
 * Task 522.3
 * Requirements: 32.2
 */

import { setCurrentVersion, registerMigrations } from './versionedStorage'

// ============================================================================
// Key constants
// ============================================================================

/** All versioned localStorage keys used by Folio. */
export const STORAGE_KEYS = {
  AUTOMATION_PREFS: 'folio_automation_prefs',
  APP_LOCK_PREFS: 'folio_app_lock_prefs',
  CHALLENGE_DATA: 'folio_challenge_data',
  AUTO_CONTRIBUTE_RULES: 'folio_auto_contribute_rules',
  BUDGET_PERIOD: 'folio-budget-period',
  CATEGORIZATION_RULES: 'folio-categorization-rules',
  CATEGORY_GRID_PREFS: 'folio-category-grid-prefs',
  CATEGORY_FREQUENCY: 'folio-category-frequency',
  TRIGGERED_CELEBRATIONS: 'folio_triggered_celebrations',
} as const

/**
 * Simple string keys that don't use the versioned envelope.
 * These store primitive values ('true'/'false', single strings).
 */
export const SIMPLE_KEYS = {
  AUTO_EARMARK_ENABLED: 'folio-auto-earmark-enabled',
  AUTO_EARMARK_GOAL_ID: 'folio-auto-earmark-goal-id',
  AUTO_SWEEP_ENABLED: 'folio-auto-sweep-enabled',
  AUTO_SWEEP_FREQUENCY: 'folio-auto-sweep-frequency',
  CATEGORY_SORT_MODE: 'folio-category-sort-mode',
  CATEGORY_ROLLOVER_ENABLED: 'folio_category_rollover_enabled',
} as const

// ============================================================================
// Version initialization
// ============================================================================

/**
 * Initialize all storage key versions and register migrations.
 * Call once on app boot (e.g., in the root layout or a provider).
 *
 * All keys start at version 1. Future schema changes add migrations
 * here and bump the version.
 */
export function initStorageVersions(): void {
  // Set current version = 1 for all versioned keys
  for (const key of Object.values(STORAGE_KEYS)) {
    setCurrentVersion(key, 1)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Migrations — add future migrations below.
  // Example (uncomment when a v2 migration is needed):
  //
  // registerMigrations(STORAGE_KEYS.AUTOMATION_PREFS, {
  //   1: (v1Data) => ({ ...v1Data as object, newFieldInV2: 'default' }),
  // })
  // setCurrentVersion(STORAGE_KEYS.AUTOMATION_PREFS, 2)
  // ──────────────────────────────────────────────────────────────────────────

  // Task 522.4: Example migration for testing (folio_automation_prefs v1 → v2)
  // This is a trivial identity migration that proves the pattern works.
  registerMigrations(STORAGE_KEYS.AUTOMATION_PREFS, {
    1: (v1Data) => {
      // v1 → v2: Add `billPreFill` field if missing (it was added in Phase 14)
      const data = v1Data as Record<string, unknown>
      return {
        autoSuggestRecurring: data.autoSuggestRecurring ?? true,
        includeSuggestionsInAllowance: data.includeSuggestionsInAllowance ?? true,
        showComingUp: data.showComingUp ?? true,
        spendingPaceAlerts: data.spendingPaceAlerts ?? true,
        billPreFill: data.billPreFill ?? true,
      }
    },
  })
  setCurrentVersion(STORAGE_KEYS.AUTOMATION_PREFS, 2)
}
