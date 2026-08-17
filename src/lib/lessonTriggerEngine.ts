/**
 * Lesson Trigger Engine — Event-driven contextual education system.
 *
 * Replaces the simple has-seen guards in contextualLessonTriggers.ts with a
 * robust trigger evaluation engine. Triggers fire based on:
 *   - First-time actions (first expense over $100, first debt added, etc.)
 *   - Pattern detection (consecutive over-budget days, recurring merchants)
 *   - Tool access (opening calculators, trajectory, cash flow for first time)
 *   - Milestone moments (Phase 17 milestone achievements)
 *   - Time-based fallback (first open of the week if nothing else triggered)
 *
 * Each trigger fires at most once per unique context. Prioritization picks
 * the most relevant trigger when multiple fire. Cooldown enforces max 1
 * educational moment per session and max 3 per week.
 *
 * Requirements: 26.1
 */

import type { Transaction, TransactionCategory, LessonTopic } from '@/types'
import type { MilestoneCategory } from '@/lib/milestones'
import { getEducationPreferences } from '@/lib/educationPreferences'

// ============================================================================
// Types
// ============================================================================

/** Categories of trigger events. */
export type TriggerType =
  | 'first_time_action'
  | 'pattern_detection'
  | 'tool_access'
  | 'milestone'
  | 'time_based'

/** Priority scoring for trigger relevance (higher = more urgent/educational). */
export type TriggerPriority = 'high' | 'medium' | 'low'

/**
 * A trigger definition: the condition under which a contextual lesson fires.
 */
export interface TriggerDefinition {
  /** Unique trigger identifier */
  id: string
  /** Which category this trigger belongs to */
  type: TriggerType
  /** Priority for ranking when multiple triggers fire simultaneously */
  priority: TriggerPriority
  /** The lesson content ID this trigger maps to */
  lessonId: string
  /** Human-readable description (for debugging/logging) */
  description: string
  /** Educational value score 1–10 (used in prioritization alongside recency) */
  educationalValue: number
}

/**
 * A fired trigger — a trigger that has been evaluated and matched.
 */
export interface FiredTrigger {
  /** The trigger definition that fired */
  trigger: TriggerDefinition
  /** Unique context key for deduplication (e.g., "first_expense_over_100") */
  contextKey: string
  /** Timestamp when the trigger fired */
  firedAt: number
  /** Relevance score (higher = more relevant right now) */
  relevanceScore: number
}

/**
 * Persisted trigger history entry.
 */
export interface TriggerHistoryEntry {
  /** The trigger ID that fired */
  triggerId: string
  /** The unique context key */
  contextKey: string
  /** ISO timestamp when this was shown */
  shownAt: string
}

/**
 * Context data for evaluating triggers. Similar to UserContext in tipUtils.ts
 * but focused on educational trigger conditions.
 */
export interface TriggerEvaluationContext {
  /** All user transactions */
  transactions: Transaction[]
  /** Today's date as YYYY-MM-DD */
  today: string
  /** Number of consecutive over-budget days */
  consecutiveOverBudgetDays: number
  /** Whether user has any goals */
  hasGoals: boolean
  /** Whether user has any debt entries */
  hasDebt: boolean
  /** Whether user has savings accounts */
  hasSavingsAccounts: boolean
  /** Tools the user has accessed this session */
  toolsAccessedThisSession: Set<string>
  /** Tools ever accessed (persisted) */
  toolsEverAccessed: Set<string>
  /** Recently earned milestone IDs */
  recentMilestoneIds: string[]
  /** Account age in days */
  accountAgeDays: number
  /** Total transactions count */
  totalTransactions: number
  /** The user's daily budget */
  dailyBudget: number
}

// ============================================================================
// localStorage Keys
// ============================================================================

const TRIGGER_HISTORY_KEY = 'folio-lesson-trigger-history'
const SESSION_LESSON_SHOWN_KEY = 'folio-session-lesson-shown'
const WEEKLY_LESSON_COUNT_KEY = 'folio-weekly-lesson-count'
const WEEKLY_LESSON_RESET_KEY = 'folio-weekly-lesson-reset-date'
const TOOLS_ACCESSED_KEY = 'folio-tools-ever-accessed'
const LAST_WEEKLY_OPEN_KEY = 'folio-last-weekly-open-date'

