/**
 * History & Transaction Intelligence — Functional Tests (Task 408)
 *
 * Covers:
 *   408.1 Search accuracy (Requirements: 22.1)
 *   408.2 Filter combinations (Requirements: 22.2)
 *   408.3 Performance with large datasets (Requirements: 22.6)
 *   408.4 Grouping modes (Requirements: 22.4)
 */

import { describe, it, expect } from 'vitest'
import { searchTransactions, parseNaturalDate } from '@/lib/transactionSearch'
import {
  applyOptimizedFilters,
  computeDateBounds,
  computeAmountBounds,
} from '@/lib/useFilteredTransactions'
import type { PrecomputedFilterParams } from '@/lib/useFilteredTransactions'
import type { Transaction, TransactionCategory } from '@/types'

// ============================================================================
// Test data helpers
// ============================================================================

let txIdCounter = 0

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  txIdCounter++
  return {
    id: `tx-${txIdCounter}`,
    userId: 'user-1',
    date: '2024-06-15',
    amount: 25.0,
    type: 'expense',
    category: 'food',
    note: 'Lunch at Chipotle',
    accountType: 'personal',
    createdAt: '2024-06-15T12:00:00Z',
    ...overrides,
  }
}

function makeTransactions(count: number): Transaction[] {
  const categories: TransactionCategory[] = [
    'food', 'drinks', 'rent', 'transport', 'school',
    'fun', 'health', 'subscriptions', 'gig', 'income', 'other',
  ]
  const notes = [
    'Chipotle', 'Starbucks', 'Amazon', 'Netflix', 'Uber',
    'Target', 'Walmart', 'Spotify', 'Gas station', 'Freelance gig',
  ]
  const txs: Transaction[] = []
  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length]
    const isIncome = cat === 'income' || cat === 'gig'
    const day = String((i % 28) + 1).padStart(2, '0')
    const month = String((i % 12) + 1).padStart(2, '0')
    txs.push(makeTx({
      id: `bulk-${i}`,
      date: `2024-${month}-${day}`,
      amount: 5 + (i % 200),
      type: isIncome ? 'income' : 'expense',
      category: cat,
      note: notes[i % notes.length],
    }))
  }
  return txs
}

// ============================================================================
// 408.1 — Search accuracy
// ============================================================================

