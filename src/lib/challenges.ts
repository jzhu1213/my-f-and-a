/**
 * Challenge Framework — Short-term spending challenges with suggestions.
 *
 * Pure computational module: no React, no components. Designed to be called
 * from hooks/components.
 *
 * Challenge rules:
 * - Duration: 3–14 days
 * - Max 2 active challenges at once
 * - Types: spending_limit, no_spend_category, logging_consistency, savings, custom
 * - Completion is celebrated; failure carries zero negative consequences
 * - Challenges can be self-set or suggested from spending patterns
 *
 * Requirements: 25.2
 */

import type { Transaction, TransactionCategory, Budget, Goal } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import { formatDateLocal, addDaysLocal, parseDateLocal, getTodayLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

export type ChallengeType =
  | 'spending_limit'
  | 'no_spend_category'
  | 'logging_consistency'
  | 'savings'
  | 'custom'

export interface Challenge {
  /** Unique identifier */
  id: string
  /** Short, encouraging title */
  title: string
  /** Brief description of what the challenge asks */
  description: string
  /** Challenge category */
  type: ChallengeType
  /** Numeric target (e.g., dollar limit, number of days) */
  targetValue: number
  /** Duration in days (3–14) */
  duration: number
  /** Start date (YYYY-MM-DD) */
  startDate: string
  /** Whether the challenge is currently running */
  isActive: boolean
  /** Current progress toward targetValue (meaning depends on type) */
  progress: number
  /** Whether the challenge has been completed successfully */
  isComplete: boolean
  /** Optional category for category-specific challenges */
  category?: TransactionCategory
}

export interface ChallengeData {
  /** All challenges (active + past) */
  challenges: Challenge[]
  /** Week number used to rotate suggestions (ISO week) */
  lastSuggestionWeek: number
}

export interface ChallengeSuggestion {
  /** Suggested title */
  title: string
  /** Suggested description */
  description: string
  /** Challenge type */
  type: ChallengeType
  /** Suggested target value */
  targetValue: number
  /** Suggested duration in days */
  duration: number
  /** Optional category */
  category?: TransactionCategory
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio_challenge_data'
const MAX_ACTIVE_CHALLENGES = 2
const MIN_DURATION = 3
const MAX_DURATION = 14
const SUGGESTIONS_COUNT = 3

// ============================================================================
// localStorage Persistence (versioned)
// ============================================================================

import { z } from 'zod'
import * as versionedStorage from './versionedStorage'
import { syncChallengeToServer } from './gamificationSync'
import { ChallengeDataSchema } from './schemas/challenge'

/**
 * Reads persisted challenge data from localStorage.
 * Uses versioned storage with schema validation.
 * Returns null if no data exists or parsing fails.
 */
export function getChallengeData(): ChallengeData | null {
  if (typeof window === 'undefined') return null
  return versionedStorage.get(STORAGE_KEY, ChallengeDataSchema) as ChallengeData | null
}

/**
 * Persists challenge data to localStorage via versioned storage
 * and syncs to server in background.
 */
export function saveChallengeData(data: ChallengeData): void {
  versionedStorage.set(STORAGE_KEY, data, ChallengeDataSchema)
  // Fire-and-forget sync to Supabase (Task 525.2)
  syncChallengeToServer(data)
}

// ============================================================================
// Challenge Queries
// ============================================================================

/**
 * Returns currently active challenges (max 2).
 */
export function getActiveChallenges(data: ChallengeData): Challenge[] {
  return data.challenges.filter((c) => c.isActive && !c.isComplete)
}

/**
 * Returns completed challenges (for history/celebration).
 */
export function getCompletedChallenges(data: ChallengeData): Challenge[] {
  return data.challenges.filter((c) => c.isComplete)
}

/**
 * Checks whether the user can start a new challenge (max 2 active).
 */
export function canStartNewChallenge(data: ChallengeData): boolean {
  return getActiveChallenges(data).length < MAX_ACTIVE_CHALLENGES
}

// ============================================================================
// Challenge Lifecycle
// ============================================================================

/**
 * Generates a simple unique ID for a challenge.
 */
function generateId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Creates a new challenge and persists it.
 * Returns the updated ChallengeData, or null if max active limit reached.
 */
export function startChallenge(
  suggestion: ChallengeSuggestion,
  startDate?: string
): ChallengeData | null {
  const existing = getChallengeData() ?? { challenges: [], lastSuggestionWeek: 0 }

  if (!canStartNewChallenge(existing)) return null

  const challenge: Challenge = {
    id: generateId(),
    title: suggestion.title,
    description: suggestion.description,
    type: suggestion.type,
    targetValue: suggestion.targetValue,
    duration: suggestion.duration,
    startDate: startDate ?? getTodayLocal(),
    isActive: true,
    progress: 0,
    isComplete: false,
    category: suggestion.category,
  }

  const updated: ChallengeData = {
    ...existing,
    challenges: [...existing.challenges, challenge],
  }

  saveChallengeData(updated)
  return updated
}

/**
 * Updates progress on an active challenge.
 * Automatically marks it complete if progress >= targetValue.
 */
export function updateChallengeProgress(
  challengeId: string,
  newProgress: number
): ChallengeData | null {
  const data = getChallengeData()
  if (!data) return null

  const updated: ChallengeData = {
    ...data,
    challenges: data.challenges.map((c) => {
      if (c.id !== challengeId) return c
      const progress = Math.max(0, newProgress)
      const isComplete = progress >= c.targetValue
      return {
        ...c,
        progress,
        isComplete,
        isActive: isComplete ? false : c.isActive,
      }
    }),
  }

  saveChallengeData(updated)
  return updated
}

/**
 * Checks if a challenge has expired (past its duration) and deactivates it.
 * Expiration carries zero consequences — just a friendly nudge to try again.
 */
export function expireOverdueChallenges(today?: string): ChallengeData | null {
  const data = getChallengeData()
  if (!data) return null

  const todayStr = today ?? getTodayLocal()
  let changed = false

  const updated: ChallengeData = {
    ...data,
    challenges: data.challenges.map((c) => {
      if (!c.isActive || c.isComplete) return c
      const endDate = formatDateLocal(addDaysLocal(parseDateLocal(c.startDate), c.duration))
      if (todayStr >= endDate) {
        changed = true
        return { ...c, isActive: false }
      }
      return c
    }),
  }

  if (changed) {
    saveChallengeData(updated)
  }
  return updated
}

/**
 * Abandons a challenge (user decided to stop early).
 * No negative consequences — just deactivates.
 */
export function abandonChallenge(challengeId: string): ChallengeData | null {
  const data = getChallengeData()
  if (!data) return null

  const updated: ChallengeData = {
    ...data,
    challenges: data.challenges.map((c) =>
      c.id === challengeId ? { ...c, isActive: false } : c
    ),
  }

  saveChallengeData(updated)
  return updated
}

// ============================================================================
// Challenge Progress Computation (Pure Functions)
// ============================================================================

/**
 * Computes progress for a spending_limit challenge.
 * Progress = how much of the budget the user has NOT spent (remaining).
 * E.g., target is $50 limit, user spent $30 → progress toward completion
 * is measured as days stayed under limit.
 */
export function computeSpendingLimitProgress(
  challenge: Challenge,
  transactions: Transaction[],
  today?: string
): number {
  const todayStr = today ?? getTodayLocal()
  const endDate = formatDateLocal(addDaysLocal(parseDateLocal(challenge.startDate), challenge.duration))
  const effectiveEnd = todayStr < endDate ? todayStr : endDate

  // Count days where spending in the category (or all) stayed under targetValue
  let daysUnderLimit = 0
  const startDate = parseDateLocal(challenge.startDate)

  for (let i = 0; i < challenge.duration; i++) {
    const checkDate = formatDateLocal(addDaysLocal(startDate, i))
    if (checkDate > effectiveEnd) break

    const daySpend = transactions
      .filter((tx) => {
        if (tx.date !== checkDate || tx.type !== 'expense') return false
        if (challenge.category) return tx.category === challenge.category
        return true
      })
      .reduce((sum, tx) => sum + tx.amount, 0)

    if (daySpend <= challenge.targetValue) {
      daysUnderLimit++
    }
  }

  return daysUnderLimit
}

/**
 * Computes progress for a no_spend_category challenge.
 * Progress = number of days with $0 spent in the target category.
 */
export function computeNoSpendProgress(
  challenge: Challenge,
  transactions: Transaction[],
  today?: string
): number {
  if (!challenge.category) return 0

  const todayStr = today ?? getTodayLocal()
  const endDate = formatDateLocal(addDaysLocal(parseDateLocal(challenge.startDate), challenge.duration))
  const effectiveEnd = todayStr < endDate ? todayStr : endDate

  let zeroSpendDays = 0
  const startDate = parseDateLocal(challenge.startDate)

  for (let i = 0; i < challenge.duration; i++) {
    const checkDate = formatDateLocal(addDaysLocal(startDate, i))
    if (checkDate > effectiveEnd) break

    const daySpend = transactions
      .filter(
        (tx) =>
          tx.date === checkDate &&
          tx.type === 'expense' &&
          tx.category === challenge.category
      )
      .reduce((sum, tx) => sum + tx.amount, 0)

    if (daySpend === 0) {
      zeroSpendDays++
    }
  }

  return zeroSpendDays
}

/**
 * Computes progress for a logging_consistency challenge.
 * Progress = number of days with at least 1 transaction logged.
 */
export function computeLoggingConsistencyProgress(
  challenge: Challenge,
  transactions: Transaction[],
  today?: string
): number {
  const todayStr = today ?? getTodayLocal()
  const endDate = formatDateLocal(addDaysLocal(parseDateLocal(challenge.startDate), challenge.duration))
  const effectiveEnd = todayStr < endDate ? todayStr : endDate

  let loggedDays = 0
  const startDate = parseDateLocal(challenge.startDate)

  for (let i = 0; i < challenge.duration; i++) {
    const checkDate = formatDateLocal(addDaysLocal(startDate, i))
    if (checkDate > effectiveEnd) break

    const hasTransaction = transactions.some((tx) => tx.date === checkDate)
    if (hasTransaction) {
      loggedDays++
    }
  }

  return loggedDays
}

/**
 * Computes progress for a savings challenge.
 * Progress = total amount saved (income tagged or goal contributions) during the period.
 */
export function computeSavingsProgress(
  challenge: Challenge,
  transactions: Transaction[],
  today?: string
): number {
  const todayStr = today ?? getTodayLocal()
  const endDate = formatDateLocal(addDaysLocal(parseDateLocal(challenge.startDate), challenge.duration))
  const effectiveEnd = todayStr < endDate ? todayStr : endDate

  const savings = transactions
    .filter(
      (tx) =>
        tx.date >= challenge.startDate &&
        tx.date <= effectiveEnd &&
        tx.type === 'income'
    )
    .reduce((sum, tx) => sum + tx.amount, 0)

  return savings
}

/**
 * Computes progress for any challenge type and returns the updated value.
 */
export function computeProgress(
  challenge: Challenge,
  transactions: Transaction[],
  today?: string
): number {
  switch (challenge.type) {
    case 'spending_limit':
      return computeSpendingLimitProgress(challenge, transactions, today)
    case 'no_spend_category':
      return computeNoSpendProgress(challenge, transactions, today)
    case 'logging_consistency':
      return computeLoggingConsistencyProgress(challenge, transactions, today)
    case 'savings':
      return computeSavingsProgress(challenge, transactions, today)
    case 'custom':
      // Custom challenges have manually-updated progress
      return challenge.progress
    default:
      return challenge.progress
  }
}

// ============================================================================
// Suggested Challenges (Task 431.2)
// ============================================================================

/**
 * Returns the current ISO week number.
 */
function getISOWeekNumber(date?: Date): number {
  const d = date ?? new Date()
  const temp = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7))
  const week1 = new Date(temp.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  )
}

