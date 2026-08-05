import type { IncomeStream } from '@/types/folio'
import type { PaySchedule, PayCadence } from '@/lib/paySchedule'
import { getNextPayday, AVG_DAYS_PER_MONTH } from '@/lib/paySchedule'

/**
 * Income Streams — pure utility functions (Task 176.1)
 *
 * This module handles multiple named income sources (job, gig, aid, parental)
 * that feed the daily allowance as a combined pool. Each stream has its own
 * cadence and expected amount; the combined monthly figure is the primary input
 * to the allowance calculation.
 *
 * Intentionally PURE: no I/O, no localStorage, no side effects.
 */

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for persisting income streams */
export const INCOME_STREAMS_KEY = 'folio-income-streams'

// ============================================================================
// Cadence → days-per-cycle mapping
// ============================================================================

/**
 * Approximate number of days per pay cycle for each cadence.
 * Used to normalize stream amounts to a monthly figure.
 */
function cadenceDays(cadence: PayCadence): number {
  switch (cadence) {
    case 'weekly':
      return 7
    case 'biweekly':
      return 14
    case 'semimonthly':
      return AVG_DAYS_PER_MONTH / 2 // ~15.22
    case 'monthly':
      return AVG_DAYS_PER_MONTH // ~30.44
    case 'irregular':
      return 14 // default to biweekly for estimation
  }
}

// ============================================================================
// Core utility functions
// ============================================================================

/**
 * Filter to only active income streams.
 *
 * Pure: returns a new array, does not mutate the input.
 */
export function getActiveStreams(streams: IncomeStream[]): IncomeStream[] {
  return streams.filter(s => s.isActive)
}

/**
 * Compute the combined monthly income from all active streams.
 *
 * Each stream's per-period amount is normalized to a monthly figure:
 *   monthlyFromStream = amount × (AVG_DAYS_PER_MONTH / cadenceDays)
 *
 * The `currentDate` parameter is accepted for future extensions (e.g., prorating
 * streams that started mid-month) but is currently unused — the calculation uses
 * the full expected cadence regardless of position within the month.
 *
 * Pure: no side effects, deterministic given the same inputs.
 */
export function computeMonthlyIncomeFromStreams(
  streams: IncomeStream[],
  _currentDate: Date
): number {
  const active = getActiveStreams(streams)
  if (active.length === 0) return 0

  return active.reduce((sum, stream) => {
    const days = cadenceDays(stream.cadence)
    // periods per month × amount per period
    const monthlyEquivalent = stream.amount * (AVG_DAYS_PER_MONTH / days)
    return sum + monthlyEquivalent
  }, 0)
}

/**
 * Get the next payday for a specific income stream.
 *
 * Delegates to the existing `getNextPayday` helper from paySchedule.ts by
 * converting the stream into a PaySchedule-compatible shape.
 *
 * Pure: returns a new Date, mutates nothing.
 */
export function getNextPaydayForStream(
  stream: IncomeStream,
  currentDate: Date
): Date {
  const schedule: PaySchedule = {
    cadence: stream.cadence,
    anchorDate: stream.anchorDate,
    amount: stream.amount,
  }
  return getNextPayday(schedule, currentDate)
}

/**
 * Derive a combined PaySchedule from multiple income streams for backward
 * compatibility with the existing `paySchedule` parameter in computeDailyAllowance.
 *
 * Strategy: use the stream with the highest monthly contribution as the
 * "dominant" schedule. If no active streams exist, returns null.
 *
 * This keeps payday-aligned budget periods working when income streams are
 * configured — the dominant stream's cadence drives the pay-cycle boundaries.
 *
 * Pure: no side effects.
 */
export function computeCombinedPaySchedule(
  streams: IncomeStream[]
): PaySchedule | null {
  const active = getActiveStreams(streams)
  if (active.length === 0) return null

  // Find the stream with the highest monthly contribution
  let dominant: IncomeStream = active[0]
  let dominantMonthly = 0

  for (const stream of active) {
    const days = cadenceDays(stream.cadence)
    const monthly = stream.amount * (AVG_DAYS_PER_MONTH / days)
    if (monthly > dominantMonthly) {
      dominantMonthly = monthly
      dominant = stream
    }
  }

  return {
    cadence: dominant.cadence,
    anchorDate: dominant.anchorDate,
    amount: dominant.amount,
  }
}

// ============================================================================
// Persistence helpers (localStorage — matches existing preference pattern)
// ============================================================================

/**
 * Load income streams from localStorage.
 * Returns an empty array if nothing is stored or parsing fails.
 */
export function loadIncomeStreams(): IncomeStream[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INCOME_STREAMS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as IncomeStream[]
  } catch {
    return []
  }
}

/**
 * Persist income streams to localStorage.
 * Fails silently if localStorage is unavailable.
 */
export function saveIncomeStreams(streams: IncomeStream[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INCOME_STREAMS_KEY, JSON.stringify(streams))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Generate a simple unique ID for a new income stream.
 * Uses crypto.randomUUID when available, falls back to timestamp + random.
 */
export function generateIncomeStreamId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `is-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