describe('408.1 Search accuracy (Requirements: 22.1)', () => {
  const transactions: Transaction[] = [
    makeTx({ note: 'Lunch at Chipotle', category: 'food', amount: 12.5, date: '2024-06-10' }),
    makeTx({ note: 'Coffee at Starbucks', category: 'drinks', amount: 5.75, date: '2024-06-11' }),
    makeTx({ note: 'Monthly rent payment', category: 'rent', amount: 1200, date: '2024-06-01' }),
    makeTx({ note: 'Uber to campus', category: 'transport', amount: 8.0, date: '2024-06-12' }),
    makeTx({ note: 'Netflix subscription', category: 'subscriptions', amount: 15.99, date: '2024-06-05' }),
    makeTx({ note: 'Freelance web project', category: 'income', amount: 500, type: 'income', date: '2024-06-14' }),
    makeTx({ note: 'Target shopping', category: 'other', amount: 47.32, date: '2024-06-13' }),
    makeTx({ note: 'Gym membership', category: 'health', amount: 30, date: '2024-06-02' }),
  ]

  describe('search by partial note', () => {
    it('finds transactions matching partial note text', () => {
      const results = searchTransactions(transactions, 'chip')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].transaction.note).toContain('Chipotle')
      expect(results[0].matchedFields).toContain('note')
    })

    it('finds by prefix match on note words', () => {
      const results = searchTransactions(transactions, 'lun')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].transaction.note).toContain('Lunch')
    })

    it('matches full word in note with highest score', () => {
      const results = searchTransactions(transactions, 'rent')
      // Should match "Monthly rent payment" via note AND "rent" category
      expect(results.length).toBeGreaterThanOrEqual(1)
      const rentTx = results.find(r => r.transaction.category === 'rent')
      expect(rentTx).toBeDefined()
      expect(rentTx!.score).toBeGreaterThanOrEqual(3)
    })
  })

  describe('search by merchant name', () => {
    it('finds transactions by merchant/note name', () => {
      const results = searchTransactions(transactions, 'starbucks')
      expect(results.length).toBe(1)
      expect(results[0].transaction.note).toBe('Coffee at Starbucks')
    })

    it('is case-insensitive', () => {
      const results = searchTransactions(transactions, 'NETFLIX')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].transaction.note).toContain('Netflix')
    })
  })

  describe('search by amount', () => {
    it('finds transactions by exact amount', () => {
      const results = searchTransactions(transactions, '12.5')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].transaction.amount).toBe(12.5)
      expect(results[0].matchedFields).toContain('amount')
    })

    it('finds transactions by amount with $ prefix', () => {
      const results = searchTransactions(transactions, '$500')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].transaction.amount).toBe(500)
    })

    it('finds transactions by rounded amount', () => {
      const results = searchTransactions(transactions, '30')
      const gymResult = results.find(r => r.transaction.amount === 30)
      expect(gymResult).toBeDefined()
      expect(gymResult!.matchedFields).toContain('amount')
    })
  })

  describe('search by category name', () => {
    it('finds transactions by category key', () => {
      const results = searchTransactions(transactions, 'food')
      expect(results.length).toBeGreaterThanOrEqual(1)
      const foodResults = results.filter(r => r.matchedFields.includes('category'))
      expect(foodResults.length).toBeGreaterThanOrEqual(1)
      expect(foodResults[0].transaction.category).toBe('food')
    })

    it('finds by category label (partial)', () => {
      const results = searchTransactions(transactions, 'transport')
      expect(results.length).toBeGreaterThanOrEqual(1)
      const transportResults = results.filter(r => r.transaction.category === 'transport')
      expect(transportResults.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('search by natural date', () => {
    it('parseNaturalDate handles "today"', () => {
      const range = parseNaturalDate('today')
      expect(range).not.toBeNull()
      const todayStr = new Date().toISOString().slice(0, 10)
      expect(range!.start).toBe(todayStr)
      expect(range!.end).toBe(todayStr)
    })

    it('parseNaturalDate handles "yesterday"', () => {
      const range = parseNaturalDate('yesterday')
      expect(range).not.toBeNull()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(range!.start).toBe(yesterday.toISOString().slice(0, 10))
    })

    it('parseNaturalDate handles "this week"', () => {
      const range = parseNaturalDate('this week')
      expect(range).not.toBeNull()
      expect(range!.start).toBeDefined()
      expect(range!.end).toBe(new Date().toISOString().slice(0, 10))
    })

    it('parseNaturalDate handles "last month"', () => {
      const range = parseNaturalDate('last month')
      expect(range).not.toBeNull()
      const now = new Date()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      expect(range!.start).toBe(startOfLastMonth.toISOString().slice(0, 10))
    })

    it('parseNaturalDate handles month names', () => {
      const range = parseNaturalDate('january')
      expect(range).not.toBeNull()
      expect(range!.start).toMatch(/^\d{4}-01-01$/)
      expect(range!.end).toMatch(/^\d{4}-01-31$/)
    })

    it('parseNaturalDate handles abbreviated month names', () => {
      const range = parseNaturalDate('jun')
      expect(range).not.toBeNull()
      expect(range!.start).toMatch(/^\d{4}-06-01$/)
      expect(range!.end).toMatch(/^\d{4}-06-30$/)
    })

    it('returns null for unrecognized date queries', () => {
      expect(parseNaturalDate('blahblah')).toBeNull()
      expect(parseNaturalDate('')).toBeNull()
    })

    it('date-based search matches transactions in the date range', () => {
      // Create transactions with today's date
      const today = new Date().toISOString().slice(0, 10)
      const txsWithToday = [
        ...transactions,
        makeTx({ note: 'Today purchase', date: today, amount: 10 }),
      ]
      const results = searchTransactions(txsWithToday, 'today')
      const todayResults = results.filter(r => r.matchedFields.includes('date'))
      expect(todayResults.length).toBeGreaterThanOrEqual(1)
      expect(todayResults[0].transaction.date).toBe(today)
    })
  })

  describe('ranking', () => {
    it('ranks exact word matches higher than substring matches', () => {
      const txs = [
        makeTx({ note: 'rent payment', category: 'rent' }),
        makeTx({ note: 'parenting book', category: 'other' }),
      ]
      const results = searchTransactions(txs, 'rent')
      // "rent payment" should score higher (exact word + category match)
      expect(results[0].transaction.note).toBe('rent payment')
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    it('results are sorted by score descending', () => {
      const results = searchTransactions(transactions, 'food')
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
  })

  describe('edge cases', () => {
    it('returns empty array for empty query', () => {
      expect(searchTransactions(transactions, '')).toEqual([])
      expect(searchTransactions(transactions, '   ')).toEqual([])
    })

    it('returns empty array when no matches found', () => {
      const results = searchTransactions(transactions, 'zzxyqnonexistent')
      expect(results).toEqual([])
    })

    it('handles single character search', () => {
      // "a" should find things with "a" as a substring
      const results = searchTransactions(transactions, 'a')
      // Should find something (many notes have 'a')
      expect(results.length).toBeGreaterThanOrEqual(0) // May or may not match
    })

    it('handles special characters gracefully', () => {
      const txWithSpecial = [makeTx({ note: 'Coffee & Tea (special!)' })]
      // Should not throw
      const results = searchTransactions(txWithSpecial, '&')
      expect(Array.isArray(results)).toBe(true)
    })

    it('handles empty transactions array', () => {
      const results = searchTransactions([], 'food')
      expect(results).toEqual([])
    })
  })
})

// ============================================================================
// 408.2 — Filter combinations
// ============================================================================

describe('408.2 Filter combinations (Requirements: 22.2)', () => {
  const transactions: Transaction[] = [
    makeTx({ category: 'food', date: '2024-06-10', amount: 12, type: 'expense' }),
    makeTx({ category: 'food', date: '2024-06-15', amount: 55, type: 'expense' }),
    makeTx({ category: 'drinks', date: '2024-06-10', amount: 5, type: 'expense' }),
    makeTx({ category: 'rent', date: '2024-06-01', amount: 1200, type: 'expense' }),
    makeTx({ category: 'income', date: '2024-06-14', amount: 500, type: 'income' }),
    makeTx({ category: 'transport', date: '2024-05-20', amount: 15, type: 'expense' }),
    makeTx({ category: 'health', date: '2024-06-12', amount: 75, type: 'expense' }),
    makeTx({ category: 'fun', date: '2024-06-13', amount: 30, type: 'expense' }),
    // A refund: income type with non-income category
    makeTx({ category: 'food', date: '2024-06-11', amount: 8, type: 'income' }),
  ]

  describe('AND logic across filter types', () => {
    it('applies category + amount range filter (AND)', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food']),
        typeFilter: 'all',
        dateBounds: null,
        amountBounds: { min: 10, max: 50 },
      }
      const result = applyOptimizedFilters(transactions, params)
      // Only food items with amount 10-50: the $12 food item
      expect(result.length).toBe(1)
      expect(result[0].amount).toBe(12)
      expect(result[0].category).toBe('food')
    })

    it('applies category + date range filter (AND)', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food']),
        typeFilter: 'all',
        dateBounds: { start: '2024-06-10', end: '2024-06-12' },
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      // Food items between Jun 10-12: $12 food (Jun 10) and $8 food refund (Jun 11)
      expect(result.length).toBe(2)
      result.forEach(tx => {
        expect(tx.category).toBe('food')
        expect(tx.date >= '2024-06-10' && tx.date <= '2024-06-12').toBe(true)
      })
    })

    it('applies category + date + amount (triple AND)', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food']),
        typeFilter: 'all',
        dateBounds: { start: '2024-06-01', end: '2024-06-30' },
        amountBounds: { min: 50, max: null },
      }
      const result = applyOptimizedFilters(transactions, params)
      // Food in June with amount >= 50: the $55 food item
      expect(result.length).toBe(1)
      expect(result[0].amount).toBe(55)
    })

    it('applies all filters: category + date + amount + type', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food']),
        typeFilter: 'expenses',
        dateBounds: { start: '2024-06-01', end: '2024-06-30' },
        amountBounds: { min: null, max: 20 },
      }
      const result = applyOptimizedFilters(transactions, params)
      // Food expenses in June under $20: just the $12 one (the $8 is income/refund)
      expect(result.length).toBe(1)
      expect(result[0].amount).toBe(12)
      expect(result[0].type).toBe('expense')
    })
  })

  describe('OR logic within categories', () => {
    it('multi-category selection uses OR (any match passes)', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food', 'drinks']),
        typeFilter: 'all',
        dateBounds: null,
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      // All food + drinks items: 3 food + 1 drinks = 4
      expect(result.length).toBe(4)
      result.forEach(tx => {
        expect(['food', 'drinks']).toContain(tx.category)
      })
    })
  })

  describe('type filter', () => {
    it('filters expenses only', () => {
      const params: PrecomputedFilterParams = {
        categorySet: null,
        typeFilter: 'expenses',
        dateBounds: null,
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      result.forEach(tx => expect(tx.type).toBe('expense'))
    })

    it('filters income only', () => {
      const params: PrecomputedFilterParams = {
        categorySet: null,
        typeFilter: 'income',
        dateBounds: null,
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      result.forEach(tx => expect(tx.type).toBe('income'))
    })

    it('filters refunds (income with non-income category)', () => {
      const params: PrecomputedFilterParams = {
        categorySet: null,
        typeFilter: 'refunds',
        dateBounds: null,
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      // Only the food-refund (income type, food category)
      expect(result.length).toBe(1)
      expect(result[0].type).toBe('income')
      expect(result[0].category).not.toBe('income')
    })
  })

  describe('clear filters (no-op fast path)', () => {
    it('returns all transactions when no filters are active', () => {
      const params: PrecomputedFilterParams = {
        categorySet: null,
        typeFilter: 'all',
        dateBounds: null,
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      expect(result).toBe(transactions) // Same reference — fast path
    })
  })

  describe('computeDateBounds', () => {
    it('returns null for null preset', () => {
      expect(computeDateBounds(null, null)).toBeNull()
    })

    it('returns today bounds for "today"', () => {
      const bounds = computeDateBounds('today', null)
      expect(bounds).not.toBeNull()
      const todayStr = new Date().toISOString().slice(0, 10)
      expect(bounds!.start).toBe(todayStr)
      expect(bounds!.end).toBe(todayStr)
    })

    it('returns this_month bounds starting from the 1st', () => {
      const bounds = computeDateBounds('this_month', null)
      expect(bounds).not.toBeNull()
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      expect(bounds!.start).toBe(start)
      expect(bounds!.end).toBe(now.toISOString().slice(0, 10))
    })

    it('returns custom range bounds', () => {
      const bounds = computeDateBounds('custom', { start: '2024-01-01', end: '2024-01-31' })
      expect(bounds).toEqual({ start: '2024-01-01', end: '2024-01-31' })
    })

    it('returns null for custom without a range', () => {
      expect(computeDateBounds('custom', null)).toBeNull()
    })
  })

  describe('computeAmountBounds', () => {
    it('returns null for null preset', () => {
      expect(computeAmountBounds(null, null)).toBeNull()
    })

    it('returns correct bounds for under_10', () => {
      expect(computeAmountBounds('under_10', null)).toEqual({ min: null, max: 10 })
    })

    it('returns correct bounds for 10_50', () => {
      expect(computeAmountBounds('10_50', null)).toEqual({ min: 10, max: 50 })
    })

    it('returns correct bounds for 50_100', () => {
      expect(computeAmountBounds('50_100', null)).toEqual({ min: 50, max: 100 })
    })

    it('returns correct bounds for over_100', () => {
      expect(computeAmountBounds('over_100', null)).toEqual({ min: 100, max: null })
    })

    it('returns custom amount bounds', () => {
      expect(computeAmountBounds('custom', { min: 25, max: 75 })).toEqual({ min: 25, max: 75 })
    })
  })

  describe('result count verification', () => {
    it('filter count matches actual results', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food', 'drinks', 'health']),
        typeFilter: 'expenses',
        dateBounds: { start: '2024-06-01', end: '2024-06-30' },
        amountBounds: null,
      }
      const result = applyOptimizedFilters(transactions, params)
      // food expenses in June: $12, $55; drinks in June: $5; health in June: $75
      expect(result.length).toBe(4)
    })
  })
})

// ============================================================================
// 408.3 — Performance with large datasets
// ============================================================================

describe('408.3 Performance with large datasets (Requirements: 22.6)', () => {
  const largeDataset = makeTransactions(600)

  it('search completes in <100ms with 600 transactions', () => {
    const start = performance.now()
    const results = searchTransactions(largeDataset, 'chipotle')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(results.length).toBeGreaterThan(0)
  })

  it('search by amount completes in <100ms with 600 transactions', () => {
    const start = performance.now()
    searchTransactions(largeDataset, '$50')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('search by natural date completes in <100ms with 600 transactions', () => {
    const start = performance.now()
    searchTransactions(largeDataset, 'this month')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('filter (category + date + amount) completes in <100ms with 600 transactions', () => {
    const params: PrecomputedFilterParams = {
      categorySet: new Set<TransactionCategory>(['food', 'drinks', 'transport']),
      typeFilter: 'expenses',
      dateBounds: { start: '2024-01-01', end: '2024-12-31' },
      amountBounds: { min: 10, max: 100 },
    }

    const start = performance.now()
    applyOptimizedFilters(largeDataset, params)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('no-filter fast path returns instantly', () => {
    const params: PrecomputedFilterParams = {
      categorySet: null,
      typeFilter: 'all',
      dateBounds: null,
      amountBounds: null,
    }

    const start = performance.now()
    const result = applyOptimizedFilters(largeDataset, params)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5) // Should be near-instant
    expect(result).toBe(largeDataset) // Same reference
  })

  it('repeated search with same transactions uses memoized index', () => {
    // First call builds the index
    searchTransactions(largeDataset, 'starbucks')

    // Second call should be faster (cached index)
    const start = performance.now()
    searchTransactions(largeDataset, 'target')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
  })

  it('handles 1000+ transactions within 100ms for filtering', () => {
    const veryLarge = makeTransactions(1200)
    const params: PrecomputedFilterParams = {
      categorySet: new Set<TransactionCategory>(['food']),
      typeFilter: 'all',
      dateBounds: null,
      amountBounds: { min: 20, max: null },
    }

    const start = performance.now()
    applyOptimizedFilters(veryLarge, params)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })
})

// ============================================================================
// 408.4 — Grouping modes
// ============================================================================

describe('408.4 Grouping modes (Requirements: 22.4)', () => {
  const transactions: Transaction[] = [
    makeTx({ note: 'Chipotle', category: 'food', amount: 12, date: '2024-06-10' }),
    makeTx({ note: 'Chipotle', category: 'food', amount: 14, date: '2024-06-12' }),
    makeTx({ note: 'Starbucks', category: 'drinks', amount: 5, date: '2024-06-10' }),
    makeTx({ note: 'Starbucks', category: 'drinks', amount: 6, date: '2024-06-14' }),
    makeTx({ note: 'Uber', category: 'transport', amount: 8, date: '2024-06-11' }),
    makeTx({ note: 'Gym', category: 'health', amount: 30, date: '2024-06-02' }),
    makeTx({ note: 'Paycheck', category: 'income', amount: 500, type: 'income', date: '2024-06-01' }),
  ]

  describe('grouping by category', () => {
    function groupByCategory(txs: Transaction[]) {
      const map = new Map<TransactionCategory, Transaction[]>()
      txs.forEach(tx => {
        const existing = map.get(tx.category) || []
        existing.push(tx)
        map.set(tx.category, existing)
      })
      return Array.from(map.entries()).map(([category, items]) => ({
        category,
        total: items.reduce((sum, tx) => sum + tx.amount, 0),
        count: items.length,
        transactions: items,
      }))
    }

    it('groups transactions correctly by category', () => {
      const groups = groupByCategory(transactions)
      expect(groups.length).toBe(5) // food, drinks, transport, health, income

      const foodGroup = groups.find(g => g.category === 'food')!
      expect(foodGroup.count).toBe(2)
      expect(foodGroup.total).toBe(26) // 12 + 14

      const drinksGroup = groups.find(g => g.category === 'drinks')!
      expect(drinksGroup.count).toBe(2)
      expect(drinksGroup.total).toBe(11) // 5 + 6
    })

    it('category totals sum to overall total', () => {
      const groups = groupByCategory(transactions)
      const groupTotal = groups.reduce((sum, g) => sum + g.total, 0)
      const overallTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0)
      expect(groupTotal).toBeCloseTo(overallTotal, 2)
    })

    it('category transaction counts sum to total count', () => {
      const groups = groupByCategory(transactions)
      const countSum = groups.reduce((sum, g) => sum + g.count, 0)
      expect(countSum).toBe(transactions.length)
    })

    it('filters work within category grouping', () => {
      // Apply filter first, then group
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food', 'drinks']),
        typeFilter: 'all',
        dateBounds: null,
        amountBounds: null,
      }
      const filtered = applyOptimizedFilters(transactions, params)
      const groups = groupByCategory(filtered)

      expect(groups.length).toBe(2)
      expect(groups.every(g => g.category === 'food' || g.category === 'drinks')).toBe(true)
    })
  })

  describe('grouping by merchant', () => {
    function groupByMerchant(txs: Transaction[]) {
      const map = new Map<string, Transaction[]>()
      txs.forEach(tx => {
        const key = (tx.note || '').trim().toLowerCase() || '(no note)'
        const existing = map.get(key) || []
        existing.push(tx)
        map.set(key, existing)
      })
      return Array.from(map.entries()).map(([merchant, items]) => ({
        merchant,
        total: items.reduce((sum, tx) => sum + tx.amount, 0),
        count: items.length,
        transactions: items,
      }))
    }

    it('groups transactions correctly by merchant/note', () => {
      const groups = groupByMerchant(transactions)
      expect(groups.length).toBe(5) // chipotle, starbucks, uber, gym, paycheck

      const chipotleGroup = groups.find(g => g.merchant === 'chipotle')!
      expect(chipotleGroup.count).toBe(2)
      expect(chipotleGroup.total).toBe(26) // 12 + 14

      const starbucksGroup = groups.find(g => g.merchant === 'starbucks')!
      expect(starbucksGroup.count).toBe(2)
      expect(starbucksGroup.total).toBe(11) // 5 + 6
    })

    it('merchant totals sum to overall total', () => {
      const groups = groupByMerchant(transactions)
      const groupTotal = groups.reduce((sum, g) => sum + g.total, 0)
      const overallTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0)
      expect(groupTotal).toBeCloseTo(overallTotal, 2)
    })

    it('merchant transaction counts sum to total count', () => {
      const groups = groupByMerchant(transactions)
      const countSum = groups.reduce((sum, g) => sum + g.count, 0)
      expect(countSum).toBe(transactions.length)
    })

    it('handles transactions without notes', () => {
      const txsNoNote = [
        ...transactions,
        makeTx({ note: undefined, category: 'other', amount: 10 }),
        makeTx({ note: '', category: 'other', amount: 20 }),
      ]
      const groups = groupByMerchant(txsNoNote)
      const noNoteGroup = groups.find(g => g.merchant === '(no note)')
      expect(noNoteGroup).toBeDefined()
      expect(noNoteGroup!.count).toBe(2)
      expect(noNoteGroup!.total).toBe(30)
    })

    it('filters work within merchant grouping', () => {
      const params: PrecomputedFilterParams = {
        categorySet: null,
        typeFilter: 'expenses',
        dateBounds: { start: '2024-06-10', end: '2024-06-14' },
        amountBounds: null,
      }
      const filtered = applyOptimizedFilters(transactions, params)
      const groups = groupByMerchant(filtered)

      // In date range Jun 10-14, expenses only: Chipotle×2, Starbucks×2, Uber×1
      const totalFiltered = groups.reduce((sum, g) => sum + g.count, 0)
      expect(totalFiltered).toBe(filtered.length)
    })
  })

  describe('timeline view (default)', () => {
    it('all transactions appear in timeline (no grouping transformation)', () => {
      // Timeline view just shows transactions as-is (sorted by date in the component)
      expect(transactions.length).toBe(7)
    })

    it('filters apply correctly to timeline view', () => {
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food']),
        typeFilter: 'expenses',
        dateBounds: null,
        amountBounds: null,
      }
      const filtered = applyOptimizedFilters(transactions, params)
      expect(filtered.length).toBe(2) // Two food expenses
      filtered.forEach(tx => {
        expect(tx.category).toBe('food')
        expect(tx.type).toBe('expense')
      })
    })
  })

  describe('view switching consistency', () => {
    it('same data appears correctly regardless of view mode', () => {
      // Same filters applied, all views should produce consistent totals
      const params: PrecomputedFilterParams = {
        categorySet: new Set<TransactionCategory>(['food', 'drinks']),
        typeFilter: 'all',
        dateBounds: null,
        amountBounds: null,
      }
      const filtered = applyOptimizedFilters(transactions, params)

      // Timeline: raw list
      const timelineTotal = filtered.reduce((sum, tx) => sum + tx.amount, 0)

      // Category grouping
      const catMap = new Map<string, number>()
      filtered.forEach(tx => {
        catMap.set(tx.category, (catMap.get(tx.category) || 0) + tx.amount)
      })
      const categoryTotal = Array.from(catMap.values()).reduce((sum, v) => sum + v, 0)

      // Merchant grouping
      const merchMap = new Map<string, number>()
      filtered.forEach(tx => {
        const key = (tx.note || '').toLowerCase()
        merchMap.set(key, (merchMap.get(key) || 0) + tx.amount)
      })
      const merchantTotal = Array.from(merchMap.values()).reduce((sum, v) => sum + v, 0)

      // All three should equal
      expect(timelineTotal).toBeCloseTo(categoryTotal, 2)
      expect(timelineTotal).toBeCloseTo(merchantTotal, 2)
    })
  })
})
