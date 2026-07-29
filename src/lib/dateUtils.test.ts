import { describe, it, expect } from 'vitest'

/**
 * Tests for local-time date utilities (Task 94.1)
 * 
 * These tests verify that "today" is always calculated using local time,
 * not UTC time, which prevents timezone-related day-boundary bugs.
 */

import { 
  formatDateLocal, 
  getTodayLocal, 
  getYesterdayLocal, 
  isSameDayLocal,
  getDaysInMonthLocal,
  subtractDaysLocal,
  addDaysLocal,
  parseDateLocal
} from './dateUtils'

describe('Local Time Date Utilities (Task 94.1)', () => {
  describe('formatDateLocal', () => {
    it('should format a date using local time, not UTC', () => {
      // Create a date at 11:59 PM on Dec 31, 2023 in local time
      const date = new Date(2023, 11, 31, 23, 59, 0)
      const formatted = formatDateLocal(date)
      
      // Should be Dec 31 in local time, regardless of UTC offset
      expect(formatted).toBe('2023-12-31')
    })

    it('should format a date at local midnight correctly', () => {
      const date = new Date(2024, 0, 1, 0, 0, 0)
      const formatted = formatDateLocal(date)
      expect(formatted).toBe('2024-01-01')
    })
  })

  describe('parseDateLocal', () => {
    it('should parse a date string to local midnight', () => {
      const parsed = parseDateLocal('2023-12-31')
      expect(parsed.getFullYear()).toBe(2023)
      expect(parsed.getMonth()).toBe(11) // December (0-indexed)
      expect(parsed.getDate()).toBe(31)
      expect(parsed.getHours()).toBe(0)
      expect(parsed.getMinutes()).toBe(0)
      expect(parsed.getSeconds()).toBe(0)
    })
  })

  describe('getTodayLocal', () => {
    it('should return today in YYYY-MM-DD format using local time', () => {
      const today = getTodayLocal()
      const now = new Date()
      const expected = formatDateLocal(now)
      expect(today).toBe(expected)
    })
  })

  describe('getYesterdayLocal', () => {
    it('should return yesterday in YYYY-MM-DD format using local time', () => {
      const yesterday = getYesterdayLocal()
      const now = new Date()
      const yesterdayDate = subtractDaysLocal(now, 1)
      const expected = formatDateLocal(yesterdayDate)
      expect(yesterday).toBe(expected)
    })
  })

  describe('isSameDayLocal', () => {
    it('should return true for dates on the same local day', () => {
      const date1 = new Date(2023, 11, 31, 10, 0, 0)
      const date2 = new Date(2023, 11, 31, 23, 59, 0)
      expect(isSameDayLocal(date1, date2)).toBe(true)
    })

    it('should return false for dates on different local days', () => {
      const date1 = new Date(2023, 11, 31, 23, 59, 0)
      const date2 = new Date(2024, 0, 1, 0, 1, 0)
      expect(isSameDayLocal(date1, date2)).toBe(false)
    })
  })

  describe('getDaysInMonthLocal', () => {
    it('should return correct days for a 31-day month', () => {
      const date = new Date(2023, 0, 15) // January 2023
      expect(getDaysInMonthLocal(date)).toBe(31)
    })

    it('should return correct days for a 30-day month', () => {
      const date = new Date(2023, 3, 15) // April 2023
      expect(getDaysInMonthLocal(date)).toBe(30)
    })

    it('should return correct days for February in a leap year', () => {
      const date = new Date(2024, 1, 15) // February 2024 (leap year)
      expect(getDaysInMonthLocal(date)).toBe(29)
    })

    it('should return correct days for February in a non-leap year', () => {
      const date = new Date(2023, 1, 15) // February 2023 (non-leap year)
      expect(getDaysInMonthLocal(date)).toBe(28)
    })
  })

  describe('subtractDaysLocal', () => {
    it('should subtract days correctly within the same month', () => {
      const date = new Date(2023, 0, 15) // Jan 15, 2023
      const result = subtractDaysLocal(date, 5)
      expect(formatDateLocal(result)).toBe('2023-01-10')
    })

    it('should subtract days correctly across month boundary', () => {
      const date = new Date(2023, 0, 5) // Jan 5, 2023
      const result = subtractDaysLocal(date, 10)
      expect(formatDateLocal(result)).toBe('2022-12-26')
    })
  })

  describe('addDaysLocal', () => {
    it('should add days correctly within the same month', () => {
      const date = new Date(2023, 0, 15) // Jan 15, 2023
      const result = addDaysLocal(date, 5)
      expect(formatDateLocal(result)).toBe('2023-01-20')
    })

    it('should add days correctly across month boundary', () => {
      const date = new Date(2023, 0, 28) // Jan 28, 2023
      const result = addDaysLocal(date, 10)
      expect(formatDateLocal(result)).toBe('2023-02-07')
    })
  })

  describe('Timezone bug fix verification', () => {
    it('should handle late-night transactions correctly (Task 94.1 fix)', () => {
      // Simulate a user in PST (UTC-8) logging a transaction at 11:59 PM on Dec 31
      // In UTC, this would be Jan 1 at 7:59 AM, but we want local date
      const lateNight = new Date(2023, 11, 31, 23, 59, 0)
      const dateStr = formatDateLocal(lateNight)
      
      // Should appear on Dec 31, not Jan 1
      expect(dateStr).toBe('2023-12-31')
      
      // Before the fix, this would have been '2024-01-01' if using UTC
    })

    it('should reset at local midnight, not UTC midnight', () => {
      // Day 1: Dec 31, 2023 at 11:59 PM
      const beforeMidnight = new Date(2023, 11, 31, 23, 59, 0)
      
      // Day 2: Jan 1, 2024 at 12:01 AM
      const afterMidnight = new Date(2024, 0, 1, 0, 1, 0)
      
      // Should be recognized as different days
      expect(isSameDayLocal(beforeMidnight, afterMidnight)).toBe(false)
      
      // Should be consecutive days
      expect(formatDateLocal(beforeMidnight)).toBe('2023-12-31')
      expect(formatDateLocal(afterMidnight)).toBe('2024-01-01')
    })
  })
})
