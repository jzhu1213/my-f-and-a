/**
 * Phase 11 Integration Tests
 *
 * Tests that verify Phase 11 power features work together correctly:
 * - 367.1: Wish list end-to-end
 * - 367.2: Subscription intelligence flow
 * - 367.3: Shared budget round-trip
 * - 367.4: Import flow
 * - 367.5: Confidence score activation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  addLocalWishItem,
  updateLocalWishItem,
  getLocalWishItems,
  computeWishProjection,
  convertWishToSaveUpPlan,
  type WishItem,
} from '@/lib/wishList'
import { computeSaveUpPlan } from '@/lib/saveUpPlanUtils'
import { createWishCompleteCelebration } from '@/lib/celebrationEngine'
import { detectSubscriptions } from '@/lib/subscriptionDetector'
import { detectPossiblyUnusedSubscriptions } from '@/lib/subscriptionUsageDetector'
import {
  trackCancelledSubscription,
  calculateSubscriptionSavings,
} from '@/lib/subscriptionSavingsTracker'
import {
  cacheSharedBudgets,
  getCachedSharedBudgets,
  enqueueSharedBudgetOp,
  getSharedBudgetQueue,
  removeSharedBudgetQueueItem,
  hasLowBalanceBeenNotified,
  markLowBalanceNotified,
  type SharedBudget,
} from '@/lib/social/sharedBudgets'
import { parseStatement, detectDuplicates } from '@/lib/statementImport'
import {
  isConfidenceEnabled,
  setConfidenceEnabled,
  computeConfidenceScore,
  getTier,
} from '@/lib/confidenceScore'
import type { Transaction, Budget, Goal } from '@/types'

// ============================================================================
// Helpers
// ============================================================================

function createTransaction(
  date: string,
  amount: number,
  type: 'income' | 'expense' = 'expense',
  category: string = 'food',
  opts: Partial<Transaction> = {}
): Transaction {
  return {
    id: `tx-${date}-${amount}-${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user-1',
    date,
    amount,
    type,
    category: category as any,
    accountType: 'personal',
    createdAt: new Date().toISOString(),
    ...opts,
  }
}

function createBudget(
  category: string,
  monthlyLimit: number,
  month: string = '2024-06'
): Budget {
  return {
    id: `budget-${category}-${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user-1',
    category: category as any,
    monthlyLimit,
    spent: 0,
    month,
  }
}

function createGoal(
  name: string,
  targetAmount: number,
  currentAmount: number
): Goal {
  return {
    id: `goal-${name}-${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user-1',
    name,
    targetAmount,
    currentAmount,
    emoji: '🎯',
    createdAt: new Date().toISOString(),
  }
}

// ============================================================================
// 367.1 — Wish list end-to-end (Requirements: 19.1)
// ============================================================================

describe('367.1 Wish list end-to-end', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should complete full wish list flow: create → project → save-up plan → complete → celebrate', () => {
    const userId = 'user-1'

    // 1. Create a wish item
    const wishItem: WishItem = {
      id: 'wish-001',
      userId,
      name: 'New Headphones',
      amount: 200,
      category: 'fun',
      priority: 'want',
      createdAt: '2024-06-01T00:00:00.000Z',
      savedSoFar: 0,
      isComplete: false,
    }
    addLocalWishItem(wishItem)

    // Verify it was stored
    const stored = getLocalWishItems(userId)
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('New Headphones')

    // 2. Compute projection — need transactions and budgets for surplus calc
    const currentDate = new Date(2024, 5, 15) // June 15, 2024
    const transactions: Transaction[] = []
    // Create 14 days of spending: $10/day (low spending relative to budget)
    for (let i = 1; i <= 14; i++) {
      const day = String(i).padStart(2, '0')
      transactions.push(createTransaction(`2024-06-${day}`, 10, 'expense', 'food'))
    }
    const budgets: Budget[] = [createBudget('food', 600, '2024-06')]

    const projection = computeWishProjection(wishItem, transactions, budgets, currentDate)
    // With $600/month budget and $10/day spending, surplus should be positive
    expect(projection.daysToAfford).toBeGreaterThan(0)
    expect(projection.daysToAfford).toBeLessThan(Infinity)
    expect(projection.averageDailySurplus).toBeGreaterThan(0)

    // 3. Convert wish to save-up plan
    const saveUpInput = convertWishToSaveUpPlan(wishItem, transactions, budgets, currentDate)
    expect(saveUpInput.targetAmount).toBe(200)
    expect(saveUpInput.currentAmount).toBe(0)
    expect(saveUpInput.contributionRate).toBeGreaterThan(0)
    expect(saveUpInput.period).toBe('weekly')

    // 4. Feed into computeSaveUpPlan
    const plan = computeSaveUpPlan(saveUpInput)
    expect(plan.weeksToGoal).toBeGreaterThan(0)
    expect(plan.weeksToGoal).toBeLessThan(Infinity)
    expect(plan.targetDate).toBeTruthy()

    // 5. Simulate progress — update savedSoFar to meet target
    updateLocalWishItem('wish-001', { savedSoFar: 200, isComplete: true })
    const updatedItems = getLocalWishItems(userId)
    expect(updatedItems[0].savedSoFar).toBe(200)
    expect(updatedItems[0].isComplete).toBe(true)

    // 6. Verify item is marked complete
    expect(updatedItems[0].isComplete).toBe(true)

    // 7. Verify celebration event is created
    const celebration = createWishCompleteCelebration('wish-001', 'New Headphones')
    expect(celebration).not.toBeNull()
    expect(celebration!.type).toBe('wish_complete')
    expect(celebration!.emoji).toBe('🌟')
  })
})

// ============================================================================
// 367.2 — Subscription intelligence flow (Requirements: 19.2)
// ============================================================================

describe('367.2 Subscription intelligence flow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should detect subscriptions, flag unused ones, track cancellation, and calculate savings', () => {
    // 1. Create transactions with a subscription-like charge
    //    Same amount ($9.99), monthly, in 'subscriptions' category, going back 90+ days
    const transactions: Transaction[] = []
    const monthlyDates = [
      '2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15',
    ]
    for (const date of monthlyDates) {
      transactions.push(
        createTransaction(date, 9.99, 'expense', 'subscriptions', {
          note: 'Netflix',
        })
      )
    }

    // 2. Call detectSubscriptions to get DetectedSubscription objects
    const detected = detectSubscriptions(transactions)
    expect(detected.length).toBeGreaterThan(0)

    const netflixSub = detected.find((s) => s.label === 'Netflix')
    expect(netflixSub).toBeDefined()
    expect(netflixSub!.amount).toBe(9.99)
    expect(netflixSub!.frequency).toBe('monthly')
    expect(netflixSub!.confidence).toBeGreaterThan(0)

    // 3. Call detectPossiblyUnusedSubscriptions with a today date 60+ days after last
    //    non-subscription activity (there is NO other spending in the category)
    const today = '2024-06-20'
    const unusedResults = detectPossiblyUnusedSubscriptions(detected, transactions, today)

    // 4. Verify the subscription is flagged as possibly unused
    expect(unusedResults.length).toBeGreaterThan(0)
    const flaggedNetflix = unusedResults.find(
      (r) => r.subscription.label === 'Netflix'
    )
    expect(flaggedNetflix).toBeDefined()
    expect(flaggedNetflix!.daysSinceLastCategoryActivity).toBeGreaterThanOrEqual(60)

    // 5. Track the cancellation
    const userId = 'user-1'
    trackCancelledSubscription(userId, {
      id: 'cancelled-netflix',
      label: 'Netflix',
      monthlyAmount: 9.99,
      cancelledAt: '2024-04-20',
      category: 'subscriptions',
    })

    // 6. Calculate savings several months later
    const laterDate = new Date(2024, 8, 20) // September 20, 2024 (5 months later)
    const savings = calculateSubscriptionSavings(
      {
        id: 'cancelled-netflix',
        label: 'Netflix',
        monthlyAmount: 9.99,
        cancelledAt: '2024-04-20',
        category: 'subscriptions',
      },
      laterDate
    )

    // 7. Verify savings counter shows correct accumulated savings
    expect(savings.monthsCancelled).toBe(5)
    expect(savings.savedAmount).toBeCloseTo(9.99 * 5, 1)
  })
})

// ============================================================================
// 367.3 — Shared budget round-trip (Requirements: 19.5)
// ============================================================================

describe('367.3 Shared budget round-trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should cache, retrieve, and queue shared budget operations', () => {
    // 1. Create a SharedBudget object with proper structure
    const sharedBudget: SharedBudget = {
      id: 'sb-001',
      name: 'Groceries with Roommate',
      category: 'food',
      monthlyLimit: 400,
      members: [
        {
          id: 'member-1',
          budgetId: 'sb-001',
          userId: 'user-1',
          contributionAmount: 200,
          joinedAt: '2024-06-01T00:00:00.000Z',
        },
        {
          id: 'member-2',
          budgetId: 'sb-001',
          userId: 'user-2',
          contributionAmount: 200,
          joinedAt: '2024-06-01T00:00:00.000Z',
        },
      ],
      currentSpent: 150,
      status: 'active',
      createdBy: 'user-1',
      createdAt: '2024-06-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    }

    // 2. Cache it
    cacheSharedBudgets([sharedBudget])

    // 3. Retrieve and verify structure matches
    const cached = getCachedSharedBudgets()
    expect(cached).toHaveLength(1)
    expect(cached[0].id).toBe('sb-001')
    expect(cached[0].name).toBe('Groceries with Roommate')
    expect(cached[0].monthlyLimit).toBe(400)
    expect(cached[0].members).toHaveLength(2)
    expect(cached[0].members[0].contributionAmount).toBe(200)
    expect(cached[0].members[1].contributionAmount).toBe(200)

    // 4. Test queue operations: enqueue, get, remove
    enqueueSharedBudgetOp('log_expense', { budgetId: 'sb-001', amount: 25 })
    enqueueSharedBudgetOp('update', { budgetId: 'sb-001', name: 'Updated Name' })

    let queue = getSharedBudgetQueue()
    expect(queue).toHaveLength(2)
    expect(queue[0].action).toBe('log_expense')
    expect(queue[1].action).toBe('update')

    // Remove the first item
    removeSharedBudgetQueueItem(queue[0].id)
    queue = getSharedBudgetQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].action).toBe('update')

    // 5. Test low-balance notification logic
    const budgetId = 'sb-001'
    const period = '2024-06'

    // Initially not notified
    expect(hasLowBalanceBeenNotified(budgetId, period)).toBe(false)

    // Mark as notified
    markLowBalanceNotified(budgetId, period)

    // Now it should be notified
    expect(hasLowBalanceBeenNotified(budgetId, period)).toBe(true)
  })
})

// ============================================================================
// 367.4 — Import flow (Requirements: 19.6)
// ============================================================================

describe('367.4 Import flow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should parse CSV, auto-categorize, and detect duplicates', () => {
    // 1. Create a sample CSV string
    const csv = `Date,Description,Amount
2024-01-15,STARBUCKS COFFEE,-5.50
2024-01-16,UBER TRIP,-12.00
2024-01-17,PAYROLL DEPOSIT,1500.00`

    // 2. Call parseStatement
    const result = parseStatement(csv)
    expect(result.success).toBe(true)

    if (!result.success) return

    // 3. Verify parsing produces ImportCandidate objects
    expect(result.candidates.length).toBe(3)

    const starbucks = result.candidates.find((c) => c.description === 'STARBUCKS COFFEE')
    expect(starbucks).toBeDefined()
    expect(starbucks!.date).toBe('2024-01-15')
    expect(starbucks!.amount).toBe(5.5)
    expect(starbucks!.type).toBe('expense')

    const uber = result.candidates.find((c) => c.description === 'UBER TRIP')
    expect(uber).toBeDefined()
    expect(uber!.date).toBe('2024-01-16')
    expect(uber!.amount).toBe(12)
    expect(uber!.type).toBe('expense')

    const payroll = result.candidates.find((c) => c.description === 'PAYROLL DEPOSIT')
    expect(payroll).toBeDefined()
    expect(payroll!.date).toBe('2024-01-17')
    expect(payroll!.amount).toBe(1500)
    expect(payroll!.type).toBe('income')

    // 4. Verify auto-categorization assigns reasonable categories
    //    Starbucks should be categorized as food or drinks
    expect(['food', 'drinks']).toContain(starbucks!.category)
    // Uber should be transport
    expect(uber!.category).toBe('transport')
    // Income should be income category
    expect(payroll!.category).toBe('income')

    // 5. Verify duplicate detection with overlapping existing transactions
    const existingTransactions: Transaction[] = [
      createTransaction('2024-01-15', 5.5, 'expense', 'food'),
      createTransaction('2024-01-18', 20, 'expense', 'fun'),
    ]

    const withDuplicates = detectDuplicates(result.candidates, existingTransactions)

    // 6. Verify duplicates are identified by date + amount match
    const starbucksDup = withDuplicates.find((c) => c.description === 'STARBUCKS COFFEE')
    expect(starbucksDup!.isDuplicate).toBe(true)

    const uberDup = withDuplicates.find((c) => c.description === 'UBER TRIP')
    expect(uberDup!.isDuplicate).toBe(false)
  })
})

// ============================================================================
// 367.5 — Confidence score activation (Requirements: 19.7)
// ============================================================================

describe('367.5 Confidence score activation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should toggle confidence feature on/off and compute meaningful scores', () => {
    // 1. Verify disabled by default
    expect(isConfidenceEnabled()).toBe(false)

    // 2. Enable
    setConfidenceEnabled(true)
    expect(isConfidenceEnabled()).toBe(true)

    // 3. Create transactions spanning a week of consistent logging (1/day for 7 days)
    const today = new Date()
    const transactions: Transaction[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      transactions.push(createTransaction(dateStr, 15, 'expense', 'food'))
    }

    // 4. Create budgets and goals
    const budgets: Budget[] = [createBudget('food', 600)]
    const goals: Goal[] = [createGoal('Emergency Fund', 1000, 300)]

    // 5. Compute confidence score
    const score1 = computeConfidenceScore({
      transactions,
      budgets,
      goals,
      bills: [],
    })

    expect(score1.score).toBeGreaterThanOrEqual(0)
    expect(score1.score).toBeLessThanOrEqual(100)
    expect(['Building', 'Growing', 'Thriving', 'Confident']).toContain(score1.tier)

    // 7. Create a second scenario with more consistent logging (14+ days)
    const transactions2: Transaction[] = []
    for (let i = 0; i < 21; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      transactions2.push(createTransaction(dateStr, 12, 'expense', 'food'))
    }
    const goals2: Goal[] = [createGoal('Emergency Fund', 1000, 800)]

    const score2 = computeConfidenceScore({
      transactions: transactions2,
      budgets,
      goals: goals2,
      bills: [],
    })

    // 8. Verify the second score is higher (more logging + better goal progress)
    expect(score2.score).toBeGreaterThan(score1.score)

    // 9. Test tier boundaries with getTier
    expect(getTier(25)).toBe('Building')
    expect(getTier(26)).toBe('Growing')
    expect(getTier(50)).toBe('Growing')
    expect(getTier(51)).toBe('Thriving')
    expect(getTier(75)).toBe('Thriving')
    expect(getTier(76)).toBe('Confident')

    // 10. Disable confidence score
    setConfidenceEnabled(false)
    expect(isConfidenceEnabled()).toBe(false)
  })
})
