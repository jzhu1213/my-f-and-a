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
  /** Optional link back to the transaction that generated this IOU */
  linkedTransactionId?: string
  /** Optional funding source used when settling this IOU */
  settledViaSourceId?: string
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
// Settle-Up Ledger
// ============================================================================

/** A single entry in the settle-up ledger showing net position with one person */
export interface SettleUpEntry {
  /** The person's name */
  personName: string
  /** Net amount: positive = they owe you, negative = you owe them */
  netAmount: number
  /** Total number of unsettled IOUs with this person */
  iouCount: number
  /** IDs of all unsettled IOUs with this person (for batch settle) */
  iouIds: string[]
  /** Direction summary: 'they_owe' | 'you_owe' | 'settled' */
  direction: 'they_owe' | 'you_owe' | 'settled'
}

/**
 * Compute a settle-up ledger from all reimbursements.
 * Groups unsettled IOUs by person, nets out amounts, and returns sorted entries.
 *
 * Sorting: largest absolute net amounts first (most impactful debts surface).
 */
export function computeSettleUpLedger(reimbursements: Reimbursement[]): SettleUpEntry[] {
  const groups = new Map<string, { net: number; ids: string[]; count: number }>()

  for (const r of reimbursements) {
    if (r.settled) continue

    const key = r.personName.trim().toLowerCase()
    const existing = groups.get(key) ?? { net: 0, ids: [], count: 0 }
    const delta = r.direction === 'owed_to_me' ? r.amount : -r.amount

    existing.net += delta
    existing.ids.push(r.id)
    existing.count += 1
    groups.set(key, existing)
  }

  // Build entries and sort by absolute net amount descending
  const entries: SettleUpEntry[] = []

  for (const r of reimbursements) {
    if (r.settled) continue
    const key = r.personName.trim().toLowerCase()
    const group = groups.get(key)
    if (!group) continue

    // Only create entry once per person (first encounter)
    if (entries.some(e => e.personName.trim().toLowerCase() === key)) continue

    const netRounded = Math.round(group.net * 100) / 100

    entries.push({
      personName: r.personName, // preserve original casing from first IOU
      netAmount: netRounded,
      iouCount: group.count,
      iouIds: group.ids,
      direction: netRounded > 0 ? 'they_owe' : netRounded < 0 ? 'you_owe' : 'settled',
    })
  }

  // Sort by absolute net amount descending
  entries.sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))

  return entries
}

/**
 * Generate a friendly reminder message for a settle-up entry.
 * Copy follows the warm, shame-free tone standard — no dunning language.
 */
export function generateReminder(entry: SettleUpEntry): string {
  const absAmount = Math.abs(entry.netAmount).toFixed(2)

  if (entry.direction === 'they_owe') {
    return `Hey ${entry.personName}! Just a friendly nudge about the $${absAmount} — no rush at all, whenever you're ready 🙂`
  } else if (entry.direction === 'you_owe') {
    return `Hey ${entry.personName}! Heads up — I've got $${absAmount} headed your way. Want to square up sometime?`
  }
  return `Hey ${entry.personName}! Looks like we're all squared up 🤝`
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
