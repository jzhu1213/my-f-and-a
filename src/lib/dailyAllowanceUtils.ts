import type { Budget, Transaction } from '@/types'
import type { DailyAllowance, AllowanceStatus, IncomeSmoothing, MonthBoundaryCarryover } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import type { FundingSource } from '@/lib/fundingSources'
import { getTotalFixedMonthly, isFixedTransaction, getUpcomingBillsList, isScheduledForKnownBill } from '@/lib/fixedExpenses'
import { isBorrowedTransaction } from '@/lib/fundingSources'
import { getStatusMessage } from '@/lib/vocabulary'

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

/**
 * Formats a Date object into YYYY-MM-DD string format
 * Uses UTC to avoid timezone issues
 */
function formatDateString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gets the first day of the month for a given date
 * Uses UTC to avoid timezone issues
 */
function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Subtracts days from a date
 * Uses UTC to avoid timezone issues
 */
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() - days)
  return result
}

/**
 * Gets the number of days in the month for a given date
 * Uses UTC to avoid timezone issues
 */
function getDaysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

/**
 * Calculates the number of days remaining in the month from a given date (inclusive).
 * Reuses logic similar to `daysLeftInMonth` from budgetUtils.ts but accepts arbitrary dates
 * and uses UTC-based calculations consistent with this file.
 *
 * @param fromDate - The starting date (inclusive)
 * @param currentDate - The current date (used to determine which month we're in)
 * @returns Number of days from `fromDate` to end of the month (inclusive of fromDate)
 */
export function getDaysRemainingFrom(fromDate: Date, currentDate: Date): number {
  const lastDayOfMonth = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const fromDay = fromDate.getUTCDate()
  return lastDayOfMonth - fromDay + 1
}

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
  const currentMonthPrefix = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`

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
    const d = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - i, 1))
    const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
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
  fundingSources?: FundingSource[]
): DailyAllowance {
  // Step 1: Calculate total monthly budget from all category limits
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  
  // Step 1a: Sum actual income transactions logged in the current month
  const currentMonthPrefix = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`
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
  const daysInMonth = getDaysInMonth(currentDate)
  
  // Determine if setupDate qualifies for mid-month calculation:
  // Must be provided and within the same month/year as currentDate
  const isSetupMidMonth = setupDate !== undefined &&
    setupDate.getUTCFullYear() === currentDate.getUTCFullYear() &&
    setupDate.getUTCMonth() === currentDate.getUTCMonth()
  
  // When mid-month setup, divide by remaining days from setupDate; otherwise full month
  const effectiveDays = isSetupMidMonth
    ? getDaysRemainingFrom(setupDate!, currentDate)
    : daysInMonth
  
  let dailyBudget: number
  switch (incomeSource) {
    case 'budget':
      dailyBudget = Math.max(0, totalMonthlyBudget - totalFixed) / effectiveDays
      break
    case 'transactions':
      dailyBudget = Math.max(0, smoothedIncome - totalFixed) / effectiveDays
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
  const todayStr = formatDateString(currentDate)
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
  const dayOfMonth = currentDate.getUTCDate()
  
  // When mid-month setup, rollover only covers days from setupDate to yesterday
  const setupDay = isSetupMidMonth ? setupDate!.getUTCDate() : 1
  const daysElapsedSinceSetup = dayOfMonth - setupDay
  
  let rollover = 0
  if (daysElapsedSinceSetup > 0) {
    const rolloverStart = isSetupMidMonth
      ? new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), setupDay))
      : getMonthStart(currentDate)
    const yesterday = subtractDays(currentDate, 1)
    
    // Expected spend from setupDate (or month start) to yesterday
    const expectedSpendToYesterday = dailyBudget * daysElapsedSinceSetup
    
    // Actual spend from setupDate (or month start) to yesterday
    // Apply the same settlement filtering as spentToday
    const rolloverExpenses = transactions
      .filter(t => {
        const txDate = t.date
        const startDate = formatDateString(rolloverStart)
        const endDate = formatDateString(yesterday)
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
  
  // Step 5: Calculate final daily allowance
  const rawAmount = dailyBudget + rollover - spentToday
  const amount = Math.max(0, rawAmount)
  
  // Step 6: Determine status and message
  const status = getStatus(rawAmount, dailyBudget) // Use rawAmount to detect overspending
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
    const previousMonthDate = subtractDays(currentDate, 1) // last day of previous month
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

  // Return valid DailyAllowance
  return {
    amount,
    dailyBudget,
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
  // Calculate daily budget for the previous month
  const totalMonthlyBudget = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  const totalFixed = getTotalFixedMonthly(fixedExpenses ?? [])
  const daysInPrevMonth = getDaysInMonth(previousMonthDate)
  const dailyBudget = Math.max(0, totalMonthlyBudget - totalFixed) / daysInPrevMonth

  // Calculate total expected discretionary spend for the entire previous month
  const expectedSpendForMonth = dailyBudget * daysInPrevMonth

  // Calculate actual discretionary spending for the entire previous month
  const prevMonthPrefix = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
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
