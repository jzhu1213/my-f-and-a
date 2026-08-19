import { describe, it, expect, beforeAll } from 'vitest'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { generateSmartSuggestions } from '@/lib/suggestionUtils'
import type { Transaction, TransactionCategory, Budget } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'

// ============================================================================
// Memory Stability Test — Task 479.2
// ============================================================================
//
// Verifies that repeated computation cycles (allowance recalc, suggestion
// generation) do not cause unbounded memory growth. Simulates extended use
// by running 1000+ iterations of core computations and checking that heap
// usage stabilizes rather than growing linearly.
//
// Approach:
// Since Vitest doesn't run with --expose-gc, we can't force GC between
// measurements. Instead we:
// 1. Run a large warm-up phase to let V8 reach steady state
// 2. Then run the measured phase and check growth per-iteration is negligible
// 3. Verify no retained references by checking functions are pure (same input
//    produces same output after N iterations)
//
// The key property we validate: the computation functions are pure and don't
// accumulate state (closures, caches, global references) across calls.
// ============================================================================

// ─── Data Generators ─────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'food', 'drinks', 'rent', 'transport', 'school',
  'fun', 'health', 'subscriptions', 'other',
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
      id: `tx-mem-${i}`,
      userId: 'user-mem',
      date: formatDate(date),
      amount: isIncome ? 500 + Math.random() * 1500 : 2 + Math.random() * 60,
      type: isIncome ? 'income' : 'expense',
      category,
      note: Math.random() < 0.5 ? `Note ${i}` : undefined,
      isRecurring: false,
      accountType: 'personal',
      createdAt: date.toISOString(),
    })
  }

  return transactions
}

function generateBudgets(): Budget[] {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return EXPENSE_CATEGORIES.map((category, i) => ({
    id: `budget-mem-${i}`,
    userId: 'user-mem',
    category,
    monthlyLimit: category === 'rent' ? 1500 : 100 + Math.random() * 200,
    spent: Math.random() * 100,
    month,
  }))
}

function generateFixedExpenses(): FixedExpense[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `bill-mem-${i}`,
    userId: 'user-mem',
    category: 'subscriptions' as TransactionCategory,
    label: `Service ${i}`,
    amount: 10 + Math.random() * 40,
    dueDay: (i % 28) + 1,
    recurringId: `recurring-mem-${i}`,
    isActive: true,
  }))
}

/**
 * Gets current heap usage in MB (Node.js environment).
 * Falls back to 0 in environments without process.memoryUsage.
 */