// ============================================================================
// Constants
// ============================================================================

/** Maximum educational moments per session */
const MAX_PER_SESSION = 1
/** Maximum educational moments per week */
const MAX_PER_WEEK = 3

// ============================================================================
// Session State
// ============================================================================

let sessionLessonShown = false

/**
 * Marks that an educational moment was shown this session.
 */
export function markSessionLessonShown(): void {
  sessionLessonShown = true
}

/**
 * Returns whether an educational moment has already been shown this session.
 */
export function hasSessionLessonBeenShown(): boolean {
  return sessionLessonShown
}

/**
 * Resets session state (for testing or page reload detection).
 */
export function resetSessionState(): void {
  sessionLessonShown = false
}

// ============================================================================
// Persistence Helpers
// ============================================================================

/**
 * Returns the full trigger history from localStorage.
 */
export function getTriggerHistory(): TriggerHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRIGGER_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Records a trigger as shown in history.
 */
export function recordTriggerShown(triggerId: string, contextKey: string): void {
  if (typeof window === 'undefined') return
  try {
    const history = getTriggerHistory()
    history.push({
      triggerId,
      contextKey,
      shownAt: new Date().toISOString(),
    })
    localStorage.setItem(TRIGGER_HISTORY_KEY, JSON.stringify(history))
    // Also update weekly count
    incrementWeeklyCount()
    // Mark session
    markSessionLessonShown()
  } catch {
    // best-effort
  }
}

/**
 * Checks if a trigger has already fired for a specific context.
 */
export function hasTriggerFiredForContext(contextKey: string): boolean {
  const history = getTriggerHistory()
  return history.some(entry => entry.contextKey === contextKey)
}

// ============================================================================
// Weekly Count / Cooldown
// ============================================================================

/**
 * Returns the number of educational moments shown this week.
 */
export function getWeeklyLessonCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const resetDate = localStorage.getItem(WEEKLY_LESSON_RESET_KEY)
    const now = new Date()
    // Reset if we're in a new week (Monday-based)
    if (resetDate) {
      const reset = new Date(resetDate)
      const daysSinceReset = Math.floor((now.getTime() - reset.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceReset >= 7) {
        localStorage.setItem(WEEKLY_LESSON_COUNT_KEY, '0')
        localStorage.setItem(WEEKLY_LESSON_RESET_KEY, now.toISOString())
        return 0
      }
    } else {
      localStorage.setItem(WEEKLY_LESSON_RESET_KEY, now.toISOString())
      localStorage.setItem(WEEKLY_LESSON_COUNT_KEY, '0')
      return 0
    }
    return Number(localStorage.getItem(WEEKLY_LESSON_COUNT_KEY) ?? '0')
  } catch {
    return 0
  }
}

/**
 * Increments the weekly lesson count.
 */
function incrementWeeklyCount(): void {
  if (typeof window === 'undefined') return
  try {
    const current = getWeeklyLessonCount()
    localStorage.setItem(WEEKLY_LESSON_COUNT_KEY, String(current + 1))
  } catch {
    // best-effort
  }
}

/**
 * Returns true if the cooldown allows another educational moment.
 * Enforces: max 1 per session, max per week based on frequency preference.
 * Also respects education preferences (mode must not be 'off').
 */
export function canShowLesson(): boolean {
  const eduPrefs = getEducationPreferences()
  if (eduPrefs.learningMode === 'off') return false
  if (sessionLessonShown) return false
  const maxPerWeek = eduPrefs.frequency === 'normal' ? MAX_PER_WEEK : 1
  if (getWeeklyLessonCount() >= maxPerWeek) return false
  return true
}

/**
 * Returns true if deep dive content should be shown (mode is 'on').
 * In 'subtle' mode, only micro-lessons are shown — no deep dives.
 */
export function canShowDeepDive(): boolean {
  const eduPrefs = getEducationPreferences()
  return eduPrefs.learningMode === 'on'
}

