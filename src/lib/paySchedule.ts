import type { Transaction } from '@/types'

/**
 * Pay schedule / cadence model + pure helpers (Group 7, Theme F — payday awareness).
 *
 * This module is intentionally PURE: no I/O, no Supabase, no side effects. It only
 * models when a user's next paycheck lands so downstream features (safe-to-spend,
 * overdraft warnings) can reason about cash flow until payday.
 *
 * Tailored for students / young adults with variable income: the `irregular`
 * cadence estimates a rhythm from recent income transactions and degrades
 * gracefully to a sensible default when there isn't enough history yet.
 *
 * **Validates: Requirements 1.1, 13.7, new**
 */

// ============================================================================
// Types
// ============================================================================

/**
 * How often a user gets paid.
 * - `weekly`      — every 7 days from the anchor date
 * - `biweekly`    — every 14 days from the anchor date
 * - `semimonthly` — twice a month (two days ~15 days apart derived from the anchor)
 * - `monthly`     — once a month on the anchor day-of-month
 * - `irregular`   — variable income; cadence is estimated from recent income history
 */
export type PayCadence =
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'irregular'

/**
 * A user's pay schedule. Deliberately small and flexible — a warm default that
 * can adapt over time rather than a rigid payroll configuration.
 */
export interface PaySchedule {
  /** Pay frequency */
  cadence: PayCadence
  /** A known payday, as an ISO date string (`YYYY-MM-DD`), used to anchor the cadence */
  anchorDate: string
  /** Optional expected paycheck amount */
  amount?: number
}

// ============================================================================
// Constants
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Sensible fallback cadence (in days) for irregular income when history is
 * insufficient. Biweekly is the most common rhythm for students / young adults,
 * so it makes a friendly, flexible default.
 */
export const DEFAULT_IRREGULAR_CADENCE_DAYS = 14

/** Minimum plausible interval between paychecks, in days. */
const MIN_CADENCE_DAYS = 1
/** Maximum plausible interval between paychecks, in days (~2 months). */
const MAX_CADENCE_DAYS = 62
/** How many recent income intervals to average when estimating an irregular cadence. */
const IRREGULAR_LOOKBACK_INTERVALS = 6

// ============================================================================
// Internal date helpers (UTC, matching dailyAllowanceUtils conventions)
// ============================================================================

/** Parse a `YYYY-MM-DD` (or ISO) string into a UTC-midnight Date. */
function parseISODate(iso: string): Date {
  const datePart = iso.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))
}

/** Truncate a Date to UTC midnight. */
function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Number of days in a given UTC month. */
function daysInUTCMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** Whole-day difference (b - a), both truncated to UTC midnight. */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfUTCDay(b).getTime() - startOfUTCDay(a).getTime()) / DAY_MS)
}

// ============================================================================
// Irregular-cadence estimation (self-contained trailing-average fallback)
// ============================================================================

/**
 * Estimate the average number of days between paychecks from recent income
 * transactions (a trailing average of the intervals between logged income).
 *
 * Degrades gracefully:
 * - Fewer than 2 income transactions → returns {@link DEFAULT_IRREGULAR_CADENCE_DAYS}.
 * - Ignores implausible intervals (0 days, or longer than ~2 months) so a stray
 *   backdated entry doesn't distort the estimate.
 * - Falls back to the default if no plausible intervals remain.
 *
 * Pure: does not mutate its input.
 *
 * **Validates: Requirements 1.1, new**
 */
