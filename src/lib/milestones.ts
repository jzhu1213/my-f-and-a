/**
 * Milestone Engine — Cumulative, permanent milestones tracking personal growth.
 *
 * Pure computational module: no React, no components. Designed to be called
 * from hooks/components.
 *
 * Milestone rules:
 * - Once earned, never lost (permanent)
 * - Categories: Tracking, Awareness, Consistency, Saving, Streaks, Challenges
 * - Each milestone triggers a celebration via celebrationEngine
 * - Progress toward next milestone is always visible
 *
 * Requirements: 25.4
 */

import type { Transaction, Goal } from '@/types'
import type { CelebrationEvent } from '@/types/folio'
import { hasBeenTriggered, markTriggered } from '@/lib/celebrationDedup'
import { getStreakData } from '@/lib/streaks'
import { getChallengeData, getCompletedChallenges } from '@/lib/challenges'

// ============================================================================
// Types
// ============================================================================

export type MilestoneCategory =
  | 'tracking'
  | 'awareness'
  | 'consistency'
  | 'saving'
  | 'streaks'
  | 'challenges'

export interface MilestoneDefinition {
  /** Unique identifier */
  id: string
  /** Display title */
  title: string
  /** Short description */
  description: string
  /** Which category this milestone belongs to */
  category: MilestoneCategory
  /** Numeric threshold to earn this milestone */
  threshold: number
  /** Emoji for celebrations and display */
  emoji: string
  /** Celebration message when earned */
  celebrationMessage: string
}

export interface EarnedMilestone {
  /** The milestone definition id */
  milestoneId: string
  /** ISO date string (YYYY-MM-DD) when earned */
  dateEarned: string
}

export interface MilestoneData {
  /** All milestones that have been earned */
  earned: EarnedMilestone[]
}

export interface MilestoneProgress {
  /** The milestone definition */
  definition: MilestoneDefinition
  /** Whether this milestone has been earned */
  isEarned: boolean
  /** Date earned (if earned) */
  dateEarned: string | null
  /** Current progress value toward threshold */
  currentValue: number
  /** Progress as a fraction 0–1 */
  progressFraction: number
}

