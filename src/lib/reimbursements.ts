/**
 * Reimbursement ledger — pure model and helpers.
 *
 * Tracks IOUs owed TO the user and owed BY the user, with net balance
 * summaries per person.
 *
 * Requirements: 12.3, 13.7, new
 */

// ============================================================================
// Types
// ============================================================================

/** Direction of an IOU */
export type ReimbursementDirection = 'owed_to_me' | 'owed_by_me'

/** A single IOU entry in the reimbursement ledger */
export interface Reimbursement {
  id: string
  userId: string
  personName: string
  direction: ReimbursementDirection
  amount: number
  note: string
  settled: boolean
  settledAt: string | null
  createdAt: string
}

// ============================================================================
// Net Balance Helpers
// ============================================================================

/**
 * Compute net balance per person across all unsettled reimbursements.
 * Positive = they owe you, negative = you owe them.
 */
export function getNetBalance(reimbursements: Reimbursement[]): Map<string, number> {
  const balances = new Map<string, number>()

  for (const r of reimbursements) {
    if (r.settled) continue
    const current = balances.get(r.personName) ?? 0
    const delta = r.direction === 'owed_to_me' ? r.amount : -r.amount
    balances.set(r.personName, current + delta)
  }

  return balances
}

/** Summary of net IOU positions */
export interface NetSummary {
  totalOwedToMe: number
  totalOwedByMe: number
  /** Positive = net owed to you, negative = net you owe others */
  net: number
}

/**
 * Compute aggregate IOU summary across all unsettled reimbursements.
 */
export function getNetSummary(reimbursements: Reimbursement[]): NetSummary {
  let totalOwedToMe = 0
  let totalOwedByMe = 0

  for (const r of reimbursements) {
    if (r.settled) continue
    if (r.direction === 'owed_to_me') {
      totalOwedToMe += r.amount
    } else {
      totalOwedByMe += r.amount
    }
  }

  return {
    totalOwedToMe,
    totalOwedByMe,
    net: totalOwedToMe - totalOwedByMe,
  }
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a partial reimbursement for creation/edit.
 * Amount must be positive, personName non-empty, direction valid.
 */
export function validateReimbursement(data: Partial<Reimbursement>): ValidationResult {
  if (!data.personName || data.personName.trim().length === 0) {
    return { valid: false, error: 'Person name is required' }
  }

  if (data.personName.trim().length > 100) {
    return { valid: false, error: 'Person name is too long' }
  }

  if (data.amount === undefined || data.amount === null) {
    return { valid: false, error: 'Amount is required' }
  }

  if (typeof data.amount !== 'number' || isNaN(data.amount)) {
    return { valid: false, error: 'Amount must be a number' }
  }

  if (data.amount <= 0) {
    return { valid: false, error: 'Amount must be positive' }
  }

  if (data.amount > 1_000_000) {
    return { valid: false, error: 'Amount seems too large' }
  }

  if (data.direction && data.direction !== 'owed_to_me' && data.direction !== 'owed_by_me') {
    return { valid: false, error: 'Direction must be "owed_to_me" or "owed_by_me"' }
  }

  return { valid: true }
}
