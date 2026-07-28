import type { TransactionCategory } from '@/types'

/**
 * Sinking Funds — pure model + helpers.
 *
 * A "sinking fund" is money set aside a little each month toward a known,
 * lumpy future cost so it doesn't blow up the daily budget when it lands.
 * Great for students and young adults with periodic/large costs like
 * textbooks each semester, travel, gifts, annual subscriptions, or car
 * registration.
 *
 * Everything here is a pure function with no side effects — persistence and
 * UI live elsewhere (supabaseData.ts / SinkingFundsScreen.tsx).
 */

// ============================================================================
// Model
// ============================================================================

/**
 * A tracked sinking fund for a periodic or large upcoming cost.
 */
export interface SinkingFund {
  id: string
  userId: string
  /** Friendly name, e.g. "Fall textbooks", "Flight home" */
  label: string
  /** Spending category this cost falls under */
  category: TransactionCategory
  /** Total amount the user is saving toward */
  targetAmount: number
  /** When the money is expected to be needed (YYYY-MM-DD). Empty string = no set date. */
  dueDate: string
  /** How much has been set aside so far */
  savedAmount: number
  /** Amount to reserve each month toward the target */
  monthlyReserve: number
  createdAt: string
}

/** Payload for creating a new fund (id/userId/createdAt are assigned on persist). */
export type SinkingFundDraft = Omit<SinkingFund, 'id' | 'userId' | 'createdAt'>

/** Result of validating a fund draft. */
export interface SinkingFundValidation {
  valid: boolean
  errors: string[]
}

/** Aggregate view across all of a user's sinking funds. */
export interface SinkingFundSummary {
  /** Number of funds */
  count: number
  /** Sum of all target amounts */
  totalTarget: number
  /** Sum of all saved amounts */
  totalSaved: number
  /** Sum of all remaining amounts (never negative per fund) */
  totalRemaining: number
  /** Sum of all monthly reserves — money to set aside this month */
  totalMonthlyReserve: number
  /** Number of funds fully funded (saved >= target) */
  fundedCount: number
}

// ============================================================================
// Presets — low-friction starting points tailored to students/young adults
// ============================================================================

/** Suggested fund starting points to keep setup fast. */
export interface SinkingFundPreset {
  label: string
  emoji: string
  category: TransactionCategory
  /** A gentle default target — always editable by the user */
  suggestedTarget: number
}

export const SINKING_FUND_PRESETS: readonly SinkingFundPreset[] = [
  { label: 'Textbooks', emoji: '📚', category: 'school', suggestedTarget: 300 },
  { label: 'Travel', emoji: '✈️', category: 'fun', suggestedTarget: 400 },
  { label: 'Gifts', emoji: '🎁', category: 'other', suggestedTarget: 150 },
  { label: 'Annual subscription', emoji: '🔁', category: 'other', suggestedTarget: 120 },
  { label: 'Car registration', emoji: '🚗', category: 'transport', suggestedTarget: 200 },
]

// ============================================================================
// Constants
// ============================================================================

/** Guardrail matching the app's transaction amount ceiling. */
const MAX_AMOUNT = 99999

// ============================================================================
// Date helpers (UTC-based, consistent with dailyAllowanceUtils)
// ============================================================================

/**
 * Parses a YYYY-MM-DD string into a UTC Date at midnight.
 * Returns null for empty/invalid input.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [year, month, day] = parts
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Number of whole months from `currentDate` until `dueDate` (inclusive of the
 * current month), floored at a minimum of 1 so we never divide by zero and
 * always ask the user to reserve something. Returns 1 when there is no due
 * date or the date is in the past.
 *
 * "Inclusive of current month" means a due date later this month still counts
 * as 1 month to save.
 */
export function getMonthsUntilDue(dueDate: string, currentDate: Date = new Date()): number {
  const due = parseDate(dueDate)
  if (!due) return 1

  const monthsDiff =
    (due.getUTCFullYear() - currentDate.getUTCFullYear()) * 12 +
    (due.getUTCMonth() - currentDate.getUTCMonth())

  // If the due month is this month or already passed, treat as 1 month left.
  return Math.max(1, monthsDiff)
}

// ============================================================================
// Core pure helpers
// ============================================================================

/**
 * Amount still needed to reach the target. Never negative.
 */
export function getRemainingAmount(fund: Pick<SinkingFund, 'targetAmount' | 'savedAmount'>): number {
  return Math.max(0, fund.targetAmount - fund.savedAmount)
}

/**
 * Whether the fund has reached (or exceeded) its target.
 */
export function isFunded(fund: Pick<SinkingFund, 'targetAmount' | 'savedAmount'>): boolean {
  return fund.targetAmount > 0 && fund.savedAmount >= fund.targetAmount
}

/**
 * Progress toward the target as a 0–1 ratio, clamped.
 */
export function getFundProgress(fund: Pick<SinkingFund, 'targetAmount' | 'savedAmount'>): number {
  if (fund.targetAmount <= 0) return 0
  return Math.min(1, Math.max(0, fund.savedAmount / fund.targetAmount))
}

