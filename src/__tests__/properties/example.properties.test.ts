/**
 * Example property-based tests
 * This file demonstrates how to use the arbitraries for property-based testing
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  arbMoneyAmount,
  arbBudgetSet,
  arbTransaction,
  arbSmartSuggestion,
} from './arbitraries'

describe('Example Properties', () => {
  describe('Money Amount Properties', () => {
    it('adding two money amounts should always be positive', () => {
      fc.assert(
        fc.property(arbMoneyAmount(), arbMoneyAmount(), (a, b) => {
          const sum = a + b
          expect(sum).toBeGreaterThan(0)
        })
      )
    })

    it('money amounts should round to 2 decimal places correctly', () => {
      fc.assert(
        fc.property(arbMoneyAmount(), (amount) => {
          const rounded = Math.round(amount * 100) / 100
          expect(rounded).toBeCloseTo(amount, 2)
        })
      )
    })
  })

  describe('Budget Properties', () => {
    it('total monthly budget should equal sum of all category limits', () => {
      fc.assert(
        fc.property(arbBudgetSet(), (budgets) => {
          const total = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
          const calculated = budgets.map((b) => b.monthlyLimit).reduce((a, b) => a + b, 0)
          expect(total).toBeCloseTo(calculated, 2)
        })
      )
    })

    it('each budget category should be unique in a budget set', () => {
      fc.assert(
        fc.property(arbBudgetSet(), (budgets) => {
          const categories = budgets.map((b) => b.category)
          const uniqueCategories = new Set(categories)
          expect(categories.length).toBe(uniqueCategories.size)
        })
      )
    })
  })

  describe('Transaction Properties', () => {
    it('filtering transactions by date should never increase count', () => {
      fc.assert(
        fc.property(fc.array(arbTransaction()), (transactions) => {
          const date = '2024-01-15'
          const filtered = transactions.filter((t) => t.date === date)
          expect(filtered.length).toBeLessThanOrEqual(transactions.length)
        })
      )
    })

    it('expense transactions should have positive amounts', () => {
      fc.assert(
        fc.property(fc.array(arbTransaction()), (transactions) => {
          const expenses = transactions.filter((t) => t.type === 'expense')
          expenses.forEach((expense) => {
            expect(expense.amount).toBeGreaterThan(0)
          })
        })
      )
    })
  })

  describe('Smart Suggestion Properties', () => {
    it('confidence score should always be between 0 and 1', () => {
      fc.assert(
        fc.property(arbSmartSuggestion(), (suggestion) => {
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
          expect(suggestion.confidence).toBeLessThanOrEqual(1)
        })
      )
    })

    it('suggestions should have positive amounts', () => {
      fc.assert(
        fc.property(fc.array(arbSmartSuggestion(), { maxLength: 4 }), (suggestions) => {
          suggestions.forEach((s) => {
            expect(s.amount).toBeGreaterThan(0)
          })
        })
      )
    })

    it('sorting suggestions by confidence should maintain order', () => {
      fc.assert(
        fc.property(fc.array(arbSmartSuggestion(), { minLength: 2 }), (suggestions) => {
          const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence)
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].confidence).toBeGreaterThanOrEqual(sorted[i + 1].confidence)
          }
        })
      )
    })
  })
})
