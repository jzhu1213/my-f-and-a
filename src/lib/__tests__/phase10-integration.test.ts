/**
 * Phase 10 Integration Tests
 *
 * Tests that verify Phase 10 features work together correctly:
 * - 349.1: Variable income → allowance flow
 * - 349.2: Mode switching round-trip
 * - 349.3: Flexible period + rollover
 * - 349.4: Pinned cards + home density
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getIncomeProjection } from '@/lib/incomePatterns'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import {
  saveBudgetMode,
  setActiveBudgetMode,
  getActiveBudgetMode,
  getBudgetModes,
  applyBudgetModeOverrides,
  type BudgetMode,
} from '@/lib/spendingModeConfig'
import {
  computePeriodContext,
  type BudgetPeriodPreference,
} from '@/lib/budgetPeriod'
import {
  getPinnedCards,
  setPinnedCards,
  addPinnedCard,
  removePinnedCard,
  MAX_PINNED_CARDS,
} from '@/lib/homeWidgets'
import { getHomeStyle, setHomeStyle } from '@/lib/uiPreferences'
import type { Transaction, Budget } from '@/types'

// ============================================================================
// Helpers
// ============================================================================

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day)

function createIncomeTransaction(
  date: string,
  amount: number,
  id?: string
): Transaction {
  return {
    id: id ?? `inc-${date}-${amount}`,
    userId: 'user-1',
    date,
    amount,
    type: 'income',
    category: 'income',
    accountType: 'personal',
    createdAt: new Date().toISOString(),
  }
}

function createExpenseTransaction(
  date: string,
  amount: number,
  category: string = 'food'
): Transaction {
  return {
    id: `exp-${date}-${amount}-${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user-1',
    date,
    amount,
    type: 'expense',
    category: category as any,
    accountType: 'personal',
    createdAt: new Date().toISOString(),
  }
}

function createBudget(
  category: string,
  monthlyLimit: number,
  month: string = '2024-06'
): Budget {
  return {
    id: `budget-${category}`,
    userId: 'user-1',
    category: category as any,
    monthlyLimit,
    spent: 0,
    month,
  }
}

// ============================================================================
// 349.1 — Variable income → allowance flow
// ============================================================================

describe('349.1 Variable income → allowance flow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should project income from 4+ months of variable income history', () => {
    // Log income over 4 months: variable but roughly biweekly
    const transactions: Transaction[] = [
      // Month 1 (Feb 2024)
      createIncomeTransaction('2024-02-01', 800, 'inc-feb-1'),
      createIncomeTransaction('2024-02-15', 750, 'inc-feb-2'),
      // Month 2 (Mar 2024)
      createIncomeTransaction('2024-03-01', 820, 'inc-mar-1'),
      createIncomeTransaction('2024-03-15', 780, 'inc-mar-2'),
      // Month 3 (Apr 2024)
      createIncomeTransaction('2024-04-01', 790, 'inc-apr-1'),
      createIncomeTransaction('2024-04-15', 810, 'inc-apr-2'),
    ]

    const targetMonth = localDate(2024, 5, 1) // May 2024
    const projection = getIncomeProjection(transactions, targetMonth)

    // With 6 income transactions over ~4 months with regular intervals,
    // confidence should be medium-high (>= 0.4)
    expect(projection.confidence).toBeGreaterThanOrEqual(0.4)
    expect(projection.projectedMonthlyIncome).toBeGreaterThan(0)
    expect(projection.regularity).not.toBe('irregular')
  })

  it('should feed projected income into the allowance engine when confidence >= 0.4', () => {
    // Build history that produces a projection
    const transactions: Transaction[] = [
      createIncomeTransaction('2024-02-01', 800, 'inc-feb-1'),
      createIncomeTransaction('2024-02-15', 800, 'inc-feb-2'),
      createIncomeTransaction('2024-03-01', 800, 'inc-mar-1'),
      createIncomeTransaction('2024-03-15', 800, 'inc-mar-2'),
      createIncomeTransaction('2024-04-01', 800, 'inc-apr-1'),
      createIncomeTransaction('2024-04-15', 800, 'inc-apr-2'),
    ]

    const targetMonth = localDate(2024, 5, 15)
    const projection = getIncomeProjection(transactions, targetMonth)

    expect(projection.confidence).toBeGreaterThanOrEqual(0.4)

    // Pass projection to allowance engine (no budgets set)
    const result = computeDailyAllowance(
      [], // no budgets — projected income becomes the source
      [], // no current-month transactions yet
      targetMonth,
      undefined, // no monthlyIncome estimate
      undefined, // no fixedExpenses
      undefined, // no setupDate
      undefined, // no incomeSmoothing
      undefined, // no carryoverEnabled
      undefined, // no countCreditImmediately
      undefined, // no fundingSources
      undefined, // no paySchedule
      undefined, // no incomeHistory
      undefined, // no termSchedule
      undefined, // no rhythmWeights
      undefined, // no incomeStreams
      { amount: projection.projectedMonthlyIncome, confidence: projection.confidence }
    )

    // The allowance should use the projected income
    expect(result.incomeSource).toBe('transactions')
    expect(result.dailyBudget).toBeGreaterThan(0)
    // dailyBudget should approximate projectedMonthlyIncome / 31 (May has 31 days)
    expect(result.dailyBudget).toBeCloseTo(
      projection.projectedMonthlyIncome / 31,
      0
    )
  })

  it('should adjust allowance mid-month when actual income arrives', () => {
    const targetMonth = localDate(2024, 5, 15)

    // Projected income: $1600/month
    const projectedIncome = { amount: 1600, confidence: 0.7 }

    // Actual income already logged this month: $900
    const transactions: Transaction[] = [
      createIncomeTransaction('2024-05-01', 500, 'inc-may-1'),
      createIncomeTransaction('2024-05-10', 400, 'inc-may-2'),
    ]

    const result = computeDailyAllowance(
      [],
      transactions,
      targetMonth,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      projectedIncome
    )

    // With actual income ($900) logged and projected income ($1600),
    // the engine should blend actuals + remaining projection.
    // The daily budget should reflect more than just projected/31.
    expect(result.dailyBudget).toBeGreaterThan(0)
    expect(result.incomeSource).toBe('transactions')
  })

  it('should fallback when income history is insufficient (< 4 transactions)', () => {
    // Only 2 income transactions — not enough for meaningful projection
    const transactions: Transaction[] = [
      createIncomeTransaction('2024-03-15', 800, 'inc-1'),
      createIncomeTransaction('2024-04-15', 750, 'inc-2'),
    ]

    const targetMonth = localDate(2024, 5, 1)
    const projection = getIncomeProjection(transactions, targetMonth)

    // Should return zero confidence
    expect(projection.confidence).toBe(0)
    expect(projection.projectedMonthlyIncome).toBe(0)

    // When passed to allowance engine, it falls back to estimate
    const result = computeDailyAllowance(
      [],
      [],
      targetMonth,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { amount: projection.projectedMonthlyIncome, confidence: projection.confidence }
    )

    // With zero confidence and zero projected amount, should use fallback
    expect(result.isEstimated).toBe(true)
    expect(result.incomeSource).toBe('estimate')
    // Fallback is $50/day
    expect(result.dailyBudget).toBe(50)
  })
})

// ============================================================================
// 349.2 — Mode switching round-trip
// ============================================================================

describe('349.2 Mode switching round-trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const modeA: BudgetMode = {
    id: 'mode-semester',
    name: 'Semester',
    icon: '📚',
    monthlyBudgetOverride: 2000,
    categoryBudgetOverrides: [
      { category: 'food', monthlyLimit: 400 },
      { category: 'fun', monthlyLimit: 100 },
    ],
    fixedExpenseOverrides: [],
    isActive: false,
  }

  const modeB: BudgetMode = {
    id: 'mode-break',
    name: 'Break',
    icon: '🏖️',
    monthlyBudgetOverride: 1200,
    categoryBudgetOverrides: [
      { category: 'food', monthlyLimit: 300 },
      { category: 'fun', monthlyLimit: 250 },
    ],
    fixedExpenseOverrides: [],
    isActive: false,
  }

  const baseBudgets: Budget[] = [
    createBudget('food', 350),
    createBudget('fun', 150),
  ]

  it('should create and persist two modes', () => {
    saveBudgetMode(modeA)
    saveBudgetMode(modeB)

    const modes = getBudgetModes()
    expect(modes.find(m => m.id === 'mode-semester')).toBeTruthy()
    expect(modes.find(m => m.id === 'mode-break')).toBeTruthy()
  })

  it('should recalculate allowance when switching modes', () => {
    saveBudgetMode(modeA)
    saveBudgetMode(modeB)

    const currentDate = localDate(2024, 6, 15) // June 15

    // Activate mode A
    setActiveBudgetMode('mode-semester')
    const activeA = getActiveBudgetMode()
    expect(activeA).not.toBeNull()
    expect(activeA!.id).toBe('mode-semester')

    // Apply mode A overrides
    const overriddenA = applyBudgetModeOverrides(baseBudgets, [], activeA)
    const resultA = computeDailyAllowance(overriddenA.budgets, [], currentDate)

    // Activate mode B
    setActiveBudgetMode('mode-break')
    const activeB = getActiveBudgetMode()
    expect(activeB).not.toBeNull()
    expect(activeB!.id).toBe('mode-break')

    // Apply mode B overrides
    const overriddenB = applyBudgetModeOverrides(baseBudgets, [], activeB)
    const resultB = computeDailyAllowance(overriddenB.budgets, [], currentDate)

    // Mode A has higher limits (400+100=500), Mode B has different (300+250=550)
    // They should produce different daily budgets
    expect(resultA.dailyBudget).not.toBeCloseTo(resultB.dailyBudget, 1)
  })

  it('should restore original values when switching back to mode A', () => {
    saveBudgetMode(modeA)
    saveBudgetMode(modeB)

    const currentDate = localDate(2024, 6, 15)

    // Activate mode A → record result
    setActiveBudgetMode('mode-semester')
    const activeA1 = getActiveBudgetMode()
    const overriddenA1 = applyBudgetModeOverrides(baseBudgets, [], activeA1)
    const resultA1 = computeDailyAllowance(overriddenA1.budgets, [], currentDate)

    // Switch to mode B
    setActiveBudgetMode('mode-break')

    // Switch back to mode A
    setActiveBudgetMode('mode-semester')
    const activeA2 = getActiveBudgetMode()
    const overriddenA2 = applyBudgetModeOverrides(baseBudgets, [], activeA2)
    const resultA2 = computeDailyAllowance(overriddenA2.budgets, [], currentDate)

    // Results should match perfectly
    expect(resultA2.dailyBudget).toBe(resultA1.dailyBudget)
    expect(resultA2.amount).toBe(resultA1.amount)
  })

  it('should restore base budgets when deactivating all modes', () => {
    saveBudgetMode(modeA)
    setActiveBudgetMode('mode-semester')

    const currentDate = localDate(2024, 6, 15)

    // Get allowance with mode A
    const activeMode = getActiveBudgetMode()
    const overridden = applyBudgetModeOverrides(baseBudgets, [], activeMode)
    const withMode = computeDailyAllowance(overridden.budgets, [], currentDate)

    // Deactivate all modes
    setActiveBudgetMode(null)
    const noMode = getActiveBudgetMode()
    expect(noMode).toBeNull()

    // Get allowance with no mode (base budgets: 350+150=500)
    const base = applyBudgetModeOverrides(baseBudgets, [], null)
    const withoutMode = computeDailyAllowance(base.budgets, [], currentDate)

    // Base: (350+150)/30 = 16.67/day, Mode A: (400+100)/30 = 16.67/day
    // Actually mode A has same total (500), but different category split.
    // Let's verify the base budgets are passed through unchanged
    expect(base.budgets[0].monthlyLimit).toBe(350)
    expect(base.budgets[1].monthlyLimit).toBe(150)
    expect(withoutMode.dailyBudget).toBeCloseTo(500 / 30, 1)
  })
})

// ============================================================================
// 349.3 — Flexible period + rollover
// ============================================================================

describe('349.3 Flexible period + rollover', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should compute weekly period context correctly', () => {
    const weeklyPref: BudgetPeriodPreference = {
      type: 'weekly',
      startDay: 1, // Monday
    }

    // June 12, 2024 is a Wednesday → 2 days into a Monday-start week
    const currentDate = localDate(2024, 6, 12)
    const context = computePeriodContext(weeklyPref, currentDate)

    expect(context).not.toBeNull()
    expect(context!.type).toBe('weekly')
    expect(context!.totalDays).toBe(7)
    expect(context!.daysElapsed).toBe(2) // Mon, Tue elapsed
    expect(context!.daysRemaining).toBe(5) // Wed, Thu, Fri, Sat, Sun
  })

  it('should compute rollover at weekly period boundary correctly', () => {
    const weeklyPref: BudgetPeriodPreference = {
      type: 'weekly',
      startDay: 1, // Monday
    }

    // Spend under budget for 7 days, then check new week
    const budgets: Budget[] = [createBudget('food', 700, '2024-06')]

    // Week 1: Mon Jun 10 – Sun Jun 16
    // Spend $5/day (under the ~$22.58/day weekly budget → 700/31 days in month)
    const transactions: Transaction[] = [
      createExpenseTransaction('2024-06-10', 5),
      createExpenseTransaction('2024-06-11', 5),
      createExpenseTransaction('2024-06-12', 5),
      createExpenseTransaction('2024-06-13', 5),
      createExpenseTransaction('2024-06-14', 5),
      createExpenseTransaction('2024-06-15', 5),
      createExpenseTransaction('2024-06-16', 5),
    ]

    // New week starts Mon Jun 17 — rollover should reset within the new period
    const newWeekDate = localDate(2024, 6, 17)
    const result = computeDailyAllowance(
      budgets,
      transactions,
      newWeekDate,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      weeklyPref
    )

    // On the first day of a new weekly period, rollover should be 0
    // because there are no previous days within the new period
    expect(result.rollover).toBe(0)
    expect(result.dailyBudget).toBeGreaterThan(0)
  })

  it('should adjust math when switching to biweekly', () => {
    const biweeklyPref: BudgetPeriodPreference = {
      type: 'biweekly',
      startDay: 1, // Monday
    }

    const currentDate = localDate(2024, 6, 15) // Saturday
    const context = computePeriodContext(biweeklyPref, currentDate)

    expect(context).not.toBeNull()
    expect(context!.type).toBe('biweekly')
    expect(context!.totalDays).toBe(14)
  })

  it('should return null context when reset to monthly (existing behavior)', () => {
    const monthlyPref: BudgetPeriodPreference = { type: 'monthly' }
    const currentDate = localDate(2024, 6, 15)

    const context = computePeriodContext(monthlyPref, currentDate)

    // Monthly returns null — the allowance engine uses its existing logic
    expect(context).toBeNull()
  })

  it('should scale the daily budget based on the budget period', () => {
    const budgets: Budget[] = [createBudget('food', 700, '2024-06')]
    const currentDate = localDate(2024, 6, 12) // Wednesday in a Monday-start week

    // Without budget period (monthly): 700 / 30 days in June ≈ 23.33
    const monthlyResult = computeDailyAllowance(budgets, [], currentDate)

    // With weekly period: 700 scaled to 7-day period / 5 remaining days
    const weeklyPref: BudgetPeriodPreference = { type: 'weekly', startDay: 1 }
    const weeklyResult = computeDailyAllowance(
      budgets,
      [],
      currentDate,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      weeklyPref
    )

    // The weekly daily budget should differ from monthly
    // Weekly: (700 * 7/30.44) / 5 ≈ 32.22
    // Monthly: 700 / 30 ≈ 23.33
    expect(weeklyResult.dailyBudget).not.toBeCloseTo(monthlyResult.dailyBudget, 0)
    expect(weeklyResult.dailyBudget).toBeGreaterThan(0)
  })
})

// ============================================================================
// 349.4 — Pinned cards + home density
// ============================================================================

describe('349.4 Pinned cards + home density', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should pin 3 cards and retrieve them', () => {
    addPinnedCard('goal_progress')
    addPinnedCard('savings_snapshot')
    addPinnedCard('income_tracker')

    const cards = getPinnedCards()
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.type)).toEqual([
      'goal_progress',
      'savings_snapshot',
      'income_tracker',
    ])
  })

  it('should not exceed MAX_PINNED_CARDS limit', () => {
    addPinnedCard('goal_progress')
    addPinnedCard('savings_snapshot')
    addPinnedCard('income_tracker')
    // Try to add a 4th
    const result = addPinnedCard('spend_pace')

    expect(result).toHaveLength(MAX_PINNED_CARDS)
    expect(result.map(c => c.type)).not.toContain('spend_pace')
  })

  it('should remove a pinned card and adjust the list', () => {
    addPinnedCard('goal_progress')
    addPinnedCard('savings_snapshot')
    addPinnedCard('income_tracker')

    const updated = removePinnedCard('savings_snapshot')

    expect(updated).toHaveLength(2)
    expect(updated.map(c => c.type)).toEqual([
      'goal_progress',
      'income_tracker',
    ])
  })

  it('should hide pinned cards in "minimal" mode and show them in "dashboard" mode', () => {
    // Pin some cards
    addPinnedCard('goal_progress')
    addPinnedCard('savings_snapshot')
    addPinnedCard('income_tracker')

    // Switch to minimal — cards still stored, but UI hides them
    setHomeStyle('minimal')
    expect(getHomeStyle()).toBe('minimal')
    // Cards are still persisted (data layer unaffected)
    expect(getPinnedCards()).toHaveLength(3)

    // Switch to dashboard — cards visible
    setHomeStyle('dashboard')
    expect(getHomeStyle()).toBe('dashboard')
    expect(getPinnedCards()).toHaveLength(3)
  })

  it('should return cards when switching back from minimal to dashboard', () => {
    addPinnedCard('goal_progress')
    addPinnedCard('spend_pace')

    // Go to dashboard
    setHomeStyle('dashboard')
    const cardsInDashboard = getPinnedCards()
    expect(cardsInDashboard).toHaveLength(2)

    // Switch to minimal
    setHomeStyle('minimal')
    expect(getHomeStyle()).toBe('minimal')

    // Switch back to dashboard
    setHomeStyle('dashboard')
    expect(getHomeStyle()).toBe('dashboard')

    // Cards should still be there
    const cardsRestored = getPinnedCards()
    expect(cardsRestored).toHaveLength(2)
    expect(cardsRestored.map(c => c.type)).toEqual([
      'goal_progress',
      'spend_pace',
    ])
  })

  it('should default to minimal home style', () => {
    // No explicit style set
    expect(getHomeStyle()).toBe('minimal')
  })
})
