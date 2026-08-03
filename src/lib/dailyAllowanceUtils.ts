import type { Budget, Transaction } from '@/types'
import type { DailyAllowance, AllowanceStatus, IncomeSmoothing, MonthBoundaryCarryover, HeroMeaning, HeroDisplay, RhythmWeights, ConfidenceBand } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import type { FundingSource } from '@/lib/fundingSources'
import type { PaySchedule } from '@/lib/paySchedule'
import type { TermSchedule } from '@/lib/termSchedule'
import { getTotalFixedMonthly, isFixedTransaction, getUpcomingBillsList, isScheduledForKnownBill } from '@/lib/fixedExpenses'
import { isBorrowedTransaction } from '@/lib/fundingSources'
import { getStatusMessage } from '@/lib/vocabulary'
import { getNextPayday, getLastPayday, AVG_DAYS_PER_MONTH } from '@/lib/paySchedule'
import { isTermActive, getDaysInTerm, getDaysRemainingInTerm } from '@/lib/termSchedule'
import { 
  formatDateLocal, 
  getMonthStartLocal, 
  subtractDaysLocal, 
  getDaysInMonthLocal,
  getDaysRemainingFromLocal,
  parseDateLocal,
  addDaysLocal
} from '@/lib/dateUtils'

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN DECISION: Financial Date vs. Logged Date (Task 89.1)
// ─────────────────────────────────────────────────────────────────────────────
//
// All financial calculations in this module use `Transaction.date` — the date
// the transaction OCCURRED (i.e. the financial/effective date chosen by the user
// via the date picker). This is distinct from `Transaction.createdAt`, which
// records WHEN the user logged the transaction in the app.
//
// This means:
//   • A paycheck logged today for June 30 contributes to June's income pool
//   • An expense backdated to last Tuesday affects that day's rollover, not today's
//   • Rollover (Step 4) compares expected vs actual spend using `t.date` ranges
//   • spentToday (Step 3) filters by `t.date === todayStr`
//
// `createdAt` is intentionally NOT used here. It is reserved for:
//   • Audit trails and "logged late" UI indicators
//   • Smart suggestions (habitEngine.ts) that predict based on logging behavior
//   • Most-recently-logged ordering for UI defaults
//
// This separation ensures that backdated entries always produce correct
// historical rollover without requiring any special recomputation — the pure
// function naturally yields the right result for any input date.
//
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN DECISION: Future-Dated (Scheduled) Transactions (Task 90.1)
// ─────────────────────────────────────────────────────────────────────────────
//
// A transaction with `date` > today is "scheduled" — an upcoming bill or
// expected paycheck the user wants to plan for. These items:
//
//   • Are EXCLUDED from spentToday (Step 3 filters `t.date === todayStr`)
//   • Are EXCLUDED from rollover (Step 4 only considers setupDate→yesterday)
//   • Are INCLUDED in `reservedForScheduled` (Step 9) for informational display
//
// Auto-realization: When the calendar reaches the transaction's `date`, it
// automatically appears in spentToday via the existing `t.date === todayStr`
// filter. No cron job, no explicit status transition — the pure date-based
// computation handles this naturally.
// ─────────────────────────────────────────────────────────────────────────────
//
// DESIGN DECISION: Reconciliation — Bills vs Scheduled (Task 90.2)
// ─────────────────────────────────────────────────────────────────────────────
//
// A recurring bill (FixedExpense) is already "reserved" via:
//   • Step 1b: totalFixed subtracts ALL active bills from the monthly pool
//   • Step 7: reservedForBills shows upcoming unpaid bills (informational)
//
// If a user ALSO logs a future-dated transaction for the same bill, we must
// prevent double-counting. `isScheduledForKnownBill` detects overlap via:
//   1. Matching recurringId (definitive)
//   2. Same category + amount within 10% (heuristic)
//   3. Note keywords matching the bill label (fuzzy)
//
// When a match is found, the transaction is excluded from reservedForScheduled
// (Step 9) — the bill is already spoken for via the recurring path.
//
// Auto-realization for recurring vs non-recurring:
//   • Recurring bill on its date: The `isFixedTransaction` filter keeps it OUT
//     of spentToday and rollover. The monthly pool subtraction (Step 1b) already
//     accounts for it. The logged transaction is a "confirmation" record — it
//     doesn't reduce the daily allowance again.
//   • Non-recurring scheduled item on its date: Enters spentToday normally via
//     the `date === todayStr` filter, reducing that day's allowance as expected.
//     The reservedForScheduled amount drops by the realized amount automatically.
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN DECISION: Date Calculations Use Local Time (Task 94.1)
// ─────────────────────────────────────────────────────────────────────────────
//
// All date calculations in this module use LOCAL time, not UTC. This ensures
// "today" means the user's local calendar day at midnight, not UTC's midnight.
//
// Problem: UTC-based calculations cause timezone bugs:
//   - At 11:59 PM PST (UTC-8), the UTC date is already the next day
//   - Transactions logged at night appear as the next day
//   - Daily resets happen at the wrong time for users
//
// Solution: Use local time methods throughout (getFullYear, getMonth, getDate)
// and the dateUtils.ts functions (formatDateLocal, getDaysInMonthLocal, etc.).
//
// The only UTC methods that remain are for:
//   - Legacy month prefix calculations (currentMonthPrefix)
//   - Will be migrated in a future task
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines allowance status based on remaining amount and daily budget.
 *
 * **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
 */
export function getStatus(remainingAmount: number, dailyBudget: number): AllowanceStatus {
  if (remainingAmount < 0) {
    return 'over'
  }

  if (dailyBudget <= 0) {
    return 'warning'
  }

  const percentRemaining = (remainingAmount / dailyBudget) * 100

  if (percentRemaining > 50) {
    return 'healthy'
  }
  if (percentRemaining >= 25) {
    return 'caution'
  }
  return 'warning'
}

