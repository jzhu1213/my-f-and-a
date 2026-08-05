// ============================================================================
// Term / Monthly Review — Pure, Deterministic Recap Helper (Task 184.1)
// ============================================================================
//
// A richer end-of-period recap that folds a stretch of quiet tracking into one
// warm moment. It builds on the month-in-review pattern (improvement 5.4) and
// ties into the academic term model (Phase 2 task 121.1):
//
//   • When a term schedule is provided, the recap spans the whole academic term
//     ("Fall 2024") with term-level stats: total saved over the term, the
//     strongest month, the top categories, and a standout "biggest win".
//   • When no term schedule exists, it degrades gracefully to a single-month
//     recap so nothing breaks — a student who never sets a term still gets a
//     warm monthly moment.
//
// This module is a PURE function library: no side effects, no I/O, no Date.now.
// Callers pass the reference data and an explicit `throughDate` cutoff, keeping
// it fully testable and deterministic (mirrors `yearInReview.ts`, task 183.1).
//
// Design principles carried from the product guidelines:
//   • Warm and shame-free — even "top categories" reads as a fun fact, never a
//     scolding. Nothing here is a leaderboard or a comparison to other people.
//   • Progressive disclosure — this is surfaced behind Tools, never on home.
// ============================================================================

import type { Transaction, Budget, TransactionCategory } from '@/types'
import type {
  TermReviewData,
  TermReviewMode,
  TermReviewMonth,
  TermReviewCategory,
  TermReviewWin,
} from '@/types/folio'
import type { TermSchedule } from '@/lib/termSchedule'
import { TRANSACTION_CATEGORIES } from '@/types'
import { parseDateLocal, formatDateLocal, addDaysLocal } from '@/lib/dateUtils'

// ── Tunables ─────────────────────────────────────────────────────────────────

/**
 * Minimum number of logged transactions in the window before a recap feels
 * earned. Below this we return `hasEnoughData: false` so the UI can show a
 * gentle "not yet" state instead of a hollow celebration. A term/month is much
 * shorter than a year, so the bar is lower than the annual recap.
 */
export const MIN_TRANSACTIONS_FOR_TERM_RECAP = 5

/** A streak worth headlining as the "biggest win" on its own. */
const NOTABLE_STREAK_DAYS = 7

/** How many top categories to surface in the recap. */
const MAX_TOP_CATEGORIES = 3

/** Average days per month, used to derive a daily budget from monthly limits. */
const AVG_DAYS_PER_MONTH = 30.44

// ── Small internal helpers ─────────────────────────────────────────────────────

/** Month names for warm labels, indexed 0–11. */
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

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

