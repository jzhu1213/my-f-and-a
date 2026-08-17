/**
 * Challenge Lifecycle Tests — Phase 17 Gamification & Habit Building
 *
 * Validates: Requirements 25.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeSpendingLimitProgress,
  getCompletionMessage,
  getExpiredMessage,
  startChallenge,
  abandonChallenge,
  getChallengeData,
  saveChallengeData,
  canStartNewChallenge,
  expireOverdueChallenges,
} from './challenges'
import type { Challenge, ChallengeSuggestion, ChallengeData } from './challenges'
import { formatDateLocal, addDaysLocal, parseDateLocal } from '@/lib/dateUtils'
import type { Transaction } from '@/types'

// ============================================================================
// Helpers
// ============================================================================

function makeTransaction(date: string, amount: number, overrides?: Partial<Transaction>): Transaction {
  return {
    id: `tx_${date}_${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user-1',
    date,
    amount,
    type: 'expense',
    category: 'food',
    accountType: 'personal',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeChallenge(overrides?: Partial<Challenge>): Challenge {
  return {
    id: 'ch_test_1',
    title: 'Keep food under $20/day',
    description: 'Spend less than $20 on food each day for 7 days',
    type: 'spending_limit',
    targetValue: 20,
    duration: 7,
    startDate: '2024-06-01',
    isActive: true,
    progress: 0,
    isComplete: false,
    category: 'food',
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Challenge Lifecycle (Requirement 25.2)', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('spending-limit challenge completion', () => {
    it('should compute full progress when spending is under the limit for all days', () => {
      const challenge = makeChallenge({
        startDate: '2024-06-01',
        duration: 7,
        targetValue: 20,
        category: 'food',
      })

      // Create 7 days of transactions, all under the $20 limit
      const transactions: Transaction[] = []
      for (let i = 0; i < 7; i++) {
        const date = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), i))
        transactions.push(makeTransaction(date, 15, { category: 'food' }))
      }

      // Compute progress with "today" being the last day of the challenge
      const lastDay = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), 6))
      const progress = computeSpendingLimitProgress(challenge, transactions, lastDay)

      // All 7 days were under limit → progress = 7 (duration days under limit)
      expect(progress).toBe(7)
    })

    it('should mark challenge as complete when progress >= targetValue (duration)', () => {
      const challenge = makeChallenge({
        startDate: '2024-06-01',
        duration: 7,
        targetValue: 20, // daily limit
      })

      // Progress = duration means all days under limit → complete
      // The challenge.targetValue for spending_limit is the daily cap,
      // but completion is determined when progress (daysUnderLimit) >= duration
      const transactions: Transaction[] = []
      for (let i = 0; i < 7; i++) {
        const date = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), i))
        transactions.push(makeTransaction(date, 10, { category: 'food' }))
      }

      const lastDay = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), 6))
      const progress = computeSpendingLimitProgress(challenge, transactions, lastDay)

      // All days under $20 → isComplete should be determinable
      expect(progress).toBe(7)
      // In the actual lifecycle, isComplete = progress >= targetValue
      // For spending_limit, the system checks days under limit vs duration
      expect(progress).toBeGreaterThanOrEqual(challenge.duration)
    })
  })

  describe('completion message', () => {
    it('should return an encouraging completion message for a finished challenge', () => {
      const challenge = makeChallenge({ isComplete: true })

      const message = getCompletionMessage(challenge)

      expect(message).toBeTruthy()
      expect(typeof message).toBe('string')
      expect(message.length).toBeGreaterThan(0)
    })
  })

  describe('challenge failure (expired)', () => {
    it('should return the gentle failure message when a challenge expires', () => {
      const message = getExpiredMessage()

      expect(message).toBe("Didn't quite make it — want to try again?")
    })

    it('should deactivate a challenge that has expired past its duration', () => {
      // Set up a challenge that started 10 days ago with 7-day duration
      const challengeData: ChallengeData = {
        challenges: [
          makeChallenge({
            id: 'ch_expired_1',
            startDate: '2024-06-01',
            duration: 7,
            isActive: true,
            isComplete: false,
          }),
        ],
        lastSuggestionWeek: 0,
      }
      saveChallengeData(challengeData)

      // "Today" is after the challenge end date (June 1 + 7 = June 8, we check on June 10)
      const result = expireOverdueChallenges('2024-06-10')

      expect(result).not.toBeNull()
      const expired = result!.challenges.find((c) => c.id === 'ch_expired_1')
      expect(expired?.isActive).toBe(false)
    })
  })

  describe('retry option (abandoned challenges allow new ones)', () => {
    it('should allow starting a new challenge after abandoning one', () => {
      // Start a challenge
      const suggestion: ChallengeSuggestion = {
        title: 'Keep food under $25/day',
        description: 'Spend less than $25 on food daily',
        type: 'spending_limit',
        targetValue: 25,
        duration: 7,
        category: 'food',
      }

      const data = startChallenge(suggestion, '2024-06-01')
      expect(data).not.toBeNull()

      // Abandon it
      const challengeId = data!.challenges[0].id
      const afterAbandon = abandonChallenge(challengeId)
      expect(afterAbandon).not.toBeNull()

      // Verify the abandoned challenge is inactive
      const abandoned = afterAbandon!.challenges.find((c) => c.id === challengeId)
      expect(abandoned?.isActive).toBe(false)

      // Should be able to start a new one
      expect(canStartNewChallenge(afterAbandon!)).toBe(true)

      // Start a new challenge
      const newSuggestion: ChallengeSuggestion = {
        title: 'No eating out for 5 days',
        description: 'Cook at home for 5 days straight',
        type: 'no_spend_category',
        targetValue: 5,
        duration: 7,
        category: 'food',
      }
      const newData = startChallenge(newSuggestion, '2024-06-10')
      expect(newData).not.toBeNull()
      expect(newData!.challenges.length).toBe(2) // original + new
    })
  })

  describe('exceeding the spending limit', () => {
    it('should not count days where spending exceeds the limit', () => {
      const challenge = makeChallenge({
        startDate: '2024-06-01',
        duration: 7,
        targetValue: 20,
        category: 'food',
      })

      // 4 days under limit, 3 days over limit
      const transactions: Transaction[] = []
      for (let i = 0; i < 4; i++) {
        const date = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), i))
        transactions.push(makeTransaction(date, 15, { category: 'food' })) // under
      }
      for (let i = 4; i < 7; i++) {
        const date = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), i))
        transactions.push(makeTransaction(date, 30, { category: 'food' })) // over
      }

      const lastDay = formatDateLocal(addDaysLocal(parseDateLocal('2024-06-01'), 6))
      const progress = computeSpendingLimitProgress(challenge, transactions, lastDay)

      // Only 4 days under limit
      expect(progress).toBe(4)
      // Not enough to complete (need 7 for full duration)
      expect(progress).toBeLessThan(challenge.duration)
    })
  })
})
