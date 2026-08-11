/**
 * Auto-Earmark Savings — Pure Utility Module + Sweep Engine
 *
 * Tracks unspent daily allowance as a virtual "earmark" toward a savings goal.
 * When sweep is enabled, actively contributes leftover amounts to the chosen goal.
 *
 * ── Related modules (money-set-aside cluster) ─────────────────────────────
 *   • setAside.ts         — unified "money set aside" model (flow + balance)
 *   • taxSetAside.ts      — gig/1099 tax reserve computation
 *   • allocationUtils.ts  — allocation-bucket slice + savings rate
 */

import type { Transaction, Budget } from '@/types'

// ============================================================================
// Auto-Earmark Savings — Pure Utility Module + Sweep Engine
// ============================================================================
// Tracks unspent daily allowance as a virtual "earmark" toward a savings goal.
// When sweep is enabled, actively contributes leftover amounts to the chosen goal.

const STORAGE_KEY_ENABLED = 'folio-auto-earmark-enabled'
const STORAGE_KEY_GOAL_ID = 'folio-auto-earmark-goal-id'
const STORAGE_KEY_SWEEP_ENABLED = 'folio-auto-sweep-enabled'
const STORAGE_KEY_SWEEP_FREQUENCY = 'folio-auto-sweep-frequency'
const STORAGE_KEY_SWEEP_LOG = 'folio-auto-sweep-log'

// ============================================================================
// Types
// ============================================================================

export type SweepFrequency = 'daily' | 'weekly' | 'monthly'

export interface AutoEarmarkConfig {
  /** Whether the auto-earmark feature is enabled (opt-in) */
  enabled: boolean
  /** Goal ID to earmark towards, or null for generic "savings" */
  goalId: string | null
  /** Whether sweep (actual goal contribution) is enabled — requires explicit opt-in */
  sweepEnabled: boolean
  /** How often to sweep leftover to the goal */
  sweepFrequency: SweepFrequency
}

export interface SweepLogEntry {
  /** ISO date when the sweep occurred */
  date: string
  /** Amount swept to the goal */
  amount: number
  /** Goal ID the amount was swept to */
  goalId: string
}

/** Minimum daily leftover required to trigger a sweep ($0.50) */
export const SWEEP_MIN_THRESHOLD = 0.5

// ============================================================================
// LocalStorage Preferences
// ============================================================================

/**
 * Reads the auto-earmark configuration from localStorage.
 * Defaults to disabled with no goal selected.
 */
export function getAutoEarmarkConfig(): AutoEarmarkConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, goalId: null, sweepEnabled: false, sweepFrequency: 'daily' }
  }
  const enabled = localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'
  const goalId = localStorage.getItem(STORAGE_KEY_GOAL_ID) || null
  const sweepEnabled = localStorage.getItem(STORAGE_KEY_SWEEP_ENABLED) === 'true'
  const sweepFrequency = (localStorage.getItem(STORAGE_KEY_SWEEP_FREQUENCY) as SweepFrequency) || 'daily'
  return { enabled, goalId, sweepEnabled, sweepFrequency }
}

/**
 * Persists the auto-earmark configuration to localStorage.
 */
export function setAutoEarmarkConfig(config: AutoEarmarkConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_ENABLED, String(config.enabled))
  localStorage.setItem(STORAGE_KEY_SWEEP_ENABLED, String(config.sweepEnabled))
  localStorage.setItem(STORAGE_KEY_SWEEP_FREQUENCY, config.sweepFrequency)
  if (config.goalId) {
    localStorage.setItem(STORAGE_KEY_GOAL_ID, config.goalId)
  } else {
    localStorage.removeItem(STORAGE_KEY_GOAL_ID)
  }
}

// ============================================================================
// Pure Computation
// ============================================================================

/**
 * Computes the virtual earmark for a single day.
 * The earmark is the difference between the daily budget and actual spending,
 * clamped to zero (no negative earmarks).
 *
 * @param dailyBudget - The user's computed daily budget
 * @param spentToday - Amount spent on this day
 * @returns The virtual earmark amount (always >= 0)
 */
export function computeDailyEarmark(dailyBudget: number, spentToday: number): number {
  if (dailyBudget <= 0) return 0
  const earmark = dailyBudget - spentToday
  return Math.max(0, earmark)
}

/**
 * Sums the daily earmarks across all days in the specified month that have
 * already passed.
 *
 * For each day in the month up to today, computes:
 *   earmark = max(0, dailyBudget - spentThatDay)
 *
 * The daily budget is derived from the user's budget limits for that month.
 *
 * @param transactions - All user transactions
 * @param budgets - User's budget limits
 * @param month - Month string in YYYY-MM format
 * @returns Total earmarked amount for the month so far
 */
export function computeMonthlyEarmarkTotal(
  transactions: Transaction[],
  budgets: Budget[],
  month: string
): number {
  // Determine daily budget from budget limits for this month
  const monthBudgets = budgets.filter(b => b.month === month)
  const totalMonthlyLimit = monthBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0)

  // If no budgets configured, we can't compute a meaningful earmark
  if (totalMonthlyLimit <= 0) return 0

  // Parse the month to determine days
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)

  // Days in this month
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const dailyBudget = totalMonthlyLimit / daysInMonth

  // Determine how many days have passed (up to today)
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNum

  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth

  // Filter expense transactions for this month
  const monthExpenses = transactions.filter(
    tx => tx.type === 'expense' && tx.date.startsWith(month)
  )

  // Sum earmarks for each day
  let total = 0
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    // Skip today if it hasn't ended yet (only count completed days)
    if (dateStr === todayStr) continue

    const daySpent = monthExpenses
      .filter(tx => tx.date === dateStr)
      .reduce((sum, tx) => sum + tx.amount, 0)

    total += computeDailyEarmark(dailyBudget, daySpent)
  }

  return total
}