/**
 * Generates context-aware encouraging messages based on allowance status.
 * 
 * **Validates: Requirements 1.10, 2.3**
 * 
 * Delegates to the canonical vocabulary's getStatusMessage for a single
 * source of truth — ensuring all surfaces show the same tone and copy.
 */
export function generateEncouragingMessage(status: AllowanceStatus, amount: number, spentToday: number): string {
  return getStatusMessage(status, amount, spentToday)
}

/**
 * Determines if celebration should be shown
 */
function shouldCelebrate(status: AllowanceStatus, spentToday: number, dailyBudget: number): boolean {
  // Celebrate if under budget at end of day or significantly under mid-day
  return status === 'healthy' && spentToday < dailyBudget * 0.5
}

/**
 * Computes smoothed monthly income from transaction history.
 * - 'current_month': sums income transactions in the current month (existing behavior)
 * - 'trailing_average': spreads total income across the whole trailing window of
 *   N months (current month + N−1 previous months) by dividing by the window length.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * Why divide by the FULL window (not just non-zero months)?
 * ─────────────────────────────────────────────────────────────────────────────────
 * Students and gig workers rarely have steady paychecks — income arrives in lumps
 * (aid disbursements, occasional gig payments, Venmo from a friend) with quiet
 * stretches in between. Two properties matter for the daily number:
 *
 *   1. Stability day-to-day — the denominator must be fixed (the window length),
 *      so logging one paycheck moves the monthly figure by only 1/windowMonths of
 *      that paycheck instead of the whole amount.
 *
 *   2. No single-paycheck spike — a lump sum is spread across the window rather
 *      than counting at full weight. e.g. a $3,000 gig payment with a 3-month
 *      window contributes $1,000/month, not $3,000.
 *
 * The earlier implementation averaged ONLY non-zero months. That defeated both
 * goals: with a single month of history a lone large paycheck averaged to itself
 * (full spike, no smoothing), and during lean months the number stayed
 * artificially high (dangerous — it implied spendable money that was not earned
 * recently). Dividing by the fixed window length fixes both: lumps are damped and
 * quiet months pull the sustainable daily number down, which is the safe direction.
 *
 * When the entire window contains no income, this returns 0 so the caller falls
 * back to the estimate / zero-setup path unchanged.
 *
 * **Validates: Requirements 1.1, new**
 */
export function computeSmoothedIncome(
  transactions: Transaction[],
  currentDate: Date,
  smoothing: IncomeSmoothing
): number {
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  if (smoothing.strategy === 'current_month') {
    return transactions
      .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
      .reduce((sum, t) => sum + t.amount, 0)
  }

  // trailing_average strategy
  // Guard against a non-positive/undefined window; a window of at least 1 month
  // keeps the divisor safe and, at windowMonths === 1, degrades to current-month.
  const windowMonths = Math.max(1, Math.floor(smoothing.windowMonths ?? 3))

  // Build month prefixes for each month in the window (current month + previous months)
  const monthPrefixes: string[] = []
  for (let i = 0; i < windowMonths; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthPrefixes.push(prefix)
  }

  // Sum income across the whole window
  const totalWindowIncome = monthPrefixes.reduce((windowSum, prefix) => {
    const monthIncome = transactions
      .filter(t => t.type === 'income' && t.date.startsWith(prefix))
      .reduce((sum, t) => sum + t.amount, 0)
    return windowSum + monthIncome
  }, 0)

  // No income anywhere in the window → let the caller fall back to estimate/zero-setup.
  if (totalWindowIncome <= 0) {
    return 0
  }

  // Spread the total across the fixed window length. Dividing by windowMonths
  // (rather than only the months that had income) is what damps a single large
  // paycheck and keeps the number stable day-to-day.
  return totalWindowIncome / windowMonths
}

/**
 * Computes a confidence band for variable income — the "usually $X–$Y/day" range.
 *
 * Only meaningful when income smoothing uses 'trailing_average' (indicating variable
 * income). Determines the per-month income across the trailing window, finds the
 * min/max, converts to daily equivalents after subtracting fixed expenses, and marks
 * the band as significant when the spread exceeds 20% of the average daily budget.
 *
 * The band is purely informational — it never changes the primary daily number.
 *
 * **Validates: Task 164.2**
 *
 * @param transactions - All transactions (used to compute monthly income per month in the window)
 * @param currentDate - Current date (determines the trailing window)
 * @param dailyBudget - The already-computed daily budget (used for significance threshold)
 * @param incomeSmoothing - Income smoothing config; band only activates for trailing_average
 * @param fixedExpenses - Optional fixed monthly expenses to subtract from both min/max
 * @returns ConfidenceBand or undefined when not applicable
 *
 * @pure Deterministic, no side effects.
 */
export function computeConfidenceBand(
  transactions: Transaction[],
  currentDate: Date,
  dailyBudget: number,
  incomeSmoothing?: IncomeSmoothing,
  fixedExpenses?: FixedExpense[]
): ConfidenceBand | undefined {
  // Only activates for trailing_average strategy (variable income)
  if (!incomeSmoothing || incomeSmoothing.strategy !== 'trailing_average') {
    return undefined
  }

  const windowMonths = Math.max(1, Math.floor(incomeSmoothing.windowMonths ?? 3))

  // Need at least 2 months to have a meaningful range
  if (windowMonths < 2) {
    return undefined
  }

  // Build month prefixes and compute income per month
  const monthlyIncomes: number[] = []
  for (let i = 0; i < windowMonths; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthIncome = transactions
      .filter(t => t.type === 'income' && t.date.startsWith(prefix))
      .reduce((sum, t) => sum + t.amount, 0)
    monthlyIncomes.push(monthIncome)
  }

  // If no income in the window at all, band is not applicable
  if (monthlyIncomes.every(m => m === 0)) {
    return undefined
  }

  const minMonthlyIncome = Math.min(...monthlyIncomes)
  const maxMonthlyIncome = Math.max(...monthlyIncomes)

  // Subtract fixed expenses from both to get discretionary range
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  const daysInMonth = getDaysInMonthLocal(currentDate)

  const low = Math.max(0, (minMonthlyIncome - totalFixed) / daysInMonth)
  const high = Math.max(0, (maxMonthlyIncome - totalFixed) / daysInMonth)

  // Determine significance: spread must exceed 20% of the average daily budget
  const spread = high - low
  const isSignificant = dailyBudget > 0 && spread > dailyBudget * 0.2

  return { low, high, isSignificant }
}

