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
  {
    id: 'micro-roth-ira-20s',
    title: 'Why a Roth IRA Matters in Your 20s',
    content: 'A Roth IRA grows your money tax-free for retirement, and your 20s are the perfect time to open one. Even $25 a month now has decades to grow — future you will be grateful.',
    emoji: '🌱',
    topic: 'saving',
    relatedLessonId: 'savings-accounts',
  },
  {
    id: 'micro-start-early',
    title: 'The Power of Starting Early',
    content: 'Compound growth means your earnings start earning too, so the earliest dollars grow the most. Starting even a few years sooner can add up to far more by retirement.',
    emoji: '📈',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
  {
    id: 'micro-hysa-vs-checking',
    title: 'HYSA vs. Checking — Free Money',
    content: 'A high-yield savings account can pay far more interest than a regular checking account on the same balance. Moving your savings over is basically free money for doing nothing.',
    emoji: '🏦',
    topic: 'saving',
    relatedLessonId: 'savings-accounts',
  },

  // ── Phase 18 Task 442: Key Educational Content Micro-Lessons ──────────

  // 442.1 — Budgeting Fundamentals
  {
    id: 'micro-50-30-20',
    title: 'The 50/30/20 Starting Point',
    content: '50% needs, 30% wants, 20% savings — not a strict rule, just a compass. Find the ratio that fits your life and adjust from there.',
    emoji: '📐',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'micro-zero-based',
    title: 'Zero-Based Budgeting',
    content: 'Give every dollar a job before it arrives. Income minus planned spending minus savings equals zero — not zero money, zero unplanned money.',
    emoji: '🎯',
    topic: 'budgeting',
    relatedLessonId: 'zero-based-budgeting',
  },
  {
    id: 'micro-envelope-method',
    title: 'The Envelope Method',
    content: 'Split spending into category limits. When food shows $30 left, you make different choices than when it\'s an invisible number. Visibility is power.',
    emoji: '✉️',
    topic: 'budgeting',
    relatedLessonId: 'envelope-method',
  },
  {
    id: 'micro-tracking-awareness',
    title: 'Tracking Changes Behavior',
    content: 'Research shows just tracking spending — no rules, no restrictions — reduces overspending by 10-15%. Awareness alone is a superpower.',
    emoji: '🔮',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // 442.2 — Saving and Compound Growth
  {
    id: 'micro-compound-growth',
    title: 'Compound Growth in Action',
    content: 'Your savings earn interest, and then that interest earns interest too. Start small, start now — time does the heavy lifting.',
    emoji: '📈',
    topic: 'saving',
    relatedLessonId: 'compound-growth',
  },
  {
    id: 'micro-opportunity-cost',
    title: 'Every Dollar Has Options',
    content: 'Every purchase means not doing something else with that money. Neither choice is wrong — just worth a quick "what else could this do for me?" check.',
    emoji: '⚖️',
    topic: 'saving',
    relatedLessonId: 'compound-growth',
  },
  {
    id: 'micro-emergency-sizing',
    title: 'Emergency Fund Size',
    content: 'Aim for 1-3 months of expenses as a first target. Even one month of buffer turns emergencies into inconveniences instead of crises.',
    emoji: '🛡️',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'micro-automate-savings',
    title: 'Set It and Forget It',
    content: 'Automatic transfers on payday have the highest savings success rate. You can\'t miss money you never see in your spending account.',
    emoji: '🤖',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },

  // 442.3 — Debt Awareness
  {
    id: 'micro-interest-compounds-against',
    title: 'Interest Works Against You',
    content: 'With debt, compound interest works in reverse — your balance generates interest, and that interest generates more interest. Even small extra payments fight back hard.',
    emoji: '⚡',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },
  {
    id: 'micro-minimum-payment-trap',
    title: 'The Minimum Payment Trap',
    content: 'Paying only minimums means most of your money goes to interest, barely touching the balance. $25 extra per month can cut payoff time in half.',
    emoji: '🪤',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },
  {
    id: 'micro-good-vs-bad-debt',
    title: 'Good Debt vs Bad Debt',
    content: 'Debt that builds your future (education, home) is different from debt that buys fleeting things. The interest rate and what it builds tell the story.',
    emoji: '🔀',
    topic: 'loans',
    relatedLessonId: 'debt-payoff-strategies',
  },
  {
    id: 'micro-debt-or-save',
    title: 'Debt vs Savings Priority',
    content: 'Keep a small emergency buffer ($500-1K), then throw extra at high-interest debt. Once that\'s gone, shift aggressively to savings. Balance beats extremes.',
    emoji: '⚖️',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },

  // 442.4 — Spending Psychology
  {
    id: 'micro-anchoring',
    title: 'The Anchoring Trap',
    content: 'A "sale" price feels great because you saw the higher price first. Ask: would you buy this at this price if there were no comparison?',
    emoji: '⚓',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'micro-lifestyle-inflation',
    title: 'Lifestyle Inflation',
    content: 'When your income rises, spending often rises to match — keeping savings flat. Noticing the creep is the first step to redirecting some of the growth.',
    emoji: '🎈',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'micro-impulse-check',
    title: 'The 10-Second Pause',
    content: 'Before a non-essential buy: "Do I want this thing, or do I want what this money could become?" Both answers are totally valid.',
    emoji: '⏸️',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'micro-small-choices-compound',
    title: 'Small Choices Compound',
    content: 'Spending $3 less per day frees up $90/month — not through deprivation, but by catching autopilot purchases and keeping the ones that bring real joy.',
    emoji: '🌊',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
]

/**
 * Looks up a micro-lesson by id. Returns undefined when no match is found.
 * Used by contextual triggers that surface a specific micro-lesson.
 */
export function getMicroLessonById(id: string): MicroLesson | undefined {
  return MICRO_LESSONS.find(m => m.id === id)
}

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
