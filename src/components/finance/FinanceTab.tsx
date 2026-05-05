"use client"
import { useState } from 'react'
import { LessonCard } from './LessonCard'
import { CreditPayoffCalculator } from './CreditPayoffCalculator'
import { CompoundGrowthCalculator } from './CompoundGrowthCalculator'
import type { Lesson, UserLessonProgress } from '@/types'

const SAMPLE_LESSONS: Lesson[] = [
  {
    id: '1',
    title: 'Credit Cards Explained',
    description: 'How credit cards work and how to avoid common pitfalls',
    content: `Credit cards let you borrow money up to a limit for purchases. The key is paying your full balance each month to avoid interest charges, which can be 15-25% annually.

Your credit utilization (how much of your limit you use) affects your credit score. Keep it under 30% for the best results. For example, if you have a $1,000 limit, try not to carry more than $300.

As a college student, a credit card can help build your credit history for future apartment rentals and car loans. Start with a student card, set up autopay for the full balance, and treat it like a debit card.`,
    example: 'Sarah, a sophomore, got a $500 limit student card. She uses it only for groceries ($150/month) and pays it off weekly. Her credit score jumped 50 points in 6 months!',
    quizQuestions: [
      { id: '1a', question: "What happens if you only pay the minimum on your credit card?", options: ["Nothing bad", "You pay interest on the remaining balance", "Your card gets canceled", "You get bonus points"], correctIndex: 1 },
      { id: '1b', question: 'What credit utilization should you aim for?', options: ["Under 30%", "Exactly 50%", "Over 75%", "Use it all!"], correctIndex: 0 },
      { id: '1c', question: 'Why is building credit history important for students?', options: ["It isnt", "For future apartment rentals and loans", "To get free stuff", "For social media clout"], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 1,
  },
  {
    id: '2',
    title: 'Emergency Fund Basics',
    description: 'Why you need one and how to build it',
    content: `An emergency fund is money set aside for unexpected expenses like car repairs, medical bills, or job loss. Without one, these surprises can send you into debt.

Start small: aim for $500-$1,000 first, then work toward 3-6 months of expenses. Even $25/week adds up to $1,300 in a year. Keep it in a high-yield savings account for easy access.

The key is treating your emergency fund as untouchable for non-emergencies. New shoes aren't an emergency. A flat tire is. This mental separation is crucial.`,
    example: 'Marcus, a gig worker, saved $50 from each delivery paycheck. When his phone broke (essential for work!), he had $800 saved and avoided a payday loan.',
    quizQuestions: [
      { id: '2a', question: 'What should an emergency fund cover?', options: ["Concert tickets", "Unexpected expenses like car repairs", "Vacation", "New clothes"], correctIndex: 1 },
      { id: '2b', question: 'Where should you keep your emergency fund?', options: ["Under your mattress", "Invested in stocks", "High-yield savings account", "Cryptocurrency"], correctIndex: 2 },
      { id: '2c', question: "What's a good starting goal for an emergency fund?", options: ["$50", "$500-$1,000", "$50,000", "$1 million"], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=goals',
    order: 2,
  },
  {
    id: '3',
    title: 'Budgeting 101',
    description: 'Simple methods that actually stick',
    content: `Budgeting isn't about restriction—it's about knowing where your money goes so you can spend on what matters. The 50/30/20 rule is a great starting point: 50% needs, 30% wants, 20% savings.

Track your spending for one week first. Most people are shocked by how much goes to small purchases. That $5 coffee every day? That's $150/month or $1,800/year.

Use categories that make sense for YOUR life. A student might have: Rent, Food, Transport, School Supplies, Fun, and Savings. Keep it simple—6 categories max.`,
    example: 'Aisha tracked her spending and found she was spending $200/month on food delivery. She started meal prepping twice a week and redirected $100 to her savings goal.',
    quizQuestions: [
      { id: '3a', question: 'In the 50/30/20 rule, what does the 20% represent?', options: ["Entertainment", "Rent", "Savings", "Food"], correctIndex: 2 },
      { id: '3b', question: 'How many budget categories should you aim for?', options: ["As many as possible", "6 or fewer", "Exactly 10", "Just 1"], correctIndex: 1 },
      { id: '3c', question: "What's the first step to effective budgeting?", options: ["Buy budgeting software", "Track your current spending", "Cut all fun expenses", "Get a higher-paying job"], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 3,
  },
]

interface FinanceTabProps {
  lessonProgress: UserLessonProgress[]
  onCompleteLesson: (lessonId: string, score: number) => void
}

export function FinanceTab({ lessonProgress, onCompleteLesson }: FinanceTabProps) {
  const [activeLesson,   setActiveLesson]   = useState<Lesson | null>(null)
  const [showCalculator, setShowCalculator] = useState<'credit' | 'compound' | null>(null)

  const completedCount  = lessonProgress.filter(p => p.completed).length
  const totalLessons    = SAMPLE_LESSONS.length
  const isCompleted     = (id: string) => lessonProgress.some(p => p.lessonId === id && p.completed)
  const nextLesson      = SAMPLE_LESSONS.find(l => !isCompleted(l.id))

  if (activeLesson) {
    return (
      <LessonCard
        lesson={activeLesson}
        isCompleted={isCompleted(activeLesson.id)}
        onComplete={score => { onCompleteLesson(activeLesson.id, score); setActiveLesson(null) }}
        onBack={() => setActiveLesson(null)}
      />
    )
  }
  if (showCalculator === 'credit')   return <CreditPayoffCalculator  onBack={() => setShowCalculator(null)} />
  if (showCalculator === 'compound') return <CompoundGrowthCalculator onBack={() => setShowCalculator(null)} />

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-12 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="label mb-8">learn</p>
        <div className="flex items-end justify-between">
          <div>
            <h1 style={{ fontSize: '36px', fontFamily: 'Space Mono, monospace', fontWeight: 300, color: 'var(--text)', lineHeight: 1 }}>
              Finance
            </h1>
            <p style={{ marginTop: '10px', fontSize: '14px', color: 'var(--sub)' }}>bite-sized financial literacy</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '28px', color: 'var(--text)', lineHeight: 1 }}>
              {completedCount}<span style={{ color: 'var(--muted)' }}>/{totalLessons}</span>
            </p>
            <p className="label mt-1">completed</p>
          </div>
        </div>
      </div>

      <div className="px-6">
        {/* Up next */}
        {nextLesson && (
          <div className="pt-7 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="label mb-5">Up Next</p>
            <button
              onClick={() => setActiveLesson(nextLesson)}
              className="w-full flex items-center justify-between gap-4 py-5 transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex-1 text-left">
                <p style={{ fontSize: '15px', color: 'var(--text)' }}>{nextLesson.title}</p>
                <p style={{ fontSize: '13px', color: 'var(--sub)', marginTop: '4px' }}>{nextLesson.description}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* All lessons */}
        <div className="pt-7 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="label mb-5">All Lessons</p>
          {SAMPLE_LESSONS.map(lesson => {
            const done = isCompleted(lesson.id)
            return (
              <button
                key={lesson.id}
                onClick={() => setActiveLesson(lesson)}
                className="w-full flex items-center gap-4 py-5 text-left transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Number / check */}
                <div
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid',
                    borderColor: done ? 'var(--green)' : 'var(--border)',
                    borderRadius: '4px',
                  }}
                >
                  <span style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '12px',
                    color: done ? 'var(--green)' : 'var(--muted)',
                  }}>
                    {done ? '✓' : lesson.order}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '15px', color: done ? 'var(--sub)' : 'var(--text)' }} className="truncate">
                    {lesson.title}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }} className="truncate">
                    {lesson.description}
                  </p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>

        {/* Calculators */}
        <div className="pt-7">
          <p className="label mb-5">Calculators</p>
          {[
            { key: 'credit'   as const, label: 'Credit Payoff',   sub: 'How fast can you clear debt?' },
            { key: 'compound' as const, label: 'Compound Growth', sub: 'Visualize your money growing' },
          ].map(tool => (
            <button
              key={tool.key}
              onClick={() => setShowCalculator(tool.key)}
              className="w-full flex items-center gap-4 py-5 text-left transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex-1">
                <p style={{ fontSize: '15px', color: 'var(--text)' }}>{tool.label}</p>
                <p style={{ fontSize: '13px', color: 'var(--sub)', marginTop: '3px' }}>{tool.sub}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