/**
 * Computes the user's daily discretionary allowance — the single number answering
 * "Can I afford this today?"
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * SOURCE-OF-TRUTH: Daily Allowance Formula
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * The formula follows these steps in order:
 *
 *   1. Determine the monthly discretionary pool:
 *        pool = incomeOrBudget − totalFixedExpenses
 *
 *      Income source priority:
 *        a) Budget limits (sum of all category monthlyLimit values)
 *        b) Actual income transactions this month (optionally smoothed)
 *        c) User-provided estimate (monthlyIncome param)
 *
 *   2. Compute daily budget:
 *        • Budget/Transactions source: pool / effectiveDays
 *          where effectiveDays = daysRemainingFrom(setupDate) or daysInMonth
 *        • Estimate source: pool / 30
 *          (intentionally uses a fixed 30-day divisor for a simpler, rougher
 *           number — this matches the onboarding tutorial formula and avoids
 *           confusing fluctuations between 28–31 day months when the user
 *           hasn't set precise budgets)
 *
 *   3. Compute spentToday:
 *        Sum of today's expense transactions, EXCLUDING fixed/recurring
 *        (those are already sunk in Step 1)
 *        WHEN countCreditImmediately is false:
 *          - Only include immediate-settlement transactions (where fundingSource.reducesBalanceNow is true)
 *          - Transactions with no fundingSourceId are treated as immediate-settlement
 *
 *   4. Compute rollover (savings/deficit from prior days this month):
 *        rawRollover = expectedSpend(setupDay→yesterday) − actualSpend(setupDay→yesterday)
 *        rollover = clamp(rawRollover, −2×dailyBudget, +2×dailyBudget)
 *        WHEN countCreditImmediately is false:
 *          - actualSpend uses the same settlement filtering as spentToday
 *
 *      The ±2-day cap prevents extreme accumulation or debt spiraling.
 *      On the first day of a new month, daysElapsed = 0, so rollover is always 0
 *      — the month boundary naturally resets the rollover scope.
 *
 *   5. Final allowance:
 *        amount = max(0, dailyBudget + rollover − spentToday)
 *
 *   6. Status & messaging derived from rawAmount vs dailyBudget.
 *
 *   7. reservedForBills (INFORMATIONAL ONLY — see note below):
 *        Sum of upcoming unpaid fixed bills remaining this month.
 *        ⚠️  This value is for UI display purposes only. It does NOT further
 *        reduce the daily allowance — those bills are already subtracted from
 *        the monthly pool in Step 1 via totalFixedExpenses.
 *
 *   8. Month-boundary carryover (optional):
 *        On the 1st of the month with carryoverEnabled, computes excess savings
 *        from the previous month beyond the ±2-day cap as advisory savings info.
 *
 *   9. Deferred spending tracking (optional):
 *        WHEN countCreditImmediately is false:
 *          - Track the amount spent on deferred-settlement sources separately
 *          - Return as deferredSpending for UI display
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * Edge Cases & Invariants
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * • Month boundaries: Rollover resets naturally because the calculation scope
 *   (setupDay→yesterday) is bounded to the current month. On day 1, there are
 *   no prior days in scope, so rollover = 0.
 *
 * • Mid-month setup: When setupDate is within the current month, the pool is
 *   divided only by the days remaining from that date, not the full month.
 *   Rollover also only considers days from setupDate onward.
 *
 * • Fixed expenses vs category budgets: Fixed expenses (debts, recurring bills)
 *   are subtracted from the income pool up front. If a user ALSO has a budget
 *   category for the same expense (e.g., "rent" budget AND "rent" fixed expense),
 *   the budget limit includes that amount while fixed subtraction removes it —
 *   effectively zeroing it out of the discretionary pool. This is intentional:
 *   fixed transactions are also excluded from spentToday and rollover calculations,
 *   keeping the system internally consistent.
 *
 * • reservedForBills double-count appearance: The UI may show "$X reserved for
 *   N upcoming bills" alongside the daily allowance. This is purely informational —
 *   the daily allowance already accounts for ALL fixed bills via the pool subtraction.
 *   The UI tip helps users understand why their allowance is what it is, not that
 *   an additional reduction is happening.
 *
 * • Settlement filtering (Task 82): When countCreditImmediately is false, only
 *   immediate-settlement spending reduces today's allowance. Deferred spending
 *   (credit cards) is tracked separately and shown as an indicator.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 14.2, Task 82**
 *
 * @param budgets - Array of budget limits by category
 * @param transactions - Array of all transactions
 * @param currentDate - Current date (for testing purposes)
 * @param monthlyIncome - Optional monthly income for estimation when no budgets are configured
 * @param fixedExpenses - Optional array of fixed monthly obligations to sink before daily division
 * @param setupDate - Optional date when user first configured budgets/income for the current month.
 *   When provided and within the current month, divides the discretionary pool by days remaining
 *   from setupDate (not the full month) for accurate mid-month starts.
 * @param incomeSmoothing - Optional income smoothing configuration for variable/irregular income.
 *   When provided and incomeSource is 'transactions', uses smoothed income instead of current month only.
 * @param carryoverEnabled - Optional flag to enable month-boundary savings carryover.
 *   When true and it's the first day of the month, computes leftover savings from the previous month.
 * @param countCreditImmediately - Optional flag to control whether deferred-settlement expenses reduce today's allowance.
 *   When false, only immediate-settlement expenses count against today. Defaults to true (all spending counts).
 * @param fundingSources - Optional array of funding sources needed to check settlement types when countCreditImmediately is false.
 * @param paySchedule - Optional pay schedule. When provided and at least one budget has `period === 'payday_aligned'`,
 *   pay-cycle boundaries are used instead of calendar-month boundaries for effectiveDays and rollover scope.
 * @param incomeHistory - Optional income transaction history used when paySchedule.cadence is 'irregular' to estimate the pay rhythm.
 * @returns DailyAllowance object with amount, status, and message
 *
 * @pure This function is a pure function: given the same inputs it always
 * produces the same output with no side effects, no internal Date.now() calls,
 * and no dependency on external mutable state. The `currentDate` parameter must
 * be passed explicitly by the caller to guarantee determinism across re-renders.
 */