export function estimateIrregularCadenceDays(incomeHistory: Transaction[]): number {
  const incomeDates = incomeHistory
    .filter((t) => t.type === 'income')
    .map((t) => parseISODate(t.date).getTime())
    .sort((a, b) => a - b)

  if (incomeDates.length < 2) {
    return DEFAULT_IRREGULAR_CADENCE_DAYS
  }

  // Intervals between consecutive income dates.
  const intervals: number[] = []
  for (let i = 1; i < incomeDates.length; i++) {
    const days = Math.round((incomeDates[i] - incomeDates[i - 1]) / DAY_MS)
    if (days >= MIN_CADENCE_DAYS && days <= MAX_CADENCE_DAYS) {
      intervals.push(days)
    }
  }

  if (intervals.length === 0) {
    return DEFAULT_IRREGULAR_CADENCE_DAYS
  }

  // Trailing average: only the most recent intervals matter for current rhythm.
  const recent = intervals.slice(-IRREGULAR_LOOKBACK_INTERVALS)
  const avg = recent.reduce((sum, d) => sum + d, 0) / recent.length

  return Math.round(avg)
}

// ============================================================================
// Next-payday computation
// ============================================================================

/** Fixed day-step interval (in days) for a cadence, or null if calendar-based. */
function fixedIntervalDays(
  cadence: PayCadence,
  incomeHistory: Transaction[]
): number | null {
  switch (cadence) {
    case 'weekly':
      return 7
    case 'biweekly':
      return 14
    case 'irregular':
      return estimateIrregularCadenceDays(incomeHistory)
    default:
      return null
  }
}

/**
 * Next payday for a fixed day-step cadence (weekly / biweekly / irregular).
 * Steps forward from the anchor by `intervalDays` until reaching the first
 * payday on or after `now`. If the anchor is in the future, the anchor itself
 * is the next payday.
 */
function nextByInterval(anchor: Date, intervalDays: number, now: Date): Date {
  const anchorStart = startOfUTCDay(anchor)
  const diff = dayDiff(anchorStart, now)

  if (diff <= 0) {
    // `now` is on or before the anchor — the anchor is the next payday.
    return anchorStart
  }

  const periods = Math.ceil(diff / intervalDays)
  return new Date(anchorStart.getTime() + periods * intervalDays * DAY_MS)
}

/** Day-of-month payday targets for a calendar cadence (monthly / semimonthly). */
function calendarPaydayDays(cadence: PayCadence, anchorDay: number): number[] {
  if (cadence === 'monthly') {
    return [anchorDay]
  }
  // semimonthly: two paydays ~15 days apart, kept within a single month.
  if (anchorDay <= 15) {
    return [anchorDay, anchorDay + 15]
  }
  return [anchorDay - 15, anchorDay]
}

/**
 * Next payday for a calendar-based cadence (monthly / semimonthly). Generates
 * candidate paydays across nearby months (clamping to each month's length so
 * e.g. a 31st anchor lands on the last day of shorter months) and returns the
 * earliest one on or after `now`.
 */
function nextByCalendar(cadence: PayCadence, anchor: Date, now: Date): Date {
  const anchorDay = anchor.getUTCDate()
  const targetDays = calendarPaydayDays(cadence, anchorDay)
  const nowStart = startOfUTCDay(now)

  // Look from one month back to a few months ahead to guarantee a hit.
  for (let offset = -1; offset <= 4; offset++) {
    const year = now.getUTCFullYear()
    const monthIndex = now.getUTCMonth() + offset
    const normalizedDate = new Date(Date.UTC(year, monthIndex, 1))
    const y = normalizedDate.getUTCFullYear()
    const m = normalizedDate.getUTCMonth()
    const monthLength = daysInUTCMonth(y, m)

    const candidates = targetDays
      .map((day) => new Date(Date.UTC(y, m, Math.min(day, monthLength))))
      .sort((a, b) => a.getTime() - b.getTime())

    for (const candidate of candidates) {
      if (candidate.getTime() >= nowStart.getTime()) {
        return candidate
      }
    }
  }

  // Should be unreachable, but degrade to a month past the anchor rather than throw.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, anchorDay))
}