/**
 * Returns true if the given lesson topic is allowed (not opted out).
 */
export function isTopicAllowed(topic: LessonTopic): boolean {
  const eduPrefs = getEducationPreferences()
  return !eduPrefs.optedOutTopics.includes(topic)
}

// ============================================================================
// Tool Access Tracking
// ============================================================================

/**
 * Returns the set of tools the user has ever accessed.
 */
export function getToolsEverAccessed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(TOOLS_ACCESSED_KEY)
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>()
  } catch {
    return new Set()
  }
}

/**
 * Records that a tool was accessed for the first time.
 */
export function recordToolAccess(toolId: string): void {
  if (typeof window === 'undefined') return
  try {
    const tools = getToolsEverAccessed()
    tools.add(toolId)
    localStorage.setItem(TOOLS_ACCESSED_KEY, JSON.stringify([...tools]))
  } catch {
    // best-effort
  }
}

/**
 * Checks if this is the first time a tool is being accessed.
 */
export function isFirstToolAccess(toolId: string): boolean {
  return !getToolsEverAccessed().has(toolId)
}

// ============================================================================
// Time-Based Fallback
// ============================================================================

/**
 * Returns whether this is the first app open of the current week.
 */
export function isFirstOpenOfWeek(today: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const lastOpen = localStorage.getItem(LAST_WEEKLY_OPEN_KEY)
    if (!lastOpen) {
      localStorage.setItem(LAST_WEEKLY_OPEN_KEY, today)
      return true
    }
    const lastDate = new Date(lastOpen + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')
    const daysSince = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince >= 7) {
      localStorage.setItem(LAST_WEEKLY_OPEN_KEY, today)
      return true
    }
    return false
  } catch {
    return false
  }
}

// ============================================================================
// Trigger Evaluation
// ============================================================================

/**
 * Evaluates all triggers against the current context and returns fired triggers.
 * Triggers that have already fired for their context are excluded.
 */
export function evaluateTriggers(
  context: TriggerEvaluationContext,
  triggerDefinitions: TriggerDefinition[]
): FiredTrigger[] {
  const fired: FiredTrigger[] = []

  for (const trigger of triggerDefinitions) {
    const contextKey = evaluateSingleTrigger(trigger, context)
    if (contextKey && !hasTriggerFiredForContext(contextKey)) {
      const relevanceScore = computeRelevanceScore(trigger, context)
      fired.push({
        trigger,
        contextKey,
        firedAt: Date.now(),
        relevanceScore,
      })
    }
  }

  return fired
}

/**
 * Evaluates a single trigger against context.
 * Returns the context key if the trigger fires, or null if it doesn't.
 */
