import { describe, it, expect } from 'vitest'
import { computeDailyAllowance } from './dailyAllowanceUtils'
import type { Budget, Transaction } from '@/types'

describe('computeDailyAllowance', () => {
  const createBudget = (category: string, monthlyLimit: number): Budget => ({
    id: `budget-${category}`,
    userId: 'user-1',
    category: category as any,
    monthlyLimit,
    spent: 0,
    month: '2024-01'
  })

  const createTransaction = (date: string, amount: number, type: 'income' | 'expense' = 'expense'): Transaction => ({
    id: `tx-${date}-${amount}`,
    userId: 'user-1',
    date,
    amount,
    type,
    category: 'food',
    accountType: 'personal',
    createdAt: new Date().toISOString()
  })

  // Helper: create a local-time Date to avoid UTC timezone issues.
  // new Date('2024-01-15') creates UTC midnight which may shift to the previous
  // day in negative-offset timezones. Using (year, month-1, day) creates local midnight.
  const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day)

  it('should calculate daily budget as totalMonthlyBudget / daysInMonth', () => {
    const budgets: Budget[] = [
      createBudget('food', 300),
      createBudget('transport', 100)
    ]
    const transactions: Transaction[] = []
    const currentDate = localDate(2024, 1, 15) // 31 days in January

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.dailyBudget).toBe(400 / 31) // ~12.90
  })

  it('should calculate spentToday from current date expense transactions', () => {
    const budgets: Budget[] = [createBudget('food', 300)]
    const transactions: Transaction[] = [
      createTransaction('2024-01-15', 10),
      createTransaction('2024-01-15', 5),
      createTransaction('2024-01-14', 20), // yesterday, should not count
      createTransaction('2024-01-15', 15, 'income') // income, should not count
    ]
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.spentToday).toBe(15) // 10 + 5
  })

  it('should calculate positive rollover when under budget in previous days', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // Days 1-5: spent 5 per day instead of 10
      createTransaction('2024-01-01', 5),
      createTransaction('2024-01-02', 5),
      createTransaction('2024-01-03', 5),
      createTransaction('2024-01-04', 5),
      createTransaction('2024-01-05', 5)
    ]
    const currentDate = localDate(2024, 1, 6) // Day 6

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // Expected: 5 days * 10 = 50, Actual: 25, Raw Rollover: 50 - 25 = 25
    // But capped to maxRollover = 10 * 2 = 20
    expect(result.rollover).toBeCloseTo(20, 1)
  })

  it('should calculate negative rollover when over budget in previous days', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // Days 1-5: spent 15 per day instead of 10
      createTransaction('2024-01-01', 15),
      createTransaction('2024-01-02', 15),
      createTransaction('2024-01-03', 15),
      createTransaction('2024-01-04', 15),
      createTransaction('2024-01-05', 15)
    ]
    const currentDate = localDate(2024, 1, 6) // Day 6

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // Expected: 5 days * 10 = 50, Actual: 75, Raw Rollover: 50 - 75 = -25
    // But capped to maxRollover = -(10 * 2) = -20
    expect(result.rollover).toBeCloseTo(-20, 1)
  })

  it('should cap rollover to ±2 days budget', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // Days 1-10: spent 0, should save 100 but cap at 20 (2 days)
      ...Array.from({ length: 10 }, (_, i) => createTransaction(`2024-01-${String(i + 1).padStart(2, '0')}`, 0))
    ]
    const currentDate = localDate(2024, 1, 11) // Day 11

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // Max rollover = 10 * 2 = 20
    expect(result.rollover).toBeCloseTo(20, 1)
  })

  it('should ensure amount is always >= 0', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      createTransaction('2024-01-15', 100) // way over budget today
    ]
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.amount).toBeGreaterThanOrEqual(0)
  })

  it('should return status "healthy" when >50% remaining', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      createTransaction('2024-01-15', 3) // spent 3 out of 10
    ]
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.status).toBe('healthy')
  })

  it('should return status "caution" when 25-50% remaining', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // On day 1, spend 6 out of 10, leaving 4 (40% remaining)
      createTransaction('2024-01-01', 6)
    ]
    const currentDate = localDate(2024, 1, 1)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // amount = 10 - 6 = 4, which is 40% of dailyBudget
    expect(result.status).toBe('caution')
  })

  it('should return status "warning" when 0-25% remaining', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // On day 1, spend 8 out of 10, leaving 2 (20% remaining)
      createTransaction('2024-01-01', 8)
    ]
    const currentDate = localDate(2024, 1, 1)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // amount = 10 - 8 = 2, which is 20% of dailyBudget
    expect(result.status).toBe('warning')
  })

  it('should return status "over" when overspent', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // On day 1, spend 12 out of 10 (overspent)
      createTransaction('2024-01-01', 12)
    ]
    const currentDate = localDate(2024, 1, 1)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // amount = max(0, 10 - 12) = 0, which is 0% (negative before max)
    expect(result.status).toBe('over')
  })

  it('should return encouraging message based on status', () => {
    const budgets: Budget[] = [createBudget('food', 310)]
    const transactions: Transaction[] = []
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.message).toBeTruthy()
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('should handle empty budgets array', () => {
    const budgets: Budget[] = []
    const transactions: Transaction[] = []
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    // Task 66: With no budgets, no transactions, and no income estimate,
    // the system now provides a sensible fallback ($1500/30 = $50/day)
    // so brand-new users always see a useful number.
    expect(result.dailyBudget).toBe(50)
    // amount = dailyBudget + rollover - spentToday
    // On Jan 15: rawRollover = 50*14 = 700, capped at ±2 days = 100
    // amount = 50 + 100 - 0 = 150
    expect(result.amount).toBe(150)
    expect(result.isEstimated).toBe(true)
  })

  it('should handle empty transactions array', () => {
    const budgets: Budget[] = [createBudget('food', 310)]
    const transactions: Transaction[] = []
    const currentDate = localDate(2024, 1, 15)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.spentToday).toBe(0)
    expect(result.amount).toBeGreaterThan(0)
  })

  it('should handle first day of month (no rollover calculation)', () => {
    const budgets: Budget[] = [createBudget('food', 310)]
    const transactions: Transaction[] = []
    const currentDate = localDate(2024, 1, 1)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    expect(result.rollover).toBe(0) // No previous days
    expect(result.amount).toBeCloseTo(310 / 31, 1)
  })

  it('should calculate amount as dailyBudget + rollover - spentToday', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // Day 1-4: spent 5 each (saved 20 total)
      createTransaction('2024-01-01', 5),
      createTransaction('2024-01-02', 5),
      createTransaction('2024-01-03', 5),
      createTransaction('2024-01-04', 5),
      // Day 5: spent 3 so far
      createTransaction('2024-01-05', 3)
    ]
    const currentDate = localDate(2024, 1, 5)

    const result = computeDailyAllowance(budgets, transactions, currentDate)

    const dailyBudget = 310 / 31 // ~10
    const rollover = 20 // saved 5*4 days, capped at ±2 days budget = 20
    const spentToday = 3
    const expectedAmount = dailyBudget + rollover - spentToday

    expect(result.amount).toBeCloseTo(expectedAmount, 1)
  })
})
