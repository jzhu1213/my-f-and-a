/**
 * Credit Education Path
 *
 * Defines a progressive credit-education sequence for first-time credit users.
 * When a user starts spending on credit sources, the system surfaces contextual
 * tips that guide them through credit lessons in a recommended order.
 *
 * The path is:
 * 1. building-credit-student — "How to start building credit"
 * 2. credit-cards — "How credit cards work"
 * 3. credit-score-basics — "What your score means"
 * 4. credit-score-monitoring — "How to check and track your score"
 * 5. common-credit-mistakes — "Pitfalls to avoid"
 *
 * Each step links to a full lesson in lessonsContent.ts. The path fires
 * contextually: the first tip appears on first credit spend, subsequent tips
 * appear as the user completes each lesson.
 */

// ============================================================================
// Credit Education Path Definition
// ============================================================================

/** Ordered sequence of credit lessons for new credit users. */
export const CREDIT_EDUCATION_PATH: string[] = [
  'building-credit-student',
  'credit-cards',
  'credit-score-basics',
  'credit-score-monitoring',
  'common-credit-mistakes',
]

/** localStorage key tracking whether the user has ever made a credit transaction. */
const FIRST_CREDIT_SPEND_KEY = 'folio-first-credit-spend-seen'

/** localStorage key tracking the last credit lesson the user completed in the path. */
const CREDIT_PATH_PROGRESS_KEY = 'folio-credit-path-progress'

// ============================================================================
// First Credit Spend Detection
// ============================================================================

/**
 * Returns true if the user has already been shown the first-credit-spend tip.
 */
export function hasSeenFirstCreditSpend(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(FIRST_CREDIT_SPEND_KEY) === 'true'
  } catch {
    return true
  }
}

/**
 * Marks that the first-credit-spend tip has been shown.
 */
export function markFirstCreditSpendSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FIRST_CREDIT_SPEND_KEY, 'true')
  } catch {
    // best-effort
  }
}

// ============================================================================
// Path Progress
// ============================================================================

/**
 * Returns the index of the user's progress through the credit education path.
 * -1 means they haven't started. 0 means they completed the first lesson, etc.
 */
export function getCreditPathProgress(): number {
  if (typeof window === 'undefined') return -1
  try {
    const stored = localStorage.getItem(CREDIT_PATH_PROGRESS_KEY)
    return stored ? Number(stored) : -1
  } catch {
    return -1
  }
}

/**
 * Advances the credit path progress when a lesson is completed.
 * Only advances if the completed lesson matches the current or a previous step.
 */
export function advanceCreditPath(completedLessonId: string): void {
  if (typeof window === 'undefined') return
  try {
    const idx = CREDIT_EDUCATION_PATH.indexOf(completedLessonId)
    if (idx === -1) return // Not a credit-path lesson
    const current = getCreditPathProgress()
    if (idx > current) {
      localStorage.setItem(CREDIT_PATH_PROGRESS_KEY, String(idx))
    }
  } catch {
    // best-effort
  }
}

/**
 * Returns the next recommended credit lesson ID based on the user's path progress,
 * or null if they've completed the entire path.
 *
 * @param completedLessonIds - Set of lesson IDs the user has already completed
 */
export function getNextCreditLesson(completedLessonIds: Set<string>): string | null {
  for (const lessonId of CREDIT_EDUCATION_PATH) {
    if (!completedLessonIds.has(lessonId)) {
      return lessonId
    }
  }
  return null
}
