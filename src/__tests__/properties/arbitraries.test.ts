/**
 * Property-based tests for arbitrary generators
 * This file verifies that our arbitraries generate valid data
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  arbTransactionCategory,
  arbTransactionType,
  arbAccountType,
  arbAllowanceStatus,
  arbMoneyAmount,
  arbSmallAmount,
  arbBudgetAmount,
  arbTransaction,
  arbQuickTransaction,
  arbBudget,
  arbBudgetSet,
  arbDailyAllowance,
  arbSmartSuggestion,
  arbContextualTip,
  arbCelebrationEvent,
  arbOnboardingResult,
  arbDateString,
} from './arbitraries'

describe('Arbitrary Generators', () => {
  describe('Basic Type Arbitraries', () => {
    it('arbTransactionCategory generates valid categories', () => {
      fc.assert(
        fc.property(arbTransactionCategory(), (category) => {
          const validCategories = [
            'food',
            'rent',
            'transport',
            'school',
            'fun',
            'health',
            'subscriptions',
            'gig',
            'income',
            'other',
          ]
          expect(validCategories).toContain(category)
        })
      )
    })

    it('arbTransactionType generates valid types', () => {
      fc.assert(
        fc.property(arbTransactionType(), (type) => {
          expect(['income', 'expense']).toContain(type)
        })
      )
    })

    it('arbAccountType generates valid account types', () => {
      fc.assert(
        fc.property(arbAccountType(), (accountType) => {
          expect(['personal', 'gig', 'savings']).toContain(accountType)
        })
      )
    })

    it('arbAllowanceStatus generates valid statuses', () => {
      fc.assert(
        fc.property(arbAllowanceStatus(), (status) => {
          expect(['healthy', 'caution', 'warning', 'over']).toContain(status)
        })
      )
    })
  })

  describe('Money Amount Arbitraries', () => {
    it('arbMoneyAmount generates positive amounts', () => {
      fc.assert(
        fc.property(arbMoneyAmount(), (amount) => {
          expect(amount).toBeGreaterThan(0)
          expect(amount).toBeLessThanOrEqual(9999.99)
        })
      )
    })

    it('arbSmallAmount generates small positive amounts', () => {
      fc.assert(
        fc.property(arbSmallAmount(), (amount) => {
          expect(amount).toBeGreaterThan(0)
          expect(amount).toBeLessThanOrEqual(100)
        })
      )
    })

    it('arbBudgetAmount generates reasonable budget amounts', () => {
      fc.assert(
        fc.property(arbBudgetAmount(), (amount) => {
          expect(amount).toBeGreaterThanOrEqual(10)
          expect(amount).toBeLessThanOrEqual(5000)
        })
      )
    })

    it('money amounts have at most 2 decimal places', () => {
      fc.assert(
        fc.property(arbMoneyAmount(), (amount) => {
          const decimalPlaces = (amount.toString().split('.')[1] || '').length
          expect(decimalPlaces).toBeLessThanOrEqual(2)
        })
      )
    })
  })

  describe('Transaction Arbitraries', () => {
    it('arbTransaction generates valid transactions', () => {
      fc.assert(
        fc.property(arbTransaction(), (transaction) => {
          expect(transaction.id).toBeDefined()
          expect(transaction.userId).toBeDefined()
          expect(transaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(transaction.amount).toBeGreaterThan(0)
          expect(['income', 'expense']).toContain(transaction.type)
          expect(transaction.category).toBeDefined()
          expect(transaction.accountType).toBeDefined()
          expect(transaction.createdAt).toBeDefined()
        })
      )
    })

    it('arbQuickTransaction generates valid quick transactions', () => {
      fc.assert(
        fc.property(arbQuickTransaction(), (quickTx) => {
          expect(quickTx.category).toBeDefined()
          expect(quickTx.amount).toBeGreaterThan(0)
          expect(quickTx.amount).toBeLessThanOrEqual(100)
          if (quickTx.note !== undefined) {
            expect(quickTx.note.length).toBeGreaterThanOrEqual(1)
            expect(quickTx.note.length).toBeLessThanOrEqual(60)
          }
        })
      )
    })
  })

  describe('Budget Arbitraries', () => {
    it('arbBudget generates valid budgets', () => {
      fc.assert(
        fc.property(arbBudget(), (budget) => {
          expect(budget.id).toBeDefined()
          expect(budget.userId).toBeDefined()
          expect(budget.category).toBeDefined()
          expect(budget.monthlyLimit).toBeGreaterThanOrEqual(10)
          expect(budget.spent).toBeGreaterThanOrEqual(0)
          expect(budget.month).toMatch(/^\d{4}-\d{2}$/)
        })
      )
    })

    it('arbBudgetSet generates one budget per category', () => {
      fc.assert(
        fc.property(arbBudgetSet(), (budgets) => {
          expect(budgets.length).toBeGreaterThan(0)
          const categories = budgets.map((b) => b.category)
          const uniqueCategories = new Set(categories)
          expect(categories.length).toBe(uniqueCategories.size)
        })
      )
    })
  })

  describe('Daily Allowance Arbitraries', () => {
    it('arbDailyAllowance generates valid allowances', () => {
      fc.assert(
        fc.property(arbDailyAllowance(), (allowance) => {
          expect(allowance.amount).toBeGreaterThanOrEqual(0)
          expect(allowance.dailyBudget).toBeGreaterThanOrEqual(0)
          expect(allowance.spentToday).toBeGreaterThanOrEqual(0)
          expect(['healthy', 'caution', 'warning', 'over']).toContain(allowance.status)
          expect(allowance.message.length).toBeGreaterThanOrEqual(10)
          expect(typeof allowance.showCelebration).toBe('boolean')
        })
      )
    })
  })

  describe('Smart Suggestion Arbitraries', () => {
    it('arbSmartSuggestion generates valid suggestions', () => {
      fc.assert(
        fc.property(arbSmartSuggestion(), (suggestion) => {
          expect(suggestion.id).toBeDefined()
          expect(suggestion.amount).toBeGreaterThan(0)
          expect(suggestion.category).toBeDefined()
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
          expect(suggestion.confidence).toBeLessThanOrEqual(1)
          expect(['frequent', 'recent', 'typical', 'preset']).toContain(suggestion.source)
          expect(suggestion.frequency).toBeGreaterThanOrEqual(0)
        })
      )
    })
  })

  describe('Contextual Tip Arbitraries', () => {
    it('arbContextualTip generates valid tips', () => {
      fc.assert(
        fc.property(arbContextualTip(), (tip) => {
          expect(tip.id).toBeDefined()
          expect(['celebration', 'gentle_nudge', 'did_you_know', 'smart_suggestion']).toContain(
            tip.type
          )
          expect(tip.title.length).toBeGreaterThanOrEqual(5)
          expect(tip.message.length).toBeGreaterThanOrEqual(20)
          expect(tip.emoji).toBeDefined()
          expect(['low', 'medium', 'high']).toContain(tip.priority)
          expect(tip.triggerCondition).toBeDefined()
        })
      )
    })
  })

  describe('Celebration Arbitraries', () => {
    it('arbCelebrationEvent generates valid celebrations', () => {
      fc.assert(
        fc.property(arbCelebrationEvent(), (celebration) => {
          expect(celebration.id).toBeDefined()
          expect(celebration.type).toBeDefined()
          expect(celebration.title.length).toBeGreaterThanOrEqual(5)
          expect(celebration.message.length).toBeGreaterThanOrEqual(20)
          expect(celebration.emoji).toBeDefined()
          expect(['confetti', 'sparkle', 'pulse', 'bounce', 'none']).toContain(
            celebration.animation
          )
          expect(celebration.duration).toBeGreaterThanOrEqual(1000)
          expect(celebration.duration).toBeLessThanOrEqual(5000)
        })
      )
    })
  })

  describe('Onboarding Arbitraries', () => {
    it('arbOnboardingResult generates valid results', () => {
      fc.assert(
        fc.property(arbOnboardingResult(), (result) => {
          expect(result.monthlyIncome).toBeGreaterThanOrEqual(10)
          expect(['student_tight', 'student_moderate', 'young_professional', 'custom']).toContain(
            result.budgetPreset
          )
          if (result.customLimits !== undefined) {
            expect(result.customLimits.food).toBeGreaterThanOrEqual(10)
            expect(result.customLimits.rent).toBeGreaterThanOrEqual(10)
          }
        })
      )
    })
  })

  describe('Date Arbitraries', () => {
    it('arbDateString generates valid date strings', () => {
      fc.assert(
        fc.property(arbDateString(), (dateStr) => {
          expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          const date = new Date(dateStr)
          expect(date.toString()).not.toBe('Invalid Date')
        })
      )
    })
  })
})
