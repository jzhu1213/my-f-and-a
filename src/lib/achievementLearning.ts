/**
 * Achievement-Linked Learning — Personalized educational insights earned through milestones and challenges.
 *
 * Pure computational module: no React, no components.
 *
 * When a milestone fires or a challenge completes, this module generates a brief,
 * data-personalized educational reward. The insight is earned — not lectured.
 *
 * Examples:
 *   Milestone "100 transactions tracked" →
 *     "You've tracked $4,320 total — your top category is Food at 35%.
 *      People who track this much start noticing their spending naturally drifts down."
 *
 *   Challenge "Keep food under $50 this week" completed →
 *     "By keeping food under $50, you freed up $23 — that's $92/month toward your trip."
 *
 * Requirements: 26.4
 */

import type { Transaction, TransactionCategory, Budget, Goal } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import type { Challenge } from '@/lib/challenges'
import type { MilestoneDefinition, MilestoneCategory } from '@/lib/milestones'

// ============================================================================
// Types
// ============================================================================

/**
 * A personalized educational insight paired with an achievement.
 */
export interface AchievementInsight {
  /** Unique insight id (derived from achievement id) */
  id: string
  /** The achievement source: milestone or challenge */
  source: 'milestone' | 'challenge'
  /** The milestone or challenge id that triggered this insight */
  achievementId: string
  /** Short personalized insight (1–2 sentences, warm tone) */
  insight: string
  /** Emoji for display */
  emoji: string
}

/**
 * Context needed to generate personalized milestone insights.
 */
export interface MilestoneInsightContext {
  /** All user transactions */
  transactions: Transaction[]
  /** User's active goals */
  goals: Goal[]
  /** User's budgets for the current month */
  budgets: Budget[]
}

/**
 * Context needed to generate personalized challenge completion insights.
 */
export interface ChallengeInsightContext {
  /** All user transactions */
  transactions: Transaction[]
  /** The completed challenge */
  challenge: Challenge
  /** User's active goals (for contextual "toward your goal" framing) */
  goals: Goal[]
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a number as a dollar string (e.g., 1234.5 → "$1,235").
 */
function formatDollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/**
 * Returns the user's top spending category and its percentage of total spend.
 */
function getTopCategory(transactions: Transaction[]): { category: TransactionCategory; label: string; percent: number } | null {
  const expenses = transactions.filter((t) => t.type === 'expense')
  if (expenses.length === 0) return null

  const totals = new Map<TransactionCategory, number>()
  let total = 0

  for (const tx of expenses) {
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount)
    total += tx.amount
  }

  let topCategory: TransactionCategory = 'other'
  let topAmount = 0
  for (const [cat, amount] of totals) {
    if (amount > topAmount) {
      topCategory = cat
      topAmount = amount
    }
  }

  const label = BUDGET_CATEGORIES.find((b) => b.category === topCategory)?.label ?? topCategory
  const percent = total > 0 ? Math.round((topAmount / total) * 100) : 0

  return { category: topCategory, label, percent }
}

/**
 * Calculates average daily spend across all expense transactions.
 */
function getAverageDailySpend(transactions: Transaction[]): number {
  const expenses = transactions.filter((t) => t.type === 'expense')
  if (expenses.length === 0) return 0

  const dates = new Set(expenses.map((t) => t.date))
  const totalSpend = expenses.reduce((sum, t) => sum + t.amount, 0)

  return dates.size > 0 ? totalSpend / dates.size : 0
}

/**
 * Gets the total expense amount for a specific category.
 */