/**
 * Analyzes spending patterns and generates personalized challenge suggestions.
 *
 * Patterns detected:
 * - Heavy coffee/drinks spender → "Skip coffee for X days"
 * - Inconsistent logger → "Log every expense for X days"
 * - Over-budget in a category → "Keep [category] under $X this week"
 * - Saving toward a goal → "Save an extra $X this week"
 *
 * Returns 3 suggestions, rotated weekly.
 */
export function generateChallengeSuggestions(
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  today?: Date
): ChallengeSuggestion[] {
  const now = today ?? new Date()
  const currentWeek = getISOWeekNumber(now)
  const suggestions: ChallengeSuggestion[] = []

  // Analyze last 30 days of transactions
  const thirtyDaysAgo = formatDateLocal(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
  )
  const recentTxns = transactions.filter(
    (tx) => tx.date >= thirtyDaysAgo && tx.type === 'expense'
  )

  // --- Pattern 1: Heavy drinks spender ---
  const drinksTxns = recentTxns.filter((tx) => tx.category === 'drinks')
  const drinksTotal = drinksTxns.reduce((sum, tx) => sum + tx.amount, 0)
  const drinksFrequency = drinksTxns.length

  if (drinksFrequency >= 10 || drinksTotal >= 60) {
    suggestions.push({
      title: 'Skip coffee for 5 days',
      description: 'Challenge yourself to go 5 days without a coffee purchase',
      type: 'no_spend_category',
      targetValue: 5,
      duration: 7,
      category: 'drinks',
    })
  }

  // --- Pattern 2: Inconsistent logger ---
  const last14Days = formatDateLocal(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14)
  )
  const recentDates = new Set(
    transactions.filter((tx) => tx.date >= last14Days).map((tx) => tx.date)
  )
  const loggedDaysCount = recentDates.size

  if (loggedDaysCount < 8) {
    // Logged fewer than 8 of the last 14 days
    suggestions.push({
      title: 'Log every expense for 7 days',
      description: 'Build the habit — track every purchase for a full week',
      type: 'logging_consistency',
      targetValue: 7,
      duration: 7,
    })
  }

  // --- Pattern 3: Over-budget in a category ---
  const overBudgetCategories = budgets.filter(
    (b) => b.spent > b.monthlyLimit * 0.9
  )

  for (const budget of overBudgetCategories) {
    const categoryInfo = BUDGET_CATEGORIES.find((bc) => bc.category === budget.category)
    const weeklyTarget = Math.round(budget.monthlyLimit / 4)

    if (categoryInfo) {
      suggestions.push({
        title: `Keep ${categoryInfo.label} under $${weeklyTarget} this week`,
        description: `You're close to your ${categoryInfo.label.toLowerCase()} limit — see if you can stay under $${weeklyTarget} for 7 days`,
        type: 'spending_limit',
        targetValue: weeklyTarget,
        duration: 7,
        category: budget.category,
      })
    }
  }

  // --- Pattern 4: Saving toward a goal ---
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount)

  if (activeGoals.length > 0) {
    suggestions.push({
      title: 'Save an extra $20 this week',
      description: 'Put a little extra toward your goal — every bit counts',
      type: 'savings',
      targetValue: 20,
      duration: 7,
    })
  }

  // --- Fallback suggestions if we don't have enough pattern-based ones ---
  const fallbacks: ChallengeSuggestion[] = [
    {
      title: 'No eating out for 5 days',
      description: 'Challenge yourself to cook at home for 5 days straight',
      type: 'no_spend_category',
      targetValue: 5,
      duration: 7,
      category: 'food',
    },
    {
      title: 'Log expenses for 5 days straight',
      description: 'Small habit, big impact — track everything for 5 days',
      type: 'logging_consistency',
      targetValue: 5,
      duration: 5,
    },
    {
      title: 'Keep fun spending under $30 this week',
      description: 'See how creative you can get with free fun for a week',
      type: 'spending_limit',
      targetValue: 30,
      duration: 7,
      category: 'fun',
    },
    {
      title: 'Save $10 this week',
      description: 'Start small — tuck away $10 toward your future',
      type: 'savings',
      targetValue: 10,
      duration: 7,
    },
  ]

  // Use currentWeek to rotate which fallbacks appear
  while (suggestions.length < SUGGESTIONS_COUNT) {
    const fallbackIndex =
      (currentWeek + suggestions.length) % fallbacks.length
    const fallback = fallbacks[fallbackIndex]
    // Avoid duplicates
    if (!suggestions.some((s) => s.title === fallback.title)) {
      suggestions.push(fallback)
    } else {
      // Pick the next fallback
      const nextIndex = (fallbackIndex + 1) % fallbacks.length
      if (!suggestions.some((s) => s.title === fallbacks[nextIndex].title)) {
        suggestions.push(fallbacks[nextIndex])
      } else {
        break // All fallbacks exhausted
      }
    }
  }

  // Return exactly SUGGESTIONS_COUNT, rotating based on week
  return suggestions.slice(0, SUGGESTIONS_COUNT)
}