function evaluateSingleTrigger(
  trigger: TriggerDefinition,
  context: TriggerEvaluationContext
): string | null {
  switch (trigger.id) {
    // ── First-time actions ───────────────────────────────────────────────
    case 'first_expense_over_100':
      return hasExpenseOver(context.transactions, 100)
        ? 'first_expense_over_100'
        : null

    case 'first_debt_added':
      return context.hasDebt ? 'first_debt_added' : null

    case 'first_goal_set':
      return context.hasGoals ? 'first_goal_set' : null

    case 'first_savings_account':
      return context.hasSavingsAccounts ? 'first_savings_account' : null

    case 'first_expense_over_50':
      return hasExpenseOver(context.transactions, 50)
        ? 'first_expense_over_50'
        : null

    case 'first_recurring_expense':
      return context.transactions.some(t => t.isRecurring && t.type === 'expense')
        ? 'first_recurring_expense'
        : null

    case 'tenth_transaction':
      return context.totalTransactions >= 10 ? 'tenth_transaction' : null

    case 'first_income_logged':
      return context.transactions.some(t => t.type === 'income')
        ? 'first_income_logged'
        : null

    // ── Pattern detection ────────────────────────────────────────────────
    case 'three_consecutive_over_budget':
      return context.consecutiveOverBudgetDays >= 3
        ? `three_over_budget_${context.today}`
        : null

    case 'five_consecutive_over_budget':
      return context.consecutiveOverBudgetDays >= 5
        ? `five_over_budget_${context.today}`
        : null

    case 'recurring_merchant_pattern':
      return detectRecurringMerchant(context.transactions)
        ? 'recurring_merchant_detected'
        : null

    case 'weekend_spending_spike':
      return detectWeekendSpike(context.transactions, context.today, context.dailyBudget)
        ? `weekend_spike_${context.today.slice(0, 7)}`
        : null

    case 'food_category_dominant':
      return isCategoryDominant(context.transactions, 'food', context.today)
        ? `food_dominant_${context.today.slice(0, 7)}`
        : null

    case 'subscriptions_growing':
      return detectSubscriptionGrowth(context.transactions, context.today)
        ? `subs_growing_${context.today.slice(0, 7)}`
        : null

    // ── Tool access ─────────────────────────────────────────────────────
    case 'first_calculator_use':
      return context.toolsAccessedThisSession.has('calculator') &&
        !context.toolsEverAccessed.has('calculator')
        ? 'first_calculator_use'
        : null

    case 'first_trajectory_use':
      return context.toolsAccessedThisSession.has('trajectory') &&
        !context.toolsEverAccessed.has('trajectory')
        ? 'first_trajectory_use'
        : null

    case 'first_cash_flow_use':
      return context.toolsAccessedThisSession.has('cash_flow') &&
        !context.toolsEverAccessed.has('cash_flow')
        ? 'first_cash_flow_use'
        : null

    case 'first_debt_tool_use':
      return context.toolsAccessedThisSession.has('debt') &&
        !context.toolsEverAccessed.has('debt')
        ? 'first_debt_tool_use'
        : null

    case 'first_learn_tab_use':
      return context.toolsAccessedThisSession.has('learn') &&
        !context.toolsEverAccessed.has('learn')
        ? 'first_learn_tab_use'
        : null

    // ── Milestone moments ───────────────────────────────────────────────
    case 'milestone_tracking_10':
      return context.recentMilestoneIds.includes('tracking-10')
        ? 'milestone_tracking_10'
        : null

    case 'milestone_tracking_50':
      return context.recentMilestoneIds.includes('tracking-50')
        ? 'milestone_tracking_50'
        : null

    case 'milestone_consistency_1':
      return context.recentMilestoneIds.includes('consistency-1')
        ? 'milestone_consistency_1'
        : null

    case 'milestone_saving_1':
      return context.recentMilestoneIds.includes('saving-1')
        ? 'milestone_saving_1'
        : null

    case 'milestone_streaks_7':
      return context.recentMilestoneIds.includes('streaks-7')
        ? 'milestone_streaks_7'
        : null

    case 'milestone_awareness_1k':
      return context.recentMilestoneIds.includes('awareness-1k')
        ? 'milestone_awareness_1k'
        : null

    // ── Time-based fallback ─────────────────────────────────────────────
    case 'first_open_of_week':
      return isFirstOpenOfWeek(context.today) ? `weekly_${context.today}` : null

    default:
      return null
  }
}

// ============================================================================
// Pattern Detection Helpers
// ============================================================================

function hasExpenseOver(transactions: Transaction[], amount: number): boolean {
  return transactions.some(t => t.type === 'expense' && t.amount > amount)
}

function detectRecurringMerchant(transactions: Transaction[]): boolean {
  // Detect if the same note/category appears 3+ times in the last 30 days
  const last30 = transactions.filter(t => {
    if (t.type !== 'expense' || !t.note) return false
    const txDate = new Date(t.date + 'T00:00:00')
    const now = new Date()
    const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff <= 30
  })

  const noteCount: Record<string, number> = {}
  for (const tx of last30) {
    if (tx.note) {
      const key = tx.note.toLowerCase().trim()
      noteCount[key] = (noteCount[key] ?? 0) + 1
    }
  }

  return Object.values(noteCount).some(count => count >= 3)
}