/**
 * Compute the next payday on or after `now` for the given schedule.
 *
 * For the `irregular` cadence, the rhythm is estimated from `incomeHistory`
 * (trailing average of recent income intervals) and stepped forward from the
 * most recent income date when available, otherwise from the schedule anchor.
 *
 * Pure: returns a new Date, mutates nothing.
 *
 * **Validates: Requirements 1.1, 13.7, new**
 *
 * @param schedule      The user's pay schedule.
 * @param now           The reference "now" (defaults to the current time).
 * @param incomeHistory Recent income transactions — only used for `irregular`.
 */
export function getNextPayday(
  schedule: PaySchedule,
  now: Date = new Date(),
  incomeHistory: Transaction[] = []
): Date {
  const interval = fixedIntervalDays(schedule.cadence, incomeHistory)

  if (interval !== null) {
    // For irregular income, anchor on the most recent income date if we have one
    // so the estimated rhythm continues from the last real paycheck.
    let anchor = parseISODate(schedule.anchorDate)
    if (schedule.cadence === 'irregular') {
      const latestIncome = incomeHistory
        .filter((t) => t.type === 'income')
        .map((t) => parseISODate(t.date))
        .sort((a, b) => b.getTime() - a.getTime())[0]
      if (latestIncome) {
        anchor = latestIncome
      }
    }
    return nextByInterval(anchor, interval, now)
  }

  return nextByCalendar(schedule.cadence, parseISODate(schedule.anchorDate), now)
}

/**
 * Whole number of days from `now` until the next payday (0 if today is payday).
 * Never negative.
 *
 * Pure.
 *
 * **Validates: Requirements 1.1, 13.7, new**
 */
export function getDaysUntilPayday(
  schedule: PaySchedule,
  now: Date = new Date(),
  incomeHistory: Transaction[] = []
): number {
  const next = getNextPayday(schedule, now, incomeHistory)
  return Math.max(0, dayDiff(now, next))
}

// ============================================================================
// Safe-to-spend-until-payday
// ============================================================================

/**
 * Spread the remaining discretionary money across the days left until the next
 * paycheck to get a warm, low-pressure "safe to spend per day" figure.
 *
 * This is a PURE consumer of the discretionary pool produced upstream (e.g. from
 * the `DailyAllowance` calculation). It deliberately does not know how that pool
 * was computed and never touches `dailyAllowanceUtils.ts`.
 *
 * Edge cases are handled gently rather than throwing:
 * - `daysUntilPayday <= 0` (payday is today or already passed) → the full
 *   remaining amount is treated as available today (no runway to divide across).
 * - The result is never negative — an overspent pool simply means there's
 *   nothing left to safely spend, not a scary negative number.
 * - Non-finite inputs (NaN / Infinity from upstream math) degrade to `0`.
 *
 * **Validates: Requirements 1.1, 2.5, new**
 *
 * @param discretionaryAvailable Remaining discretionary money to stretch until payday.
 * @param daysUntilPayday        Whole days until the next paycheck (see {@link getDaysUntilPayday}).
 * @returns The amount that can be safely spent per day until payday (>= 0).
 */
export function computeSafeToSpendUntilPayday(
  discretionaryAvailable: number,
  daysUntilPayday: number
): number {
  // Guard against NaN / Infinity flowing in from upstream calculations.
  if (!Number.isFinite(discretionaryAvailable) || !Number.isFinite(daysUntilPayday)) {
    return 0
  }

  // Never surface a negative "safe to spend" figure.
  const available = Math.max(0, discretionaryAvailable)

  // Payday is today (or somehow in the past): there's no runway to spread the
  // money across, so the whole remaining amount is available today.
  if (daysUntilPayday <= 0) {
    return available
  }

  return available / daysUntilPayday
}

// ============================================================================
// Payday-aligned budget period helper (Task 103.1)
// ============================================================================

/**
 * Average number of days in a calendar month (365.25 / 12).
 * Used to convert between monthly and pay-cycle pools without calendar look-ups.
 */
export const AVG_DAYS_PER_MONTH = 30.44

