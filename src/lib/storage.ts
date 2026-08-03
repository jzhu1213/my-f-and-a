// Folio - Local Storage Utilities
// Task 211: Structured onboarding progress persistence

import type { OnboardingPath } from '@/types'

// ============================================================================
// Constants
// ============================================================================

const ONBOARDING_PROGRESS_KEY = 'folio-onboarding-progress'
const LEGACY_ONBOARDED_KEY = 'folio-onboarded'

// ============================================================================
// Types
// ============================================================================

/**
 * Structured onboarding progress state.
 * Replaces the old single boolean `folio-onboarded` localStorage flag.
 */
export interface OnboardingProgress {
  /** Which path the user chose (null = not yet selected) */
  path: OnboardingPath
  /** Steps the user has completed */
  completedSteps: string[]
  /** Steps the user explicitly skipped */
  skippedSteps: string[]
  /** Whether the entire onboarding is fully complete */
  isComplete: boolean
}

// ============================================================================
// Helpers
// ============================================================================

export function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * Default (empty) onboarding progress for a fresh user.
 */
function defaultProgress(): OnboardingProgress {
  return {
    path: null,
    completedSteps: [],
    skippedSteps: [],
    isComplete: false,
  }
}

/**
 * Progress representing a fully-completed onboarding (used for migration).
 */
function completedProgress(): OnboardingProgress {
  return {
    path: null, // Unknown — they finished before structured tracking existed
    completedSteps: [],
    skippedSteps: [],
    isComplete: true,
  }
}

// ============================================================================
// Core API (Task 211.2 + 211.3)
// ============================================================================

/**
 * Read the current onboarding progress from localStorage.
 * Handles one-way migration from the legacy `folio-onboarded` boolean:
 * if the old flag is 'true' and no structured state exists, treat as complete.
 */
export function getOnboardingProgress(): OnboardingProgress {
  if (typeof window === 'undefined') return defaultProgress()

  try {
    const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingProgress>
      return {
        path: parsed.path ?? null,
        completedSteps: parsed.completedSteps ?? [],
        skippedSteps: parsed.skippedSteps ?? [],
        isComplete: parsed.isComplete ?? false,
      }
    }

    // One-way migration: old flag exists but no structured state
    const legacyFlag = localStorage.getItem(LEGACY_ONBOARDED_KEY)
    if (legacyFlag === 'true') {
      const migrated = completedProgress()
      // Persist the migrated state so the migration only runs once
      localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // Corrupted data — start fresh
  }

  return defaultProgress()
}

/**
 * Write the full structured onboarding progress to localStorage.
 */
export function setOnboardingProgress(progress: OnboardingProgress): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress))
  // Keep the legacy flag in sync for any code that still reads it
  if (progress.isComplete) {
    localStorage.setItem(LEGACY_ONBOARDED_KEY, 'true')
  }
}

/**
 * Set the active onboarding path.
 */
export function setOnboardingPath(path: OnboardingPath): void {
  const progress = getOnboardingProgress()
  progress.path = path
  setOnboardingProgress(progress)
}

/**
 * Mark a step as completed (appends if not already present).
 */
export function markOnboardingStepCompleted(step: string): void {
  const progress = getOnboardingProgress()
  if (!progress.completedSteps.includes(step)) {
    progress.completedSteps.push(step)
  }
  setOnboardingProgress(progress)
}

/**
 * Mark a step as skipped (appends if not already present).
 */
export function markOnboardingStepSkipped(step: string): void {
  const progress = getOnboardingProgress()
  if (!progress.skippedSteps.includes(step)) {
    progress.skippedSteps.push(step)
  }
  setOnboardingProgress(progress)
}

/**
 * Clear all onboarding progress (sign-out / reset).
 * Removes both the structured key and the legacy key.
 */
export function clearOnboardingProgress(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY)
  localStorage.removeItem(LEGACY_ONBOARDED_KEY)
}

/**
 * @deprecated Use clearOnboardingProgress() instead.
 * Kept temporarily for any transitive callers.
 */
export function clearOnboarding() {
  clearOnboardingProgress()
}
