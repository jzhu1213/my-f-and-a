import type { Transaction } from '@/types'
import type { PaySchedule } from './paySchedule'
import type { FixedExpense } from './fixedExpenses'
import type { SinkingFund } from './sinkingFunds'
import type { Disbursement } from './disbursements'
import { getNextPayday } from './paySchedule'
import { getTotalMonthlyReserve } from './sinkingFunds'
import { isDisbursementActive } from './disbursements'

/**
 * Cash-flow forecast engine — pure functions that project a day-by-day balance
 * curve from today through the end of term or next payday.
 *
 * No side effects, no Supabase calls. Receives all data as arguments and returns
 * a deterministic projection.
 *
 * **Validates: Requirements new (Task 148.1)**
 */

// ============================================================================
// Types
// ============================================================================

/** A single event that affects the projected balance on a given day. */
export interface ForecastEvent {
  /** What kind of event this is */
  type: 'income' | 'bill' | 'sinking-reserve' | 'scheduled'
  /** Human-friendly label for the event */
  label: string
  /** Dollar amount (positive for inflows, negative for outflows) */
  amount: number
}

/** A single day in the forecast projection. */
export interface ForecastDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** Projected balance at end of this day */
  projectedBalance: number
  /** Events occurring on this day */
  events: ForecastEvent[]
}

/** Summary of the forecast for quick display. */
export interface ForecastSummary {
  /** The lowest projected balance across the forecast window */
  lowestBalance: number
  /** The date of the lowest projected balance */
  lowestBalanceDate: string
  /** Whether the balance ever dips below zero */
  willGoNegative: boolean
  /** The end date of the forecast */
  endDate: string
  /** Formatted end date label (e.g. "Jan 15") */
  endDateLabel: string
  /** Total number of days in the forecast */
  totalDays: number
}

/** Full forecast result. */
export interface CashFlowForecast {
  /** Day-by-day balance curve */
  days: ForecastDay[]
  /** Quick summary stats */
  summary: ForecastSummary
}

/** Input configuration for the forecast. */
export interface ForecastInput {
  /** Current available balance (discretionary pool or account balance) */
  currentBalance: number
  /** User's pay schedule (null = no schedule set, fallback to end-of-month) */
  paySchedule: PaySchedule | null
  /** Active recurring bills */
  bills: FixedExpense[]
  /** Sinking funds with monthly reserves */
  sinkingFunds: SinkingFund[]
  /** Future-dated scheduled transactions (type === 'expense' with date > today) */
  scheduledTransactions: Transaction[]
  /** Income transactions for cadence estimation (irregular pay) */
  incomeHistory: Transaction[]
  /** Reference date — defaults to today */
  now?: Date
}

// ============================================================================
// Internal date helpers (UTC, consistent with paySchedule.ts)
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

/** Format a Date to YYYY-MM-DD in UTC. */
function toISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Truncate a Date to UTC midnight. */
function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Get end-of-month date for a given reference date. */
function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

/** Format a date as a short label like "Jan 15". */
function formatDateLabel(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** Number of whole days between two dates. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfUTCDay(b).getTime() - startOfUTCDay(a).getTime()) / DAY_MS)
}

// ============================================================================
// Core forecast computation
// ============================================================================

/**
 * Generates a forward-looking cash-flow forecast from today through the next
 * payday (or end-of-month if no pay schedule is configured).
 *
 * The forecast projects the balance day by day, incorporating:
 * - Income events on payday
 * - Recurring bill due dates
 * - Sinking fund daily reserve deductions (spread evenly across the month)
 * - Scheduled one-off transactions
 *
 * Pure function — no side effects.
 */
