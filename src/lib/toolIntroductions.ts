// Folio — Tool Introduction System (Task 394.1)
// Surfaces brief, 1-tap dismissible introductions to related tools when users
// complete checklist steps. Max 1 per session. Never blocking.

// ============================================================================
// Constants
// ============================================================================

const SHOWN_INTROS_KEY = 'folio-tool-intros-shown'
let sessionIntroShown = false

// ============================================================================
// Types
// ============================================================================

export interface ToolIntroduction {
  /** Unique identifier for this introduction */
  id: string
  /** The checklist step ID that triggers this introduction */
  triggerStep: string
  /** Emoji to display */
  emoji: string
  /** The message shown to the user */
  message: string
  /** The tool ID this introduction points to (for optional navigation) */
  relatedToolId: string
}

// ============================================================================
// Introduction Definitions
// ============================================================================

/**
 * Mapping from checklist step completions → tool introduction messages.
 * Each introduction surfaces once (ever) and at most 1 per session.
 */
export const TOOL_INTRODUCTIONS: ToolIntroduction[] = [
  {
    id: 'intro-cash-flow',
    triggerStep: 'set-budget',
    emoji: '📈',
    message: 'Now that you have a budget, the Cash Flow tool can show you what\'s ahead →',
    relatedToolId: 'cash-flow-forecast',
  },
  {
    id: 'intro-savings-projections',
    triggerStep: 'create-goal',
    emoji: '🎯',
    message: 'Your goal is set! Savings Projections can show you when you\'ll get there →',
    relatedToolId: 'savings-projections',
  },
  {
    id: 'intro-trajectory',
    triggerStep: 'first-expense',
    emoji: '📊',
    message: 'Nice! Keep logging and your Financial Trajectory will come alive →',
    relatedToolId: 'trajectory',
  },
  {
    id: 'intro-income-trends',
    triggerStep: 'add-income',
    emoji: '💰',
    message: 'Income tracked! Income Trends will show how your earnings grow →',
    relatedToolId: 'income-trends',
  },
]

// ============================================================================
// Core API
// ============================================================================

/**
 * Mark that a tool introduction has been shown in the current session.
 * Prevents any further introductions from appearing until next app open.
 */
export function markToolIntroductionSessionShown(): void {
  sessionIntroShown = true
}

/**
 * Check whether a tool introduction has already been shown this session.
 */
export function hasToolIntroductionBeenShownThisSession(): boolean {
  return sessionIntroShown
}

/**
 * Get the set of introduction IDs that have already been shown (ever).
 */
function getShownIntroIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SHOWN_INTROS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      return new Set(parsed)
    }
  } catch {
    // Corrupted — treat as none shown
  }
  return new Set()
}

/**
 * Persist an introduction ID as permanently shown.
 */
export function markToolIntroductionShown(introId: string): void {
  if (typeof window === 'undefined') return
  try {
    const shown = getShownIntroIds()
    shown.add(introId)
    localStorage.setItem(SHOWN_INTROS_KEY, JSON.stringify([...shown]))
  } catch {
    // best-effort
  }
  // Also mark session as having shown an intro
  markToolIntroductionSessionShown()
}

/**
 * Get the appropriate tool introduction for a just-completed checklist step.
 * Returns null if:
 * - No introduction mapped to this step
 * - The introduction has already been shown (ever)
 * - An introduction has already been shown this session
 */
export function getToolIntroduction(completedStepId: string): ToolIntroduction | null {
  // Already shown one this session — respect the "max 1 per session" rule
  if (sessionIntroShown) return null

  const intro = TOOL_INTRODUCTIONS.find(i => i.triggerStep === completedStepId)
  if (!intro) return null

  // Check if already permanently shown
  const shown = getShownIntroIds()
  if (shown.has(intro.id)) return null

  return intro
}

/**
 * Check if there are any pending introductions for steps that have been completed
 * but whose introductions haven't been shown yet.
 * Useful for showing an introduction on app open if one was missed.
 */
export function getPendingIntroduction(completedStepIds: string[]): ToolIntroduction | null {
  if (sessionIntroShown) return null

  const shown = getShownIntroIds()

  for (const intro of TOOL_INTRODUCTIONS) {
    if (completedStepIds.includes(intro.triggerStep) && !shown.has(intro.id)) {
      return intro
    }
  }

  return null
}
