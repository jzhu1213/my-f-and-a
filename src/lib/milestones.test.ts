/**
 * Milestone Accuracy Tests — Phase 17 Gamification & Habit Building
 *
 * Validates: Requirements 25.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkAndAwardMilestones,
  getMilestoneData,
  saveMilestoneData,
  MILESTONE_DEFINITIONS,
} from './milestones'
import type { MilestoneData } from './milestones'
import type { Transaction, Goal } from '@/types'

// ============================================================================
// Helpers
// ============================================================================

function makeTransaction(id: string, date: string, overrides?: Partial<Transaction>): Transaction {
  return {
    id,
    userId: 'user-1',
    date,
    amount: 10,
    type: 'expense',
    category: 'food',
    accountType: 'personal',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeGoal(overrides?: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Emergency Fund',
    targetAmount: 1000,
    currentAmount: 0,
    emoji: '🎯',
    createdAt: '2024-01-01',
    ...overrides,
  }
}

/**
 * Generate N transactions with unique IDs and sequential dates.
 */
function generateTransactions(count: number): Transaction[] {
  const transactions: Transaction[] = []
  for (let i = 0; i < count; i++) {
    const day = String((i % 28) + 1).padStart(2, '0')
    const month = String(Math.floor(i / 28) % 12 + 1).padStart(2, '0')
    transactions.push(
      makeTransaction(`tx_${i}`, `2024-${month}-${day}`)
    )
  }
  return transactions
}

// ============================================================================
// Tests
// ============================================================================

describe('Milestone Accuracy (Requirement 25.4)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('reaching milestone threshold', () => {
    it('should award the 100-transaction milestone when threshold is reached', () => {
      // Generate exactly 100 transactions
      const transactions = generateTransactions(100)
      const goals: Goal[] = []

      const events = checkAndAwardMilestones(transactions, goals)

      // Verify the 'tracking-100' milestone was awarded
      const milestoneData = getMilestoneData()
      expect(milestoneData).not.toBeNull()

      const earned = milestoneData!.earned.find((e) => e.milestoneId === 'tracking-100')
      expect(earned).toBeDefined()
      expect(earned!.milestoneId).toBe('tracking-100')
    })

    it('should return a CelebrationEvent for newly earned milestones', () => {
      const transactions = generateTransactions(100)
      const goals: Goal[] = []

      const events = checkAndAwardMilestones(transactions, goals)

      // Should have at least one celebration event (tracking-10, tracking-50, tracking-100)
      expect(events.length).toBeGreaterThanOrEqual(1)

      // Find the 100-transaction celebration
      const centuryEvent = events.find((e) => e.id === 'milestone_tracking-100')
      expect(centuryEvent).toBeDefined()
      expect(centuryEvent!.type).toBe('milestone_earned')
      expect(centuryEvent!.emoji).toBe('💯')
      expect(centuryEvent!.message).toContain('100 transactions')
    })

    it('should award multiple milestone thresholds at once (10, 50, 100)', () => {
      const transactions = generateTransactions(100)
      const goals: Goal[] = []

      const events = checkAndAwardMilestones(transactions, goals)

      const milestoneData = getMilestoneData()
      expect(milestoneData).not.toBeNull()

      const earnedIds = milestoneData!.earned.map((e) => e.milestoneId)
      expect(earnedIds).toContain('tracking-10')
      expect(earnedIds).toContain('tracking-50')
      expect(earnedIds).toContain('tracking-100')
    })
  })

  describe('milestone permanence (never un-unlocks)', () => {
    it('should retain earned milestones even if the value decreases below threshold', () => {
      // First: earn the 100-transaction milestone
      const transactions100 = generateTransactions(100)
      checkAndAwardMilestones(transactions100, [])

      // Verify it's earned
      const data1 = getMilestoneData()
      expect(data1!.earned.some((e) => e.milestoneId === 'tracking-100')).toBe(true)

      // Now check with fewer transactions (simulating data reduction)
      // The milestone should still be in the earned list because it was persisted
      const transactions50 = generateTransactions(50)
      const events = checkAndAwardMilestones(transactions50, [])

      // The milestone data should still have tracking-100 earned
      const data2 = getMilestoneData()
      expect(data2!.earned.some((e) => e.milestoneId === 'tracking-100')).toBe(true)
    })

    it('should not fire a celebration event for already-earned milestones', () => {
      // First award
      const transactions = generateTransactions(100)
      const firstEvents = checkAndAwardMilestones(transactions, [])
      expect(firstEvents.length).toBeGreaterThan(0)

      // Second check — same milestones already earned, should not celebrate again
      const secondEvents = checkAndAwardMilestones(transactions, [])
      
      // No new milestone celebrations since all are already earned
      const trackingEvents = secondEvents.filter((e) => e.id.startsWith('milestone_tracking-'))
      expect(trackingEvents.length).toBe(0)
    })
  })

  describe('milestone appears in gallery (earned list)', () => {
    it('should include milestone details (title, emoji, date) in earned data', () => {
      const transactions = generateTransactions(10)
      checkAndAwardMilestones(transactions, [])

      const data = getMilestoneData()
      expect(data).not.toBeNull()

      const earned = data!.earned.find((e) => e.milestoneId === 'tracking-10')
      expect(earned).toBeDefined()
      expect(earned!.dateEarned).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format

      // The milestone definition can be looked up from the ID
      const def = MILESTONE_DEFINITIONS.find((d) => d.id === 'tracking-10')
      expect(def).toBeDefined()
      expect(def!.title).toBe('First Steps')
      expect(def!.emoji).toBe('📝')
    })
  })
})
