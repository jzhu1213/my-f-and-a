/**
 * Per-source running balance computation.
 *
 * A pure helper that takes funding sources and transaction history
 * and computes the current balance for each source:
 *   computedBalance = snapshotBalance + totalInflows - totalOutflows
 */

import type { FundingSource, FundingSourceKind } from '@/lib/fundingSources'
import type { Transaction } from '@/types'

/**
 * Balance breakdown for a single funding source.
 */
export interface SourceBalance {
  sourceId: string
  label: string
  emoji: string
  kind: FundingSourceKind
  /** User-set starting point (editable) */
  snapshotBalance: number
  /** Income/deposits attributed to this source */
  totalInflows: number
  /** Expenses from this source */
  totalOutflows: number
  /** snapshotBalance + totalInflows - totalOutflows */
  computedBalance: number
}

/**
 * Computes the running balance for each funding source based on transaction history.
 *
 * Algorithm:
 * 1. For each funding source, start with its snapshotBalance (default 0 if undefined)
 * 2. Sum all transactions where fundingSourceId === source.id:
 *    - income transactions → add to inflows
 *    - expense transactions → add to outflows
 * 3. computedBalance = snapshotBalance + totalInflows - totalOutflows
 *
 * @param fundingSources - User's configured funding sources
 * @param transactions - Full transaction history
 * @returns Map keyed by source ID → SourceBalance
 */
export function computeSourceBalances(
  fundingSources: FundingSource[],
  transactions: Transaction[]
): Map<string, SourceBalance> {
  const result = new Map<string, SourceBalance>()

  // Initialize each source with zero flows
  for (const source of fundingSources) {
    result.set(source.id, {
      sourceId: source.id,
      label: source.label,
      emoji: source.emoji,
      kind: source.kind,
      snapshotBalance: source.snapshotBalance ?? 0,
      totalInflows: 0,
      totalOutflows: 0,
      computedBalance: source.snapshotBalance ?? 0,
    })
  }

  // Accumulate transaction amounts per source
  for (const tx of transactions) {
    if (!tx.fundingSourceId) continue

    const balance = result.get(tx.fundingSourceId)
    if (!balance) continue

    if (tx.type === 'income') {
      balance.totalInflows += tx.amount
    } else if (tx.type === 'expense') {
      balance.totalOutflows += tx.amount
    }
  }

  // Compute final balance for each source
  for (const balance of result.values()) {
    balance.computedBalance =
      balance.snapshotBalance + balance.totalInflows - balance.totalOutflows
  }

  return result
}
