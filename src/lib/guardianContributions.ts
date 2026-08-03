/**
 * Guardian Contributions — Family / Parental Support Tracking
 *
 * Lets a student mark recurring support from a parent, guardian, or other
 * family supporter and surface it warmly as a named income stream.
 * Optionally generates a read-only share token so the supporter can see
 * how their help lands.
 *
 * Persistence: localStorage for MVP (same pattern as householdPool.ts).
 * Pure helpers are separated from storage I/O where possible.
 *
 * Task 171.1 — Track inbound support as a named income stream
 */

import type { PayCadence } from './paySchedule'

// ============================================================================
// Types
// ============================================================================

/** A recurring contribution from a family supporter. */
export interface GuardianContribution {
  id: string
  userId: string
  /** Supporter's display name (e.g. "Mom", "Dad", "Grandma") */
  name: string
  /** Friendly emoji for the supporter */
  emoji: string
  /** Dollar amount per cadence period */
  amount: number
  /** How often the support arrives */
  cadence: PayCadence
  /** ISO date (YYYY-MM-DD) when the first contribution was or will be received */
  startDate: string
  /** Optional warm note from the student */
  note: string
  /** Share token for the supporter's read-only view (null = not shared) */
  shareToken: string | null
  /** Whether this contribution is actively expected */
  isActive: boolean
  createdAt: string
}

/** Read-only summary shown to the supporter via the shared link. */
export interface GuardianContributionSummary {
  supporterName: string
  supporterEmoji: string
  recipientName: string
  amount: number
  cadence: PayCadence
  lastContributionDate: string | null
  nextExpectedDate: string
  monthlyHistory: { month: string; total: number }[]
  totalContributed: number
}

// ============================================================================
// Constants
// ============================================================================

const CONTRIBUTIONS_KEY = 'folio-guardian-contributions'
const SHARED_SUMMARY_PREFIX = 'folio-guardian-shared-'
const DAY_MS = 24 * 60 * 60 * 1000

// ============================================================================
// Storage Helpers
// ============================================================================

function loadContributions(): GuardianContribution[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONTRIBUTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveContributions(contributions: GuardianContribution[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONTRIBUTIONS_KEY, JSON.stringify(contributions))
}

// ============================================================================
// Pure Date Helpers
// ============================================================================

/** Parse a `YYYY-MM-DD` string into a UTC-midnight Date. */
function parseISODate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))
}

/** Format a Date as `YYYY-MM-DD`. */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Number of days in a given UTC month. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Compute the next expected contribution date on or after `now` for a given
 * cadence and start date. Reuses the same cadence model as paySchedule.ts.
 *
 * Pure: no side effects.
 */
export function getNextContributionDate(
  startDate: string,
  cadence: PayCadence,
  now: Date = new Date()
): Date {
  const anchor = parseISODate(startDate)
  const nowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // If anchor is in the future, that's our next date
  if (anchor.getTime() >= nowStart.getTime()) {
    return anchor
  }

  switch (cadence) {
    case 'weekly':
      return nextByInterval(anchor, 7, nowStart)
    case 'biweekly':
      return nextByInterval(anchor, 14, nowStart)
    case 'monthly':
      return nextByCalendarMonthly(anchor, nowStart)
    case 'semimonthly':
      return nextBySemimonthly(anchor, nowStart)
    case 'irregular':
      // For irregular support, fall back to biweekly as a warm default
      return nextByInterval(anchor, 14, nowStart)
  }
}

function nextByInterval(anchor: Date, intervalDays: number, now: Date): Date {
  const diff = Math.round((now.getTime() - anchor.getTime()) / DAY_MS)
  if (diff <= 0) return anchor
  const periods = Math.ceil(diff / intervalDays)
  return new Date(anchor.getTime() + periods * intervalDays * DAY_MS)
}

function nextByCalendarMonthly(anchor: Date, now: Date): Date {
  const anchorDay = anchor.getUTCDate()

  // Check current month
  for (let offset = 0; offset <= 3; offset++) {
    const year = now.getUTCFullYear()
    const monthIndex = now.getUTCMonth() + offset
    const d = new Date(Date.UTC(year, monthIndex, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const maxDay = daysInMonth(y, m)
    const candidate = new Date(Date.UTC(y, m, Math.min(anchorDay, maxDay)))
    if (candidate.getTime() >= now.getTime()) {
      return candidate
    }
  }

  // Fallback
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, anchorDay))
}