/**
 * Computes the daily budget for a payday-aligned budget period.
 *
 * The budget period runs from one payday to the next (one pay cycle). The monthly
 * pool is converted to a pay-period pool by scaling with the ratio of pay-cycle
 * length to an average calendar month, then divided by the total days in that cycle.
 *
 *   periodPool  = monthlyPool × (daysInPayCycle / AVG_DAYS_PER_MONTH)
 *   dailyBudget = periodPool / daysInPayCycle
 *               = monthlyPool / AVG_DAYS_PER_MONTH   (simplified)
 *
 * The simplification shows that for a PURE payday-aligned budget, the daily
 * budget equals monthlyPool / 30.44 regardless of cycle length. The cycle
 * length still matters when combined with rollover (how many days have elapsed
 * since the last payday determines rollover scope), but the per-day rate is
 * consistent across months.
 *
 * Pure: no side effects, deterministic given the same inputs.
 *
 * **Validates: Requirements new (Task 103.1)**
 *
 * @param monthlyPool      The monthly discretionary pool (income minus fixed expenses).
 * @param paySchedule      The user's pay schedule.
 * @param now              The reference date (defaults to today).
 * @param incomeHistory    Recent income transactions (for irregular cadence estimation).
 * @returns The daily budget for the current pay period (>= 0).
 */
export function computePaydayPeriodDailyBudget(
  monthlyPool: number,
  paySchedule: PaySchedule,
  now: Date = new Date(),
  incomeHistory: Transaction[] = []
): number {
  if (!Number.isFinite(monthlyPool) || monthlyPool <= 0) {
    return 0
  }

  const nextPayday = getNextPayday(paySchedule, now, incomeHistory)

  // Walk back one pay cycle to find the last payday
  const interval = fixedIntervalDays(paySchedule.cadence, incomeHistory)
  let lastPayday: Date

  if (interval !== null) {
    // Fixed-interval cadences: step back exactly one interval
    lastPayday = new Date(nextPayday.getTime() - interval * DAY_MS)
  } else {
    // Calendar cadences (monthly / semimonthly): use the previous calendar payday
    lastPayday = getNextPayday(paySchedule, new Date(nextPayday.getTime() - DAY_MS), incomeHistory)
  }

  const daysInPayCycle = Math.max(1, dayDiff(lastPayday, nextPayday))

  // periodPool / daysInPayCycle = monthlyPool * (daysInPayCycle / AVG_DAYS_PER_MONTH) / daysInPayCycle
  //                             = monthlyPool / AVG_DAYS_PER_MONTH
  // We keep the full formula for clarity, even though it simplifies.
  const periodPool = monthlyPool * (daysInPayCycle / AVG_DAYS_PER_MONTH)
  return Math.max(0, periodPool / daysInPayCycle)
}

/**
 * Returns the last payday on or before `now` for the given pay schedule.
 * This is the start of the current pay period.
 *
 * Pure: no side effects.
 *
 * **Validates: Requirements new (Task 103.1)**
 */
export function getLastPayday(
  schedule: PaySchedule,
  now: Date = new Date(),
  incomeHistory: Transaction[] = []
): Date {
  const nextPayday = getNextPayday(schedule, now, incomeHistory)
  const interval = fixedIntervalDays(schedule.cadence, incomeHistory)

  if (interval !== null) {
    return new Date(nextPayday.getTime() - interval * DAY_MS)
  }
  // For calendar cadences, step back one day to get a date in the previous cycle
  return getNextPayday(schedule, new Date(nextPayday.getTime() - DAY_MS), incomeHistory)
}

/**
 * Sensible default minimum-balance buffer (in dollars). A warm little cushion
 * so students / young adults get a friendly heads-up *before* they actually
 * hit zero, not after. User-configurable via Settings.
 */
export const DEFAULT_MIN_BALANCE_BUFFER = 50

/**
 * Result of projecting the balance trajectory until the next payday.
 */
