import type { Transaction, TransactionCategory } from '@/types'
import type { SmartSuggestion } from '@/types/folio'

/**
 * Returns category-specific preset amounts appropriate for college students.
 * Used as a fallback when transaction history is insufficient to generate suggestions.
 */
export function getCategoryPresets(category: TransactionCategory): number[] {
  switch (category) {
    case 'food':      return [8, 12, 5, 15]
    case 'rent':      return [500, 600, 800, 400]
    case 'transport': return [3, 10, 25, 50]
    case 'school':    return [50, 100, 20, 200]
    case 'fun':       return [10, 20, 5, 30]
    case 'gig':       return [50, 100, 25, 75]
    case 'income':    return [500, 1000, 200, 750]
    case 'other':     return [10, 20, 5, 50]
    default:          return [10, 20, 5, 50]
  }
}

/**
 * Generates smart amount suggestions for a given category based on transaction history.
 *
 * Algorithm:
 * 1. Filter to expense transactions matching the category
 * 2. Group similar amounts by rounding to nearest $0.50
 * 3. Count frequency of each rounded amount and collect notes
 * 4. Sort by frequency descending and take top 4
 * 5. Calculate confidence as frequency / totalCategoryTransactions
 * 6. Use the most recent (last) note as the label
 * 7. Fall back to category presets if fewer than 2 suggestions found
 *
 * Postconditions:
 * - Returns 0–4 SmartSuggestion objects
 * - All amounts are positive
 * - No duplicate amounts in result
 * - Sorted by confidence descending
 */
export function generateSmartSuggestions(
  category: TransactionCategory,
  transactions: Transaction[]
): SmartSuggestion[] {
  // Step 1: Filter to relevant expense transactions for this category
  const categoryTxs = transactions.filter(
    (t) => t.category === category && t.type === 'expense'
  )

  // Step 2 & 3: Group by rounded amount, count frequency, collect notes
  const amountMap = new Map<number, { count: number; notes: string[] }>()

  for (const tx of categoryTxs) {
    // Round to nearest $0.50 to group similar amounts
    const rounded = Math.round(tx.amount * 2) / 2

    // Only include positive amounts
    if (rounded <= 0) continue

    const existing = amountMap.get(rounded) ?? { count: 0, notes: [] }
    existing.count++
    if (tx.note) {
      existing.notes.push(tx.note)
    }
    amountMap.set(rounded, existing)
  }

  // Step 4: Sort by frequency descending, take top 4
  const sorted = Array.from(amountMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)

  // Step 5 & 6: Build suggestion objects
  const totalCategoryTxs = categoryTxs.length || 1

  const suggestions: SmartSuggestion[] = sorted.map(([amount, data], index) => {
    // Use the last note seen (most recent, since transactions arrive in order)
    const label = data.notes.length > 0
      ? data.notes[data.notes.length - 1]
      : undefined

    return {
      id: `${category}-${amount}-${index}`,
      amount,
      category,
      label,
      confidence: data.count / totalCategoryTxs,
      source: data.count >= 3 ? 'frequent' : 'recent',
      frequency: data.count,
    }
  })

  // Step 7: Pad with presets if fewer than 2 history-based suggestions
  if (suggestions.length < 2) {
    const presets = getCategoryPresets(category)
    for (const preset of presets) {
      if (suggestions.length >= 4) break
      // Avoid duplicate amounts
      if (!suggestions.some((s) => s.amount === preset)) {
        suggestions.push({
          id: `${category}-preset-${preset}`,
          amount: preset,
          category,
          confidence: 0.1,
          source: 'preset',
          frequency: 0,
        })
      }
    }
  }

  return suggestions
}