function nextBySemimonthly(anchor: Date, now: Date): Date {
  const anchorDay = anchor.getUTCDate()
  const day1 = anchorDay <= 15 ? anchorDay : anchorDay - 15
  const day2 = anchorDay <= 15 ? anchorDay + 15 : anchorDay

  for (let offset = 0; offset <= 3; offset++) {
    const year = now.getUTCFullYear()
    const monthIndex = now.getUTCMonth() + offset
    const d = new Date(Date.UTC(year, monthIndex, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const maxDay = daysInMonth(y, m)

    const candidates = [
      new Date(Date.UTC(y, m, Math.min(day1, maxDay))),
      new Date(Date.UTC(y, m, Math.min(day2, maxDay))),
    ].sort((a, b) => a.getTime() - b.getTime())

    for (const candidate of candidates) {
      if (candidate.getTime() >= now.getTime()) {
        return candidate
      }
    }
  }

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, anchorDay))
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * Create a new guardian contribution.
 */
export function createContribution(
  userId: string,
  name: string,
  emoji: string,
  amount: number,
  cadence: PayCadence,
  startDate: string,
  note?: string
): GuardianContribution {
  const contributions = loadContributions()
  const contribution: GuardianContribution = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim() || 'Family support',
    emoji: emoji || '💜',
    amount: Math.max(0, amount),
    cadence,
    startDate,
    note: note?.trim() ?? '',
    shareToken: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  }
  contributions.push(contribution)
  saveContributions(contributions)
  return contribution
}

/**
 * Get all active contributions for a user.
 */
export function getContributions(userId: string): GuardianContribution[] {
  return loadContributions().filter(c => c.userId === userId && c.isActive)
}

/**
 * Get a single contribution by ID.
 */
export function getContribution(id: string): GuardianContribution | null {
  return loadContributions().find(c => c.id === id && c.isActive) ?? null
}

/**
 * Update a contribution's fields.
 */
export function updateContribution(
  id: string,
  updates: Partial<Pick<GuardianContribution, 'name' | 'emoji' | 'amount' | 'cadence' | 'startDate' | 'note'>>
): GuardianContribution | null {
  const contributions = loadContributions()
  const contribution = contributions.find(c => c.id === id && c.isActive)
  if (!contribution) return null

  if (updates.name !== undefined) contribution.name = updates.name.trim() || contribution.name
  if (updates.emoji !== undefined) contribution.emoji = updates.emoji || contribution.emoji
  if (updates.amount !== undefined) contribution.amount = Math.max(0, updates.amount)
  if (updates.cadence !== undefined) contribution.cadence = updates.cadence
  if (updates.startDate !== undefined) contribution.startDate = updates.startDate
  if (updates.note !== undefined) contribution.note = updates.note.trim()

  saveContributions(contributions)
  return { ...contribution }
}

/**
 * Soft-delete a contribution (mark as inactive).
 */
export function deleteContribution(id: string): boolean {
  const contributions = loadContributions()
  const contribution = contributions.find(c => c.id === id)
  if (!contribution) return false
  contribution.isActive = false
  saveContributions(contributions)
  return true
}

// ============================================================================
// Monthly Total (for income / allowance calculations)
// ============================================================================

/**
 * Compute the total monthly contribution amount across all active guardian
 * contributions for a user. Converts different cadences to monthly equivalents.
 *
 * Pure computation once contributions are loaded.
 */
export function getMonthlyContributionTotal(userId: string): number {
  const contributions = getContributions(userId)
  return contributions.reduce((sum, c) => sum + cadenceToMonthly(c.amount, c.cadence), 0)
}

/**
 * Convert a per-period amount to a monthly equivalent.
 * Pure helper.
 */
export function cadenceToMonthly(amount: number, cadence: PayCadence): number {
  switch (cadence) {
    case 'weekly':
      return amount * (52 / 12) // ~4.33
    case 'biweekly':
      return amount * (26 / 12) // ~2.17
    case 'semimonthly':
      return amount * 2
    case 'monthly':
      return amount
    case 'irregular':
      // Default to biweekly equivalent for irregular support
      return amount * (26 / 12)
  }
}

// ============================================================================
// Share Token Management
// ============================================================================

/**
 * Generate a share token for a contribution so the supporter can view it.
 */
export function createShareToken(contributionId: string): string | null {
  const contributions = loadContributions()
  const contribution = contributions.find(c => c.id === contributionId && c.isActive)
  if (!contribution) return null

  contribution.shareToken = crypto.randomUUID()
  saveContributions(contributions)
  return contribution.shareToken
}