// ============================================================================
// Milestone Definitions
// ============================================================================

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  // ── Tracking: transactions logged ──────────────────────────────────────
  { id: 'tracking-10', title: 'First Steps', description: '10 transactions logged', category: 'tracking', threshold: 10, emoji: '📝', celebrationMessage: 'You logged your first 10 transactions \u2014 the habit is forming!' },
  { id: 'tracking-50', title: 'Getting the Hang of It', description: '50 transactions logged', category: 'tracking', threshold: 50, emoji: '📊', celebrationMessage: '50 transactions tracked! You really know your spending now.' },
  { id: 'tracking-100', title: 'Century Club', description: '100 transactions logged', category: 'tracking', threshold: 100, emoji: '💯', celebrationMessage: "100 transactions \u2014 you've built a real picture of your finances!" },
  { id: 'tracking-500', title: 'Dedicated Tracker', description: '500 transactions logged', category: 'tracking', threshold: 500, emoji: '🏅', celebrationMessage: "500 transactions! That's some serious dedication." },
  { id: 'tracking-1000', title: 'Tracking Legend', description: '1,000 transactions logged', category: 'tracking', threshold: 1000, emoji: '🏆', celebrationMessage: "1,000 transactions \u2014 you're a tracking legend!" },

  // ── Awareness: total spending tracked ──────────────────────────────────
  { id: 'awareness-1k', title: 'Money Aware', description: '$1K total spending tracked', category: 'awareness', threshold: 1000, emoji: '👀', celebrationMessage: "You've tracked $1K in spending \u2014 awareness is the first step!" },
  { id: 'awareness-5k', title: 'Budget Conscious', description: '$5K total spending tracked', category: 'awareness', threshold: 5000, emoji: '📈', celebrationMessage: '$5K tracked! You have real clarity on where your money goes.' },
  { id: 'awareness-10k', title: 'Finance Navigator', description: '$10K total spending tracked', category: 'awareness', threshold: 10000, emoji: '🧭', celebrationMessage: "$10K tracked \u2014 you're navigating your finances like a pro." },
  { id: 'awareness-50k', title: 'Master of Awareness', description: '$50K total spending tracked', category: 'awareness', threshold: 50000, emoji: '🌟', celebrationMessage: '$50K tracked! You have incredible insight into your money.' },

  // ── Consistency: consecutive months of use ─────────────────────────────
  { id: 'consistency-1', title: 'First Month', description: '1 consecutive month of use', category: 'consistency', threshold: 1, emoji: '📅', celebrationMessage: "One month in \u2014 you're building a great habit!" },
  { id: 'consistency-3', title: 'Quarter Strong', description: '3 consecutive months of use', category: 'consistency', threshold: 3, emoji: '💪', celebrationMessage: '3 months straight! This is becoming second nature.' },
  { id: 'consistency-6', title: 'Half-Year Hero', description: '6 consecutive months of use', category: 'consistency', threshold: 6, emoji: '⭐', celebrationMessage: "6 months of consistent use \u2014 that's genuinely impressive!" },
  { id: 'consistency-12', title: 'Year-Round Champion', description: '12 consecutive months of use', category: 'consistency', threshold: 12, emoji: '🎖️', celebrationMessage: "A full year! You've made financial awareness a way of life." },

  // ── Saving: goals completed ────────────────────────────────────────────
  { id: 'saving-1', title: 'First Goal Met', description: 'First savings goal completed', category: 'saving', threshold: 1, emoji: '🎯', celebrationMessage: "You met your first savings goal \u2014 that's huge!" },
  { id: 'saving-3', title: 'Goal Getter', description: '3 goals completed', category: 'saving', threshold: 3, emoji: '🌱', celebrationMessage: "3 goals done! You're building real momentum." },
  { id: 'saving-5', title: 'Savings Star', description: '5 goals completed', category: 'saving', threshold: 5, emoji: '✨', celebrationMessage: '5 goals completed \u2014 you clearly know how to follow through!' },

  // ── Streaks: day streaks achieved ──────────────────────────────────────
  { id: 'streaks-7', title: 'Week Warrior', description: '7-day streak achieved', category: 'streaks', threshold: 7, emoji: '🔥', celebrationMessage: 'A full week streak! Keep that momentum going.' },
  { id: 'streaks-30', title: 'Month Master', description: '30-day streak achieved', category: 'streaks', threshold: 30, emoji: '🔥', celebrationMessage: "30-day streak! That's a whole month of consistency." },
  { id: 'streaks-60', title: 'Two-Month Titan', description: '60-day streak achieved', category: 'streaks', threshold: 60, emoji: '💫', celebrationMessage: '60-day streak \u2014 two months straight!' },
  { id: 'streaks-100', title: 'Streak Legend', description: '100-day streak achieved', category: 'streaks', threshold: 100, emoji: '🌈', celebrationMessage: '100-day streak! You are absolutely unstoppable.' },

  // ── Challenges: challenges completed ───────────────────────────────────
  { id: 'challenges-5', title: 'Challenge Starter', description: '5 challenges completed', category: 'challenges', threshold: 5, emoji: '⚡', celebrationMessage: '5 challenges done! You love pushing yourself.' },
  { id: 'challenges-10', title: 'Challenge Pro', description: '10 challenges completed', category: 'challenges', threshold: 10, emoji: '🏆', celebrationMessage: "10 challenges completed \u2014 you're a challenge pro!" },
  { id: 'challenges-25', title: 'Challenge Champion', description: '25 challenges completed', category: 'challenges', threshold: 25, emoji: '👑', celebrationMessage: '25 challenges! Nobody can stop you.' },
]

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio_milestone_data'

// ============================================================================
// localStorage Persistence
// ============================================================================

/**
 * Reads persisted milestone data from localStorage.
 * Returns null if no data exists or parsing fails.
 */
export function getMilestoneData(): MilestoneData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MilestoneData
  } catch {
    return null
  }
}

/**
 * Persists milestone data to localStorage.
 */
export function saveMilestoneData(data: MilestoneData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Best-effort persistence — localStorage may be full or unavailable
  }
}

// ============================================================================
// Progress Computation
// ============================================================================

/**
 * Computes the current value for a milestone category based on live data.
 */
export function computeCategoryValue(
  category: MilestoneCategory,
  transactions: Transaction[],
  goals: Goal[]
): number {
  switch (category) {
    case 'tracking':
      return transactions.length

    case 'awareness': {
      return transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
    }

    case 'consistency': {
      // Count consecutive months with at least 1 transaction, going backward from current month
      if (transactions.length === 0) return 0
      const now = new Date()
      let consecutiveMonths = 0
      for (let i = 0; i < 24; i++) {
        const year = now.getFullYear()
        const month = now.getMonth() - i
        const checkDate = new Date(year, month, 1)
        const yearStr = checkDate.getFullYear().toString()
        const monthStr = (checkDate.getMonth() + 1).toString().padStart(2, '0')
        const prefix = `${yearStr}-${monthStr}`
        const hasActivity = transactions.some((t) => t.date.startsWith(prefix))
        if (hasActivity) {
          consecutiveMonths++
        } else {
          break
        }
      }
      return consecutiveMonths
    }

    case 'saving': {
      return goals.filter((g) => g.currentAmount >= g.targetAmount).length
    }

    case 'streaks': {
      const streakData = getStreakData()
      return streakData?.longestStreak ?? 0
    }

    case 'challenges': {
      const challengeData = getChallengeData()
      if (!challengeData) return 0
      return getCompletedChallenges(challengeData).length
    }

    default:
      return 0
  }
}

