// Folio — Tool Readiness System (Task 394.2)
// Determines whether advanced tools have enough data to be useful.
// When they don't, provides friendly messaging instead of broken/empty screens.
// No locked gates — just honest context about what's needed.

// ============================================================================
// Types
// ============================================================================

export interface ToolReadinessContext {
  /** Total number of transactions logged */
  transactionCount: number
  /** Days since the user's first transaction (0 if none) */
  daysSinceFirstTransaction: number
  /** Number of budgets the user has set */
  budgetCount: number
  /** Number of savings goals created */
  goalCount: number
}

export interface ToolReadinessState {
  /** Whether the tool has enough data to show meaningful content */
  ready: boolean
  /** Friendly message to show when not ready (empty string when ready) */
  message: string
  /** Emoji to display with the not-ready message */
  emoji: string
  /** Optional progress hint (e.g., "2 of 3 days") */
  progressHint?: string
}

// ============================================================================
// Readiness Thresholds
// ============================================================================

interface ToolThreshold {
  /** Minimum transaction count needed */
  minTransactions?: number
  /** Minimum days since first transaction */
  minDays?: number
  /** Minimum budget count needed */
  minBudgets?: number
  /** Minimum goal count needed */
  minGoals?: number
  /** Friendly message when not ready */
  notReadyMessage: string
  /** Emoji for the not-ready state */
  emoji: string
  /** Builder for progress hint (optional) */
  progressHintFn?: (ctx: ToolReadinessContext) => string | undefined
}

const TOOL_THRESHOLDS: Record<string, ToolThreshold> = {
  'trajectory': {
    minTransactions: 3,
    minDays: 3,
    notReadyMessage: 'Keep logging for a few days and this will come alive',
    emoji: '📊',
    progressHintFn: (ctx) => {
      if (ctx.daysSinceFirstTransaction > 0 && ctx.daysSinceFirstTransaction < 3) {
        return `${ctx.daysSinceFirstTransaction} of 3 days tracked`
      }
      return undefined
    },
  },
  'income-trends': {
    minTransactions: 2,
    minDays: 7,
    notReadyMessage: 'Once you have a week of income data, trends will appear here',
    emoji: '💰',
    progressHintFn: (ctx) => {
      if (ctx.daysSinceFirstTransaction > 0 && ctx.daysSinceFirstTransaction < 7) {
        return `${ctx.daysSinceFirstTransaction} of 7 days`
      }
      return undefined
    },
  },
  'term-review': {
    minTransactions: 5,
    minDays: 14,
    notReadyMessage: 'After a couple weeks of tracking, your term review will have something to say',
    emoji: '📝',
    progressHintFn: (ctx) => {
      if (ctx.daysSinceFirstTransaction > 0 && ctx.daysSinceFirstTransaction < 14) {
        return `${ctx.daysSinceFirstTransaction} of 14 days`
      }
      return undefined
    },
  },
  'year-in-review': {
    minTransactions: 10,
    minDays: 30,
    notReadyMessage: 'Your year-in-review needs at least a month of data to be meaningful',
    emoji: '🗓️',
    progressHintFn: (ctx) => {
      if (ctx.daysSinceFirstTransaction > 0 && ctx.daysSinceFirstTransaction < 30) {
        return `${ctx.daysSinceFirstTransaction} of 30 days`
      }
      return undefined
    },
  },
  'cash-flow-forecast': {
    minBudgets: 1,
    minTransactions: 1,
    notReadyMessage: 'Set a budget and log a few transactions, then cash flow forecasting kicks in',
    emoji: '📈',
  },
  'savings-projections': {
    minGoals: 1,
    notReadyMessage: 'Create a savings goal and this tool will show you when you\'ll get there',
    emoji: '🎯',
  },
  'confidence': {
    minTransactions: 3,
    minDays: 3,
    notReadyMessage: 'Keep logging for a few days and your confidence score will appear',
    emoji: '✨',
  },
  'peer-context': {
    minTransactions: 5,
    minDays: 7,
    notReadyMessage: 'A week of tracking data lets us show meaningful comparisons',
    emoji: '👥',
  },
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Determine whether a tool has enough data to show meaningful content.
 * Returns a readiness state with a friendly message for not-ready tools.
 *
 * Tools not in the threshold map are always considered ready.
 */
export function getToolReadinessState(
  toolId: string,
  context: ToolReadinessContext
): ToolReadinessState {
  const threshold = TOOL_THRESHOLDS[toolId]

  // Tools without thresholds are always ready
  if (!threshold) {
    return { ready: true, message: '', emoji: '' }
  }

  // Check each threshold condition
  const meetsTransactions = threshold.minTransactions == null ||
    context.transactionCount >= threshold.minTransactions

  const meetsDays = threshold.minDays == null ||
    context.daysSinceFirstTransaction >= threshold.minDays

  const meetsBudgets = threshold.minBudgets == null ||
    context.budgetCount >= threshold.minBudgets

  const meetsGoals = threshold.minGoals == null ||
    context.goalCount >= threshold.minGoals

  const ready = meetsTransactions && meetsDays && meetsBudgets && meetsGoals

  if (ready) {
    return { ready: true, message: '', emoji: '' }
  }

  const progressHint = threshold.progressHintFn?.(context)

  return {
    ready: false,
    message: threshold.notReadyMessage,
    emoji: threshold.emoji,
    progressHint,
  }
}

/**
 * Get all tool IDs that have readiness thresholds defined.
 */
export function getToolsWithReadinessThresholds(): string[] {
  return Object.keys(TOOL_THRESHOLDS)
}

/**
 * Check if a specific tool has readiness requirements.
 */
export function toolHasReadinessRequirements(toolId: string): boolean {
  return toolId in TOOL_THRESHOLDS
}