function getCategoryTotal(transactions: Transaction[], category: TransactionCategory): number {
  return transactions
    .filter((t) => t.type === 'expense' && t.category === category)
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Gets total expenses.
 */
function getTotalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Returns the user's closest active goal name, or a generic phrase.
 */
function getGoalPhrase(goals: Goal[]): string {
  const active = goals.filter((g) => g.currentAmount < g.targetAmount)
  if (active.length === 0) return 'your next goal'

  // Pick the one closest to completion
  const sorted = [...active].sort(
    (a, b) => (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount)
  )
  return sorted[0].name.toLowerCase()
}

/**
 * Returns the spending during a challenge's active period for relevant categories.
 */
function getChallengeSpending(challenge: Challenge, transactions: Transaction[]): number {
  const endDate = getEndDate(challenge.startDate, challenge.duration)
  return transactions
    .filter((t) => {
      if (t.type !== 'expense') return false
      if (t.date < challenge.startDate || t.date > endDate) return false
      if (challenge.category) return t.category === challenge.category
      return true
    })
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Returns date string (YYYY-MM-DD) for a date offset by N days.
 */
function getEndDate(startDate: string, days: number): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Gets typical weekly spend for a category (based on last 30 days).
 */
function getTypicalWeeklySpend(transactions: Transaction[], category?: TransactionCategory): number {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    .toISOString().slice(0, 10)

  const relevant = transactions.filter((t) => {
    if (t.type !== 'expense' || t.date < thirtyDaysAgo) return false
    if (category) return t.category === category
    return true
  })

  const total = relevant.reduce((sum, t) => sum + t.amount, 0)
  // Convert 30-day total to weekly average
  return total / 4.3
}

// ============================================================================
// Milestone Learning Moments (Task 444.1)
// ============================================================================

/**
 * Generates a personalized educational insight when a milestone is earned.
 *
 * The insight uses real user data to teach something about their habits —
 * it's brief, warm, and earned through the milestone achievement.
 */
export function generateMilestoneInsight(
  milestone: MilestoneDefinition,
  context: MilestoneInsightContext
): AchievementInsight | null {
  const { transactions, goals } = context
  const insight = getMilestoneInsightText(milestone, context)

  if (!insight) return null

  return {
    id: `insight-milestone-${milestone.id}`,
    source: 'milestone',
    achievementId: milestone.id,
    insight,
    emoji: milestone.emoji,
  }
}

/**
 * Core logic: maps each milestone category/threshold to a personalized insight.
 */
function getMilestoneInsightText(
  milestone: MilestoneDefinition,
  context: MilestoneInsightContext
): string | null {
  const { transactions, goals, budgets } = context
  const totalExpenses = getTotalExpenses(transactions)
  const topCat = getTopCategory(transactions)
  const avgDaily = getAverageDailySpend(transactions)

  switch (milestone.category) {
    case 'tracking':
      return getTrackingInsight(milestone.threshold, transactions, totalExpenses, topCat, avgDaily)

    case 'awareness':
      return getAwarenessInsight(milestone.threshold, transactions, totalExpenses, topCat)

    case 'consistency':
      return getConsistencyInsight(milestone.threshold, avgDaily, topCat)

    case 'saving':
      return getSavingInsight(milestone.threshold, goals)

    case 'streaks':
      return getStreaksInsight(milestone.threshold, avgDaily)

    case 'challenges':
      return getChallengesInsight(milestone.threshold)

    default:
      return null
  }
}

function getTrackingInsight(
  threshold: number,
  transactions: Transaction[],
  totalExpenses: number,
  topCat: ReturnType<typeof getTopCategory>,
  avgDaily: number
): string {
  if (threshold <= 10) {
    return `You've logged 10 transactions — that's enough data to see your average day costs about ${formatDollars(avgDaily)}. Knowing that number is already an edge most people don't have.`
  }
  if (threshold <= 50) {
    if (topCat) {
      return `50 transactions in! Your top category is ${topCat.label} at ${topCat.percent}% of spending. That one number can reshape how you plan your week.`
    }
    return `50 transactions tracked — you're building a real picture of where your money goes. That clarity compounds over time.`
  }
  if (threshold <= 100) {
    return `You've tracked ${formatDollars(totalExpenses)} total — here's what that data tells you: your average day costs ${formatDollars(avgDaily)}.${topCat ? ` ${topCat.label} is your biggest slice at ${topCat.percent}%.` : ''} People who track this much start seeing their spending naturally decrease.`
  }
  if (threshold <= 500) {
    return `500 transactions deep — you know your money better than most people ever will.${topCat ? ` ${topCat.label} still leads at ${topCat.percent}%.` : ''} This level of awareness typically translates to 10–15% less unintentional spending.`
  }
  // 1000+
  return `1,000 transactions tracked — ${formatDollars(totalExpenses)} mapped out. At this point, you're not just tracking — you're building financial intuition. That's the kind of skill that pays for itself.`
}

function getAwarenessInsight(
  threshold: number,
  transactions: Transaction[],
  totalExpenses: number,
  topCat: ReturnType<typeof getTopCategory>
): string {
  if (threshold <= 1000) {
    return `You've tracked ${formatDollars(totalExpenses)} in spending — awareness is the first step.${topCat ? ` Your biggest category (${topCat.label}) tells you where small changes would have the biggest impact.` : ''}`
  }
  if (threshold <= 5000) {
    return `${formatDollars(totalExpenses)} tracked! You now have real clarity on where your money goes.${topCat ? ` ${topCat.label} at ${topCat.percent}% is your biggest lever for change.` : ''}`
  }
  if (threshold <= 10000) {
    return `${formatDollars(totalExpenses)} of spending, fully mapped. You have a clear picture of your financial rhythm — that's genuinely powerful.${topCat ? ` Even a 10% shift in ${topCat.label} would free up ${formatDollars(totalExpenses * topCat.percent / 100 * 0.1)}/year.` : ''}`
  }
  // 50k+
  return `${formatDollars(totalExpenses)} tracked — you have a comprehensive view of your financial life. This level of insight gives you the power to make truly informed decisions about your future.`
}

function getConsistencyInsight(
  threshold: number,
  avgDaily: number,
  topCat: ReturnType<typeof getTopCategory>
): string {
  if (threshold <= 1) {
    return `One full month of tracking! Consistency is where the magic happens — your average day costs about ${formatDollars(avgDaily)}, and now you'll start seeing patterns week to week.`
  }
  if (threshold <= 3) {
    return `3 months straight — you've moved past the "new habit" phase. Your spending data is now meaningful enough to spot seasonal patterns and plan ahead.`
  }
  if (threshold <= 6) {
    return `6 months of consistency! You now have half a year of data — enough to predict future months with confidence and spot trends most people miss.`
  }
  // 12+
  return `A full year of consistent tracking. You have a complete picture of your annual rhythm — seasonal spending, income fluctuations, all of it. That's rare and incredibly valuable.`
}

function getSavingInsight(
  threshold: number,
  goals: Goal[]
): string {
  const completed = goals.filter((g) => g.currentAmount >= g.targetAmount)
  const totalSaved = completed.reduce((sum, g) => sum + g.targetAmount, 0)

  if (threshold <= 1) {
    return `Your first goal met! You've proven you can set a target and hit it.${totalSaved > 0 ? ` That's ${formatDollars(totalSaved)} you made happen through intention.` : ''} The hardest part is behind you.`
  }
  if (threshold <= 3) {
    return `3 goals completed — ${formatDollars(totalSaved)} saved through pure intention. Each goal gets easier because you've built the muscle memory of delayed gratification.`
  }
  // 5+
  return `5 goals done — ${formatDollars(totalSaved)} put exactly where you wanted it. You've moved from "trying to save" to "someone who saves." That's an identity shift.`
}

function getStreaksInsight(
  threshold: number,
  avgDaily: number
): string {
  if (threshold <= 7) {
    return `A full week streak! Daily tracking gives you a running average — yours is about ${formatDollars(avgDaily)}/day. That number becomes your gut check for "can I afford this?"`
  }
  if (threshold <= 30) {
    return `30-day streak! A month of daily awareness means you're catching spending in real-time instead of regretting it later. That shift alone changes outcomes.`
  }
  if (threshold <= 60) {
    return `60-day streak — two months of daily tracking. At this point, logging is probably automatic. Research shows it takes about 66 days to cement a habit — you're right there.`
  }
  // 100+
  return `100-day streak! This level of consistency is rare. You've built a financial awareness practice that most people never achieve. It's genuinely paying off in clarity.`
}

function getChallengesInsight(threshold: number): string {
  if (threshold <= 5) {
    return `5 challenges completed! Each one taught you something about your habits — what's easy to cut, what's harder than expected, and where your real flexibility lives.`
  }
  if (threshold <= 10) {
    return `10 challenges done! You've run enough experiments to know your spending patterns inside and out. That self-knowledge is worth more than any budgeting tip.`
  }
  // 25+
  return `25 challenges conquered! You've essentially run a personal spending research project. You know exactly where your money can flex and where it can't.`
}

// ============================================================================
// Challenge Completion Insights (Task 444.2)
// ============================================================================

/**
 * Generates a personalized insight when a challenge is completed.
 *
 * Shows what the user accomplished in concrete, encouraging terms:
 * how much they saved, what that means per month, and ties it to their goals.
 */
export function generateChallengeInsight(
  context: ChallengeInsightContext
): AchievementInsight | null {
  const { challenge, transactions, goals } = context
  const insight = getChallengeInsightText(challenge, transactions, goals)

  if (!insight) return null

  return {
    id: `insight-challenge-${challenge.id}`,
    source: 'challenge',
    achievementId: challenge.id,
    insight,
    emoji: '🎯',
  }
}

/**
 * Core logic: generates personalized text based on challenge type and user data.
 */
function getChallengeInsightText(
  challenge: Challenge,
  transactions: Transaction[],
  goals: Goal[]
): string | null {
  switch (challenge.type) {
    case 'spending_limit':
      return getSpendingLimitInsight(challenge, transactions, goals)

    case 'no_spend_category':
      return getNoSpendInsight(challenge, transactions, goals)

    case 'logging_consistency':
      return getLoggingInsight(challenge, transactions)

    case 'savings':
      return getSavingsInsight(challenge, goals)

    case 'custom':
      return getCustomInsight(challenge)

    default:
      return null
  }
}

function getSpendingLimitInsight(
  challenge: Challenge,
  transactions: Transaction[],
  goals: Goal[]
): string {
  const categoryLabel = challenge.category
    ? BUDGET_CATEGORIES.find((b) => b.category === challenge.category)?.label ?? challenge.category
    : 'spending'

  const typicalWeekly = getTypicalWeeklySpend(transactions, challenge.category)
  const actualSpend = getChallengeSpending(challenge, transactions)
  const saved = Math.max(0, typicalWeekly - actualSpend)
  const monthlyEquivalent = Math.round(saved * (30 / challenge.duration))
  const goalPhrase = getGoalPhrase(goals)

  if (saved > 0) {
    return `By keeping ${categoryLabel.toLowerCase()} under ${formatDollars(challenge.targetValue)}, you freed up about ${formatDollars(saved)} — that's ~${formatDollars(monthlyEquivalent)}/month toward ${goalPhrase}.`
  }

  return `You kept ${categoryLabel.toLowerCase()} under ${formatDollars(challenge.targetValue)} for ${challenge.duration} days. That discipline is a skill — and it gets easier every time.`
}

function getNoSpendInsight(
  challenge: Challenge,
  transactions: Transaction[],
  goals: Goal[]
): string {
  const categoryLabel = challenge.category
    ? BUDGET_CATEGORIES.find((b) => b.category === challenge.category)?.label?.toLowerCase() ?? challenge.category
    : 'that category'

  const typicalWeekly = getTypicalWeeklySpend(transactions, challenge.category)
  const actualSpend = getChallengeSpending(challenge, transactions)
  const saved = Math.max(0, typicalWeekly - actualSpend)
  const monthlyHalf = Math.round(saved * 2) // "if you kept it up half the time" = saved × (30/7) × 0.5 ≈ saved × 2

  if (saved > 0) {
    return `${challenge.progress} days without ${categoryLabel} saved you ~${formatDollars(saved)} — that's ~${formatDollars(monthlyHalf)}/month if you kept it up even half the time.`
  }

  return `${challenge.progress} days of skipping ${categoryLabel} — you proved you can do it. Now you get to choose when it's worth it and when it's not.`
}

function getLoggingInsight(
  challenge: Challenge,
  transactions: Transaction[]
): string {
  // Calculate average daily spend during the challenge period
  const endDate = getEndDate(challenge.startDate, challenge.duration)
  const periodTxns = transactions.filter(
    (t) => t.type === 'expense' && t.date >= challenge.startDate && t.date <= endDate
  )
  const totalSpend = periodTxns.reduce((sum, t) => sum + t.amount, 0)
  const avgDaily = challenge.progress > 0 ? totalSpend / challenge.progress : 0

  if (avgDaily > 0) {
    return `${challenge.progress} days straight of tracking! Your average daily spend was ${formatDollars(avgDaily)} — knowing that number is worth more than any budgeting tip.`
  }

  return `${challenge.progress} days of consistent tracking — you've built the foundation. Every day you log is another data point that helps you make better decisions.`
}

function getSavingsInsight(
  challenge: Challenge,
  goals: Goal[]
): string {
  const saved = challenge.progress
  const yearlyEquivalent = Math.round(saved * (365 / challenge.duration))
  const goalPhrase = getGoalPhrase(goals)

  if (saved > 0) {
    return `You saved ${formatDollars(saved)} in ${challenge.duration} days — at that pace, you'd have ${formatDollars(yearlyEquivalent)} by year end. That's real momentum toward ${goalPhrase}.`
  }

  return `Challenge complete! Every dollar you set aside is a vote for your future self. The habit matters more than the amount.`
}

function getCustomInsight(challenge: Challenge): string {
  return `You set yourself a challenge and followed through — that's self-directed growth. The ability to commit and deliver on your own terms is a superpower.`
}
