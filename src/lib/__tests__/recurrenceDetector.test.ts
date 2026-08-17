import { describe, it, expect } from 'vitest'
import { detectRecurrences } from '@/lib/recurrenceDetector'
import type { Transaction } from '@/types'

// ============================================================================
// Helpers
// ============================================================================

let idCounter = 0

/** Creates a transaction with sensible defaults. */
function makeTx(overrides: Partial<Transaction> & { date: string; amount: number; note: string }): Transaction {
  idCounter++
  return {
    id: `tx-${idCounter}`,
    userId: 'test-user',
    type: 'expense',
    category: 'other',
    accountType: 'personal',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Generates a series of transactions at regular intervals.
 * @param startDate - YYYY-MM-DD start date
 * @param intervalDays - days between occurrences
 * @param count - number of transactions to generate
 * @param note - transaction note/merchant
 * @param amount - base amount (slight variance added if jitter > 0)
 * @param jitter - max random amount variance (± jitter)
 * @param category - transaction category
 */
function generateRecurring(
  startDate: string,
  intervalDays: number,
  count: number,
  note: string,
  amount: number,
  jitter: number = 0,
  category: Transaction['category'] = 'other'
): Transaction[] {
  const txs: Transaction[] = []
  const [year, month, day] = startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day)

  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime())
    d.setDate(d.getDate() + i * intervalDays)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    // Add slight amount variance for realism
    const variance = jitter > 0 ? (Math.sin(i * 1.7) * jitter) : 0
    const txAmount = Math.round((amount + variance) * 100) / 100

    txs.push(makeTx({
      date: dateStr,
      amount: Math.abs(txAmount),
      note,
      category,
      type: 'expense',
    }))
  }

  return txs
}

// ============================================================================
// Tests — Validates: Requirements 23.1
// ============================================================================

describe('detectRecurrences — accuracy with seeded 3-month data', () => {
  // Seed data: 3 months starting from 2024-01-01
  // Weekly coffee: ~$5, every 7 days, ~13 occurrences over 3 months
  const weeklyCoffee = generateRecurring(
    '2024-01-01', 7, 13, 'Starbucks Coffee', 5.25, 0.50, 'drinks'
  )

  // Monthly rent: $1200, every ~30 days, 3 occurrences
  const monthlyRent = generateRecurring(
    '2024-01-01', 30, 3, 'Rent Payment', 1200, 0, 'rent'
  )

  // Biweekly paycheck: income, every ~14 days — should NOT be detected (income type)
  const biweeklyPaycheck: Transaction[] = generateRecurring(
    '2024-01-05', 14, 7, 'Company Paycheck', 1500, 0, 'income'
  ).map(tx => ({ ...tx, type: 'income' as const }))

  // One-off similar transactions that should NOT be detected as recurring
  const oneOffTransactions: Transaction[] = [
    // A single coffee at a different place (different note = different group)
    makeTx({ date: '2024-02-10', amount: 4.75, note: 'Blue Bottle Coffee', category: 'drinks' }),
    // A single large payment to landlord for something else (different note)
    makeTx({ date: '2024-02-15', amount: 200, note: 'Landlord Repair Fee', category: 'other' }),
    // Two purchases at the same place — not enough for 3-occurrence threshold
    makeTx({ date: '2024-01-20', amount: 12.99, note: 'Random Store', category: 'food' }),
    makeTx({ date: '2024-02-25', amount: 13.50, note: 'Random Store', category: 'food' }),
  ]

  const allTransactions = [
    ...weeklyCoffee,
    ...monthlyRent,
    ...biweeklyPaycheck,
    ...oneOffTransactions,
  ]

  const results = detectRecurrences(allTransactions)

  it('detects the weekly coffee pattern', () => {
    const coffee = results.find(r => r.label.toLowerCase().includes('starbucks'))
    expect(coffee).toBeDefined()
    expect(coffee!.frequency).toBe('weekly')
    // Amount should be approximately $5.25 (with small jitter)
    expect(coffee!.amount).toBeGreaterThan(4.5)
    expect(coffee!.amount).toBeLessThan(6.0)
    // Should have detected all 13 occurrences
    expect(coffee!.occurrenceCount).toBe(13)
    // Confidence should be fairly high given regular pattern
    expect(coffee!.confidence).toBeGreaterThan(0.5)
  })

  it('detects the monthly rent pattern', () => {
    const rent = results.find(r => r.label.toLowerCase().includes('rent payment'))
    expect(rent).toBeDefined()
    expect(rent!.frequency).toBe('monthly')
    // Amount should be exactly $1200
    expect(rent!.amount).toBeCloseTo(1200, 0)
    // Should have detected 3 occurrences
    expect(rent!.occurrenceCount).toBe(3)
    // Confidence should be reasonable
    expect(rent!.confidence).toBeGreaterThanOrEqual(0.4)
  })

  it('does NOT detect biweekly paycheck (income type is excluded)', () => {
    const paycheck = results.find(r => r.label.toLowerCase().includes('paycheck'))
    expect(paycheck).toBeUndefined()
  })

  it('does NOT detect one-off similar transactions (no false positives)', () => {
    // Blue Bottle Coffee: only 1 occurrence, should not be detected
    const bluebottle = results.find(r => r.label.toLowerCase().includes('blue bottle'))
    expect(bluebottle).toBeUndefined()

    // Landlord Repair Fee: only 1 occurrence
    const repair = results.find(r => r.label.toLowerCase().includes('landlord repair'))
    expect(repair).toBeUndefined()

    // Random Store: only 2 occurrences (threshold is 3)
    const randomStore = results.find(r => r.label.toLowerCase().includes('random store'))
    expect(randomStore).toBeUndefined()
  })

  it('weekly coffee has correct timing (nextOccurrence roughly 7 days after last)', () => {
    const coffee = results.find(r => r.label.toLowerCase().includes('starbucks'))
    expect(coffee).toBeDefined()

    // Last coffee was at day index 12 * 7 = 84 days from start (2024-01-01 + 84 days = 2024-03-25)
    // Next occurrence should be about 7 days later
    const lastDate = new Date(coffee!.lastOccurrence)
    const nextDate = new Date(coffee!.nextOccurrence)
    const daysDiff = (nextDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

    // Should be approximately 7 days
    expect(daysDiff).toBeGreaterThan(5)
    expect(daysDiff).toBeLessThan(10)
  })

  it('monthly rent has correct timing (nextOccurrence roughly 30 days after last)', () => {
    const rent = results.find(r => r.label.toLowerCase().includes('rent payment'))
    expect(rent).toBeDefined()

    const lastDate = new Date(rent!.lastOccurrence)
    const nextDate = new Date(rent!.nextOccurrence)
    const daysDiff = (nextDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

    // Should be approximately 30 days
    expect(daysDiff).toBeGreaterThan(25)
    expect(daysDiff).toBeLessThan(35)
  })

  it('only detects the expected number of recurring patterns (no extra false positives)', () => {
    // We expect exactly 2 patterns: weekly coffee + monthly rent
    expect(results.length).toBe(2)
  })
})
