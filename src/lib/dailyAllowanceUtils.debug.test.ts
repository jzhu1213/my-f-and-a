import { describe, it, expect } from 'vitest'
import { computeDailyAllowance } from './dailyAllowanceUtils'
import type { Budget, Transaction } from '@/types'

describe('debug date filtering', () => {
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

  it('should show rollover calculation details', () => {
    const budgets: Budget[] = [createBudget('food', 310)] // 310/31 = 10 per day
    const transactions: Transaction[] = [
      // Days 1-5: spent 5 per day instead of 10
      createTransaction('2024-01-01', 5),
      createTransaction('2024-01-02', 5),
      createTransaction('2024-01-03', 5),
      createTransaction('2024-01-04', 5),
      createTransaction('2024-01-05', 5)
    ]
    const currentDate = new Date('2024-01-06') // Day 6

    const dailyBudget = 310 / 31
    const dayOfMonth = currentDate.getUTCDate()
    const expected = dailyBudget * (dayOfMonth - 1) // 5 days * 10 = 50
    
    // Simulate the filter logic
    const monthStart = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1))
    const yesterday = new Date(currentDate.getTime())
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    
    const startDate = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}-${String(monthStart.getUTCDate()).padStart(2, '0')}`
    const endDate = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`
    
    console.log('Current date:', currentDate.toISOString())
    console.log('Day of month:', dayOfMonth)
    console.log('Month start:', monthStart.toISOString(), '→', startDate)
    console.log('Yesterday:', yesterday.toISOString(), '→', endDate)
    console.log('Expected spend (days 1-5):', expected)
    console.log('Transactions:')
    transactions.forEach(t => {
      const matches = t.date >= startDate && t.date <= endDate && t.type === 'expense'
      console.log(`  ${t.date}: ${t.amount}, matches=${matches}`)
    })
    
    const result = computeDailyAllowance(budgets, transactions, currentDate)
    
    console.log('Rollover:', result.rollover)
    console.log('Expected rollover:', expected - 25)
    
    expect(result.rollover).toBeCloseTo(25, 1)
  })
})
