import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  DEFAULT_HOME_CURRENCY,
  getCurrency,
  getCurrencySymbol,
  isSupportedCurrency,
  normalizeCode,
  isValidExchangeRate,
  convertToHome,
  convertToLocal,
  isForeignTransaction,
  resolveTransactionAmount,
  formatCurrency,
  formatTransactionAmount,
  describeConversion,
} from './currencyUtils'

describe('currencyUtils', () => {
  describe('lookups', () => {
    it('normalizes codes to uppercase and trims', () => {
      expect(normalizeCode('  usd ')).toBe('USD')
      expect(normalizeCode(undefined)).toBe('')
      expect(normalizeCode(null)).toBe('')
    })

    it('finds curated currencies case-insensitively', () => {
      expect(getCurrency('thb')?.name).toBe('Thai Baht')
      expect(getCurrency('EUR')?.symbol).toBe('€')
      expect(getCurrency('ZZZ')).toBeUndefined()
    })

    it('falls back to the code for unknown symbols', () => {
      expect(getCurrencySymbol('USD')).toBe('$')
      expect(getCurrencySymbol('ZZZ')).toBe('ZZZ')
    })

    it('reports supported currencies', () => {
      expect(isSupportedCurrency('JPY')).toBe(true)
      expect(isSupportedCurrency('ZZZ')).toBe(false)
    })
  })

  describe('validation', () => {
    it('accepts only finite positive rates', () => {
      expect(isValidExchangeRate(0.028)).toBe(true)
      expect(isValidExchangeRate(0)).toBe(false)
      expect(isValidExchangeRate(-1)).toBe(false)
      expect(isValidExchangeRate(Infinity)).toBe(false)
      expect(isValidExchangeRate(NaN)).toBe(false)
      expect(isValidExchangeRate('1' as unknown)).toBe(false)
    })
  })

  describe('conversion', () => {
    it('converts local to home and back', () => {
      // 1 THB = 0.028 USD → 500 THB = 14 USD
      expect(convertToHome(500, 0.028)).toBeCloseTo(14, 10)
      expect(convertToLocal(14, 0.028)).toBeCloseTo(500, 6)
    })

    it('returns the input unchanged for an invalid rate', () => {
      expect(convertToHome(500, 0)).toBe(500)
      expect(convertToLocal(14, -1)).toBe(14)
    })
  })

  describe('isForeignTransaction (backward-compatible)', () => {
    it('is not foreign without a currency', () => {
      expect(isForeignTransaction({})).toBe(false)
      expect(isForeignTransaction({ currency: undefined, exchangeRate: undefined })).toBe(false)
    })

    it('is not foreign when currency equals home currency', () => {
      expect(isForeignTransaction({ currency: 'USD', exchangeRate: 1 }, 'USD')).toBe(false)
    })

    it('is not foreign without a valid rate', () => {
      expect(isForeignTransaction({ currency: 'THB' })).toBe(false)
      expect(isForeignTransaction({ currency: 'THB', exchangeRate: 0 })).toBe(false)
    })

    it('is foreign with a distinct currency and valid rate', () => {
      expect(isForeignTransaction({ currency: 'THB', exchangeRate: 0.028 }, 'USD')).toBe(true)
    })
  })

  describe('resolveTransactionAmount', () => {
    it('treats single-currency transactions as identity', () => {
      const conv = resolveTransactionAmount({ amount: 14 })
      expect(conv.isForeign).toBe(false)
      expect(conv.homeAmount).toBe(14)
      expect(conv.localAmount).toBe(14)
      expect(conv.homeCurrency).toBe(DEFAULT_HOME_CURRENCY)
      expect(conv.exchangeRate).toBe(1)
    })

    it('derives the local amount from the stored home amount and rate', () => {
      const conv = resolveTransactionAmount(
        { amount: 14, currency: 'THB', exchangeRate: 0.028 },
        'USD'
      )
      expect(conv.isForeign).toBe(true)
      expect(conv.homeAmount).toBe(14)
      expect(conv.localAmount).toBeCloseTo(500, 6)
      expect(conv.localCurrency).toBe('THB')
    })
  })

  describe('formatCurrency', () => {
    it('formats home amounts with the currency symbol', () => {
      expect(formatCurrency(14, 'USD')).toBe('$14.00')
    })

    it('respects zero-decimal currencies', () => {
      expect(formatCurrency(500, 'JPY')).toBe('¥500')
    })

    it('falls back gracefully for unknown ISO codes', () => {
      const out = formatCurrency(10, 'ZZZ')
      expect(out).toContain('10')
    })

    it('coerces non-finite amounts to zero', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('$0.00')
    })
  })

  describe('formatTransactionAmount + describeConversion', () => {
    it('omits the local string for single-currency transactions', () => {
      const parts = formatTransactionAmount({ amount: 14 }, 'USD')
      expect(parts.isForeign).toBe(false)
      expect(parts.local).toBeUndefined()
      expect(parts.home).toBe('$14.00')
      expect(describeConversion({ amount: 14 }, 'USD')).toBe('$14.00')
    })

    it('shows both currencies for a foreign transaction', () => {
      const tx = { amount: 14, currency: 'THB', exchangeRate: 0.028 }
      const parts = formatTransactionAmount(tx, 'USD')
      expect(parts.isForeign).toBe(true)
      // The exact THB rendering (฿ vs "THB") depends on the runtime's ICU data,
      // so assert on the stable local value rather than the symbol glyph.
      expect(parts.local).toContain('500')
      expect(parts.home).toBe('$14.00')
      expect(describeConversion(tx, 'USD')).toBe(`${parts.local} · about $14.00`)
    })
  })

  // ==========================================================================
  // Property-based tests
  // ==========================================================================

  describe('properties', () => {
    it('convertToLocal inverts convertToHome for valid rates', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
          fc.double({ min: 0.0001, max: 10_000, noNaN: true }),
          (localAmount, rate) => {
            const home = convertToHome(localAmount, rate)
            const back = convertToLocal(home, rate)
            expect(back).toBeCloseTo(localAmount, 4)
          }
        )
      )
    })

    it('a transaction without a currency is never foreign (default experience unchanged)', () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 1_000_000, noNaN: true }), (amount) => {
          const conv = resolveTransactionAmount({ amount })
          expect(conv.isForeign).toBe(false)
          expect(conv.homeAmount).toBe(amount)
          expect(conv.localAmount).toBe(amount)
        })
      )
    })

    it('resolved local amount converts back to the stored home amount', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
          fc.double({ min: 0.0001, max: 10_000, noNaN: true }),
          (homeAmount, rate) => {
            const conv = resolveTransactionAmount(
              { amount: homeAmount, currency: 'THB', exchangeRate: rate },
              'USD'
            )
            expect(convertToHome(conv.localAmount, rate)).toBeCloseTo(homeAmount, 4)
          }
        )
      )
    })

    it('formatCurrency always returns a non-empty string', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }),
          fc.constantFrom('USD', 'EUR', 'JPY', 'THB', 'ZZZ'),
          (amount, code) => {
            const out = formatCurrency(amount, code)
            expect(typeof out).toBe('string')
            expect(out.length).toBeGreaterThan(0)
          }
        )
      )
    })
  })
})
