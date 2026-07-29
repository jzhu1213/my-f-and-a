/**
 * Net Obligations — pure helper that aggregates all "what is owed" into a
 * single summary: outstanding credit float, active debts, and IOUs.
 *
 * Requirements: task 85.1, 85.2
 */

import type { Debt } from '@/types/folio'
import type { Reimbursement } from '@/lib/reimbursements'
import type { FundingSource } from '@/lib/fundingSources'
import type { Transaction } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface NetObligations {
  /** Total you owe: debt balances + IOUs you owe + outstanding credit float */
  youOwe: number
  /** Total you're owed: IOUs others owe you */
  youreOwed: number
  /** Net position: youreOwed - youOwe (negative = you owe more) */
  netPosition: number
  /** Breakdown for optional detail display */
  breakdown: {
    debtBalance: number
    iouOwedByMe: number
    creditFloat: number
    iouOwedToMe: number
  }
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute the net obligations summary from existing models.
 *
 * @param debts - Active debts from the Debt model
 * @param reimbursements - All reimbursements from the Reimbursement model
 * @param transactions - Transactions for computing credit float
 * @param fundingSources - Funding sources for identifying credit sources
 * @param currentDate - Reference date for current-month credit float calculation
 */
export function computeNetObligations(
  debts: Debt[],
  reimbursements: Reimbursement[],
  transactions: Transaction[],
  fundingSources: FundingSource[],
  currentDate: Date = new Date()
): NetObligations {
  // 1. Sum all active debt balances (balance > 0)
  const debtBalance = debts.reduce(
    (sum, d) => sum + (d.balance > 0 ? d.balance : 0),
    0
  )

  // 2. IOUs from the Reimbursement model (unsettled only)
  let iouOwedByMe = 0
  let iouOwedToMe = 0

  for (const r of reimbursements) {
    if (r.settled) continue
    if (r.direction === 'owed_by_me') {
      iouOwedByMe += r.amount
    } else {
      iouOwedToMe += r.amount
    }
  }

  // 3. Credit float: month-to-date spending on deferred credit sources
  const creditSourceIds = new Set(
    fundingSources
      .filter(s => s.kind === 'credit' && !s.reducesBalanceNow)
      .map(s => s.id)
  )

  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  const creditFloat = transactions.reduce((sum, tx) => {
    if (
      tx.type === 'expense' &&
      tx.date.startsWith(currentMonth) &&
      tx.fundingSourceId &&
      creditSourceIds.has(tx.fundingSourceId)
    ) {
      return sum + tx.amount
    }
    return sum
  }, 0)

  // 4. Aggregate
  const youOwe = debtBalance + iouOwedByMe + creditFloat
  const youreOwed = iouOwedToMe
  const netPosition = youreOwed - youOwe

  return {
    youOwe,
    youreOwed,
    netPosition,
    breakdown: {
      debtBalance,
      iouOwedByMe,
      creditFloat,
      iouOwedToMe,
    },
  }
}
