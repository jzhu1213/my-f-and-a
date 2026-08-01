/**
 * Property-based tests for core money math invariants.
 *
 * Tests computeDailyAllowance and date utilities against universal properties
 * that must hold regardless of input combinations.
 *
 * **Validates: Requirements 4.5**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  arbBudgetSet,
  arbTransaction,
  arbDateString,
  arbFixedExpense,
  arbPaySchedule,
  arbTermSchedule,
  arbBudgetWithPeriod,
  arbBudgetAmount,
  arbTransactionCategory,
} from './arbitraries'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import {
  parseDateLocal,
  getMonthStartLocal,
  subtractDaysLocal,
  formatDateLocal,
} from '@/lib/dateUtils'
import type { Budget, Transaction } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'

// ============================================================================
// Helper: Generate a currentDate that's NOT the 1st of a month (for rollover tests)
// ============================================================================

/** Generates a date on a specific day of the month (at local midnight) */
const arbDateOnDay = (day: number): fc.Arbitrary<Date> =>
  fc
    .record({
      year: fc.integer({ min: 2022, max: 2026 }),
      month: fc.integer({ min: 1, max: 12 }),
    })
    .map(({ year, month }) => new Date(year, month - 1, day))

/** Generates a date mid-month (day 2-28) for rollover to be non-trivial */
const arbMidMonthDate = (): fc.Arbitrary<Date> =>
  fc
    .record({
      year: fc.integer({ min: 2022, max: 2026 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 2, max: 28 }),
    })
    .map(({ year, month, day }) => new Date(year, month - 1, day))

/** Generates a date that's the 1st of a month */
const arbFirstOfMonth = (): fc.Arbitrary<Date> =>
  fc
    .record({
      year: fc.integer({ min: 2022, max: 2026 }),
      month: fc.integer({ min: 1, max: 12 }),
    })
    .map(({ year, month }) => new Date(year, month - 1, 1))

// ============================================================================
// Property 1: Allowance never negative
// ============================================================================

