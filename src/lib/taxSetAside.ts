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
