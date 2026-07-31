/**
 * Spend-Down Plan — "Make this $X last until [date]" mode.
 *
 * Students often receive a lump sum (aid refund, scholarship, etc.)
 * that must cover all spending until a known date. This module computes
 * a daily spending allowance from the remaining balance and days left.
 *
 * Everything here is a pure function with no side effects — persistence lives
 * in useHomeData (localStorage) and UI in the relevant components.
 */

import type { Transaction } from '@/types'
import { formatDateLocal, parseDateLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

export interface SpendDownPlan {
  id: string
  /** User-facing label, e.g. "Fall Aid Refund" */
  label: string
  /** Total starting amount to spend down */
  totalAmount: number
  /** Start date (ISO YYYY-MM-DD) — when the money was received */
  startDate: string
  /** Target end date (ISO YYYY-MM-DD) — make it last until this date */
  endDate: string
  /** Emoji for display */
  emoji: string
  /** Optional link to a disbursement ID (if created from a disbursement entry) */
  disbursementId?: string
}

export interface SpendDownResult {
  /** Daily amount safe to spend */
  dailyAmount: number
  /** Days remaining until endDate (including today) */
  daysRemaining: number
  /** Total spent since startDate (from transactions) */
  spentSoFar: number
  /** Remaining balance (totalAmount - spentSoFar) */
  remaining: number
  /** Total pool (the original amount) */
  totalAmount: number
  /** Progress fraction (0 to 1) based on time elapsed */
  timeProgress: number
  /** Progress fraction (0 to 1) based on spending (spentSoFar / totalAmount) */
  spendProgress: number
  /** Whether the user is on track (spending at or below daily pace) */
  onTrack: boolean
  /** Friendly label from the plan */
  label: string
  /** Plan ID for reference */
  planId: string
}

// ============================================================================
// Constants
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'folio-spend-down-plans'

// ============================================================================
// Core Pure Helpers
// ============================================================================

/**
 * Determines if a spend-down plan is currently active (today is between start and end).
 *
 * @param plan - The spend-down plan
 * @param currentDate - The current date
 * @returns true if currentDate is on or between startDate and endDate
 */
export function isSpendDownActive(plan: SpendDownPlan, currentDate: Date): boolean {
  const todayStr = formatDateLocal(currentDate)
  return todayStr >= plan.startDate && todayStr <= plan.endDate
}

/**
 * Returns the number of days remaining in the plan (including today).
 * Returns 0 if the plan has ended. Returns full duration if not yet started.
 *
 * @param plan - The spend-down plan
 * @param currentDate - The current date
 * @returns Days remaining including today, or 0 if plan ended
 */
export function getDaysRemainingInPlan(plan: SpendDownPlan, currentDate: Date): number {
  const todayStr = formatDateLocal(currentDate)
  if (todayStr > plan.endDate) return 0
  if (todayStr < plan.startDate) {
    // Not started yet — return total plan days
    const start = parseDateLocal(plan.startDate)
    const end = parseDateLocal(plan.endDate)
    const diff = Math.round((end.getTime() - start.getTime()) / DAY_MS)
    return Math.max(1, diff + 1)
  }

  const today = parseDateLocal(todayStr)
  const end = parseDateLocal(plan.endDate)
  const diff = Math.round((end.getTime() - today.getTime()) / DAY_MS)
  return Math.max(1, diff + 1) // +1 for inclusive today
}

/**
 * Computes the spend-down result for a plan given transactions and the current date.
 *
 * @param plan - The spend-down plan
 * @param transactions - All user transactions (expenses between startDate and today are summed)
 * @param currentDate - The current date (for testability)
 * @returns SpendDownResult or null if plan is expired or not yet started
 *
 * @pure No side effects, no internal Date.now() calls.
 */
export function computeSpendDown(
  plan: SpendDownPlan,
  transactions: Transaction[],
  currentDate: Date
): SpendDownResult | null {
  // Only compute when plan is active
  if (!isSpendDownActive(plan, currentDate)) return null

  const todayStr = formatDateLocal(currentDate)
  const daysRemaining = getDaysRemainingInPlan(plan, currentDate)

  // Sum expenses from plan start to today (inclusive)
  const spentSoFar = transactions
    .filter(t =>
      t.type === 'expense' &&
      t.date >= plan.startDate &&
      t.date <= todayStr
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Remaining balance
  const remaining = Math.max(0, plan.totalAmount - spentSoFar)

  // Daily allowance from remaining balance
  const dailyAmount = Math.max(0, remaining / daysRemaining)

  // Time progress: fraction of total plan duration elapsed
  const start = parseDateLocal(plan.startDate)
  const end = parseDateLocal(plan.endDate)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1)
  const today = parseDateLocal(todayStr)
  const elapsed = Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1
  const timeProgress = Math.min(1, Math.max(0, elapsed / totalDays))

  // Spend progress: fraction of total amount spent
  const spendProgress = plan.totalAmount > 0
    ? Math.min(1, Math.max(0, spentSoFar / plan.totalAmount))
    : 0

  // On track: spending proportion ≤ time proportion
  const onTrack = spendProgress <= timeProgress

  return {
    dailyAmount: Math.round(dailyAmount * 100) / 100,
    daysRemaining,
    spentSoFar: Math.round(spentSoFar * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    totalAmount: plan.totalAmount,
    timeProgress,
    spendProgress,
    onTrack,
    label: plan.label,
    planId: plan.id,
  }
}

// ============================================================================
// Persistence Helpers (localStorage)
// ============================================================================

/**
 * Load persisted spend-down plans from localStorage.
 * Returns an empty array if nothing is stored or if parsing fails.
 */
export function loadSpendDownPlans(): SpendDownPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SpendDownPlan[]
  } catch {
    return []
  }
}

/**
 * Save spend-down plans to localStorage.
 */
export function saveSpendDownPlans(plans: SpendDownPlan[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Generate a simple unique ID for a new spend-down plan.
 */
export function generateSpendDownId(): string {
  return `sd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
