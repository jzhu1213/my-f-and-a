// ============================================================================
// Year in Review — Pure, Deterministic Recap Helper (Task 183.1)
// ============================================================================
//
// Folds a year of quiet tracking into one warm, shareable moment:
//   • best streak      — longest run of days within the daily number
//   • most-saved month — the month the user came out furthest ahead
//   • top category     — where the most spending went (framed neutrally)
//   • biggest win      — the single standout achievement of the year
//
// This module is a PURE function library: no side effects, no I/O, no Date.now.
// Callers pass the reference year and the data. This keeps it fully testable and
// deterministic, mirroring the pattern in `celebrationEngine.ts` (Phase 1 task 57).
//
// Design principles carried from the product guidelines:
//   • Warm and shame-free — even "top category" reads as a fun fact, never a
//     scolding. Nothing here is a leaderboard or a comparison to other people.
//   • Progressive disclosure — this is surfaced behind Tools, never on home.
// ============================================================================

import type { Transaction, Budget, TransactionCategory } from '@/types'
import type {
  YearInReviewData,
  YearInReviewMonth,
  YearInReviewCategory,
  YearInReviewWin,
} from '@/types/folio'
import { TRANSACTION_CATEGORIES } from '@/types'

// ── Tunables ─────────────────────────────────────────────────────────────────

/**
 * Minimum number of logged transactions in the year before a recap feels
 * earned. Below this we return `hasEnoughData: false` so the UI can show a
 * gentle "not yet" state instead of a hollow celebration.
 */
export const MIN_TRANSACTIONS_FOR_RECAP = 10

/** A streak worth headlining as the "biggest win" on its own. */
const NOTABLE_STREAK_DAYS = 7

// ── Small internal helpers ─────────────────────────────────────────────────────

/** Month names for warm labels, indexed 0–11. */
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** Returns true when a YYYY-MM-DD date string falls within `year`. */
function isInYear(dateStr: string, year: number): boolean {
  return dateStr.startsWith(`${year}-`)
}

