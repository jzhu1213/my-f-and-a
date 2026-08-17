// ============================================================================
// Education Preferences — learning mode, frequency, and topic opt-out controls
// for the contextual financial education system.
// ============================================================================
//
// Follows the same localStorage getter/setter pattern as gamificationPreferences.ts.
// When learningMode is 'off', no lessons are shown. When 'subtle', only
// micro-lessons appear (no deep dives). Frequency controls weekly caps.
// Users can opt out of specific topics they already understand.
//
// Requirements: 26.6

import type { LessonTopic } from '@/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Learning mode:
 * - 'on': Full lessons including deep dives (default)
 * - 'subtle': Micro-lessons only, no deep dives
 * - 'off': No educational content shown
 */
export type LearningMode = 'on' | 'subtle' | 'off'

/**
 * Lesson frequency:
 * - 'normal': Max 1 per session, 3 per week
 * - 'less': Max 1 per week
 */
export type LessonFrequency = 'normal' | 'less'

/** Complete education preferences shape. */
export interface EducationPreferences {
  /** Learning mode — controls overall education visibility. */
  learningMode: LearningMode
  /** How often lessons appear. */
  frequency: LessonFrequency
  /** Topics the user has opted out of. */
  optedOutTopics: LessonTopic[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-education-prefs'

const DEFAULT_PREFS: EducationPreferences = {
  learningMode: 'on',
  frequency: 'normal',
  optedOutTopics: [],
}

// ============================================================================
// Persistence — getters & setters
// ============================================================================

/**
 * Load education preferences from localStorage.
 * Returns defaults (on, normal frequency, no opt-outs) for new users.
 */
export function getEducationPreferences(): EducationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFS
    const parsed = JSON.parse(stored) as Partial<EducationPreferences>
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * Persist education preferences to localStorage.
 */
export function setEducationPreferences(prefs: EducationPreferences): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Convenience helpers
// ============================================================================

/**
 * Returns true if learning is enabled (mode is 'on' or 'subtle').
 */
export function isLearningEnabled(): boolean {
  const prefs = getEducationPreferences()
  return prefs.learningMode !== 'off'
}

/**
 * Returns true if deep dives are allowed (mode is 'on').
 * 'subtle' mode shows micro-lessons only — no deep dives.
 */
export function allowsDeepDives(): boolean {
  const prefs = getEducationPreferences()
  return prefs.learningMode === 'on'
}

/**
 * Returns true if the given topic has been opted out by the user.
 */
export function isTopicOptedOut(topic: LessonTopic): boolean {
  const prefs = getEducationPreferences()
  return prefs.optedOutTopics.includes(topic)
}

/**
 * Returns the max lessons per week based on frequency preference.
 * - 'normal': 3 per week
 * - 'less': 1 per week
 */
export function getMaxPerWeek(): number {
  const prefs = getEducationPreferences()
  return prefs.frequency === 'normal' ? 3 : 1
}
