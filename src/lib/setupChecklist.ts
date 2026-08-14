// Folio - Progressive Setup Checklist (Task 392)
// Manages the post-onboarding guided task list that helps new users
// discover app features at their own pace.

// ============================================================================
// Constants
// ============================================================================

const CHECKLIST_KEY = 'folio-setup-checklist'

// ============================================================================
// Types
// ============================================================================

export interface ChecklistStep {
  id: string
  label: string
  description: string
  emoji: string
  /** Action identifier used by the parent to route taps */
  action: string
}

export interface ChecklistState {
  /** Step IDs that have been completed */
  completedSteps: string[]
  /** Whether the user has dismissed the checklist */
  dismissed: boolean
  /** Whether the checklist has been activated (post-onboarding) */
  activated: boolean
}

export interface ChecklistProgress {
  completed: number
  total: number
  percentage: number
}

// ============================================================================
// Step Definitions
// ============================================================================

export const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    id: 'setup-allowance',
    label: 'Set up your allowance',
    description: 'Completed during onboarding',
    emoji: '✅',
    action: 'allowance',
  },
  {
    id: 'first-expense',
    label: 'Log your first expense',
    description: 'Tap + to track a purchase',
    emoji: '💸',
    action: 'log-expense',
  },
  {
    id: 'add-income',
    label: 'Add your income source',
    description: 'So Folio knows what you earn',
    emoji: '💰',
    action: 'add-income',
  },
  {
    id: 'set-budget',
    label: 'Set a budget for one category',
    description: 'Pick a spending limit to track',
    emoji: '📊',
    action: 'set-budget',
  },
  {
    id: 'create-goal',
    label: 'Create your first savings goal',
    description: 'Something to save toward',
    emoji: '🎯',
    action: 'create-goal',
  },
  {
    id: 'enable-notifications',
    label: 'Enable notifications',
    description: 'Gentle nudges when it matters',
    emoji: '🔔',
    action: 'enable-notifications',
  },
  {
    id: 'invite-friend',
    label: 'Invite a friend',
    description: 'Budgeting is better together',
    emoji: '👋',
    action: 'invite-friend',
  },
]

// ============================================================================
// Default state
// ============================================================================

function defaultState(): ChecklistState {
  return {
    completedSteps: [],
    dismissed: false,
    activated: false,
  }
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Read the current checklist state from localStorage.
 */
export function getChecklistState(): ChecklistState {
  if (typeof window === 'undefined') return defaultState()

  try {
    const raw = localStorage.getItem(CHECKLIST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChecklistState>
      return {
        completedSteps: parsed.completedSteps ?? [],
        dismissed: parsed.dismissed ?? false,
        activated: parsed.activated ?? false,
      }
    }
  } catch {
    // Corrupted — start fresh
  }

  return defaultState()
}

/**
 * Write the full checklist state to localStorage.
 */
function saveChecklistState(state: ChecklistState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state))
}

/**
 * Activate the checklist (called after onboarding completes).
 * Marks "Set up your allowance" as completed automatically.
 */
export function activateChecklist(): void {
  const state = getChecklistState()
  state.activated = true
  if (!state.completedSteps.includes('setup-allowance')) {
    state.completedSteps.push('setup-allowance')
  }
  saveChecklistState(state)
}

/**
 * Mark a specific step as completed.
 */
export function markChecklistStepComplete(stepId: string): void {
  const state = getChecklistState()
  if (!state.completedSteps.includes(stepId)) {
    state.completedSteps.push(stepId)
  }
  saveChecklistState(state)
}

/**
 * Dismiss the checklist (user chose "I'll explore on my own").
 */
export function dismissChecklist(): void {
  const state = getChecklistState()
  state.dismissed = true
  saveChecklistState(state)
}

/**
 * Resume the checklist (user chose "Resume setup" in Settings).
 */
export function resumeChecklist(): void {
  const state = getChecklistState()
  state.dismissed = false
  saveChecklistState(state)
}

/**
 * Check whether the checklist is currently dismissed.
 */
export function isChecklistDismissed(): boolean {
  return getChecklistState().dismissed
}

/**
 * Check whether the checklist has been activated.
 */
export function isChecklistActivated(): boolean {
  return getChecklistState().activated
}

/**
 * Check whether all steps are complete.
 */
export function isChecklistComplete(): boolean {
  const state = getChecklistState()
  return state.completedSteps.length >= CHECKLIST_STEPS.length
}

/**
 * Get completion progress for the checklist.
 */
export function getChecklistProgress(): ChecklistProgress {
  const state = getChecklistState()
  const total = CHECKLIST_STEPS.length
  const completed = state.completedSteps.length
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

/**
 * Get the next uncompleted steps (for display in the compact card).
 */
export function getNextSteps(limit: number = 2): ChecklistStep[] {
  const state = getChecklistState()
  return CHECKLIST_STEPS
    .filter(step => !state.completedSteps.includes(step.id))
    .slice(0, limit)
}

/**
 * Get all steps with their completion status.
 */
export function getAllStepsWithStatus(): (ChecklistStep & { completed: boolean })[] {
  const state = getChecklistState()
  return CHECKLIST_STEPS.map(step => ({
    ...step,
    completed: state.completedSteps.includes(step.id),
  }))
}

/**
 * Check if the checklist should be visible on home.
 * Visible when: activated AND not dismissed AND not all complete.
 */
export function shouldShowChecklist(): boolean {
  const state = getChecklistState()
  return state.activated && !state.dismissed && state.completedSteps.length < CHECKLIST_STEPS.length
}
