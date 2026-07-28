/**
 * Emergency Fund Helper — student-scaled target recommendation.
 *
 * Students typically don't need a full 3–6 months of expenses.
 * We recommend ~1 month of essential expenses, with a sensible floor
 * of $1,000 for those who don't yet track their expenses.
 */

export interface EmergencyFundTarget {
  /** Recommended dollar target */
  target: number
  /** Warm, non-judgmental rationale explaining the recommendation */
  rationale: string
}

/** Minimum floor for students who don't know their expenses yet */
const DEFAULT_STUDENT_TARGET = 1000

/**
 * Compute a student-scaled emergency fund target.
 *
 * @param monthlyEssentialExpenses - Optional known monthly essentials (rent, food, transport, etc.)
 * @returns Target amount and a friendly rationale string
 */
export function computeEmergencyFundTarget(
  monthlyEssentialExpenses?: number
): EmergencyFundTarget {
  if (monthlyEssentialExpenses != null && monthlyEssentialExpenses > 0) {
    // 1 month of essentials, rounded to the nearest $50 for a clean number
    const raw = monthlyEssentialExpenses
    const target = Math.max(DEFAULT_STUDENT_TARGET, Math.round(raw / 50) * 50)

    return {
      target,
      rationale:
        `Based on your ~$${monthlyEssentialExpenses.toLocaleString()}/mo essentials, ` +
        `$${target.toLocaleString()} covers about one month — a solid safety net while you're in school.`,
    }
  }

  // Fallback when expenses aren't known
  return {
    target: DEFAULT_STUDENT_TARGET,
    rationale:
      `$${DEFAULT_STUDENT_TARGET.toLocaleString()} is a great starter emergency fund for students. ` +
      `It's enough to cover an unexpected expense without derailing your budget.`,
  }
}