function detectWeekendSpike(
  transactions: Transaction[],
  today: string,
  dailyBudget: number
): boolean {
  if (dailyBudget <= 0) return false
  const todayDate = new Date(today + 'T00:00:00')
  const currentMonth = today.slice(0, 7)

  let weekendSpend = 0
  let weekendDays = 0
  let weekdaySpend = 0
  let weekdayDays = 0

  // Count days and spending for the current month
  for (let i = 1; i <= 28; i++) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - i)
    if (d.toISOString().slice(0, 7) !== currentMonth) break
    const dayOfWeek = d.getDay()
    const dateStr = d.toISOString().slice(0, 10)
    const daySpend = transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(dateStr))
      .reduce((sum, t) => sum + t.amount, 0)

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendSpend += daySpend
      weekendDays++
    } else {
      weekdaySpend += daySpend
      weekdayDays++
    }
  }

  if (weekendDays === 0 || weekdayDays === 0) return false
  const avgWeekend = weekendSpend / weekendDays
  const avgWeekday = weekdaySpend / weekdayDays
  return avgWeekend > avgWeekday * 1.5
}

function isCategoryDominant(
  transactions: Transaction[],
  category: TransactionCategory,
  today: string
): boolean {
  const currentMonth = today.slice(0, 7)
  const monthExpenses = transactions.filter(
    t => t.type === 'expense' && t.date.startsWith(currentMonth)
  )
  if (monthExpenses.length < 5) return false

  const totalSpend = monthExpenses.reduce((s, t) => s + t.amount, 0)
  const categorySpend = monthExpenses
    .filter(t => t.category === category)
    .reduce((s, t) => s + t.amount, 0)

  return totalSpend > 0 && categorySpend / totalSpend > 0.4
}

function detectSubscriptionGrowth(
  transactions: Transaction[],
  today: string
): boolean {
  const currentMonth = today.slice(0, 7)
  const todayDate = new Date(today + 'T00:00:00')
  const prevDate = new Date(todayDate)
  prevDate.setMonth(prevDate.getMonth() - 1)
  const prevMonth = prevDate.toISOString().slice(0, 7)

  const currentSubs = transactions.filter(
    t => t.type === 'expense' && t.category === 'subscriptions' && t.date.startsWith(currentMonth)
  )
  const prevSubs = transactions.filter(
    t => t.type === 'expense' && t.category === 'subscriptions' && t.date.startsWith(prevMonth)
  )

  const currentTotal = currentSubs.reduce((s, t) => s + t.amount, 0)
  const prevTotal = prevSubs.reduce((s, t) => s + t.amount, 0)

  return prevTotal > 0 && currentTotal > prevTotal * 1.2
}

// ============================================================================
// Prioritization
// ============================================================================

/**
 * Computes a relevance score for a fired trigger.
 * Higher score = more relevant right now.
 * Factors: priority weight + educational value + recency bonus.
 */
function computeRelevanceScore(
  trigger: TriggerDefinition,
  _context: TriggerEvaluationContext
): number {
  const priorityWeight = trigger.priority === 'high' ? 30 : trigger.priority === 'medium' ? 20 : 10
  const educationalWeight = trigger.educationalValue * 3
  // Time-based triggers get a lower bonus (they're fallbacks)
  const typePenalty = trigger.type === 'time_based' ? -15 : 0

  return priorityWeight + educationalWeight + typePenalty
}

/**
 * Selects the single best trigger to fire from a list of candidates.
 * Picks the highest relevance score. Ties broken by educational value.
 */
export function selectBestTrigger(fired: FiredTrigger[]): FiredTrigger | null {
  if (fired.length === 0) return null
  return fired.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
    return b.trigger.educationalValue - a.trigger.educationalValue
  })[0]
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Evaluates all triggers, applies prioritization, checks cooldown, and returns
 * the single best educational lesson to show (or null if none should fire).
 *
 * This is the primary API for the trigger engine.
 */
export function getNextLesson(
  context: TriggerEvaluationContext,
  triggerDefinitions: TriggerDefinition[]
): FiredTrigger | null {
  // Check cooldown first
  if (!canShowLesson()) return null

  // Evaluate all triggers
  const fired = evaluateTriggers(context, triggerDefinitions)
  if (fired.length === 0) return null

  // Select the best one
  return selectBestTrigger(fired)
}
