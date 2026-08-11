/**
 * Tax Set-Aside Helper for Gig / 1099 Income
 *
 * Pure utility that computes a suggested tax reserve for freelance or gig income.
 * The default rate (25%) covers a sensible estimate for US self-employment tax
 * + federal income tax for most young-adult earners. Users can always override.
 *
 * Includes quarterly estimated tax guidance (Task 177.1) — warm, plain-language
 * framing with no filing or professional-advice claims.
 *
 * ── Related modules (money-set-aside cluster) ─────────────────────────────
 *   • setAside.ts            — unified "money set aside" model (flow + balance)
 *   • autoEarmarkSavings.ts  — auto-sweep unspent allowance toward savings
 *   • allocationUtils.ts     — allocation-bucket slice + savings rate
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

// ============================================================================
// Quarterly Tax Estimates (Task 177.1)
// ============================================================================

/** Which fiscal quarter (Q1–Q4) */
export type TaxQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

/**
 * A single quarter's tax estimate — earned income, suggested reserve, coverage
 * status, and warm user-facing copy.
 */
export interface QuarterlyTaxEstimate {
  /** Which quarter this covers */
  quarter: TaxQuarter
  /** Months covered: "Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec" */
  monthRange: string
  /** Gig income earned during this quarter */
  earnedIncome: number
  /** Suggested tax set-aside for this quarter */
  suggestedReserve: number
  /** Amount the user has already reserved toward this quarter */
  amountReserved: number
  /** Whether reserved ≥ suggestedReserve */
  covered: boolean
  /** The IRS quarterly deadline for this quarter's estimated payment */
  deadlineDate: string
  /** Whether this quarter is in the past relative to referenceDate */
  isPast: boolean
  /** Whether this is the current quarter (the one the user is in right now) */
  isCurrent: boolean
  /** Short warm headline for display */
  headline: string
  /** Encouraging detail copy */
  detail: string
}

/**
 * Result of the full quarterly estimates computation — all four quarters
 * plus an overall summary.
 */
export interface QuarterlyTaxEstimatesResult {
  /** The tax year these estimates cover */
  taxYear: number
  /** All four quarters in order (Q1–Q4) */
  quarters: QuarterlyTaxEstimate[]
  /** The next upcoming deadline (null if all deadlines are past) */
  nextDeadline: { quarter: TaxQuarter; date: string; daysUntil: number } | null
  /** Total gig income across the year so far */
  totalGigIncome: number
  /** Total suggested reserve across the year */
  totalSuggestedReserve: number
  /** Total amount reserved by the user */
  totalReserved: number
  /** Friendly disclaimer — always included */
  disclaimer: string
}

const QUARTER_LABELS: Record<TaxQuarter, string> = {
  Q1: 'Jan–Mar',
  Q2: 'Apr–Jun',
  Q3: 'Jul–Sep',
  Q4: 'Oct–Dec',
}

/**
 * IRS quarterly estimated tax deadline for each quarter.
 * Returns the deadline as YYYY-MM-DD for the given tax year.
 * Q4's deadline falls in January of the *following* year.
 */
function getQuarterlyDeadline(quarter: TaxQuarter, taxYear: number): string {
  switch (quarter) {
    case 'Q1':
      return `${taxYear}-04-15`
    case 'Q2':
      return `${taxYear}-06-15`
    case 'Q3':
      return `${taxYear}-09-15`
    case 'Q4':
      return `${taxYear + 1}-01-15`
  }
}

/**
 * Compute the number of days between two date strings (YYYY-MM-DD).
 * Positive means `to` is in the future relative to `from`.
 */
function daysBetween(from: string, to: string): number {
  const msPerDay = 86_400_000
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')
  return Math.round((toDate.getTime() - fromDate.getTime()) / msPerDay)
}

/**
 * Determine which quarter a month (1–12) belongs to.
 */
function quarterForMonth(month: number): TaxQuarter {
  if (month <= 3) return 'Q1'
  if (month <= 6) return 'Q2'
  if (month <= 9) return 'Q3'
  return 'Q4'
}

/**
 * Input for a single quarter's gig income — used when callers provide
 * pre-aggregated per-quarter income totals and reserved amounts.
 */
export interface QuarterlyIncomeInput {
  quarter: TaxQuarter
  earnedIncome: number
  amountReserved: number
}

/**
 * Compute quarterly tax estimates for the tax year.
 *
 * Accepts either:
 * - An array of per-quarter income/reserve breakdowns, OR
 * - A flat list of monthly income amounts (index 0 = January) and a single
 *   totalReserved figure that's split proportionally.
 *
 * Returns warm, actionable guidance for each quarter — never professional
 * tax advice.
 *
 * @param params.taxYear       - The tax year (e.g. 2025)
 * @param params.quarterlyData - Pre-aggregated per-quarter income & reserves
 * @param params.monthlyIncome - Alternative: 12-element array of monthly gig income
 * @param params.totalReserved - Used with monthlyIncome: total reserved across the year
 * @param params.referenceDate - ISO date string (YYYY-MM-DD) for "today" (testable)
 * @param params.taxRate       - Optional override (0–1). Defaults to 25%.
 */
