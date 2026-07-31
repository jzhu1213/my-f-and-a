/**
 * Disbursements — dedicated module for financial-aid and lump-sum income handling.
 *
 * Students often receive income as large lump sums (semester aid disbursements,
 * scholarship payments, refund checks) that need to be spread across time to
 * produce a meaningful daily allowance. This module handles that logic.
 *
 * Everything here is a pure function with no side effects — persistence lives
 * in useHomeData (localStorage) and UI in the relevant components.
 */

// ============================================================================
// Model
// ============================================================================

/** Types of financial disbursement a student might receive */
export type DisbursementType = 'financial_aid' | 'scholarship' | 'refund' | 'other'

/**
 * A tracked disbursement — a lump sum spread across months to boost daily allowance.
 */
export interface Disbursement {
  id: string
  /** User-facing name, e.g. "Fall 2024 Aid Refund" */
  label: string
  /** Total lump-sum amount received */
  amount: number
  /** Number of months to spread the amount over (1–12) */
  coverMonths: number
  /** Start date for the cover period (ISO YYYY-MM-DD) */
  startDate: string
  /** Classification of disbursement */
  type: DisbursementType
  /** Emoji for display */
  emoji: string
}

// ============================================================================
// Presets — common student disbursement types for quick entry
// ============================================================================

export interface DisbursementPreset {
  label: string
  emoji: string
  type: DisbursementType
  /** Default number of months to cover */
  defaultCoverMonths: number
}

export const DISBURSEMENT_PRESETS: readonly DisbursementPreset[] = [
  { label: 'Financial Aid Refund', emoji: '🎓', type: 'financial_aid', defaultCoverMonths: 4 },
  { label: 'Scholarship Payment', emoji: '🏅', type: 'scholarship', defaultCoverMonths: 4 },
  { label: 'Work-Study Stipend', emoji: '💼', type: 'other', defaultCoverMonths: 4 },
  { label: 'Tax Refund', emoji: '🧾', type: 'refund', defaultCoverMonths: 3 },
]

// ============================================================================
// Core Pure Helpers
// ============================================================================

/**
 * Computes the monthly share of a single disbursement.
 * Divides the lump sum by the cover months (minimum 1).
 */
export function computeDisbursementMonthlyShare(amount: number, coverMonths: number): number {
  return amount / Math.max(1, coverMonths)
}

/**
 * Determines if a disbursement is still active (cover period hasn't expired).
 *
 * A disbursement is active from its startDate through startDate + coverMonths.
 * If startDate is empty or invalid, it's considered active (defensive).
 */
export function isDisbursementActive(disbursement: Disbursement, currentDate: Date): boolean {
  if (!disbursement.startDate) return true

  const parts = disbursement.startDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return true

  const [year, month, day] = parts
  const start = new Date(year, month - 1, day)
  
  // End date = start + coverMonths
  const end = new Date(start)
  end.setMonth(end.getMonth() + Math.max(1, disbursement.coverMonths))

  return currentDate < end
}

/**
 * Returns the number of months remaining on an active disbursement.
 * Returns 0 if the disbursement has expired.
 */
export function getRemainingMonths(disbursement: Disbursement, currentDate: Date): number {
  if (!disbursement.startDate) return disbursement.coverMonths

  const parts = disbursement.startDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return disbursement.coverMonths

  const [year, month, day] = parts
  const start = new Date(year, month - 1, day)
  
  const end = new Date(start)
  end.setMonth(end.getMonth() + Math.max(1, disbursement.coverMonths))

  if (currentDate >= end) return 0

  // Months difference between current and end
  const monthsLeft = (end.getFullYear() - currentDate.getFullYear()) * 12 +
    (end.getMonth() - currentDate.getMonth())

  return Math.max(0, monthsLeft)
}

/**
 * Computes the total monthly income boost from all active disbursements.
 * Only includes disbursements whose cover period hasn't expired yet.
 *
 * This is the value that gets added to monthly income in the daily allowance calc.
 */
export function computeActiveDisbursementBonus(
  disbursements: Disbursement[],
  currentDate: Date
): number {
  return disbursements.reduce((total, d) => {
    if (!isDisbursementActive(d, currentDate)) return total
    return total + computeDisbursementMonthlyShare(d.amount, d.coverMonths)
  }, 0)
}

// ============================================================================
// Persistence Helpers (localStorage)
// ============================================================================

const STORAGE_KEY = 'folio-disbursements'

/**
 * Load persisted disbursements from localStorage.
 * Returns an empty array if nothing is stored or if parsing fails.
 */
export function loadDisbursements(): Disbursement[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Disbursement[]
  } catch {
    return []
  }
}

/**
 * Save disbursements to localStorage.
 */
export function saveDisbursements(disbursements: Disbursement[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(disbursements))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Generate a simple unique ID for a new disbursement.
 */
export function generateDisbursementId(): string {
  return `disb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
