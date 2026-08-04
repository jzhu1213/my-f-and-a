// Folio - Onboarding Analytics (Local-Only, No PII)
// Task 227.1: Track path choice, completion, and drop-off
//
// Privacy guarantees:
// - All data stays in localStorage — nothing leaves the device beyond existing sync
// - No financial values, no PII, no user-identifiable information
// - Only tracks: path choice, step actions, timing, and completion state

import type { OnboardingPath } from '@/types'

// ============================================================================
// Constants
// ============================================================================

const ANALYTICS_KEY = 'folio-onboarding-analytics'

// ============================================================================
// Types
// ============================================================================

/** A single step event in the onboarding funnel. */
export interface OnboardingStepEvent {
  stepId: string
  action: 'completed' | 'skipped'
  timestamp: string
  durationMs?: number
}

/**
 * Aggregate analytics data for the onboarding funnel.
 * Stored locally; used to inform path tuning without exposing PII.
 */
export interface OnboardingAnalyticsData {
  /** Which path the user selected */
  pathSelected: OnboardingPath
  /** ISO timestamp of path selection */
  pathSelectedAt: string
  /** ISO timestamp when onboarding started (first event) */
  startedAt: string
  /** ISO timestamp when onboarding was completed */
  completedAt?: string
  /** ISO timestamp when onboarding was abandoned */
  abandonedAt?: string
  /** The last step the user reached before completing/abandoning */
  lastStepReached: string
  /** Ordered list of step-level events */
  stepEvents: OnboardingStepEvent[]
  /** Total steps encountered so far */
  totalSteps: number
  /** Count of steps completed */
  completedSteps: number
  /** Count of steps skipped */
  skippedSteps: number
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Read the current analytics blob from localStorage (or null). */
function readAnalytics(): OnboardingAnalyticsData | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(ANALYTICS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OnboardingAnalyticsData
  } catch {
    return null
  }
}

/** Persist the analytics blob to localStorage. */
function writeAnalytics(data: OnboardingAnalyticsData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data))
}

/** Get the current ISO timestamp. */
function now(): string {
  return new Date().toISOString()
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Record that the user selected an onboarding path.
 * Initializes the analytics record if not already present.
 */
export function trackPathSelected(path: OnboardingPath): void {
  if (typeof window === 'undefined') return

  const existing = readAnalytics()
  const timestamp = now()

  const data: OnboardingAnalyticsData = existing
    ? { ...existing, pathSelected: path, pathSelectedAt: timestamp }
    : {
        pathSelected: path,
        pathSelectedAt: timestamp,
        startedAt: timestamp,
        lastStepReached: '',
        stepEvents: [],
        totalSteps: 0,
        completedSteps: 0,
        skippedSteps: 0,
      }

  writeAnalytics(data)
}

/**
 * Record that the user completed a step.
 * @param stepId - Identifier of the completed step
 * @param durationMs - Optional time spent on this step in milliseconds
 */
export function trackStepCompleted(stepId: string, durationMs?: number): void {
  if (typeof window === 'undefined') return

  const data = readAnalytics()
  if (!data) return

  const event: OnboardingStepEvent = {
    stepId,
    action: 'completed',
    timestamp: now(),
    ...(durationMs !== undefined && { durationMs }),
  }

  data.stepEvents.push(event)
  data.lastStepReached = stepId
  data.totalSteps = data.stepEvents.length
  data.completedSteps = data.stepEvents.filter((e) => e.action === 'completed').length
  data.skippedSteps = data.stepEvents.filter((e) => e.action === 'skipped').length

  writeAnalytics(data)
}

/**
 * Record that the user skipped a step.
 * @param stepId - Identifier of the skipped step
 */
export function trackStepSkipped(stepId: string): void {
  if (typeof window === 'undefined') return

  const data = readAnalytics()
  if (!data) return

  const event: OnboardingStepEvent = {
    stepId,
    action: 'skipped',
    timestamp: now(),
  }

  data.stepEvents.push(event)
  data.lastStepReached = stepId
  data.totalSteps = data.stepEvents.length
  data.completedSteps = data.stepEvents.filter((e) => e.action === 'completed').length
  data.skippedSteps = data.stepEvents.filter((e) => e.action === 'skipped').length

  writeAnalytics(data)
}

/**
 * Record that the user completed the entire onboarding flow.
 * @param totalDurationMs - Optional total time spent in onboarding in milliseconds
 */
export function trackOnboardingCompleted(totalDurationMs?: number): void {
  if (typeof window === 'undefined') return

  const data = readAnalytics()
  if (!data) return

  data.completedAt = now()

  // Store total duration as a convenience field if provided
  if (totalDurationMs !== undefined) {
    // Attach to the last step event as context, or store as a synthetic event
    const event: OnboardingStepEvent = {
      stepId: '__onboarding_complete',
      action: 'completed',
      timestamp: data.completedAt,
      durationMs: totalDurationMs,
    }
    data.stepEvents.push(event)
  }

  writeAnalytics(data)
}

/**
 * Record that the user abandoned onboarding at a specific step.
 * @param lastStepId - The step the user was on when they left
 */
export function trackOnboardingAbandoned(lastStepId: string): void {
  if (typeof window === 'undefined') return

  const data = readAnalytics()
  if (!data) return

  data.abandonedAt = now()
  data.lastStepReached = lastStepId

  writeAnalytics(data)
}

/**
 * Read the current onboarding analytics data.
 * Returns the full aggregate, or a blank record if none exists.
 */
export function getOnboardingAnalytics(): OnboardingAnalyticsData {
  const data = readAnalytics()

  if (data) return data

  // Return a safe empty default
  return {
    pathSelected: null,
    pathSelectedAt: '',
    startedAt: '',
    lastStepReached: '',
    stepEvents: [],
    totalSteps: 0,
    completedSteps: 0,
    skippedSteps: 0,
  }
}

/**
 * Clear all onboarding analytics data (for sign-out or reset).
 */
export function clearOnboardingAnalytics(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ANALYTICS_KEY)
}