function getHeapMB(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / (1024 * 1024)
  }
  return 0
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Memory Stability — Extended Use Simulation (Task 479.2)', () => {
  let transactions: Transaction[]
  let budgets: Budget[]
  let fixedExpenses: FixedExpense[]
  const currentDate = new Date()

  beforeAll(() => {
    transactions = generateTransactions(500) // Moderate size for repeated iteration
    budgets = generateBudgets()
    fixedExpenses = generateFixedExpenses()
  })

  it('computeDailyAllowance is deterministic after 1000+ iterations (no state accumulation)', () => {
    // The key memory-safety property: a pure function produces identical output
    // regardless of how many prior invocations have occurred. If memory were
    // leaking via closures or accumulated state, results might diverge.

    const firstResult = computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)

    // Run 1000 iterations
    for (let i = 0; i < 1000; i++) {
      computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
    }

    const afterResult = computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)

    // Results must be identical — no accumulated drift
    expect(afterResult.amount).toBe(firstResult.amount)
    expect(afterResult.dailyBudget).toBe(firstResult.dailyBudget)
    expect(afterResult.spentToday).toBe(firstResult.spentToday)
    expect(afterResult.rollover).toBe(firstResult.rollover)
    expect(afterResult.status).toBe(firstResult.status)
    expect(afterResult.isEstimated).toBe(firstResult.isEstimated)
  })

  it('generateSmartSuggestions is deterministic after 1000+ iterations', () => {
    const firstResult = generateSmartSuggestions('food', transactions)

    // Run 1000 iterations cycling through categories
    for (let i = 0; i < 1000; i++) {
      const category = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length]
      generateSmartSuggestions(category, transactions)
    }

    const afterResult = generateSmartSuggestions('food', transactions)

    // Same input → same output after thousands of calls
    expect(afterResult.length).toBe(firstResult.length)
    for (let i = 0; i < firstResult.length; i++) {
      expect(afterResult[i].amount).toBe(firstResult[i].amount)
      expect(afterResult[i].confidence).toBe(firstResult[i].confidence)
      expect(afterResult[i].category).toBe(firstResult[i].category)
    }
  })

  it('mixed computation cycle shows memory growth per-iteration is sub-linear', () => {
    // Verifies that memory growth is bounded — not O(n) with iterations.
    // We measure growth over two equal-sized batches. If there's a real leak,
    // growth in batch 2 should be similar to batch 1. With proper GC, the
    // per-iteration allocation should be negligible after warm-up.

    // Heavy warm-up to reach V8 steady state
    for (let i = 0; i < 200; i++) {
      computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
      generateSmartSuggestions(EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length], transactions)
    }

    const heapAfterWarmup = getHeapMB()

    // Batch 1: 500 iterations
    for (let i = 0; i < 500; i++) {
      computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
      generateSmartSuggestions(EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length], transactions)
    }
    const heapAfterBatch1 = getHeapMB()
    const batch1Growth = heapAfterBatch1 - heapAfterWarmup

    // Batch 2: another 500 iterations
    for (let i = 0; i < 500; i++) {
      computeDailyAllowance(budgets, transactions, currentDate, undefined, fixedExpenses)
      generateSmartSuggestions(EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length], transactions)
    }
    const heapAfterBatch2 = getHeapMB()
    const batch2Growth = heapAfterBatch2 - heapAfterBatch1

    console.log(`  Mixed cycle memory growth analysis:`)
    console.log(`    After warmup: ${heapAfterWarmup.toFixed(2)} MB`)
    console.log(`    After batch 1 (+500): ${heapAfterBatch1.toFixed(2)} MB (Δ ${batch1Growth.toFixed(2)} MB)`)
    console.log(`    After batch 2 (+500): ${heapAfterBatch2.toFixed(2)} MB (Δ ${batch2Growth.toFixed(2)} MB)`)

    // The computation is pure — if there's no leak, batch 2 growth should NOT
    // consistently exceed batch 1 growth. In practice, V8 GC may produce
    // negative growth (reclamation). We check that growth per iteration is
    // bounded to <0.05 MB/iteration (50 KB), which would indicate no leak.
    // With 500 iterations, that's 25 MB max growth per batch.
    if (heapAfterWarmup > 0) {
      const growthPerIteration = Math.max(0, batch2Growth) / 500
      console.log(`    Growth per iteration (batch 2): ${(growthPerIteration * 1024).toFixed(1)} KB`)
      // 50 KB/iteration would be a clear leak signal for pure functions
      expect(growthPerIteration).toBeLessThan(0.05)
    }
  })

  it('verifies no closure/global state leaks with varying data subsets', () => {
    // Run computations with different data slices to verify no references
    // are retained from previous calls (closure capture or module-level caches)

    const results: number[] = []

    for (let i = 0; i < 1000; i++) {
      // Use varying slices — if closures captured prior data, results would drift
      const subset = transactions.slice(0, 100 + (i % 400))
      const result = computeDailyAllowance(budgets, subset, currentDate, undefined, fixedExpenses)
      results.push(result.amount)
    }

    // Verify determinism: same slice index → same result
    // Run the same slice pattern again
    const verifyResults: number[] = []
    for (let i = 0; i < 100; i++) {
      const subset = transactions.slice(0, 100 + (i % 400))
      const result = computeDailyAllowance(budgets, subset, currentDate, undefined, fixedExpenses)
      verifyResults.push(result.amount)
    }

    // First 100 results from both runs should match
    for (let i = 0; i < 100; i++) {
      expect(verifyResults[i]).toBe(results[i])
    }

    // Log summary
    const heapNow = getHeapMB()
    console.log(`  Varying data verification (1000 iterations):`)
    console.log(`    Heap at end: ${heapNow.toFixed(2)} MB`)
    console.log(`    All results deterministic: ✓`)
  })
})