export function computeDailyAllowance(
  budgets: Budget[],
  transactions: Transaction[],
  currentDate: Date = new Date(),
  monthlyIncome?: number,
  fixedExpenses?: FixedExpense[],
  setupDate?: Date,
  incomeSmoothing?: IncomeSmoothing,
  carryoverEnabled?: boolean,
  countCreditImmediately?: boolean,
  fundingSources?: FundingSource[],
  paySchedule?: PaySchedule | null,
  incomeHistory?: Transaction[],
  termSchedule?: TermSchedule | null,
  rhythmWeights?: RhythmWeights | null
): DailyAllowance {
  // Step 1: Calculate total monthly budget from all category limits.
  //
  // PARTIAL-LIMITS HANDLING (Task 101.1):
  // Only categories with a monthlyLimit > 0 contribute to the pool.
  // Categories without a limit (monthlyLimit === 0) are excluded entirely —
  // they are NOT treated as "unlimited" or as "over budget". This means:
  //   • If 2 of 6 categories have limits set, the pool = sum of those 2 limits.
  //   • The remaining 4 categories are purely informational (tracking only).
  //   • The daily budget reflects only what the user has explicitly budgeted.
  //
  // WEEKLY-PERIOD BUDGETS (Task 102.1):
  // When a budget has period === 'weekly', its monthlyLimit IS the weekly limit.
  // The monthly contribution to the pool = monthlyLimit × 4.33.
  //
  // PAYDAY-ALIGNED BUDGETS (Task 103.1):
  // When a budget has period === 'payday_aligned', its monthlyLimit is the monthly
  // amount. The pay-period equivalent is computed via AVG_DAYS_PER_MONTH scaling.
  // For the pool sum, we keep the monthly-equivalent so the totalFixed subtraction
  // (also monthly) stays consistent. The effectiveDays divisor handles the rest.
  const budgetsWithLimits = budgets.filter(b => b.monthlyLimit > 0)
  const totalMonthlyBudget = budgetsWithLimits.reduce((sum, budget) => {
    // For weekly-period budgets, scale up to monthly equivalent
    return sum + (budget.period === 'weekly' ? budget.monthlyLimit * 4.33 : budget.monthlyLimit)
  }, 0)

  // Step 1 (payday): Determine whether pay-cycle mode is active.
  // Active when: paySchedule is provided AND at least one budget has period === 'payday_aligned'.
  const hasPaydayAlignedBudget = budgetsWithLimits.some(b => b.period === 'payday_aligned')
  const usePaydayCycle = !!paySchedule && hasPaydayAlignedBudget

  // When payday-cycle mode is active, resolve the current pay period boundaries.
  // lastPayday = start of current pay period (exclusive lower bound for rollover)
  // nextPayday = end of current pay period (used for daysInPayCycle)
  const history = incomeHistory ?? transactions
  const lastPayday = usePaydayCycle
    ? getLastPayday(paySchedule!, currentDate, history)
    : null
  const nextPayday = usePaydayCycle
    ? getNextPayday(paySchedule!, currentDate, history)
    : null
  // Days from lastPayday to nextPayday inclusive = full cycle length
  const daysInPayCycle = (lastPayday && nextPayday)
    ? Math.max(1, Math.round((nextPayday.getTime() - lastPayday.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  // Step 1 (term): Determine whether term/semester-cycle mode is active.
  // Active when: termSchedule is provided AND at least one budget has period === 'semester'
  // AND the current date is within the term. Takes precedence over payday-cycle when both apply.
  const hasTermBudget = budgetsWithLimits.some(b => b.period === 'semester')
  const useTermCycle = !!termSchedule && hasTermBudget && isTermActive(termSchedule, currentDate)
  const termDaysTotal = useTermCycle ? getDaysInTerm(termSchedule!) : 0
  const termDaysRemaining = useTermCycle ? getDaysRemainingInTerm(termSchedule!, currentDate) : 0
  
  // Step 1a: Sum actual income transactions logged in the current month
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  const actualMonthlyIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + t.amount, 0)
  
  // Determine income source priority:
  // 1. Budget limits (if configured)
  // 2. Actual logged income transactions (if any exist this month)
  // 3. monthlyIncome parameter estimate (fallback)
  const hasBudgets = totalMonthlyBudget > 0
  const hasActualIncome = actualMonthlyIncome > 0
  const hasEstimate = typeof monthlyIncome === 'number' && monthlyIncome > 0
  
  let incomeSource: 'budget' | 'transactions' | 'estimate'
  if (hasBudgets) {
    incomeSource = 'budget'
  } else if (hasActualIncome) {
    incomeSource = 'transactions'
  } else {
    incomeSource = 'estimate'
  }

  // Step 1a-ii: When income smoothing is provided and source is transactions,
  // use smoothed income to stabilize the pool for gig workers with variable income.
  const smoothedIncome = (incomeSource === 'transactions' && incomeSmoothing)
    ? computeSmoothedIncome(transactions, currentDate, incomeSmoothing)
    : actualMonthlyIncome

  const isEstimated = incomeSource === 'estimate'
  
  // Step 1b: Subtract fixed monthly obligations up front (rent, subscriptions, etc.)
  // Only discretionary money is spread across the remaining days.
  //
  // Relationship with category budgets: If a user has BOTH a budget category for an
  // expense (e.g., "rent" at $1500) AND a corresponding fixed expense entry ($1500),
  // the budget limit includes the amount while this subtraction removes it — effectively
  // zeroing it from the discretionary pool. This is intentional and internally consistent
  // because isFixedTransaction() also excludes those transactions from spentToday and
  // rollover calculations in Steps 3–4.
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  
  // Step 2: Calculate daily budget from discretionary pool
  const daysInMonth = getDaysInMonthLocal(currentDate)
  
  // Determine if setupDate qualifies for mid-month calculation:
  // Must be provided and within the same month/year as currentDate
  const isSetupMidMonth = setupDate !== undefined &&
    setupDate.getFullYear() === currentDate.getFullYear() &&
    setupDate.getMonth() === currentDate.getMonth()
  
  // When term-cycle mode is active, effectiveDays = daysInTerm (total term length
  // for a stable daily budget) and the monthly pool is scaled to the term length.
  // Term-cycle takes precedence over payday-cycle when both are active.
  // When payday-cycle mode is active, effectiveDays = daysInPayCycle and
  // the monthly pool is converted to a pay-period pool via AVG_DAYS_PER_MONTH.
  // When mid-month setup (calendar mode), divide by remaining days from setupDate.
  // Otherwise use the full calendar month.
  const effectiveDays = useTermCycle
    ? termDaysTotal
    : usePaydayCycle
      ? daysInPayCycle
      : isSetupMidMonth
        ? getDaysRemainingFromLocal(setupDate!, currentDate)
        : daysInMonth

  // For term-based budgets, the pool is the term-length equivalent of the monthly pool.
  // termPool = monthlyPool * (daysInTerm / AVG_DAYS_PER_MONTH)
  // dailyBudget = termPool / daysInTerm = monthlyPool / AVG_DAYS_PER_MONTH
  // For payday-aligned budgets, the pool is the pay-period equivalent of the monthly pool.
  // periodPool = monthlyPool * (daysInPayCycle / AVG_DAYS_PER_MONTH)
  // dailyBudget = periodPool / daysInPayCycle = monthlyPool / AVG_DAYS_PER_MONTH
  // We route through effectiveDays for the division, so we adjust the pool here.
  const scaledPool = useTermCycle && termDaysTotal > 0
    ? (pool: number) => pool * (termDaysTotal / AVG_DAYS_PER_MONTH)
    : usePaydayCycle && daysInPayCycle > 0
      ? (pool: number) => pool * (daysInPayCycle / AVG_DAYS_PER_MONTH)
      : (pool: number) => pool

  let dailyBudget: number
  switch (incomeSource) {
    case 'budget':
      dailyBudget = Math.max(0, scaledPool(totalMonthlyBudget - totalFixed)) / effectiveDays
      break
    case 'transactions':
      dailyBudget = Math.max(0, scaledPool(smoothedIncome - totalFixed)) / effectiveDays
      break
    case 'estimate':
      // Intentionally uses a fixed 30-day divisor (not daysInMonth) for estimates.
      // This matches the onboarding tutorial formula and provides a stable, simpler
      // number when the user hasn't configured precise budgets. The slight inaccuracy
      // (±1 day) is acceptable for a rough estimate and avoids confusing month-to-month
      // fluctuations for users who haven't opted into detailed budget tracking.
      //
      // Task 66: When estimate is provided, use it. When it's 0, fall back to a
      // sensible default ($1500/month ≈ $50/day) so new users always see a useful
      // number rather than $0. The fallback is clearly signaled via isEstimated.
      if (hasEstimate) {
        dailyBudget = Math.max(0, monthlyIncome! - totalFixed) / 30
      } else {
        // Sensible fallback for zero-setup users (~$50/day)
        const FALLBACK_MONTHLY = 1500
        dailyBudget = Math.max(0, FALLBACK_MONTHLY - totalFixed) / 30
      }
      break
  }
  
  // Step 3: Calculate spentToday (exclude fixed/recurring — already sunk in Step 1b)
  // When countCreditImmediately is false, only count immediate-settlement transactions
  //
  // NOTE (Task 89.1): We filter by `t.date` (the financial/effective date), NOT
  // `t.createdAt` (when the user logged it). A backdated expense contributes to
  // the correct historical day's spend, ensuring rollover is always accurate.
  const todayStr = formatDateLocal(currentDate)
  const shouldCountCreditImmediately = countCreditImmediately ?? true
  
  // Helper to check if a transaction is immediate-settlement
  const isImmediateSettlement = (tx: Transaction): boolean => {
    // No funding source = treat as immediate
    if (!tx.fundingSourceId || !fundingSources) return true
    
    const source = fundingSources.find(s => s.id === tx.fundingSourceId)
    // Source not found = treat as immediate (graceful degradation)
    if (!source) return true
    
    return source.reducesBalanceNow
  }
  
  const todayExpenses = transactions
    .filter(t => t.date === todayStr && t.type === 'expense' && !isFixedTransaction(t) && !isBorrowedTransaction(t, fundingSources ?? []))
  
  // Track borrowed spending separately (informational)
  const borrowedTodayExpenses = transactions
    .filter(t => t.date === todayStr && t.type === 'expense' && !isFixedTransaction(t) && isBorrowedTransaction(t, fundingSources ?? []))
  const borrowedSpending = borrowedTodayExpenses.reduce((sum, t) => sum + t.amount, 0)

  // When countCreditImmediately is false, split spending by settlement type
  let spentToday: number
  let deferredSpending: number | undefined
  
  if (shouldCountCreditImmediately) {
    // Default behavior: all spending counts
    spentToday = todayExpenses.reduce((sum, t) => sum + t.amount, 0)
  } else {
    // Filter to immediate-settlement only
    const immediateExpenses = todayExpenses.filter(isImmediateSettlement)
    const deferredExpenses = todayExpenses.filter(tx => !isImmediateSettlement(tx))
    
    spentToday = immediateExpenses.reduce((sum, t) => sum + t.amount, 0)
    deferredSpending = deferredExpenses.reduce((sum, t) => sum + t.amount, 0)
  }
  
  // Step 4: Calculate rollover from previous days
  // Rollover = what was saved/overspent from setupDate (or day 1) to yesterday.
  // When countCreditImmediately is false, use the same settlement filtering.
  //
  // Month boundary behavior: On day 1 of a new month, daysElapsedSinceSetup = 0
  // because dayOfMonth (1) - setupDay (1) = 0. This means rollover is always 0 on
  // the first day — the month boundary resets naturally without special-case logic.
  // On day 2, rollover only reflects day 1's delta, which is inherently within the
  // ±2-day cap since it's a single day's variance.
  
  // When mid-month setup, rollover only covers days from setupDate to yesterday
  const setupDay = isSetupMidMonth ? setupDate!.getDate() : 1
  const dayOfMonth = currentDate.getDate()
  
  // In term-cycle mode, rollover covers days from term start to yesterday.
  // In payday-cycle mode, rollover covers days from lastPayday to yesterday
  // instead of from month start / setupDate.
  // In calendar mode, the existing month-based logic applies.
  const rolloverStart: Date = useTermCycle
    ? parseDateLocal(termSchedule!.startDate)
    : usePaydayCycle && lastPayday
      ? lastPayday
      : isSetupMidMonth
        ? new Date(currentDate.getFullYear(), currentDate.getMonth(), setupDay)
        : getMonthStartLocal(currentDate)

  const daysElapsedSinceSetup = useTermCycle
    ? Math.max(0, Math.round((currentDate.getTime() - rolloverStart.getTime()) / (24 * 60 * 60 * 1000)))
    : usePaydayCycle && lastPayday
      ? Math.max(0, Math.round((currentDate.getTime() - lastPayday.getTime()) / (24 * 60 * 60 * 1000)))
      : dayOfMonth - setupDay
  
  let rollover = 0
  if (daysElapsedSinceSetup > 0) {
    const yesterday = subtractDaysLocal(currentDate, 1)
    
    // Expected spend from rollover start to yesterday
    // Task 164.1: When rhythm weights are active and reliable, use per-day
    // weighted expected spend instead of flat dailyBudget * daysElapsed.
    // This ensures rollover correctly accounts for the expectation that
    // weekends have higher spending and weekdays lower.
    const useRhythm = rhythmWeights && rhythmWeights.isReliable
    let expectedSpendToYesterday: number
    if (useRhythm) {
      // Sum dailyBudget * weight[dayOfWeek] for each day from rolloverStart to yesterday
      expectedSpendToYesterday = 0
      let walkDay = new Date(rolloverStart.getTime())
      const yesterdayTime = yesterday.getTime()
      while (walkDay.getTime() <= yesterdayTime) {
        const dow = walkDay.getDay()
        expectedSpendToYesterday += dailyBudget * rhythmWeights.weights[dow]
        walkDay = addDaysLocal(walkDay, 1)
      }
    } else {
      expectedSpendToYesterday = dailyBudget * daysElapsedSinceSetup
    }
    
    // Actual spend from rollover start to yesterday
    // Apply the same settlement filtering as spentToday
    const rolloverExpenses = transactions
      .filter(t => {
        const txDate = t.date
        const startDate = formatDateLocal(rolloverStart)
        const endDate = formatDateLocal(yesterday)
        return txDate >= startDate && txDate <= endDate && t.type === 'expense' && !isFixedTransaction(t) && !isBorrowedTransaction(t, fundingSources ?? [])
      })
    
    const actualSpendToYesterday = shouldCountCreditImmediately
      ? rolloverExpenses.reduce((sum, t) => sum + t.amount, 0)
      : rolloverExpenses.filter(isImmediateSettlement).reduce((sum, t) => sum + t.amount, 0)
    
    // Rollover: positive = saved, negative = overspent
    // Cap rollover to ±2 days budget to prevent extreme accumulation
    const rawRollover = expectedSpendToYesterday - actualSpendToYesterday
    const maxRollover = dailyBudget * 2
    rollover = Math.max(-maxRollover, Math.min(maxRollover, rawRollover))
  }

  // Task 164.1: Apply rhythm adjustment to today's daily budget when weights are reliable.
  // The `dailyBudget` used for rollover cap and status thresholds stays flat (stable),
  // but the number shown to the user and used for the hero amount reflects rhythm.
  const useRhythmForToday = rhythmWeights && rhythmWeights.isReliable
  const rhythmAdjustedDailyBudget = useRhythmForToday
    ? dailyBudget * rhythmWeights.weights[currentDate.getDay()]
    : dailyBudget
  
  // Step 5: Calculate final daily allowance
  const rawAmount = rhythmAdjustedDailyBudget + rollover - spentToday
  const amount = Math.max(0, rawAmount)
  
  // Step 6: Determine status and message
  const status = getStatus(rawAmount, rhythmAdjustedDailyBudget) // Use rawAmount to detect overspending
  const message = generateEncouragingMessage(status, amount, spentToday)
  const showCelebration = shouldCelebrate(status, spentToday, dailyBudget)
  
  // Step 7: Reserve upcoming bills — DISPLAY ONLY, does NOT reduce the allowance.
  // ⚠️  These bills are already fully accounted for in Step 1b (totalFixed subtraction
  // from the monthly pool). The reservedForBills value exists solely so the UI can
  // show the user WHY their daily budget is what it is ("$X reserved for N upcoming
  // bills"). It does NOT further reduce `amount` above.
  const upcomingBills = getUpcomingBillsList(fixedExpenses ?? [], currentDate)
  const reservedForBills = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0)
  const upcomingBillCount = upcomingBills.length

  // Step 8: Compute month-boundary carryover when enabled and it's the 1st of the month
  let monthBoundaryCarryover: MonthBoundaryCarryover | undefined
  if (carryoverEnabled && dayOfMonth === 1) {
    const previousMonthDate = subtractDaysLocal(currentDate, 1) // last day of previous month
    monthBoundaryCarryover = computeMonthBoundaryCarryover(
      budgets,
      transactions,
      previousMonthDate,
      fixedExpenses,
      true
    )
  }

  // Step 9: Compute reservedForScheduled — sum of future-dated expenses within this month.
  // These items are excluded from spentToday and rollover naturally (date > todayStr), but
  // the user benefits from seeing how much is "spoken for" in upcoming planned transactions.
  // This auto-realizes implicitly: when a scheduled transaction's date arrives, it becomes
  // part of spentToday via the normal date === todayStr filter — no cron or status change needed.
  //
  // ─────────────────────────────────────────────────────────────────────────────────
  // RECONCILIATION WITH RECURRING BILLS (Task 90.2)
  // ─────────────────────────────────────────────────────────────────────────────────
  // We exclude transactions that match a known recurring bill (via isScheduledForKnownBill)
  // to prevent double-counting. Those bills are already accounted for in:
  //   • Step 1b: totalFixed subtraction from the monthly pool
  //   • Step 7: reservedForBills informational display
  //
  // Only truly NEW one-off scheduled items appear in reservedForScheduled.
  //
  // Auto-realization behavior:
  //   • Recurring bill on its date: isFixedTransaction keeps it out of spentToday — the
  //     monthly pool subtraction already covers it. The transaction is a "confirmation" record.
  //   • Non-recurring scheduled item on its date: enters spentToday normally via the
  //     date === todayStr filter, reducing the daily allowance as expected.
  // ─────────────────────────────────────────────────────────────────────────────────
  const scheduledExpenses = transactions.filter(t =>
    t.type === 'expense' &&
    t.date > todayStr &&
    t.date.startsWith(currentMonthPrefix) &&
    !isFixedTransaction(t) &&
    !isScheduledForKnownBill(t, fixedExpenses ?? [])
  )
  const reservedForScheduled = scheduledExpenses.reduce((sum, t) => sum + t.amount, 0)
  const scheduledCount = scheduledExpenses.length

  // Step 10: Compute confidence band for variable income (Task 164.2)
  // Only relevant when income comes from transactions and smoothing is in use.
  // The band shows "usually $X–$Y/day" as supplementary info — never changes the hero number.
  let confidenceBand: ConfidenceBand | undefined
  if (incomeSource === 'transactions' && incomeSmoothing) {
    const band = computeConfidenceBand(transactions, currentDate, dailyBudget, incomeSmoothing, fixedExpenses)
    if (band && band.isSignificant) {
      confidenceBand = band
    }
  }

  // Return valid DailyAllowance
  return {
    amount,
    dailyBudget: rhythmAdjustedDailyBudget,
    spentToday,
    rollover,
    status,
    message,
    showCelebration,
    isEstimated,
    incomeSource,
    reservedForBills: reservedForBills > 0 ? reservedForBills : undefined,
    upcomingBillCount: upcomingBillCount > 0 ? upcomingBillCount : undefined,
    monthBoundaryCarryover,
    deferredSpending: deferredSpending !== undefined && deferredSpending > 0 ? deferredSpending : undefined,
    borrowedSpending: borrowedSpending > 0 ? borrowedSpending : undefined,
    reservedForScheduled: reservedForScheduled > 0 ? reservedForScheduled : undefined,
    scheduledCount: scheduledCount > 0 ? scheduledCount : undefined,
    confidenceBand,
  }
}

/**
 * Computes leftover savings at a month boundary.
 * When a user underspends their daily budget consistently, the raw rollover can exceed
 * the ±2-day cap. The excess is the "carryover" — money that could be routed to savings.
 *
 * This is purely informational/advisory — it reports how much COULD be saved,
 * it doesn't automatically move money.
 *
 * **Validates: Requirements 1.2, new**
 *
 * @param budgets - Budget limits
 * @param transactions - All transactions (to calculate previous month's spending)
 * @param previousMonthDate - A date in the previous month (e.g., last day of prev month)
 * @param fixedExpenses - Fixed monthly obligations
 * @param enabled - Whether the carryover feature is enabled by the user
 * @returns MonthBoundaryCarryover with the excess amount
 */
export function computeMonthBoundaryCarryover(
  budgets: Budget[],
  transactions: Transaction[],
  previousMonthDate: Date,
  fixedExpenses?: FixedExpense[],
  enabled?: boolean
): MonthBoundaryCarryover {
  // Calculate daily budget for the previous month.
  // Only include categories with an actual limit set (monthlyLimit > 0),
  // consistent with the partial-limits handling in computeDailyAllowance.
  const totalMonthlyBudget = budgets
    .filter(b => b.monthlyLimit > 0)
    .reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  const daysInPrevMonth = getDaysInMonthLocal(previousMonthDate)
  const dailyBudget = Math.max(0, totalMonthlyBudget - totalFixed) / daysInPrevMonth

  // Calculate total expected discretionary spend for the entire previous month
  const expectedSpendForMonth = dailyBudget * daysInPrevMonth

  // Calculate actual discretionary spending for the entire previous month
  const prevMonthPrefix = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
  const actualSpendForMonth = transactions
    .filter(t =>
      t.date.startsWith(prevMonthPrefix) &&
      t.type === 'expense' &&
      !isFixedTransaction(t)
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Raw rollover: positive means saved money, negative means overspent
  const rawRollover = expectedSpendForMonth - actualSpendForMonth

  // Cap rollover to ±2 days of daily budget (same logic as computeDailyAllowance Step 4)
  const maxRollover = dailyBudget * 2
  const cappedRollover = Math.max(-maxRollover, Math.min(maxRollover, rawRollover))

  // Carryover is the excess savings beyond the cap (only positive excess counts)
  const carryoverAmount = Math.max(0, rawRollover - cappedRollover)

  // If not enabled, report zero amount but still provide the raw data for transparency
  if (!enabled) {
    return {
      amount: 0,
      rawRollover,
      cappedRollover,
      enabled: false,
    }
  }

  return {
    amount: carryoverAmount,
    rawRollover,
    cappedRollover,
    enabled: true,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Meaning Status Helper (Task 100.2)
// ─────────────────────────────────────────────────────────────────────────────
//
// A pure helper that converts the currently-selected HeroMeaning (allowance,
// spent_today, spent_week, balance) plus raw data into a fully-resolved
// HeroDisplay. The hero component itself stays agnostic — it only consumes
// displayAmount, label, status, and message.
//
// Each meaning has its own status thresholds:
//   'allowance':   existing healthy/caution/warning/over logic (% of daily budget)
//   'spent_today': high (>1.5× dailyBudget) | warning (>1.0× dailyBudget) |
//                  normal (otherwise). When no budget exists, always 'healthy'.
//   'spent_week':  high/warning/normal vs. 7× dailyBudget.
//   'balance':     positive-balance = healthy, near-zero = caution, negative = over.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the display-ready hero values for the currently-selected HeroMeaning.
 *
 * This is a pure function — no side effects, no Date.now() calls.
 * Pass `currentDate` explicitly for testability.
 *
 * @param heroMeaning - Which metric the user wants to see
 * @param allowance   - The computed daily allowance (from computeDailyAllowance)
 * @param transactions - All transactions (needed for spent_week and balance)
 * @param currentDate - Current date (for weekly window + balance calculation)
 * @returns HeroDisplay with displayAmount, label, status, and message
 */
export function heroMeaningStatus(
  heroMeaning: HeroMeaning,
  allowance: DailyAllowance,
  transactions: Transaction[],
  currentDate: Date = new Date()
): HeroDisplay {
  const { amount, dailyBudget, spentToday, status: allowanceStatus } = allowance

  switch (heroMeaning) {
    // ── 'allowance': existing "safe to spend today" logic ────────────────────
    case 'allowance': {
      return {
        displayAmount: amount,
        label: 'Safe to spend today',
        status: allowanceStatus,
        message: generateEncouragingMessage(allowanceStatus, amount, spentToday),
      }
    }

    // ── 'spent_today': neutral spend level (no budget shame) ─────────────────
    case 'spent_today': {
      let status: AllowanceStatus = 'healthy'
      let message: string

      if (dailyBudget > 0) {
        const ratio = spentToday / dailyBudget
        if (ratio > 1.5) {
          status = 'over'
          message = "Big day of spending — just so you know"
        } else if (ratio > 1.0) {
          status = 'warning'
          message = "A bit more than your usual — you got this"
        } else if (ratio > 0.75) {
          status = 'caution'
          message = "On track with your typical day"
        } else {
          status = 'healthy'
          message = spentToday === 0
            ? "Nothing logged yet today — tap to record spending"
            : "Light day so far — nice"
        }
      } else {
        // No budget configured — purely informational
        status = 'healthy'
        message = spentToday === 0
          ? "Nothing logged yet today"
          : `You've logged $${Math.round(spentToday)} so far today`
      }

      return {
        displayAmount: spentToday,
        label: 'Spent today',
        status,
        message,
      }
    }

    // ── 'spent_week': rolling 7-day spend total ───────────────────────────────
    case 'spent_week': {
      const todayStr = formatDateLocal(currentDate)
      // Build the 7-day window: today and the 6 days before
      const weekStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 6
      )
      const weekStartStr = formatDateLocal(weekStart)

      const spentThisWeek = transactions
        .filter(t => t.type === 'expense' && t.date >= weekStartStr && t.date <= todayStr && !isFixedTransaction(t))
        .reduce((sum, t) => sum + t.amount, 0)

      const weeklyBudget = dailyBudget * 7

      let status: AllowanceStatus = 'healthy'
      let message: string

      if (weeklyBudget > 0) {
        const ratio = spentThisWeek / weeklyBudget
        if (ratio > 1.5) {
          status = 'over'
          message = "High spend week — worth a quick look at where it went"
        } else if (ratio > 1.0) {
          status = 'warning'
          message = "A bit more than your weekly usual"
        } else if (ratio > 0.75) {
          status = 'caution'
          message = "Keeping pace with a typical week"
        } else {
          status = 'healthy'
          message = spentThisWeek === 0
            ? "No spending logged this week yet"
            : "Under your typical week — solid"
        }
      } else {
        status = 'healthy'
        message = spentThisWeek === 0
          ? "No spending logged this week yet"
          : "Here's your 7-day spending"
      }

      return {
        displayAmount: spentThisWeek,
        label: 'Spent this week',
        status,
        message,
      }
    }

    // ── 'balance': net money on hand (income minus expenses) ─────────────────
    case 'balance': {
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      const totalExpenses = transactions
        .filter(t => t.type === 'expense' && !isFixedTransaction(t))
        .reduce((sum, t) => sum + t.amount, 0)
      const balance = totalIncome - totalExpenses

      let status: AllowanceStatus
      let message: string

      if (balance > dailyBudget * 7) {
        status = 'healthy'
        message = "Good cushion — you're in a solid spot"
      } else if (balance > dailyBudget) {
        status = 'caution'
        message = "Some cushion available — keep it going"
      } else if (balance >= 0) {
        status = 'warning'
        message = "Running a bit lean — worth keeping an eye on"
      } else {
        status = 'over'
        message = "In the negative — log any income you haven't recorded yet"
      }

      return {
        displayAmount: balance,
        label: 'Money on hand',
        status,
        message,
      }
    }
  }
}
