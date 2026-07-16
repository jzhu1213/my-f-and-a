import type { Transaction, TransactionCategory, TransactionType } from '@/types'

export interface TransactionRepeat {
  category: TransactionCategory
  amount: number
  note?: string
  type: TransactionType
  label: string
}

/** Last N unique transactions for one-tap repeat logging */
export function getRecentRepeats(transactions: Transaction[], limit = 3): TransactionRepeat[] {
  const seen   = new Set<string>()
  const result: TransactionRepeat[] = []

  for (const tx of transactions) {
    const key = `${tx.type}|${tx.category}|${tx.amount}|${tx.note ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)

    const notePart = tx.note ? tx.note : ''
    const label    = notePart
      ? `${notePart} · $${tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(2)}`
      : `$${tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(2)}`

    result.push({
      category: tx.category,
      amount: tx.amount,
      note: tx.note,
      type: tx.type,
      label,
    })
    if (result.length >= limit) break
  }

  return result
}
