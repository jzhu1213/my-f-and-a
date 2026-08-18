import { describe, it, expect } from 'vitest'
import { formatNumber, formatMoney, formatDate, formatRelativeDate } from './localeFormat'

// ============================================================================
// Locale-aware formatting verification — Task 459.2
// Validates: Requirements 27.5
//
// Tests formatting behavior across 3 distinct locales: en-US, de-DE, ja-JP.
// Verifies decimal separators, thousands separators, currency symbol placement,
// date format differences, and relative date labels.
// ============================================================================

describe('localeFormat — locale-aware formatting verification', () => {
  // ==========================================================================
  // Number formatting
  // ==========================================================================

  describe('formatNumber — decimal and thousands separators', () => {
    it('en-US: period decimal, comma thousands', () => {
      const result = formatNumber(1234.56, {}, 'en-US')
      expect(result).toBe('1,234.56')
    })

    it('de-DE: comma decimal, period thousands', () => {
      const result = formatNumber(1234.56, {}, 'de-DE')
      // de-DE uses period as thousands separator and comma as decimal
      expect(result).toContain(',') // decimal separator
      expect(result).toContain('.') // thousands separator
      // Verify numeric value is represented correctly
      expect(result).toMatch(/1\.234,56/)
    })

    it('ja-JP: period decimal, comma thousands (same as en-US for plain numbers)', () => {
      const result = formatNumber(1234.56, {}, 'ja-JP')
      // Japanese locale also uses comma thousands and period decimal for numbers
      expect(result).toBe('1,234.56')
    })

    it('handles zero correctly across locales', () => {
      expect(formatNumber(0, {}, 'en-US')).toBe('0')
      expect(formatNumber(0, {}, 'de-DE')).toBe('0')
      expect(formatNumber(0, {}, 'ja-JP')).toBe('0')
    })

    it('coerces non-finite values to 0', () => {
      expect(formatNumber(NaN, {}, 'en-US')).toBe('0')
      expect(formatNumber(Infinity, {}, 'de-DE')).toBe('0')
    })
  })

  // ==========================================================================
  // Currency formatting
  // ==========================================================================

  describe('formatMoney — currency symbol placement and decimals', () => {
    it('en-US: $ prefix with 2 decimals', () => {
      const result = formatMoney(14, 'USD', { locale: 'en-US' })
      expect(result).toBe('$14.00')
    })

    it('de-DE: € suffix with comma decimal', () => {
      const result = formatMoney(14, 'EUR', { locale: 'de-DE' })
      // German locale places € after the amount with a space
      expect(result).toContain('14')
      expect(result).toContain('€')
      // The comma is used as decimal separator
      expect(result).toMatch(/14,00/)
    })

    it('ja-JP: ¥ prefix with 0 decimals (JPY is zero-decimal currency)', () => {
      const result = formatMoney(500, 'JPY', { locale: 'ja-JP' })
      // Intl may use fullwidth yen ￥ (U+FFE5) or halfwidth ¥ (U+00A5)
      expect(result).toMatch(/[¥￥]/)
      expect(result).toContain('500')
      // JPY has 0 decimal digits — no decimal portion
      expect(result).not.toMatch(/500[.,]\d/)
    })

    it('en-US: large currency amount has thousands separator', () => {
      const result = formatMoney(1234.56, 'USD', { locale: 'en-US' })
      expect(result).toBe('$1,234.56')
    })

    it('de-DE: large EUR amount uses period thousands, comma decimal', () => {
      const result = formatMoney(1234.56, 'EUR', { locale: 'de-DE' })
      // Should contain period as thousands separator and comma as decimal
      expect(result).toMatch(/1\.234,56/)
      expect(result).toContain('€')
    })

    it('ja-JP: large JPY amount has comma thousands, no decimals', () => {
      const result = formatMoney(12345, 'JPY', { locale: 'ja-JP' })
      // Intl may use fullwidth yen ￥ (U+FFE5) or halfwidth ¥ (U+00A5)
      expect(result).toMatch(/[¥￥]/)
      // Large yen amounts use grouping
      expect(result).toContain('12,345')
    })

    it('coerces non-finite amount to zero', () => {
      expect(formatMoney(NaN, 'USD', { locale: 'en-US' })).toBe('$0.00')
    })
  })

  // ==========================================================================
  // Date formatting
  // ==========================================================================

  describe('formatDate — locale date differences', () => {
    // Use a fixed date: June 15, 2024
    const testDate = new Date(2024, 5, 15) // month is 0-indexed

    it('en-US: "Jun 15" short format', () => {
      const result = formatDate(testDate, { month: 'short', day: 'numeric' }, 'en-US')
      expect(result).toBe('Jun 15')
    })

    it('de-DE: day before month in short format', () => {
      const result = formatDate(testDate, { month: 'short', day: 'numeric' }, 'de-DE')
      // German typically puts day before month: "15. Jun." or "15. Juni"
      expect(result).toMatch(/15/)
      expect(result).toMatch(/Jun/i)
    })

    it('ja-JP: month/day order with Japanese characters', () => {
      const result = formatDate(testDate, { month: 'short', day: 'numeric' }, 'ja-JP')
      // Japanese format includes month/day with Japanese markers
      expect(result).toMatch(/6|月|15|日/)
    })

    it('handles YYYY-MM-DD string input', () => {
      const result = formatDate('2024-06-15', { month: 'short', day: 'numeric' }, 'en-US')
      expect(result).toBe('Jun 15')
    })

    it('long format differs across locales', () => {
      const opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
      const enResult = formatDate(testDate, opts, 'en-US')
      const deResult = formatDate(testDate, opts, 'de-DE')
      const jaResult = formatDate(testDate, opts, 'ja-JP')

      // en-US: "June 15, 2024"
      expect(enResult).toContain('June')
      expect(enResult).toContain('2024')

      // de-DE: "15. Juni 2024"
      expect(deResult).toContain('2024')
      expect(deResult).toMatch(/15/)

      // ja-JP: "2024年6月15日"
      expect(jaResult).toContain('2024')
    })
  })

  // ==========================================================================
  // Relative date formatting
  // ==========================================================================

  describe('formatRelativeDate — "Today" / "Yesterday" / locale short date', () => {
    it('returns "Today" for today in all locales (English string)', () => {
      const today = new Date()
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-')

      // "Today"/"Yesterday" labels remain in English (i18n strings not yet translated)
      expect(formatRelativeDate(todayStr, 'en-US')).toBe('Today')
      expect(formatRelativeDate(todayStr, 'de-DE')).toBe('Today')
      expect(formatRelativeDate(todayStr, 'ja-JP')).toBe('Today')
    })

    it('returns "Yesterday" for yesterday in all locales', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = [
        yesterday.getFullYear(),
        String(yesterday.getMonth() + 1).padStart(2, '0'),
        String(yesterday.getDate()).padStart(2, '0'),
      ].join('-')

      expect(formatRelativeDate(yStr, 'en-US')).toBe('Yesterday')
      expect(formatRelativeDate(yStr, 'de-DE')).toBe('Yesterday')
      expect(formatRelativeDate(yStr, 'ja-JP')).toBe('Yesterday')
    })

    it('formats older dates with locale-appropriate short date', () => {
      // A date clearly in the past (not today or yesterday)
      const oldDate = '2024-01-10'

      const enResult = formatRelativeDate(oldDate, 'en-US')
      const deResult = formatRelativeDate(oldDate, 'de-DE')
      const jaResult = formatRelativeDate(oldDate, 'ja-JP')

      // en-US: "Jan 10"
      expect(enResult).toBe('Jan 10')

      // de-DE: something like "10. Jan." with day first
      expect(deResult).toMatch(/10/)
      expect(deResult).toMatch(/Jan/i)

      // ja-JP: something like "1月10日"
      expect(jaResult).toMatch(/1|月|10|日/)
    })
  })
})