/**
 * Computes progress for all milestones given current data.
 */
export function computeAllMilestoneProgress(
  transactions: Transaction[],
  goals: Goal[]
): MilestoneProgress[] {
  const data = getMilestoneData() ?? { earned: [] }
  const earnedMap = new Map(data.earned.map((e) => [e.milestoneId, e.dateEarned]))

  // Compute current values per category (cache to avoid redundant computation)
  const categoryValues = new Map<MilestoneCategory, number>()
  const categories: MilestoneCategory[] = ['tracking', 'awareness', 'consistency', 'saving', 'streaks', 'challenges']
  for (const cat of categories) {
    categoryValues.set(cat, computeCategoryValue(cat, transactions, goals))
  }

  return MILESTONE_DEFINITIONS.map((def) => {
    const dateEarned = earnedMap.get(def.id) ?? null
    const currentValue = categoryValues.get(def.category) ?? 0
    const progressFraction = Math.min(1, currentValue / def.threshold)

    return {
      definition: def,
      isEarned: dateEarned !== null,
      dateEarned,
      currentValue,
      progressFraction,
    }
  })
}

// ============================================================================
// Milestone Check & Award
// ============================================================================

/**
 * Checks all milestones and awards any newly earned ones.
 * Returns celebration events for any newly earned milestones.
 */
export function checkAndAwardMilestones(
  transactions: Transaction[],
  goals: Goal[]
): CelebrationEvent[] {
  const data = getMilestoneData() ?? { earned: [] }
  const earnedIds = new Set(data.earned.map((e) => e.milestoneId))
  const today = new Date().toISOString().slice(0, 10)
  const newEvents: CelebrationEvent[] = []

  // Compute current values per category
  const categories: MilestoneCategory[] = ['tracking', 'awareness', 'consistency', 'saving', 'streaks', 'challenges']
  const categoryValues = new Map<MilestoneCategory, number>()
  for (const cat of categories) {
    categoryValues.set(cat, computeCategoryValue(cat, transactions, goals))
  }

  for (const def of MILESTONE_DEFINITIONS) {
    // Already earned — skip
    if (earnedIds.has(def.id)) continue

    const currentValue = categoryValues.get(def.category) ?? 0
    if (currentValue >= def.threshold) {
      // Earn it!
      data.earned.push({ milestoneId: def.id, dateEarned: today })
      earnedIds.add(def.id)

      // Only celebrate if not already triggered (dedup)
      const celebrationId = `milestone_${def.id}`
      if (!hasBeenTriggered(celebrationId)) {
        markTriggered(celebrationId)
        newEvents.push({
          id: celebrationId,
          type: 'milestone_earned',
          title: `${def.emoji} ${def.title}`,
          message: def.celebrationMessage,
          emoji: def.emoji,
          animation: 'sparkle',
          duration: 4000,
          sound: 'cheerful',
        })
      }
    }
  }

  // Persist if anything changed
  if (newEvents.length > 0) {
    saveMilestoneData(data)
  }

  return newEvents
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns a human-friendly category label.
 */
export function getCategoryLabel(category: MilestoneCategory): string {
  switch (category) {
    case 'tracking': return 'Tracking'
    case 'awareness': return 'Awareness'
    case 'consistency': return 'Consistency'
    case 'saving': return 'Saving'
    case 'streaks': return 'Streaks'
    case 'challenges': return 'Challenges'
    default: return category
  }
}

/**
 * Returns milestones grouped by category, ordered by threshold.
 */
export function getMilestonesByCategory(): Map<MilestoneCategory, MilestoneDefinition[]> {
  const grouped = new Map<MilestoneCategory, MilestoneDefinition[]>()
  for (const def of MILESTONE_DEFINITIONS) {
    const existing = grouped.get(def.category) ?? []
    existing.push(def)
    grouped.set(def.category, existing)
  }
  return grouped
}