export function computeQuarterlyTaxEstimates(params: {
  taxYear: number
  quarterlyData?: QuarterlyIncomeInput[]
  monthlyIncome?: number[]
  totalReserved?: number
  referenceDate: string
  taxRate?: number
}): QuarterlyTaxEstimatesResult {
  const {
    taxYear,
    quarterlyData,
    monthlyIncome,
    totalReserved = 0,
    referenceDate,
    taxRate = DEFAULT_GIG_TAX_RATE,
  } = params

  const rate = Math.max(0, Math.min(1, taxRate))
  const refMonth = parseInt(referenceDate.slice(5, 7), 10)
  const currentQuarter = quarterForMonth(refMonth)

  // Build per-quarter income/reserve either from pre-aggregated data or monthly array
  const perQuarter: Record<TaxQuarter, { income: number; reserved: number }> = {
    Q1: { income: 0, reserved: 0 },
    Q2: { income: 0, reserved: 0 },
    Q3: { income: 0, reserved: 0 },
    Q4: { income: 0, reserved: 0 },
  }

  if (quarterlyData && quarterlyData.length > 0) {
    for (const qd of quarterlyData) {
      perQuarter[qd.quarter].income = Math.max(0, qd.earnedIncome)
      perQuarter[qd.quarter].reserved = Math.max(0, qd.amountReserved)
    }
  } else if (monthlyIncome && monthlyIncome.length > 0) {
    // Sum monthly income into quarters
    for (let i = 0; i < Math.min(12, monthlyIncome.length); i++) {
      const q = quarterForMonth(i + 1) // i+1 because months are 1-indexed
      perQuarter[q].income += Math.max(0, monthlyIncome[i] ?? 0)
    }
    // Proportionally distribute totalReserved across quarters based on income
    const totalIncome = Object.values(perQuarter).reduce((s, q) => s + q.income, 0)
    if (totalIncome > 0 && totalReserved > 0) {
      for (const q of (['Q1', 'Q2', 'Q3', 'Q4'] as TaxQuarter[])) {
        perQuarter[q].reserved = Math.round(
          (perQuarter[q].income / totalIncome) * totalReserved * 100
        ) / 100
      }
    }
  }

  const allQuarters: TaxQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterOrder: Record<TaxQuarter, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }

  const quarters: QuarterlyTaxEstimate[] = allQuarters.map((q) => {
    const { income, reserved } = perQuarter[q]
    const suggestedReserve = Math.round(income * rate * 100) / 100
    const covered = reserved >= suggestedReserve && suggestedReserve > 0
    const deadlineDate = getQuarterlyDeadline(q, taxYear)
    const isPast = quarterOrder[q] < quarterOrder[currentQuarter]
    const isCurrent = q === currentQuarter
    const pct = Math.round(rate * 100)

    // Warm, friendly copy
    let headline: string
    let detail: string

    if (isPast && income > 0) {
      // Past quarter with income — summary
      headline = covered
        ? `${q} taxes covered`
        : `${q} set-aside reminder`
      detail = covered
        ? `You earned $${Math.round(income).toLocaleString()} in ${QUARTER_LABELS[q]} and set aside enough. Well done.`
        : `You earned $${Math.round(income).toLocaleString()} in ${QUARTER_LABELS[q]}. Consider tucking away ~$${Math.round(suggestedReserve).toLocaleString()} (${pct}%) when you can.`
    } else if (isPast && income === 0) {
      headline = `${q} — no gig income`
      detail = `Nothing to set aside for ${QUARTER_LABELS[q]}. All good.`
    } else if (isCurrent) {
      // Current quarter — actionable
      headline = income > 0
        ? (covered ? `On track for ${q}` : `Set aside for ${q}`)
        : `${q} so far — no gig income yet`
      detail = income > 0
        ? (covered
          ? `You've earned $${Math.round(income).toLocaleString()} so far and already set aside enough. Keep it up.`
          : `You've earned $${Math.round(income).toLocaleString()} so far this quarter. Setting aside ~$${Math.round(suggestedReserve).toLocaleString()} (${pct}%) keeps things stress-free.`)
        : `If gig income comes in, we'll help you figure out what to set aside.`
    } else {
      // Future quarter
      headline = `${q} coming up`
      detail = `We'll track your gig income for ${QUARTER_LABELS[q]} and suggest a set-aside amount as you go.`
    }

    return {
      quarter: q,
      monthRange: QUARTER_LABELS[q],
      earnedIncome: income,
      suggestedReserve,
      amountReserved: reserved,
      covered,
      deadlineDate,
      isPast,
      isCurrent,
      headline,
      detail,
    }
  })

  // Find the next upcoming deadline
  let nextDeadline: QuarterlyTaxEstimatesResult['nextDeadline'] = null
  for (const q of quarters) {
    const days = daysBetween(referenceDate, q.deadlineDate)
    if (days > 0) {
      nextDeadline = { quarter: q.quarter, date: q.deadlineDate, daysUntil: days }
      break
    }
  }

  const totalGigIncome = quarters.reduce((s, q) => s + q.earnedIncome, 0)
  const totalSuggestedReserve = quarters.reduce((s, q) => s + q.suggestedReserve, 0)
  const totalActualReserved = quarters.reduce((s, q) => s + q.amountReserved, 0)

  return {
    taxYear,
    quarters,
    nextDeadline,
    totalGigIncome,
    totalSuggestedReserve,
    totalReserved: totalActualReserved,
    disclaimer: "This isn't tax advice — just a friendly heads-up to set money aside.",
  }
}

// ============================================================================
// Single-period trajectory (Phase 1/3 — Tasks 54 & 154.1)
// ============================================================================

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
