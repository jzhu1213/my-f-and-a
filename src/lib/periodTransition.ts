/**
 * Period Transition — detects when a new budget period has started since the
 * user's last app open and generates a warm welcome-back message.
 *
 * Core logic:
 * 1. Stores the last-seen period start date in localStorage.
 * 2. On each app open, compares the current period start with the stored one.
 * 3. If they differ, a new period has begun — surface a brief reset message.
 *
 * The rollover mechanics (±2× daily cap) are already handled by the allowance
 * engine in dailyAllowanceUtils.ts. This module only handles the _messaging_.
 *
 * **Validates: Requirements 18.5, 2.x**
 */

import type { BudgetPeriodPreference, BudgetPeriodType } from '@/lib/budgetPeriod'
import { computePeriodContext } from '@/lib/budgetPeriod'
import { formatCurrency as formatCurrencyCentral } from '@/lib/currencyUtils'
import type { TermSchedule } from '@/lib/termSchedule'

// ============================================================================
// Types
// ============================================================================

/** Result when a period transition is detected */
export interface PeriodTransitionMessage {
  /** The human-friendly message to display */
  text: string
  /** The daily allowance amount for the new period's first day */
  startAmount: number
  /** The type of period that just started */
  periodType: BudgetPeriodType
}

// ============================================================================
// Constants
// ============================================================================

const LAST_PERIOD_START_KEY = 'folio-last-period-start'

// ============================================================================
// Persistence Helpers
// ============================================================================

/**
 * Get the last-seen period start date from localStorage.
 */
function getLastSeenPeriodStart(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_PERIOD_START_KEY)
  } catch {
    return null
  }
}

/**
 * Store the current period start date in localStorage.
 */
function setLastSeenPeriodStart(periodStart: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_PERIOD_START_KEY, periodStart)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Core Detection
// ============================================================================

/**
 * Detect whether a new period has started since the last app open.
 *
 * Returns a PeriodTransitionMessage if a transition is detected, or null otherwise.
 * Also updates localStorage so the message only shows once per period transition.
 *
 * @param budgetPeriod - The user's budget period preference
 * @param currentDate - The current date
 * @param dailyAllowanceAmount - Today's computed daily allowance amount (for the message)
 * @param termSchedule - Optional term schedule
 */
export function detectPeriodTransition(
  budgetPeriod: BudgetPeriodPreference | null,
  currentDate: Date,
  dailyAllowanceAmount: number,
  termSchedule?: TermSchedule | null
): PeriodTransitionMessage | null {
  // Monthly periods use existing month-boundary logic — no transition message needed
  if (!budgetPeriod || budgetPeriod.type === 'monthly') return null

  const periodContext = computePeriodContext(budgetPeriod, currentDate, termSchedule)
  if (!periodContext) return null

  const currentPeriodStart = periodContext.periodStart
  const lastSeenStart = getLastSeenPeriodStart()

  // Always update the stored period start to the current one
  setLastSeenPeriodStart(currentPeriodStart)

  // If no previous record, this is the first time — don't show a message
  if (!lastSeenStart) return null

  // If the period start hasn't changed, no transition occurred
  if (lastSeenStart === currentPeriodStart) return null

  // A new period has started! Generate the welcome-back message
  const text = generatePeriodResetMessage(budgetPeriod.type, dailyAllowanceAmount)

  return {
    text,
    startAmount: dailyAllowanceAmount,
    periodType: budgetPeriod.type,
  }
}

/**
 * Initialize the period tracking without triggering a transition message.
 * Call this when the user first sets up a budget period preference so the
 * next real transition is detected correctly.
 */
export function initializePeriodTracking(
  budgetPeriod: BudgetPeriodPreference | null,
  currentDate: Date,
  termSchedule?: TermSchedule | null
): void {
  if (!budgetPeriod || budgetPeriod.type === 'monthly') {
    // Clear tracking for monthly periods
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(LAST_PERIOD_START_KEY) } catch { /* ignore */ }
    }
    return
  }

  const periodContext = computePeriodContext(budgetPeriod, currentDate, termSchedule)
  if (periodContext) {
    setLastSeenPeriodStart(periodContext.periodStart)
  }
}

// ============================================================================
// Message Generation
// ============================================================================

/**
 * Generate a warm, encouraging period-reset message.
 *
 * @param periodType - The budget period type
 * @param amount - Today's daily allowance amount
 */
function generatePeriodResetMessage(periodType: BudgetPeriodType, amount: number): string {
  const formatted = formatCurrency(amount)

  switch (periodType) {
    case 'weekly':
      return `New week — you start with ${formatted} today`
    case 'biweekly':
      return `New cycle — you start with ${formatted} today`
    case 'term':
      return `New term — you start with ${formatted} today`
    default:
      return `Fresh start — you have ${formatted} today`
  }
}

/**
 * Simple currency formatter for the message (no cents if whole dollar).
 */
function formatCurrency(amount: number): string {
  const digits = amount === Math.floor(amount) ? 0 : 2
  return formatCurrencyCentral(amount, 'USD', { fractionDigits: digits })
}
