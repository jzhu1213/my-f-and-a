/**
 * Tax Set-Aside Helper for Gig / 1099 Income
 *
 * Pure utility that computes a suggested tax reserve for freelance or gig income.
 * The default rate (25%) covers a sensible estimate for US self-employment tax
 * + federal income tax for most young-adult earners. Users can always override.
 */

export interface TaxSetAsideResult {
  /** Dollar amount to set aside for taxes */
  suggestedReserve: number
  /** The tax rate used (0–1 scale, e.g. 0.25 = 25%) */
  rate: number
  /** Friendly explanation of why setting aside for taxes is a good idea */
  rationale: string
}

/** Default tax rate: 25% (covers ~15.3% SE tax + ~10% federal for most students/young adults) */
export const DEFAULT_GIG_TAX_RATE = 0.25

/**
 * Compute the suggested tax set-aside for gig/1099 income.
 *
 * @param incomeAmount - The gross gig income amount
 * @param taxRate - Optional override (0–1 scale). Defaults to 25%.
 * @returns An object with the suggested reserve amount, rate used, and a friendly rationale
 */
export function computeTaxSetAside(
  incomeAmount: number,
  taxRate: number = DEFAULT_GIG_TAX_RATE
): TaxSetAsideResult {
  // Clamp rate to a reasonable range
  const clampedRate = Math.max(0, Math.min(1, taxRate))

  const suggestedReserve = Math.round(incomeAmount * clampedRate * 100) / 100

  const pct = Math.round(clampedRate * 100)

  const rationale =
    `Gig income doesn't have taxes withheld automatically, so setting aside ~${pct}% ` +
    `now means no surprises at tax time. You've got this!`

  return {
    suggestedReserve,
    rate: clampedRate,
    rationale,
  }
}

/**
 * A trajectory-facing view of how a user's gig tax set-aside is tracking.
 *
 * Compares the suggested tax reserve for this period's gig income against the
 * money the user has actually routed away from spending (their reserved
 * set-aside flow). Framed warmly — never shaming — so it can surface as an
 * insight card in the Financial Trajectory view (task 154.1).
 */
export interface GigTaxTrajectory {
  /** Gig / 1099 income earned this period. */
  gigIncome: number
  /** Suggested amount to reserve for taxes. */
  suggestedReserve: number
  /** Tax rate used (0–1 scale). */
  rate: number
  /** Money the user has reserved this period (their set-aside flow). */
  reserved: number
  /** True when reserved money already covers the suggested tax reserve. */
  covered: boolean
  /** Short, warm headline for the insight card. */
  headline: string
  /** Encouraging supporting copy. */
  detail: string
}

/**
 * Build a gig tax set-aside trajectory from this period's gig income and the
 * amount the user has reserved.
 *
 * Returns `null` when there's no gig income to reason about, so callers can
 * simply skip rendering the insight.
 *
 * @param gigIncome - Gig/1099 income earned this period
 * @param reserved  - Money reserved this period (set-aside flow)
 * @param taxRate   - Optional override (0–1 scale). Defaults to 25%.
 */
export function computeGigTaxTrajectory(
  gigIncome: number,
  reserved: number,
  taxRate: number = DEFAULT_GIG_TAX_RATE
): GigTaxTrajectory | null {
  if (!Number.isFinite(gigIncome) || gigIncome <= 0) return null

  const { suggestedReserve, rate } = computeTaxSetAside(gigIncome, taxRate)
  const safeReserved = Number.isFinite(reserved) && reserved > 0 ? reserved : 0
  const covered = safeReserved >= suggestedReserve
  const pct = Math.round(rate * 100)

  const headline = covered
    ? 'Gig taxes covered'
    : 'Tax set-aside for gig income'

  const detail = covered
    ? `You've earned $${Math.round(gigIncome).toLocaleString()} from gigs and set aside enough to cover the ~${pct}% you'll likely owe. Tax season sorted.`
    : `You've earned $${Math.round(gigIncome).toLocaleString()} from gigs this period. Tucking away ~$${Math.round(suggestedReserve).toLocaleString()} (${pct}%) keeps tax time stress-free.`

  return {
    gigIncome,
    suggestedReserve,
    rate,
    reserved: safeReserved,
    covered,
    headline,
    detail,
  }
}