export function generateCashFlowForecast(input: ForecastInput): CashFlowForecast {
  const now = input.now ?? new Date()
  const today = startOfUTCDay(now)

  // Determine the forecast horizon
  let horizonDate: Date
  if (input.paySchedule) {
    horizonDate = getNextPayday(input.paySchedule, now, input.incomeHistory)
    // If next payday is today, look ahead to the one after
    if (daysBetween(today, horizonDate) <= 0) {
      const tomorrow = new Date(today.getTime() + DAY_MS)
      horizonDate = getNextPayday(input.paySchedule, tomorrow, input.incomeHistory)
    }
  } else {
    // Fallback: end of current month
    horizonDate = endOfMonth(today)
  }

  // Ensure at least 1 day of forecast
  const totalDays = Math.max(1, daysBetween(today, horizonDate))

  // Pre-compute daily sinking fund deduction (monthly reserve / ~30 days)
  const monthlyReserve = getTotalMonthlyReserve(input.sinkingFunds, now)
  const dailySinkingReserve = monthlyReserve > 0 ? monthlyReserve / 30.44 : 0

  // Build a map of date → events
  const eventsByDate = new Map<string, ForecastEvent[]>()

  const addEvent = (dateStr: string, event: ForecastEvent) => {
    const existing = eventsByDate.get(dateStr) ?? []
    existing.push(event)
    eventsByDate.set(dateStr, existing)
  }

  // Add recurring bill events (only active bills due within the forecast window)
  for (const bill of input.bills) {
    if (!bill.isActive) continue

    const dueDay = bill.dueDay
    // Check current month
    const daysInCurrentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate()
    const clampedDayCurrentMonth = Math.min(dueDay, daysInCurrentMonth)
    const currentMonthDue = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), clampedDayCurrentMonth))
    if (currentMonthDue.getTime() > today.getTime() && currentMonthDue.getTime() <= horizonDate.getTime()) {
      addEvent(toISODate(currentMonthDue), {
        type: 'bill',
        label: bill.label,
        amount: -bill.amount,
      })
    }
    // Check next month if the horizon crosses into it
    const daysInNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0)).getUTCDate()
    const clampedDayNextMonth = Math.min(dueDay, daysInNextMonth)
    const nextMonthDue = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, clampedDayNextMonth))
    if (nextMonthDue.getTime() > today.getTime() && nextMonthDue.getTime() <= horizonDate.getTime()) {
      addEvent(toISODate(nextMonthDue), {
        type: 'bill',
        label: bill.label,
        amount: -bill.amount,
      })
    }
  }

  // Add scheduled transactions (future-dated expenses within the forecast window)
  for (const tx of input.scheduledTransactions) {
    const txDate = tx.date.slice(0, 10)
    const txDateObj = new Date(txDate + 'T00:00:00Z')
    if (txDateObj.getTime() > today.getTime() && txDateObj.getTime() <= horizonDate.getTime()) {
      addEvent(txDate, {
        type: 'scheduled',
        label: tx.note || tx.category,
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
      })
    }
  }

  // Add income event on payday (if pay schedule has an amount)
  if (input.paySchedule?.amount) {
    const paydayStr = toISODate(horizonDate)
    addEvent(paydayStr, {
      type: 'income',
      label: 'Payday',
      amount: input.paySchedule.amount,
    })
  }

  // Generate day-by-day forecast
  const days: ForecastDay[] = []
  let runningBalance = input.currentBalance

  for (let i = 0; i <= totalDays; i++) {
    const date = new Date(today.getTime() + i * DAY_MS)
    const dateStr = toISODate(date)
    const dayEvents: ForecastEvent[] = [...(eventsByDate.get(dateStr) ?? [])]

    // Apply sinking fund daily reserve (skip today since it's already in current balance)
    if (i > 0 && dailySinkingReserve > 0) {
      dayEvents.push({
        type: 'sinking-reserve',
        label: 'Sinking fund reserve',
        amount: -Math.round(dailySinkingReserve * 100) / 100,
      })
    }

    // Apply all events to running balance
    for (const event of dayEvents) {
      runningBalance += event.amount
    }

    days.push({
      date: dateStr,
      projectedBalance: Math.round(runningBalance * 100) / 100,
      events: dayEvents,
    })
  }

  // Compute summary
  let lowestBalance = Infinity
  let lowestBalanceDate = toISODate(today)
  let willGoNegative = false

  for (const day of days) {
    if (day.projectedBalance < lowestBalance) {
      lowestBalance = day.projectedBalance
      lowestBalanceDate = day.date
    }
    if (day.projectedBalance < 0) {
      willGoNegative = true
    }
  }

  return {
    days,
    summary: {
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      lowestBalanceDate,
      willGoNegative,
      endDate: toISODate(horizonDate),
      endDateLabel: formatDateLabel(horizonDate),
      totalDays,
    },
  }
}

// ============================================================================
// Forecast income validation (irregular / aid-based income)
// ============================================================================

/**
 * How trustworthy the forecast's income assumptions are.
 * - `high`      — a regular pay schedule with a known amount; the projected
 *                 payday deposit is reliable.
 * - `estimated` — income is irregular or the payday amount is unknown, so the
 *                 timing/amount is a best-guess from recent history.
 * - `low`       — no pay schedule at all; the forecast can't project a deposit.
 */
export type ForecastConfidence = 'high' | 'estimated' | 'low'

/** Result of validating irregular / aid-based income against the forecast. */
export interface ForecastIncomeValidation {
  /** Overall confidence in the forecast's income assumptions. */
  confidence: ForecastConfidence
  /** Warm, shame-free note describing the income assumptions. */
  note: string
  /** True when the pay schedule cadence is `irregular`. */
  isIrregular: boolean
  /** True when there's at least one active aid/lump-sum disbursement. */
  hasAidIncome: boolean
  /** True when no payday amount is available, so the forecast omits a deposit. */
  missingScheduleAmount: boolean
  /**
   * When irregular income has a scheduled amount that diverges notably from the
   * average of recent income, this is the recent average for context (else null).
   */
  recentAverageIncome: number | null
}

