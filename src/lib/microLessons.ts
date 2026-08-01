import type { LessonTopic } from '@/types'

// ============================================================================
// Micro-Lessons — bite-sized 30-second financial tips
// ============================================================================

/**
 * A micro-lesson is a compact, contextual financial tip that can be shown
 * without requiring the full LessonsScreen. Each takes ~30 seconds to read.
 */
export interface MicroLesson {
  id: string
  title: string
  /** 1-2 sentences max — warm, non-judgmental, actionable. */
  content: string
  emoji: string
  topic: LessonTopic
  /** Points to the full lesson for "Learn more" follow-up. */
  relatedLessonId: string
}

/**
 * Collection of micro-lessons covering common student financial situations.
 * Tone: warm, encouraging, practical. Never shaming.
 */
export const MICRO_LESSONS: MicroLesson[] = [
  {
    id: 'micro-latte-effect',
    title: 'The Latte Effect',
    content: 'Small daily purchases add up fast — $5/day is $150/month. Noticing the pattern is the first step, not cutting the joy.',
    emoji: '☕',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'micro-pay-yourself-first',
    title: 'Pay Yourself First',
    content: 'Move a small amount to savings the moment money arrives — before spending. Even $10 matters when it becomes a habit.',
    emoji: '💰',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'micro-24-hour-rule',
    title: 'The 24-Hour Rule',
    content: 'Before a non-essential purchase over $30, wait 24 hours. Most impulse urges fade — and the ones that don\'t are worth it.',
    emoji: '⏰',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'micro-credit-not-free',
    title: 'Credit ≠ Free Money',
    content: 'Credit lets you borrow, not earn. If you can\'t pay the full balance this month, it costs you 15-25% more over time.',
    emoji: '💳',
    topic: 'credit',
    relatedLessonId: 'credit-cards',
  },
  {
    id: 'micro-emergency-starter',
    title: 'Emergency Fund Starter',
    content: 'Even $25/week builds a $1,300 cushion in a year. A small buffer means surprises stay surprises instead of becoming debt.',
    emoji: '🛟',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'micro-subscription-creep',
    title: 'Subscription Creep',
    content: 'Review your recurring charges once a month. That free trial you forgot about? It\'s been quietly charging you.',
    emoji: '🔄',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'micro-payday-strategy',
    title: 'Payday Strategy',
    content: 'On payday, allocate first: savings, bills, then spending. Deciding before you have the urge makes it automatic.',
    emoji: '📅',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'micro-round-up-saving',
    title: 'Round-Up Saving',
    content: 'Rounding purchases up to the next dollar and stashing the difference adds up without feeling like sacrifice.',
    emoji: '🪙',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'micro-credit-utilization',
    title: 'Keep It Under 30%',
    content: 'Using less than 30% of your credit limit signals responsible borrowing and helps your score climb steadily.',
    emoji: '📊',
    topic: 'credit',
    relatedLessonId: 'credit-cards',
  },
  {
    id: 'micro-credit-autopay',
    title: 'Autopay Is Your Safety Net',
    content: 'Set up autopay for at least the minimum payment. One missed payment can follow your credit report for years — autopay makes it worry-free.',
    emoji: '🔒',
    topic: 'credit',
    relatedLessonId: 'common-credit-mistakes',
  },
  {
    id: 'micro-credit-score-check',
    title: 'Checking Won\'t Hurt',
    content: 'Checking your own credit score is a soft inquiry — it never lowers your score. Most bank apps show it free. Check monthly to spot surprises early.',
    emoji: '🔍',
    topic: 'credit',
    relatedLessonId: 'credit-score-monitoring',
  },
  {
    id: 'micro-compound-time',
    title: 'Time Is the Secret',
    content: 'Starting to invest even $20/month at 20 beats starting $200/month at 35. Time does the heavy lifting.',
    emoji: '⏳',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
]

// ============================================================================
// Read/unread tracking (localStorage)
// ============================================================================

const READ_MICRO_LESSONS_KEY = 'folio-read-micro-lessons'

/**
 * Returns the set of micro-lesson IDs the user has already read.
 */
export function getReadMicroLessons(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(READ_MICRO_LESSONS_KEY)
    return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
  } catch {
    return new Set()
  }
}

/**
 * Marks a micro-lesson as read (persisted to localStorage).
 */
export function markMicroLessonRead(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const read = getReadMicroLessons()
    read.add(id)
    localStorage.setItem(READ_MICRO_LESSONS_KEY, JSON.stringify([...read]))
  } catch {
    // best-effort
  }
}

/**
 * Returns unread micro-lessons (in original order).
 */
export function getUnreadMicroLessons(): MicroLesson[] {
  const read = getReadMicroLessons()
  return MICRO_LESSONS.filter(m => !read.has(m.id))
}