/** Number of days in a given month (0-indexed) for a given year (local, DST-safe). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Zero-padded YYYY-MM-DD for a specific year/month/day. */
function ymd(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/** Emoji + friendly label for a category (falls back gracefully). */
function categoryMeta(category: TransactionCategory): { emoji: string; label: string } {
  const match = TRANSACTION_CATEGORIES.find(c => c.category === category)
  return match
    ? { emoji: match.emoji, label: match.label }
    : { emoji: '📦', label: 'Other' }
}

/** Whole-dollar display string, e.g. 1234.5 → "$1,235". */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

// ── Core computation ────────────────────────────────────────────────────────

/**
 * Computes the longest run of consecutive "good" days in the year.
 *
 * A day counts as "within the daily number" when its total expense spend is
 * strictly below that month's daily budget (total monthly limits ÷ days in the
 * month). When the user has no budget limits configured, we fall back to
 * counting consecutive no-spend days, so the streak still means something warm.
 *
 * The scan runs from the user's first activity of the year through the last day
 * covered by the data. Bounding the start at first activity keeps empty months
 * before the user began tracking from inflating a no-spend streak, and a
 * partial/current year is never penalized for months that haven't happened yet.
 */
function computeBestStreak(
  expensesByDay: Map<string, number>,
  monthlyBudgetTotal: number,
  year: number,
  firstDate: string,
  lastMonthIndex: number,
  lastDay: number
): number {
  let best = 0
  let current = 0

  const firstMonthIndex = Number(firstDate.slice(5, 7)) - 1
  const firstDay = Number(firstDate.slice(8, 10))

  for (let month = firstMonthIndex; month <= lastMonthIndex; month++) {
    const dim = daysInMonth(year, month)
    const dailyBudget = monthlyBudgetTotal > 0 ? monthlyBudgetTotal / dim : 0
    const startDay = month === firstMonthIndex ? firstDay : 1
    const endDay = month === lastMonthIndex ? lastDay : dim

    for (let day = startDay; day <= endDay; day++) {
      const spent = expensesByDay.get(ymd(year, month, day)) ?? 0
      const good = dailyBudget > 0 ? spent < dailyBudget : spent === 0
      if (good) {
        current += 1
        if (current > best) best = current
      } else {
        current = 0
      }
    }
  }

  return best
}

/**
 * Computes a warm, shareable annual recap from a year of transactions.
 *
 * Pure and deterministic: identical inputs always yield identical output, and
 * no ambient clock is read. Callers decide the reference `year` and, for a
 * partial/current year, pass `throughDate` so the scan stops at "today".
 *
 * @param transactions - All of the user's transactions (any years; filtered here)
 * @param budgets      - Budget limits used to define "within the daily number"
 * @param year         - The calendar year to summarize
 * @param throughDate  - Optional YYYY-MM-DD cutoff (inclusive) for a partial year.
 *                       When omitted, the full calendar year is scanned.
 * @returns A {@link YearInReviewData} recap
 */
export function computeYearInReview(
  transactions: Transaction[],
  budgets: Budget[],
  year: number,
  throughDate?: string
): YearInReviewData {
  // Determine the last day we should scan (inclusive).
  let lastMonthIndex = 11
  let lastDay = daysInMonth(year, 11)
  if (throughDate && isInYear(throughDate, year)) {
    const parts = throughDate.split('-').map(Number)
    lastMonthIndex = parts[1] - 1
    lastDay = parts[2]
  }

  // Filter to in-year, non-scheduled transactions we can reason about.
  const yearTx = transactions.filter(
    t => isInYear(t.date, year) && t.date <= (throughDate ?? ymd(year, 11, 31))
  )

  // Aggregate as we go — single pass over the year's transactions.
  const expensesByDay = new Map<string, number>()
  const expenseByCategory = new Map<TransactionCategory, number>()
  const incomeByMonth = new Array<number>(12).fill(0)
  const expenseByMonth = new Array<number>(12).fill(0)

  let totalIncome = 0
  let totalExpense = 0

  for (const t of yearTx) {
    const monthIndex = Number(t.date.slice(5, 7)) - 1
    if (t.type === 'expense') {
      totalExpense += t.amount
      expenseByMonth[monthIndex] += t.amount
      expensesByDay.set(t.date, (expensesByDay.get(t.date) ?? 0) + t.amount)
      expenseByCategory.set(
        t.category,
        (expenseByCategory.get(t.category) ?? 0) + t.amount
      )
    } else {
      totalIncome += t.amount
      incomeByMonth[monthIndex] += t.amount
    }
  }

  const monthlyBudgetTotal = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)

  // ── Best streak ──────────────────────────────────────────────────────────
  // Bound the scan at the earliest in-year transaction so pre-start empty
  // months don't inflate a no-spend streak. When there's no data, streak is 0.
  const firstDate = yearTx.reduce<string | null>(
    (min, t) => (min === null || t.date < min ? t.date : min),
    null
  )
  const bestStreak = firstDate
    ? computeBestStreak(
        expensesByDay,
        monthlyBudgetTotal,
        year,
        firstDate,
        lastMonthIndex,
        lastDay
      )
    : 0

  // ── Most-saved month (highest income − expense; only when positive) ────────
  let mostSavedMonth: YearInReviewMonth | null = null
  for (let m = 0; m <= lastMonthIndex; m++) {
    const saved = incomeByMonth[m] - expenseByMonth[m]
    if (saved > 0 && (mostSavedMonth === null || saved > mostSavedMonth.saved)) {
      mostSavedMonth = { month: m, monthLabel: MONTH_LABELS[m], saved }
    }
  }

  // ── Top category (most expense spend; framed as a fun fact) ────────────────
  let topCategory: YearInReviewCategory | null = null
  for (const [category, total] of expenseByCategory) {
    if (total > 0 && (topCategory === null || total > topCategory.total)) {
      const meta = categoryMeta(category)
      topCategory = { category, label: meta.label, emoji: meta.emoji, total }
    }
  }

  const totalSaved = totalIncome - totalExpense

  // ── Biggest win — one standout, chosen deterministically ───────────────────
  const biggestWin = pickBiggestWin(bestStreak, mostSavedMonth, totalSaved)

  return {
    year,
    transactionCount: yearTx.length,
    hasEnoughData: yearTx.length >= MIN_TRANSACTIONS_FOR_RECAP,
    bestStreak,
    mostSavedMonth,
    topCategory,
    totalSaved,
    biggestWin,
  }
}

/**
 * Chooses the single warmest headline achievement of the year.
 *
 * Preference order (each still shame-free):
 *   1. A notable under-budget/no-spend streak (7+ days) — a real habit win.
 *   2. Coming out ahead overall (positive net saved across the year).
 *   3. The best single saving month.
 *   4. A gentle "you showed up" fallback when data is thin.
 */
function pickBiggestWin(
  bestStreak: number,
  mostSavedMonth: YearInReviewMonth | null,
  totalSaved: number
): YearInReviewWin {
  if (bestStreak >= NOTABLE_STREAK_DAYS) {
    return {
      kind: 'streak',
      headline: 'Your longest streak',
      detail: `${bestStreak} days in a row inside your daily number. That's a real habit.`,
    }
  }

  if (totalSaved > 0) {
    return {
      kind: 'saved',
      headline: 'You came out ahead',
      detail: `You saved ${money(totalSaved)} across the whole year. Future-you says thanks.`,
    }
  }

  if (mostSavedMonth) {
    return {
      kind: 'month',
      headline: `${mostSavedMonth.monthLabel} was your month`,
      detail: `You set aside ${money(mostSavedMonth.saved)} — your strongest stretch of the year.`,
    }
  }

  return {
    kind: 'showed_up',
    headline: 'You showed up',
    detail: 'A whole year of paying attention to your money. That matters more than any number.',
  }
}