describe('Money Math Properties', () => {
  it('1. allowance amount is always >= 0 regardless of inputs', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        fc.array(arbTransaction(), { maxLength: 30 }),
        arbMidMonthDate(),
        (budgets, transactions, currentDate) => {
          const result = computeDailyAllowance(budgets, transactions, currentDate)
          expect(result.amount).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  // ============================================================================
  // Property 2: Rollover cap holds
  // ============================================================================

  it('2. |rollover| <= dailyBudget * 2 always holds', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        fc.array(arbTransaction(), { maxLength: 30 }),
        arbMidMonthDate(),
        (budgets, transactions, currentDate) => {
          const result = computeDailyAllowance(budgets, transactions, currentDate)
          const maxRollover = result.dailyBudget * 2
          expect(Math.abs(result.rollover)).toBeLessThanOrEqual(maxRollover + 0.01) // tiny float tolerance
        }
      ),
      { numRuns: 200 }
    )
  })

  // ============================================================================
  // Property 3: Dates land on local midnight
  // ============================================================================

  it('3. parseDateLocal always produces dates at local midnight', () => {
    fc.assert(
      fc.property(arbDateString(), (dateStr) => {
        const date = parseDateLocal(dateStr)
        expect(date.getHours()).toBe(0)
        expect(date.getMinutes()).toBe(0)
        expect(date.getSeconds()).toBe(0)
        expect(date.getMilliseconds()).toBe(0)
      }),
      { numRuns: 200 }
    )
  })

  it('3b. getMonthStartLocal always produces dates at local midnight', () => {
    fc.assert(
      fc.property(arbMidMonthDate(), (date) => {
        const monthStart = getMonthStartLocal(date)
        expect(monthStart.getHours()).toBe(0)
        expect(monthStart.getMinutes()).toBe(0)
        expect(monthStart.getSeconds()).toBe(0)
        expect(monthStart.getMilliseconds()).toBe(0)
      }),
      { numRuns: 200 }
    )
  })

  it('3c. subtractDaysLocal preserves midnight when input is at midnight', () => {
    fc.assert(
      fc.property(
        arbDateString(),
        fc.integer({ min: 0, max: 365 }),
        (dateStr, days) => {
          const date = parseDateLocal(dateStr) // guaranteed midnight
          const result = subtractDaysLocal(date, days)
          expect(result.getHours()).toBe(0)
          expect(result.getMinutes()).toBe(0)
          expect(result.getSeconds()).toBe(0)
          expect(result.getMilliseconds()).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  // ============================================================================
  // Property 4: Backdating correctness
  // ============================================================================

  it('4. backdated transaction affects rollover, not spentToday', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        arbMidMonthDate(),
        arbBudgetAmount(),
        (budgets, currentDate, txAmount) => {
          // Precondition: budgets have limits and date is not the 1st
          fc.pre(budgets.some(b => b.monthlyLimit > 0))
          fc.pre(currentDate.getDate() > 2)

          const todayStr = formatDateLocal(currentDate)
          const yesterdayStr = formatDateLocal(subtractDaysLocal(currentDate, 1))

          // Baseline: no transactions
          const baseline = computeDailyAllowance(budgets, [], currentDate)

          // Backdated transaction (yesterday) — should NOT affect spentToday
          const backdatedTx: Transaction = {
            id: 'backdate-test',
            userId: 'test',
            date: yesterdayStr,
            amount: txAmount,
            type: 'expense',
            category: 'food',
            accountType: 'personal',
            createdAt: new Date().toISOString(),
          }
          const withBackdated = computeDailyAllowance(budgets, [backdatedTx], currentDate)

          // spentToday should remain 0 since the tx is for yesterday
          expect(withBackdated.spentToday).toBe(0)

          // Today's transaction should affect spentToday
          const todayTx: Transaction = {
            ...backdatedTx,
            id: 'today-test',
            date: todayStr,
          }
          const withToday = computeDailyAllowance(budgets, [todayTx], currentDate)
          expect(withToday.spentToday).toBeCloseTo(txAmount, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================================
  // Property 5: Weekly-period budgets scale correctly
  // ============================================================================

  it('5. weekly budget contributes monthlyLimit * 4.33 to the pool', () => {
    fc.assert(
      fc.property(
        arbBudgetAmount(),
        arbTransactionCategory(),
        arbMidMonthDate(),
        (weeklyLimit, category, currentDate) => {
          fc.pre(weeklyLimit > 0)
          // Avoid rent/income categories which might trigger fixed-expense filtering
          fc.pre(category !== 'rent' && category !== 'income' && category !== 'gig')

          const weeklyBudget: Budget = {
            id: 'weekly-test',
            userId: 'test',
            category,
            monthlyLimit: weeklyLimit,
            spent: 0,
            month: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
            period: 'weekly',
          }

          const monthlyBudget: Budget = {
            id: 'monthly-test',
            userId: 'test',
            category,
            monthlyLimit: weeklyLimit * 4.33,
            spent: 0,
            month: weeklyBudget.month,
            period: 'monthly',
          }

          const weeklyResult = computeDailyAllowance([weeklyBudget], [], currentDate)
          const monthlyResult = computeDailyAllowance([monthlyBudget], [], currentDate)

          // The dailyBudget values should be approximately equal since both pools are equivalent
          expect(weeklyResult.dailyBudget).toBeCloseTo(monthlyResult.dailyBudget, 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================================
  // Property 6: Payday-aligned budgets use pay cycle length
  // ============================================================================

  it('6. payday-aligned budgets compute dailyBudget using AVG_DAYS_PER_MONTH', () => {
    fc.assert(
      fc.property(
        arbBudgetAmount(),
        arbPaySchedule(),
        arbMidMonthDate(),
        (limit, paySchedule, currentDate) => {
          fc.pre(limit > 0)

          const budget: Budget = {
            id: 'payday-test',
            userId: 'test',
            category: 'food',
            monthlyLimit: limit,
            spent: 0,
            month: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
            period: 'payday_aligned',
          }

          const result = computeDailyAllowance(
            [budget],
            [],
            currentDate,
            undefined, // monthlyIncome
            undefined, // fixedExpenses
            undefined, // setupDate
            undefined, // incomeSmoothing
            undefined, // carryoverEnabled
            undefined, // countCreditImmediately
            undefined, // fundingSources
            paySchedule
          )

          // Daily budget should be positive when there's a positive limit
          expect(result.dailyBudget).toBeGreaterThan(0)
          // With pay-cycle mode, dailyBudget ≈ limit / AVG_DAYS_PER_MONTH (30.44)
          const AVG_DAYS_PER_MONTH = 30.44
          expect(result.dailyBudget).toBeCloseTo(limit / AVG_DAYS_PER_MONTH, 0)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================================
  // Property 7: Semester/term-based budgets spread across term days
  // ============================================================================

  it('7. term-based budgets spread dailyBudget across term days', () => {
    fc.assert(
      fc.property(
        arbBudgetAmount(),
        arbTermSchedule(),
        (limit, termSchedule) => {
          fc.pre(limit > 0)

          // Create a currentDate that falls within the term
          const start = parseDateLocal(termSchedule.startDate)
          const end = parseDateLocal(termSchedule.endDate)
          const midpoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)

          const budget: Budget = {
            id: 'term-test',
            userId: 'test',
            category: 'food',
            monthlyLimit: limit,
            spent: 0,
            month: `${midpoint.getFullYear()}-${String(midpoint.getMonth() + 1).padStart(2, '0')}`,
            period: 'semester',
          }

          const result = computeDailyAllowance(
            [budget],
            [],
            midpoint,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined, // paySchedule
            undefined, // incomeHistory
            termSchedule
          )

          // dailyBudget should be positive
          expect(result.dailyBudget).toBeGreaterThan(0)
          // The daily budget is approx: limit / AVG_DAYS_PER_MONTH (since termPool/termDays simplifies)
          const AVG_DAYS_PER_MONTH = 30.44
          expect(result.dailyBudget).toBeCloseTo(limit / AVG_DAYS_PER_MONTH, 0)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================================
  // Property 8: Month boundary rollover resets
  // ============================================================================

  it('8. on day 1 of a month, rollover is always 0', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        fc.array(arbTransaction(), { maxLength: 20 }),
        arbFirstOfMonth(),
        (budgets, transactions, firstOfMonth) => {
          const result = computeDailyAllowance(budgets, transactions, firstOfMonth)
          // On day 1, daysElapsedSinceSetup = dayOfMonth - setupDay = 1 - 1 = 0
          // So rollover is always 0
          expect(result.rollover).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  // ============================================================================
  // Property 9: SpentToday only counts today
  // ============================================================================

  it('9. spentToday only includes transactions with date === today', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        arbMidMonthDate(),
        arbBudgetAmount(),
        (budgets, currentDate, amount) => {
          fc.pre(budgets.some(b => b.monthlyLimit > 0))

          const todayStr = formatDateLocal(currentDate)
          const yesterdayStr = formatDateLocal(subtractDaysLocal(currentDate, 1))

          // One transaction today, one yesterday — only today's should count
          const txToday: Transaction = {
            id: 'today',
            userId: 'test',
            date: todayStr,
            amount,
            type: 'expense',
            category: 'food',
            accountType: 'personal',
            createdAt: new Date().toISOString(),
          }
          const txYesterday: Transaction = {
            id: 'yesterday',
            userId: 'test',
            date: yesterdayStr,
            amount: amount * 2,
            type: 'expense',
            category: 'food',
            accountType: 'personal',
            createdAt: new Date().toISOString(),
          }

          const result = computeDailyAllowance(budgets, [txToday, txYesterday], currentDate)
          expect(result.spentToday).toBeCloseTo(amount, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================================
  // Property 10: Fixed expenses excluded from daily spend
  // ============================================================================

  it('10. recurring transactions (isRecurring=true) are excluded from spentToday', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        arbMidMonthDate(),
        arbBudgetAmount(),
        (budgets, currentDate, amount) => {
          fc.pre(budgets.some(b => b.monthlyLimit > 0))

          const todayStr = formatDateLocal(currentDate)

          // A recurring transaction should not count in spentToday
          const recurringTx: Transaction = {
            id: 'recurring',
            userId: 'test',
            date: todayStr,
            amount,
            type: 'expense',
            category: 'food',
            isRecurring: true,
            accountType: 'personal',
            createdAt: new Date().toISOString(),
          }

          const result = computeDailyAllowance(budgets, [recurringTx], currentDate)
          expect(result.spentToday).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('10b. rent category transactions are excluded from spentToday', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        arbMidMonthDate(),
        arbBudgetAmount(),
        (budgets, currentDate, amount) => {
          fc.pre(budgets.some(b => b.monthlyLimit > 0))

          const todayStr = formatDateLocal(currentDate)

          // A rent-category transaction is treated as fixed
          const rentTx: Transaction = {
            id: 'rent-tx',
            userId: 'test',
            date: todayStr,
            amount,
            type: 'expense',
            category: 'rent',
            accountType: 'personal',
            createdAt: new Date().toISOString(),
          }

          const result = computeDailyAllowance(budgets, [rentTx], currentDate)
          expect(result.spentToday).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