/** Input for {@link validateForecastIncome}. */
export interface ForecastIncomeValidationInput {
  /** The user's pay schedule (null = none configured). */
  paySchedule: PaySchedule | null
  /** Income transactions used to estimate irregular rhythm/amount. */
  incomeHistory: Transaction[]
  /** Active aid/lump-sum disbursements (financial aid, scholarships, refunds). */
  disbursements?: Disbursement[]
  /** Reference date — defaults to today. */
  now?: Date
}

/** How many recent income transactions to average for the amount comparison. */
const RECENT_INCOME_LOOKBACK = 6
/** Relative gap beyond which the scheduled amount is flagged as diverging. */
const AMOUNT_DIVERGENCE_THRESHOLD = 0.25

/**
 * Validates irregular and aid-based income against the cash-flow forecast so
 * the forecast can flag when its projected deposits are estimates rather than
 * certainties (task 154.1, pairs with Phase 2 task 120.1).
 *
 * The forecast only shows a single payday deposit (from `paySchedule.amount`)
 * and does NOT add aid disbursements as lump deposits — aid is smoothed into
 * the daily allowance instead. For students and gig workers this can make the
 * projected balance look lower or less certain than reality, so we surface a
 * gentle, contextual note.
 *
 * Pure function — no side effects.
 */
export function validateForecastIncome(
  input: ForecastIncomeValidationInput
): ForecastIncomeValidation {
  const now = input.now ?? new Date()
  const { paySchedule, incomeHistory, disbursements } = input

  const isIrregular = paySchedule?.cadence === 'irregular'
  const hasAidIncome = (disbursements ?? []).some((d) => isDisbursementActive(d, now))
  const scheduledAmount = paySchedule?.amount
  const missingScheduleAmount = !paySchedule || !scheduledAmount || scheduledAmount <= 0

  // Recent average income (for the divergence check on irregular pay).
  const recentIncomeAmounts = incomeHistory
    .filter((t) => t.type === 'income' && t.amount > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
    .slice(0, RECENT_INCOME_LOOKBACK)
    .map((t) => t.amount)

  const recentAverage =
    recentIncomeAmounts.length > 0
      ? recentIncomeAmounts.reduce((s, a) => s + a, 0) / recentIncomeAmounts.length
      : null

  // Does the scheduled amount diverge notably from recent reality?
  let amountDiverges = false
  if (isIrregular && scheduledAmount && scheduledAmount > 0 && recentAverage && recentAverage > 0) {
    amountDiverges =
      Math.abs(scheduledAmount - recentAverage) / recentAverage > AMOUNT_DIVERGENCE_THRESHOLD
  }

  // ── Determine confidence ─────────────────────────────────────────────────
  let confidence: ForecastConfidence
  if (missingScheduleAmount && !hasAidIncome) {
    confidence = 'low'
  } else if (isIrregular || missingScheduleAmount || amountDiverges) {
    confidence = 'estimated'
  } else {
    confidence = 'high'
  }

  // ── Build a warm, contextual note ────────────────────────────────────────
  let note: string
  if (confidence === 'low') {
    note =
      "No pay schedule set yet, so this view doesn't include future income. Add your pay rhythm to see the full picture."
  } else if (hasAidIncome && isIrregular) {
    note =
      "Your income varies and aid is spread across months, so this is a careful estimate. Your aid already boosts your daily allowance — you likely have more room than the line suggests."
  } else if (hasAidIncome) {
    note =
      "Aid disbursements are smoothed into your daily allowance rather than shown as a lump deposit here, so your real cushion may be a bit higher than this line."
  } else if (isIrregular && amountDiverges && recentAverage) {
    note = `Your income varies — recent deposits have averaged around $${Math.round(recentAverage).toLocaleString()}, so treat the projected payday as an estimate.`
  } else if (isIrregular) {
    note =
      "Your income is irregular, so the payday timing here is estimated from your recent history — a helpful guide, not a guarantee."
  } else if (missingScheduleAmount) {
    note =
      "We know your pay rhythm but not the amount, so this view leaves out your next deposit. Add an amount to project it in."
  } else {
    note = "Based on your regular pay schedule — this projection should be reliable."
  }

  return {
    confidence,
    note,
    isIrregular,
    hasAidIncome,
    missingScheduleAmount,
    recentAverageIncome: amountDiverges ? recentAverage : null,
  }
}