// ============================================================================
// Custom Challenge Creation (Task 431.3)
// ============================================================================

export interface CustomChallengeInput {
  /** Challenge type */
  type: ChallengeType
  /** Target value (dollars, days, etc.) */
  targetValue: number
  /** Duration in days (3–14) */
  duration: number
  /** Optional title override */
  title?: string
  /** Optional description override */
  description?: string
  /** Optional category for category-specific challenges */
  category?: TransactionCategory
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates custom challenge input.
 * Returns validation result with any error messages.
 */
export function validateCustomChallenge(input: CustomChallengeInput): ValidationResult {
  const errors: string[] = []

  // Duration must be 3–14 days
  if (input.duration < MIN_DURATION || input.duration > MAX_DURATION) {
    errors.push(`Duration must be between ${MIN_DURATION} and ${MAX_DURATION} days`)
  }

  // Target value must be positive
  if (input.targetValue <= 0) {
    errors.push('Target must be greater than zero')
  }

  // Type must be valid
  const validTypes: ChallengeType[] = [
    'spending_limit',
    'no_spend_category',
    'logging_consistency',
    'savings',
    'custom',
  ]
  if (!validTypes.includes(input.type)) {
    errors.push('Please pick a valid challenge type')
  }

  // Category-specific challenges need a category
  if (
    (input.type === 'no_spend_category' || input.type === 'spending_limit') &&
    !input.category
  ) {
    errors.push('Pick a category for this challenge')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Default titles/descriptions for each challenge type (used when user doesn't provide custom copy).
 */
function getDefaultCopy(input: CustomChallengeInput): { title: string; description: string } {
  const categoryLabel = input.category
    ? BUDGET_CATEGORIES.find((bc) => bc.category === input.category)?.label ?? input.category
    : ''

  switch (input.type) {
    case 'spending_limit':
      return {
        title: `Keep ${categoryLabel || 'spending'} under $${input.targetValue}`,
        description: `Stay under $${input.targetValue}${categoryLabel ? ` on ${categoryLabel.toLowerCase()}` : ''} for ${input.duration} days`,
      }
    case 'no_spend_category':
      return {
        title: `No ${categoryLabel.toLowerCase() || 'spending'} for ${input.targetValue} days`,
        description: `Challenge yourself to skip ${categoryLabel.toLowerCase() || 'this category'} for ${input.targetValue} days`,
      }
    case 'logging_consistency':
      return {
        title: `Log expenses for ${input.targetValue} days`,
        description: `Track every expense for ${input.targetValue} days straight`,
      }
    case 'savings':
      return {
        title: `Save $${input.targetValue} in ${input.duration} days`,
        description: `Put away $${input.targetValue} over the next ${input.duration} days`,
      }
    case 'custom':
    default:
      return {
        title: 'My custom challenge',
        description: `Complete this challenge in ${input.duration} days`,
      }
  }
}

/**
 * Creates a custom challenge from user input.
 * Validates input, generates copy if not provided, and persists.
 * Returns the updated ChallengeData or null if validation fails or max active reached.
 */
export function createCustomChallenge(input: CustomChallengeInput): {
  data: ChallengeData | null
  errors: string[]
} {
  const validation = validateCustomChallenge(input)
  if (!validation.valid) {
    return { data: null, errors: validation.errors }
  }

  const defaultCopy = getDefaultCopy(input)

  const suggestion: ChallengeSuggestion = {
    title: input.title || defaultCopy.title,
    description: input.description || defaultCopy.description,
    type: input.type,
    targetValue: input.targetValue,
    duration: input.duration,
    category: input.category,
  }

  const result = startChallenge(suggestion)
  if (!result) {
    return { data: null, errors: ['You already have 2 active challenges — finish one first!'] }
  }

  return { data: result, errors: [] }
}

// ============================================================================
// UX Messages
// ============================================================================

/**
 * Returns an encouraging completion message for a finished challenge.
 */
export function getCompletionMessage(challenge: Challenge): string {
  const messages = [
    'Nice work! You crushed it 🎉',
    'Challenge complete — you did it!',
    'Look at you go! Another one done 💪',
    'That\'s a wrap — well done!',
  ]
  return messages[Math.abs(challenge.id.length) % messages.length]
}

/**
 * Returns a warm, non-punitive message for an expired/abandoned challenge.
 */
export function getExpiredMessage(): string {
  return "Didn't quite make it — want to try again?"
}

/**
 * Returns a progress summary message for an active challenge.
 */
export function getProgressMessage(challenge: Challenge): string {
  if (challenge.targetValue <= 0) return ''
  const percent = Math.min(100, Math.round((challenge.progress / challenge.targetValue) * 100))

  if (percent >= 80) return 'Almost there — keep going!'
  if (percent >= 50) return 'Halfway there, nice!'
  if (percent > 0) return "You're on your way"
  return 'Just getting started'
}

/**
 * Returns the number of days remaining for an active challenge.
 */
export function getDaysRemaining(challenge: Challenge, today?: string): number {
  const todayStr = today ?? getTodayLocal()
  const endDate = formatDateLocal(addDaysLocal(parseDateLocal(challenge.startDate), challenge.duration))
  const todayDate = parseDateLocal(todayStr)
  const end = parseDateLocal(endDate)
  const diff = Math.ceil((end.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}
