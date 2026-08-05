import { describe, it, expect } from 'vitest'
import { computeYearInReview, MIN_TRANSACTIONS_FOR_RECAP } from './yearInReview'
import type { Transaction, Budget, TransactionCategory } from '@/types'

// ── Test fixtures ─────────────────────────────────────────────────────────────

let idCounter = 0
function tx(
  date: string,
  amount: number,
  type: 'income' | 'expense',
  category: TransactionCategory = type === 'income' ? 'income' : 'food'
): Transaction {
  return {
    id: `tx-${idCounter++}`,
    userId: 'u1',
    date,
    amount,
    type,
    category,
    accountType: 'personal',
    createdAt: `${date}T12:00:00`,
  }
}

function budget(category: TransactionCategory, monthlyLimit: number): Budget {
  return {
    id: `b-${category}`,
    userId: 'u1',
    category,
    monthlyLimit,
    spent: 0,
    month: '2024-01',
  }
}

/** Build enough in-year transactions to clear the recap threshold. */
function fillToThreshold(year: number): Transaction[] {
  const out: Transaction[] = []
  for (let i = 0; i < MIN_TRANSACTIONS_FOR_RECAP; i++) {
    const day = String((i % 27) + 1).padStart(2, '0')
    out.push(tx(`${year}-06-${day}`, 5, 'expense'))
  }
  return out
}

describe('computeYearInReview', () => {
  describe('data sufficiency', () => {
    it('reports hasEnoughData=false below the threshold', () => {
      const result = computeYearInReview([tx('2024-03-01', 10, 'expense')], [], 2024)
      expect(result.hasEnoughData).toBe(false)
      expect(result.transactionCount).toBe(1)
    })

    it('reports hasEnoughData=true at the threshold', () => {
      const result = computeYearInReview(fillToThreshold(2024), [], 2024)
      expect(result.hasEnoughData).toBe(true)
      expect(result.transactionCount).toBe(MIN_TRANSACTIONS_FOR_RECAP)
    })
  })

  describe('year filtering', () => {
    it('ignores transactions from other years', () => {
      const txs = [
        tx('2023-12-31', 100, 'expense'),
        tx('2024-01-01', 20, 'expense'),
        tx('2025-01-01', 100, 'expense'),
      ]
      const result = computeYearInReview(txs, [], 2024)
      expect(result.transactionCount).toBe(1)
      expect(result.topCategory?.total).toBe(20)
    })
  })

  describe('top category', () => {
    it('picks the category with the most expense spend', () => {
      const txs = [
        tx('2024-02-01', 300, 'expense', 'rent'),
        tx('2024-02-02', 50, 'expense', 'food'),
        tx('2024-02-03', 40, 'expense', 'food'),
        ...fillToThreshold(2024),
      ]
      const result = computeYearInReview(txs, [], 2024)
      // rent (300) beats food (90 + threshold fills of 5 each = 90 + 50 = 140)
      expect(result.topCategory?.category).toBe('rent')
      expect(result.topCategory?.total).toBe(300)
    })

    it('is null when there are no expenses', () => {
      const txs = [tx('2024-05-01', 1000, 'income')]
      const result = computeYearInReview(txs, [], 2024)
      expect(result.topCategory).toBeNull()
    })
  })

  describe('most-saved month', () => {
    it('picks the month with the highest net savings', () => {
      const txs = [
        // March: +800 income, -100 expense = 700 saved
        tx('2024-03-01', 800, 'income'),
        tx('2024-03-05', 100, 'expense'),
        // July: +500 income, -450 expense = 50 saved
        tx('2024-07-01', 500, 'income'),
        tx('2024-07-05', 450, 'expense'),
        ...fillToThreshold(2024),
      ]
      const result = computeYearInReview(txs, [], 2024)
      expect(result.mostSavedMonth?.month).toBe(2) // March (0-indexed)
      expect(result.mostSavedMonth?.monthLabel).toBe('March')
      expect(result.mostSavedMonth?.saved).toBe(700)
    })

    it('is null when no month is net-positive', () => {
      const txs = fillToThreshold(2024) // only expenses
      const result = computeYearInReview(txs, [], 2024)
      expect(result.mostSavedMonth).toBeNull()
    })
  })

  describe('best streak', () => {
    it('counts consecutive no-spend days when no budget is set', () => {
      // Spend on Jan 1 and Jan 5; days 2,3,4 are no-spend → streak of 3.
      const txs = [
        tx('2024-01-01', 10, 'expense'),
        tx('2024-01-05', 10, 'expense'),
        ...fillToThreshold(2024),
      ]
      const result = computeYearInReview(txs, [], 2024, '2024-01-31')
      expect(result.bestStreak).toBeGreaterThanOrEqual(3)
    })

    it('counts under-budget days against the daily budget', () => {
      // $310/mo over 31 days = $10/day. Spend $5 on days 1-4 (under), $50 on day 5 (over).
      const txs = [
        tx('2024-01-01', 5, 'expense'),
        tx('2024-01-02', 5, 'expense'),
        tx('2024-01-03', 5, 'expense'),
        tx('2024-01-04', 5, 'expense'),
        tx('2024-01-05', 50, 'expense'),
        ...fillToThreshold(2024),
      ]
      const result = computeYearInReview(txs, [budget('food', 310)], 2024, '2024-01-05')
      // Days 1-4 under budget = streak of 4; day 5 breaks it.
      expect(result.bestStreak).toBe(4)
    })
  })

  describe('biggest win', () => {
    it('headlines a notable streak when present', () => {
      const txs: Transaction[] = []
      // 10 consecutive no-spend-free... actually build a 10-day under-budget run.
      for (let d = 1; d <= 10; d++) {
        txs.push(tx(`2024-01-${String(d).padStart(2, '0')}`, 1, 'expense'))
      }
      const result = computeYearInReview(txs, [budget('food', 3100)], 2024, '2024-01-10')
      expect(result.biggestWin.kind).toBe('streak')
    })

    it('falls back to "showed up" when nothing stands out', () => {
      // Enough transactions, no budget, spending every consecutive day (no streak),
      // and net-negative so no "saved" or "month" win.
      const txs: Transaction[] = []
      for (let i = 0; i < MIN_TRANSACTIONS_FOR_RECAP; i++) {
        const day = String(i + 1).padStart(2, '0')
        txs.push(tx(`2024-08-${day}`, 10, 'expense'))
      }
      const result = computeYearInReview(txs, [], 2024, '2024-08-15')
      // Every day 1..N has spend → no no-spend streak; net negative → showed_up.
      expect(result.biggestWin.kind).toBe('showed_up')
    })
  })

  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const txs = [
        tx('2024-03-01', 800, 'income'),
        tx('2024-03-05', 100, 'expense', 'rent'),
        ...fillToThreshold(2024),
      ]
      const a = computeYearInReview(txs, [budget('food', 300)], 2024)
      const b = computeYearInReview(txs, [budget('food', 300)], 2024)
      expect(a).toEqual(b)
    })
  })

  describe('totalSaved', () => {
    it('computes net income minus expense across the year', () => {
      const txs = [
        tx('2024-01-01', 1000, 'income'),
        tx('2024-06-01', 200, 'expense'),
        ...fillToThreshold(2024), // + 10 * $5 = $50 expense
      ]
      const result = computeYearInReview(txs, [], 2024)
      expect(result.totalSaved).toBe(1000 - 200 - 50)
    })
  })
})