/** Friendly "September 2024" from a "2024-09" key. */
function monthKeyToLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${MONTH_LABELS[month - 1]} ${year}`
}

/** Whole days between two ISO dates (inclusive of both ends, min 1). */
function inclusiveDaySpan(startDate: string, endDate: string): number {
  const start = parseDateLocal(startDate)
  const end = parseDateLocal(endDate)
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, diff + 1)
}

/**
 * Resolves the [start, end] window (inclusive, ISO) to summarize.
 *
 *   • term mode  — the term's own dates, clamped so we never scan past the
 *     `throughDate` cutoff (a term still in progress recaps only what happened).
 *   • month mode — the calendar month containing `throughDate`, clamped at the
 *     cutoff so a partial current month isn't padded with empty future days.
 */
function resolveWindow(
  termSchedule: TermSchedule | null | undefined,
  throughDate: string
): { mode: TermReviewMode; startDate: string; endDate: string; periodLabel: string } {
  if (termSchedule) {
    const startDate = termSchedule.startDate
    // Clamp the end at the cutoff so an in-progress term recaps only elapsed days.
    const endDate = throughDate < termSchedule.endDate ? throughDate : termSchedule.endDate
    const periodLabel = termSchedule.label?.trim()
      ? termSchedule.label.trim()
      : `${monthKeyToLabel(startDate.slice(0, 7))} term`
    return { mode: 'term', startDate, endDate, periodLabel }
  }

  // Monthly fallback: the calendar month containing the cutoff.
  const monthKey = throughDate.slice(0, 7)
  const startDate = `${monthKey}-01`
  return {
    mode: 'month',
    startDate,
    endDate: throughDate,
    periodLabel: monthKeyToLabel(monthKey),
  }
}

/**
 * Longest run of consecutive "good" days across the window.
 *
 * A day counts as "within the daily number" when its expense spend is strictly
 * below the daily budget (total monthly limits ÷ avg days per month). With no
 * budget configured we fall back to counting consecutive no-spend days, so the
 * streak still means something warm. Scanning is bounded by the window, which
 * for a term is 30–150 days — cheap and deterministic.
 */
function computeBestStreak(
  expensesByDay: Map<string, number>,
  monthlyBudgetTotal: number,
  startDate: string,
  endDate: string
): number {
  const dailyBudget = monthlyBudgetTotal > 0 ? monthlyBudgetTotal / AVG_DAYS_PER_MONTH : 0

  let best = 0
  let current = 0

  let cursor = parseDateLocal(startDate)
  const end = parseDateLocal(endDate)

  while (cursor.getTime() <= end.getTime()) {
    const key = formatDateLocal(cursor)
    const spent = expensesByDay.get(key) ?? 0
    const good = dailyBudget > 0 ? spent < dailyBudget : spent === 0
    if (good) {
      current += 1
      if (current > best) best = current
    } else {
      current = 0
    }
    cursor = addDaysLocal(cursor, 1)
  }

  return best
}

// ── Core computation ────────────────────────────────────────────────────────

/**
 * Computes a warm, term-aware end-of-period recap.
 *
 * Pure and deterministic: identical inputs always yield identical output, and
 * no ambient clock is read. Callers pass an explicit `throughDate` cutoff.
 *
 * @param transactions - All of the user's transactions (any dates; filtered here)
 * @param budgets      - Budget limits used to define "within the daily number"
 * @param termSchedule - The active term schedule, or null/undefined for a
 *                        graceful monthly-only recap
 * @param throughDate  - YYYY-MM-DD cutoff (inclusive). Anything after is ignored,
 *                        so an in-progress term/month recaps only what happened.
 * @returns A {@link TermReviewData} recap
 */
export function computeTermReview(
  transactions: Transaction[],
  budgets: Budget[],
  termSchedule: TermSchedule | null | undefined,
  throughDate: string
): TermReviewData {
  const { mode, startDate, endDate, periodLabel } = resolveWindow(termSchedule, throughDate)

  // Filter to in-window transactions we can reason about.
  const windowTx = transactions.filter(t => t.date >= startDate && t.date <= endDate)

  // Aggregate in a single pass.
  const expensesByDay = new Map<string, number>()
  const expenseByCategory = new Map<TransactionCategory, number>()
  const savedByMonth = new Map<string, number>()

  let totalIncome = 0
  let totalExpense = 0

  for (const t of windowTx) {
    const monthKey = t.date.slice(0, 7)
    const signed = t.type === 'expense' ? -t.amount : t.amount
    savedByMonth.set(monthKey, (savedByMonth.get(monthKey) ?? 0) + signed)

    if (t.type === 'expense') {
      totalExpense += t.amount
      expensesByDay.set(t.date, (expensesByDay.get(t.date) ?? 0) + t.amount)
      expenseByCategory.set(
        t.category,
        (expenseByCategory.get(t.category) ?? 0) + t.amount
      )
    } else {
      totalIncome += t.amount
    }
  }

  const monthlyBudgetTotal = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const bestStreak = windowTx.length
    ? computeBestStreak(expensesByDay, monthlyBudgetTotal, startDate, endDate)
    : 0

  // ── Best month (highest income − expense; only when positive) ──────────────
  let bestMonth: TermReviewMonth | null = null
  for (const [monthKey, saved] of savedByMonth) {
    if (saved > 0 && (bestMonth === null || saved > bestMonth.saved)) {
      bestMonth = { monthKey, monthLabel: monthKeyToLabel(monthKey), saved }
    }
  }

  // ── Top categories (most expense spend; framed as fun facts) ───────────────
  const topCategories: TermReviewCategory[] = Array.from(expenseByCategory.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_CATEGORIES)
    .map(([category, total]) => {
      const meta = categoryMeta(category)
      return { category, label: meta.label, emoji: meta.emoji, total }
    })

  const totalSaved = totalIncome - totalExpense

  const biggestWin = pickBiggestWin(
    mode,
    periodLabel,
    bestStreak,
    bestMonth,
    totalSaved,
    windowTx.length
  )

  return {
    mode,
    periodLabel,
    startDate,
    endDate,
    daysInPeriod: inclusiveDaySpan(startDate, endDate),
    transactionCount: windowTx.length,
    hasEnoughData: windowTx.length >= MIN_TRANSACTIONS_FOR_TERM_RECAP,
    totalIncome,
    totalExpense,
    totalSaved,
    bestMonth,
    topCategories,
    bestStreak,
    biggestWin,
  }
}

/**
 * Chooses the single warmest headline achievement for the period.
 *
 * Preference order (each still shame-free):
 *   1. A notable under-budget/no-spend streak (7+ days) — a real habit win.
 *   2. Coming out ahead overall (positive net saved across the period).
 *   3. The strongest single month (only meaningful in term mode where there is
 *      more than one month to compare).
 *   4. Consistency — showing up often even without a net-positive number.
 *   5. A gentle "you showed up" fallback when data is thin.
 */
function pickBiggestWin(
  mode: TermReviewMode,
  periodLabel: string,
  bestStreak: number,
  bestMonth: TermReviewMonth | null,
  totalSaved: number,
  transactionCount: number
): TermReviewWin {
  if (bestStreak >= NOTABLE_STREAK_DAYS) {
    return {
      kind: 'streak',
      headline: 'Your longest streak',
      detail: `${bestStreak} days in a row inside your daily number. That's a real habit.`,
    }
  }

  if (totalSaved > 0) {
    const span = mode === 'term' ? 'this term' : 'this month'
    return {
      kind: 'saved',
      headline: 'You came out ahead',
      detail: `You set aside ${money(totalSaved)} ${span}. Future-you says thanks.`,
    }
  }

  if (mode === 'term' && bestMonth) {
    return {
      kind: 'best_month',
      headline: `${bestMonth.monthLabel} was your month`,
      detail: `You set aside ${money(bestMonth.saved)} — your strongest stretch of the term.`,
    }
  }

  if (transactionCount >= MIN_TRANSACTIONS_FOR_TERM_RECAP) {
    return {
      kind: 'consistency',
      headline: 'You kept showing up',
      detail: `You logged ${transactionCount} times across ${periodLabel}. Staying aware is the whole game.`,
    }
  }

  return {
    kind: 'showed_up',
    headline: 'You showed up',
    detail: 'A stretch of paying attention to your money. That matters more than any number.',
  }
}