// ============================================================================
// Sweep Log — tracks contributions to prevent duplicates
// ============================================================================

/**
 * Reads the sweep log from localStorage.
 */
export function getSweepLog(): SweepLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SWEEP_LOG)
    if (!raw) return []
    return JSON.parse(raw) as SweepLogEntry[]
  } catch {
    return []
  }
}

/**
 * Records a sweep entry to localStorage.
 */
export function recordSweep(entry: SweepLogEntry): void {
  if (typeof window === 'undefined') return
  try {
    const log = getSweepLog()
    log.push(entry)
    // Keep only the last 90 entries to avoid unbounded growth
    const trimmed = log.slice(-90)
    localStorage.setItem(STORAGE_KEY_SWEEP_LOG, JSON.stringify(trimmed))
  } catch {
    // best-effort
  }
}

/**
 * Returns the most recent sweep entry, or null if no sweeps have occurred.
 */
export function getLastSweep(): SweepLogEntry | null {
  const log = getSweepLog()
  return log.length > 0 ? log[log.length - 1] : null
}

// ============================================================================
// Sweep Computation — determines how much to contribute
// ============================================================================

/**
 * Computes the amount to sweep (contribute) to the goal based on
 * unspent daily allowances for completed days that haven't been swept yet.
 *
 * Only considers completed days (never today). Checks the sweep log
 * to avoid double-sweeping days that have already been contributed.
 *
 * @param transactions - All user transactions
 * @param budgets - User budget limits
 * @param config - Current auto-earmark config
 * @returns The amount to sweep (0 if below threshold or nothing to sweep)
 */
export function computeSweepAmount(
  transactions: Transaction[],
  budgets: Budget[],
  config: AutoEarmarkConfig
): number {
  if (!config.enabled || !config.sweepEnabled || !config.goalId) return 0

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Get dates already swept this month
  const log = getSweepLog()
  const sweptDates = new Set(
    log
      .filter(e => e.date.startsWith(currentMonth))
      .map(e => e.date)
  )

  // Determine daily budget
  const monthBudgets = budgets.filter(b => b.month === currentMonth)
  const totalMonthlyLimit = monthBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  if (totalMonthlyLimit <= 0) return 0

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyBudget = totalMonthlyLimit / daysInMonth

  // Filter expense transactions for this month
  const monthExpenses = transactions.filter(
    tx => tx.type === 'expense' && tx.date.startsWith(currentMonth)
  )

  const todayStr = now.toISOString().slice(0, 10)

  // Determine which days to consider based on frequency
  let startDay = 1
  if (config.sweepFrequency === 'daily') {
    // Only sweep yesterday (or the last un-swept day)
    startDay = Math.max(1, now.getDate() - 1)
  } else if (config.sweepFrequency === 'weekly') {
    // Sweep the last 7 completed days
    startDay = Math.max(1, now.getDate() - 7)
  }
  // 'monthly' sweeps all completed days in the month

  let totalToSweep = 0
  for (let day = startDay; day <= now.getDate(); day++) {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`
    // Skip today (not completed) and already-swept days
    if (dateStr === todayStr) continue
    if (sweptDates.has(dateStr)) continue

    const daySpent = monthExpenses
      .filter(tx => tx.date === dateStr)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const earmark = computeDailyEarmark(dailyBudget, daySpent)
    totalToSweep += earmark
  }

  // Only sweep if above the minimum threshold
  if (totalToSweep < SWEEP_MIN_THRESHOLD) return 0
  return Math.round(totalToSweep * 100) / 100
}

/**
 * Computes the total amount auto-saved (swept) in the last 7 days.
 * Used for the weekly recap tip.
 */
export function computeWeeklyAutoSaved(): number {
  const log = getSweepLog()
  if (log.length === 0) return 0

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

  let total = 0
  for (const entry of log) {
    if (entry.date >= cutoff) {
      total += entry.amount
    }
  }
  return Math.round(total * 100) / 100
}

/**
 * Determines if a sweep should run now, based on the configured frequency
 * and the last sweep date.
 *
 * @param config - Current auto-earmark config
 * @returns true if a sweep is due
 */
export function isSweepDue(config: AutoEarmarkConfig): boolean {
  if (!config.enabled || !config.sweepEnabled || !config.goalId) return false

  const lastSweep = getLastSweep()
  if (!lastSweep) return true // Never swept before

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const lastDate = lastSweep.date

  if (config.sweepFrequency === 'daily') {
    // Due if last sweep was before today
    return lastDate < todayStr
  }

  if (config.sweepFrequency === 'weekly') {
    // Due if last sweep was 7+ days ago
    const lastSweepDate = new Date(lastDate)
    const daysSince = Math.floor((now.getTime() - lastSweepDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysSince >= 7
  }

  if (config.sweepFrequency === 'monthly') {
    // Due if last sweep was in a different month
    return lastDate.slice(0, 7) !== todayStr.slice(0, 7)
  }

  return false
}