/**
 * Get a contribution by its share token (for the shared view page).
 */
export function getContributionByShareToken(token: string): GuardianContribution | null {
  const contributions = loadContributions()
  return contributions.find(c => c.shareToken === token && c.isActive) ?? null
}

/**
 * Revoke (remove) the share token for a contribution.
 */
export function revokeShareToken(contributionId: string): boolean {
  const contributions = loadContributions()
  const contribution = contributions.find(c => c.id === contributionId && c.isActive)
  if (!contribution) return false

  contribution.shareToken = null
  // Also remove stored summary
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SHARED_SUMMARY_PREFIX + contribution.shareToken)
  }
  saveContributions(contributions)
  return true
}

/**
 * Build the shareable URL for a guardian contribution token.
 */
export function getSupportShareUrl(token: string): string {
  if (typeof window === 'undefined') return `/shared/support/${token}`
  return `${window.location.origin}/shared/support/${token}`
}

// ============================================================================
// Shared Summary Generation
// ============================================================================

/**
 * Generate a read-only summary for the supporter's shared view.
 * Shows warm, encouraging data about how their support helps.
 */
export function generateSupporterSummary(
  contribution: GuardianContribution,
  recipientName: string
): GuardianContributionSummary {
  const now = new Date()
  const nextDate = getNextContributionDate(contribution.startDate, contribution.cadence, now)
  const monthlyAmount = cadenceToMonthly(contribution.amount, contribution.cadence)

  // Generate last 6 months of history
  const monthlyHistory: { month: string; total: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

    // Only count months on or after the start date
    const startMonth = contribution.startDate.slice(0, 7)
    if (month >= startMonth) {
      monthlyHistory.push({ month, total: Math.round(monthlyAmount * 100) / 100 })
    }
  }

  const totalContributed = monthlyHistory.reduce((sum, m) => sum + m.total, 0)

  // Compute last contribution date (the most recent date before now)
  let lastContributionDate: string | null = null
  const start = parseISODate(contribution.startDate)
  if (start.getTime() <= now.getTime()) {
    // Walk backward from next to find the most recent past one
    const prevDate = getPreviousContributionDate(contribution.startDate, contribution.cadence, now)
    if (prevDate) {
      lastContributionDate = formatDate(prevDate)
    }
  }

  return {
    supporterName: contribution.name,
    supporterEmoji: contribution.emoji,
    recipientName,
    amount: contribution.amount,
    cadence: contribution.cadence,
    lastContributionDate,
    nextExpectedDate: formatDate(nextDate),
    monthlyHistory,
    totalContributed: Math.round(totalContributed * 100) / 100,
  }
}

/**
 * Store the supporter summary keyed by token for the shared page.
 */
export function storeSupporterSummary(token: string, summary: GuardianContributionSummary): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHARED_SUMMARY_PREFIX + token, JSON.stringify(summary))
}

/**
 * Retrieve a supporter summary by token for the shared page.
 */
export function getSupporterSummary(token: string): GuardianContributionSummary | null {
  if (typeof window === 'undefined') return null
  try {
    // Check if the contribution is still active and has this token
    const contribution = getContributionByShareToken(token)
    if (!contribution) return null

    const raw = localStorage.getItem(SHARED_SUMMARY_PREFIX + token)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the most recent contribution date before `now`.
 */
function getPreviousContributionDate(
  startDate: string,
  cadence: PayCadence,
  now: Date
): Date | null {
  const next = getNextContributionDate(startDate, cadence, now)
  const anchor = parseISODate(startDate)

  // If the next date equals the anchor (start is in the future), there's no previous
  if (next.getTime() <= anchor.getTime()) return null

  switch (cadence) {
    case 'weekly':
      return new Date(next.getTime() - 7 * DAY_MS)
    case 'biweekly':
    case 'irregular':
      return new Date(next.getTime() - 14 * DAY_MS)
    case 'monthly': {
      const prev = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() - 1, next.getUTCDate()))
      const maxDay = daysInMonth(prev.getUTCFullYear(), prev.getUTCMonth())
      if (prev.getUTCDate() > maxDay) {
        return new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), maxDay))
      }
      return prev
    }
    case 'semimonthly':
      // Approximately 15 days before
      return new Date(next.getTime() - 15 * DAY_MS)
  }
}
