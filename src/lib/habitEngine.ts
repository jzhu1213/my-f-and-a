import type { Transaction, TransactionCategory } from '@/types'

/**
 * Time-of-day slots for habit prediction.
 * Maps to rough periods a college student would recognize.
 */
export type TimeSlot =
  | 'early_morning' // 5–8 AM
  | 'morning'       // 8–11 AM
  | 'midday'        // 11 AM–2 PM
  | 'afternoon'     // 2–5 PM
  | 'evening'       // 5–9 PM
  | 'night'         // 9 PM–5 AM

export interface HabitPrediction {
  category: TransactionCategory
  amount: number
  note?: string
  confidence: number // 0–1, higher = more certain
}

export interface HabitChip {
  category: TransactionCategory
  amount: number
  note?: string
  label: string
  frequency: number
}

/**
 * Returns the time-of-day slot for a given date.
 * Used to bucket transactions by when they typically happen.
 */
export function getTimeOfDaySlot(date: Date): TimeSlot {
  const hour = date.getHours()
  if (hour >= 5 && hour < 8) return 'early_morning'
  if (hour >= 8 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'midday'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

/**
 * Analyzes transaction history to predict the most likely expense
 * for the current time of day.
 *
 * Algorithm:
 * 1. Filter to expense transactions only
 * 2. Group by time slot (based on createdAt)
 * 3. For the current slot, find the most common category+amount combo
 * 4. Return the top prediction with confidence score
 *
 * Returns null if there's insufficient data (< 3 transactions in the slot)
 * or if confidence is too low (< 0.2).
 */
export function predictHabit(
  transactions: Transaction[],
  currentTime?: Date
): HabitPrediction | null {
  if (!transactions || transactions.length === 0) return null

  const now = currentTime ?? new Date()
  const currentSlot = getTimeOfDaySlot(now)

  // Filter to expenses that match the current time slot
  const slotTransactions = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false
    const txDate = new Date(tx.createdAt)
    return getTimeOfDaySlot(txDate) === currentSlot
  })

  // Need at least 3 transactions in this slot to be meaningful
  if (slotTransactions.length < 3) return null

  // Group by category + rounded amount
  const comboMap = new Map<string, { count: number; category: TransactionCategory; amount: number; note?: string }>()

  for (const tx of slotTransactions) {
    // Round to nearest dollar for grouping
    const roundedAmount = Math.round(tx.amount)
    const key = `${tx.category}|${roundedAmount}`

    const existing = comboMap.get(key)
    if (existing) {
      existing.count++
      // Keep most recent note
      if (tx.note) existing.note = tx.note
    } else {
      comboMap.set(key, {
        count: 1,
        category: tx.category,
        amount: roundedAmount,
        note: tx.note,
      })
    }
  }

  // Find the most frequent combo
  let best: { count: number; category: TransactionCategory; amount: number; note?: string } | null = null
  for (const entry of comboMap.values()) {
    if (!best || entry.count > best.count) {
      best = entry
    }
  }

  if (!best) return null

  const confidence = best.count / slotTransactions.length

  // Only return if confidence is meaningful
  if (confidence < 0.2) return null

  return {
    category: best.category,
    amount: best.amount,
    note: best.note,
    confidence,
  }
}

/**
 * Returns the top N most-frequently-logged transactions across all time.
 * These are frequency-weighted (not recency-weighted like getRecentRepeats).
 *
 * Used for "log again" habit chips that surface the user's real patterns.
 */
export function getTopHabitChips(
  transactions: Transaction[],
  limit = 3
): HabitChip[] {
  if (!transactions || transactions.length === 0) return []

  // Only consider expenses
  const expenses = transactions.filter((tx) => tx.type === 'expense')
  if (expenses.length === 0) return []

  // Group by category + rounded amount + note
  const comboMap = new Map<string, { count: number; category: TransactionCategory; amount: number; note?: string }>()

  for (const tx of expenses) {
    const roundedAmount = Math.round(tx.amount * 2) / 2 // round to nearest $0.50
    const noteKey = tx.note?.trim() ?? ''
    const key = `${tx.category}|${roundedAmount}|${noteKey}`

    const existing = comboMap.get(key)
    if (existing) {
      existing.count++
    } else {
      comboMap.set(key, {
        count: 1,
        category: tx.category,
        amount: roundedAmount,
        note: tx.note?.trim() || undefined,
      })
    }
  }

  // Sort by frequency, take top N (minimum 2 occurrences to be a "habit")
  const sorted = Array.from(comboMap.values())
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return sorted.map((entry) => {
    const amountStr = entry.amount % 1 === 0 ? `$${entry.amount}` : `$${entry.amount.toFixed(2)}`
    const label = entry.note
      ? `${entry.note} · ${amountStr}`
      : amountStr

    return {
      category: entry.category,
      amount: entry.amount,
      note: entry.note,
      label,
      frequency: entry.count,
    }
  })
}
