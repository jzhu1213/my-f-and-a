import { describe, it, expect, beforeAll } from 'vitest'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { generateSmartSuggestions } from '@/lib/suggestionUtils'
import { searchTransactions } from '@/lib/transactionSearch'
import type { Transaction, TransactionCategory, Budget } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'

// ============================================================================
// Stress Performance Test — Task 479.1
// ============================================================================
//
// Validates that core computation utilities meet performance budgets under
// large dataset conditions (2000+ transactions, 20+ goals, 50+ bills).
//
// Performance budgets:
// - computeDailyAllowance: <16ms (one frame budget at 60fps)
// - generateSmartSuggestions: <50ms with 2000+ transactions
// - searchTransactions: <50ms for substring search across 2000+ entries
// ============================================================================

// ─── Data Generators ─────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'food', 'drinks', 'rent', 'transport', 'school',
  'fun', 'health', 'subscriptions', 'other',
]

const NOTES = [
  'Chipotle', 'Coffee', 'Groceries', 'Uber', 'Netflix', 'Gym',
  'Textbook', 'Movie', 'Subway', 'Boba tea', 'Pizza', 'Gas',
  'Amazon', 'Spotify', 'Lunch', 'Dinner', 'Snacks', 'Bus',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function generateTransactions(count: number): Transaction[] {
  const transactions: Transaction[] = []
  const now = new Date()
  const startMs = new Date(now.getFullYear() - 1, now.getMonth(), 1).getTime()
  const endMs = now.getTime()
  const rangeMs = endMs - startMs

  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() < 0.15
    const date = new Date(startMs + Math.random() * rangeMs)
    const category: TransactionCategory = isIncome ? 'income' : randomItem(EXPENSE_CATEGORIES)

    transactions.push({
      id: `tx-perf-${i}`,
      userId: 'user-perf',
      date: formatDate(date),
      amount: isIncome ? 500 + Math.random() * 1500 : 2 + Math.random() * 60,
      type: isIncome ? 'income' : 'expense',
      category,
      note: Math.random() < 0.7 ? randomItem(NOTES) : undefined,
      isRecurring: category === 'subscriptions' && Math.random() < 0.4,
      accountType: 'personal',
      createdAt: date.toISOString(),
    })
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date))
  return transactions
}

function generateBudgets(): Budget[] {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return EXPENSE_CATEGORIES.map((category, i) => ({
    id: `budget-perf-${i}`,
    userId: 'user-perf',
    category,
    monthlyLimit: category === 'rent' ? 1500 : 50 + Math.random() * 250,
    spent: Math.random() * 150,
    month,
    isFixed: category === 'rent',
  }))
}

function generateFixedExpenses(count: number): FixedExpense[] {
  const expenses: FixedExpense[] = []
  const labels = ['Rent', 'Netflix', 'Spotify', 'Gym', 'Phone', 'Insurance', 'Internet']

  for (let i = 0; i < count; i++) {
    expenses.push({
      id: `bill-perf-${i}`,
      userId: 'user-perf',
      category: i === 0 ? 'rent' : randomItem(EXPENSE_CATEGORIES),
      label: labels[i % labels.length] + (i >= labels.length ? ` ${Math.floor(i / labels.length)}` : ''),
      amount: i === 0 ? 1200 : 5 + Math.random() * 80,
      dueDay: (i % 28) + 1,
      recurringId: `recurring-perf-${i}`,
      isActive: true,
    })
  }

  return expenses
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Stress Performance — Large Dataset (Task 479.1)', () => {
  let transactions: Transaction[]
  let budgets: Budget[]
  let fixedExpenses: FixedExpense[]

  beforeAll(() => {
    // Generate large dataset once for all tests
    transactions = generateTransactions(2200)
    budgets = generateBudgets()
    fixedExpenses = generateFixedExpenses(55)
  })

  it('should have generated 2000+ transactions', () => {
    expect(transactions.length).toBeGreaterThanOrEqual(2000)
  })

  it('computeDailyAllowance completes in <16ms with 2200 transactions and 55 bills', () => {
    const currentDate = new Date()

    // Warm up (JIT compilation)
    computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)

    // Measure over multiple runs for stability
    const iterations = 10
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
      const end = performance.now()
      times.push(end - start)
    }

    const median = times.sort((a, b) => a - b)[Math.floor(iterations / 2)]
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`  computeDailyAllowance (2200 txns, 55 bills):`)
    console.log(`    Median: ${median.toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms`)
    console.log(`    Min: ${Math.min(...times).toFixed(2)}ms | Max: ${Math.max(...times).toFixed(2)}ms`)

    // Budget: <16ms (one frame at 60fps)
    expect(median).toBeLessThan(16)
  })

  it('generateSmartSuggestions completes in <50ms with 2200 transactions', () => {
    // Warm up
    generateSmartSuggestions('food', transactions)

    const iterations = 10
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const category = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length]
      const start = performance.now()
      generateSmartSuggestions(category, transactions)
      const end = performance.now()
      times.push(end - start)
    }

    const median = times.sort((a, b) => a - b)[Math.floor(iterations / 2)]
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`  generateSmartSuggestions (2200 txns):`)
    console.log(`    Median: ${median.toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms`)
    console.log(`    Min: ${Math.min(...times).toFixed(2)}ms | Max: ${Math.max(...times).toFixed(2)}ms`)

    // Budget: <50ms
    expect(median).toBeLessThan(50)
  })

  it('searchTransactions completes in <50ms for substring search across 2200 transactions', () => {
    const queries = ['coffee', 'chipotle', 'uber', '15', 'food', 'pizza', 'gym']

    // Warm up — first call builds the index
    searchTransactions(transactions, 'warmup')

    const iterations = queries.length
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      searchTransactions(transactions, queries[i])
      const end = performance.now()
      times.push(end - start)
    }

    const median = times.sort((a, b) => a - b)[Math.floor(iterations / 2)]
    const avg = times.reduce((s, t) => s + t, 0) / times.length

    console.log(`  searchTransactions (2200 txns, various queries):`)
    console.log(`    Median: ${median.toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms`)
    console.log(`    Min: ${Math.min(...times).toFixed(2)}ms | Max: ${Math.max(...times).toFixed(2)}ms`)

    // Budget: <50ms per search
    expect(median).toBeLessThan(50)
  })

  it('all core computations combined complete in <100ms (interaction budget)', () => {
    const currentDate = new Date()

    // Simulate a full "home screen load" cycle:
    // allowance + suggestions + search
    const start = performance.now()

    computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
    generateSmartSuggestions('food', transactions)
    generateSmartSuggestions('drinks', transactions)
    generateSmartSuggestions('transport', transactions)
    searchTransactions(transactions, 'coffee')

    const elapsed = performance.now() - start

    console.log(`  Combined home-load computation: ${elapsed.toFixed(2)}ms`)

    // Budget: <100ms total for all computations (INP budget)
    expect(elapsed).toBeLessThan(100)
  })
})