/**
 * Suggested monthly reserve to reach the target by the due date.
 * Spreads the remaining amount across the months left, rounded to whole dollars.
 * Returns 0 once the fund is fully funded.
 */
export function computeMonthlyReserve(
  targetAmount: number,
  savedAmount: number,
  dueDate: string,
  currentDate: Date = new Date()
): number {
  const remaining = Math.max(0, targetAmount - savedAmount)
  if (remaining <= 0) return 0
  const months = getMonthsUntilDue(dueDate, currentDate)
  return Math.ceil(remaining / months)
}

/**
 * Validates a fund draft. Returns all problems found so the UI can surface them.
 */
export function validateSinkingFund(draft: Partial<SinkingFundDraft>): SinkingFundValidation {
  const errors: string[] = []

  const label = (draft.label ?? '').trim()
  if (!label) {
    errors.push('Give your fund a name.')
  }

  const target = draft.targetAmount ?? 0
  if (!(target > 0)) {
    errors.push('Set a target above $0.')
  } else if (target > MAX_AMOUNT) {
    errors.push(`Target can't exceed $${MAX_AMOUNT.toLocaleString('en-US')}.`)
  }

  const saved = draft.savedAmount ?? 0
  if (saved < 0) {
    errors.push("Saved amount can't be negative.")
  } else if (saved > MAX_AMOUNT) {
    errors.push(`Saved amount can't exceed $${MAX_AMOUNT.toLocaleString('en-US')}.`)
  }

  const reserve = draft.monthlyReserve ?? 0
  if (reserve < 0) {
    errors.push("Monthly reserve can't be negative.")
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Builds a normalized fund draft from partial input, filling sensible defaults
 * and auto-computing the monthly reserve when one isn't provided. Pure — does
 * not assign id/userId/createdAt (those belong to persistence).
 *
 * Amounts are clamped to non-negative values and the label is trimmed.
 */
export function createSinkingFund(
  input: Partial<SinkingFundDraft>,
  currentDate: Date = new Date()
): SinkingFundDraft {
  const label = (input.label ?? '').trim()
  const category: TransactionCategory = input.category ?? 'other'
  const targetAmount = Math.max(0, input.targetAmount ?? 0)
  const savedAmount = Math.max(0, input.savedAmount ?? 0)
  const dueDate = input.dueDate ?? ''

  // Use an explicit reserve when provided (>= 0), otherwise auto-compute.
  const monthlyReserve =
    input.monthlyReserve !== undefined && input.monthlyReserve >= 0
      ? input.monthlyReserve
      : computeMonthlyReserve(targetAmount, savedAmount, dueDate, currentDate)

  return {
    label,
    category,
    targetAmount,
    savedAmount,
    dueDate,
    monthlyReserve,
  }
}

/**
 * Returns the sum of monthly reserves across all funds.
 * This is the amount that should be sunk (reserved) from the monthly pool
 * before computing the daily discretionary allowance — equivalent to how
 * fixed obligations are handled in Theme A.
 *
 * Accepts an optional `now` parameter so callers can pass a stable reference
 * date (e.g. from a test or from the allowance engine).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
export function getTotalMonthlyReserve(funds: SinkingFund[], now: Date = new Date()): number {
  return funds.reduce((sum, fund) => {
    // Re-compute the dynamic reserve so it stays accurate even if the stored
    // monthlyReserve field is stale. Fall back to the stored value when the
    // fund is already fully funded (computeMonthlyReserve returns 0).
    const dynamic = computeMonthlyReserve(fund.targetAmount, fund.savedAmount, fund.dueDate, now)
    return sum + dynamic
  }, 0)
}

/**
 * Summarizes a list of funds into aggregate totals for display.
 */
export function summarizeSinkingFunds(funds: SinkingFund[]): SinkingFundSummary {
  return funds.reduce<SinkingFundSummary>(
    (summary, fund) => {
      summary.count += 1
      summary.totalTarget += fund.targetAmount
      summary.totalSaved += fund.savedAmount
      summary.totalRemaining += getRemainingAmount(fund)
      summary.totalMonthlyReserve += fund.monthlyReserve
      if (isFunded(fund)) summary.fundedCount += 1
      return summary
    },
    {
      count: 0,
      totalTarget: 0,
      totalSaved: 0,
      totalRemaining: 0,
      totalMonthlyReserve: 0,
      fundedCount: 0,
    }
  )
}

/**
 * Spreads a financial-aid or refund lump sum (e.g. semester disbursement,
 * tax refund) across a given number of months. Use this to compute the
 * monthly income boost that should be added to the daily allowance model.
 *
 * @param lumpSum    Total lump-sum amount received (e.g. $5000 aid disbursement)
 * @param coverMonths  Number of months the lump sum should cover (1–12)
 * @returns Monthly share to add to income
 */
export function computeDisbursementMonthlyShare(lumpSum: number, coverMonths: number): number {
  return lumpSum / Math.max(1, coverMonths)
}