export interface BalanceProjection {
  /** Whether the projected low point dips below the configured buffer. */
  willDipBelowBuffer: boolean
  /**
   * The lowest projected balance between now and the next payday. With a steady
   * daily burn this is the balance right before the next paycheck lands.
   */
  projectedLowBalance: number
  /**
   * Whole days from now until the balance is first projected to fall below the
   * buffer. Only present when {@link BalanceProjection.willDipBelowBuffer} is true.
   */
  daysUntilDip?: number
}

/** Round a dollar figure to the nearest cent (avoids floating-point noise). */
function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Project a simple balance trajectory from now until the next payday and flag
 * when it would dip below a configurable minimum-balance buffer.
 *
 * The model is intentionally simple and warm rather than a precise cash-flow
 * forecast: the balance is assumed to draw down at a steady `dailyBurnRate`
 * until the next paycheck. Because that draw-down is monotonic, the lowest
 * point over the window is the balance right before payday.
 *
 * This is a PURE consumer of upstream figures (the discretionary pool, a
 * burn-rate estimate, days-until-payday). It never touches `dailyAllowanceUtils.ts`.
 *
 * Edge cases are handled gently rather than throwing:
 * - Non-finite inputs (NaN / Infinity) degrade to a safe "no dip" result.
 * - `daysUntilPayday <= 0` (payday today / passed) → no runway to burn, so the
 *   low point is simply the current balance.
 * - A negative burn rate (net inflow before payday) is treated as `0` — money
 *   coming in never *causes* a dip.
 * - A negative buffer is clamped to `0` (you can't require a sub-zero cushion).
 *
 * **Validates: Requirements 5.2, new**
 *
 * @param currentBalance   The available balance / discretionary pool right now.
 * @param daysUntilPayday  Whole days until the next paycheck (see {@link getDaysUntilPayday}).
 * @param dailyBurnRate    Expected average daily spend between now and payday.
 * @param minBalanceBuffer The cushion to stay above (defaults to {@link DEFAULT_MIN_BALANCE_BUFFER}).
 */
export function projectBalanceUntilPayday(
  currentBalance: number,
  daysUntilPayday: number,
  dailyBurnRate: number,
  minBalanceBuffer: number = DEFAULT_MIN_BALANCE_BUFFER
): BalanceProjection {
  // Guard against NaN / Infinity flowing in from upstream calculations.
  if (
    !Number.isFinite(currentBalance) ||
    !Number.isFinite(daysUntilPayday) ||
    !Number.isFinite(dailyBurnRate) ||
    !Number.isFinite(minBalanceBuffer)
  ) {
    const safeBalance = Number.isFinite(currentBalance) ? roundCents(currentBalance) : 0
    return { willDipBelowBuffer: false, projectedLowBalance: safeBalance }
  }

  // Money flowing in never causes a dip; a sub-zero cushion makes no sense.
  const burn = Math.max(0, dailyBurnRate)
  const buffer = Math.max(0, minBalanceBuffer)
  // No runway to burn across if payday is today or already passed.
  const days = Math.max(0, Math.floor(daysUntilPayday))

  // Steady draw-down is monotonic, so the low point is the balance at payday.
  const projectedLowBalance = roundCents(currentBalance - burn * days)

  const willDipBelowBuffer = projectedLowBalance < buffer

  if (!willDipBelowBuffer) {
    return { willDipBelowBuffer: false, projectedLowBalance }
  }

  // First whole day the running balance is projected to fall below the buffer.
  let daysUntilDip: number
  if (currentBalance < buffer) {
    // Already under the cushion today.
    daysUntilDip = 0
  } else if (burn <= 0) {
    // Shouldn't happen (willDip would be false), but stay safe.
    daysUntilDip = days
  } else {
    // balance(d) = currentBalance - burn*d < buffer  →  d > (currentBalance - buffer) / burn
    daysUntilDip = Math.min(days, Math.floor((currentBalance - buffer) / burn) + 1)
  }

  return { willDipBelowBuffer: true, projectedLowBalance, daysUntilDip }
}
