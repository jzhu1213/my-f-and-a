"use client"
import { useState } from 'react'
import { ProgressRing } from '../ui/ProgressRing'
import { LessonCard } from './LessonCard'
import { CreditPayoffCalculator } from './CreditPayoffCalculator'
import { CompoundGrowthCalculator } from './CompoundGrowthCalculator'
import type { Lesson, UserLessonProgress } from '@/types'

// Sample lessons - in production these would come from the database
const SAMPLE_LESSONS: Lesson[] = [
  {
    id: '1',
    title: 'Credit Cards Explained',
    description: 'Learn how credit cards work and avoid common pitfalls',
    content: `Credit cards let you borrow money up to a limit for purchases. The key is paying your full balance each month to avoid interest charges, which can be 15-25% annually.

Your credit utilization (how much of your limit you use) affects your credit score. Keep it under 30% for the best results. For example, if you have a $1,000 limit, try not to carry more than $300.

As a college student, a credit card can help build your credit history for future apartment rentals and car loans. Start with a student card, set up autopay for the full balance, and treat it like a debit card.`,
    example: 'Sarah, a sophomore, got a $500 limit student card. She uses it only for groceries ($150/month) and pays it off weekly. Her credit score jumped 50 points in 6 months!',
    quizQuestions: [
      {
        id: '1a',
        question: "What happens if you only pay the minimum on your credit card?",
        options: ["Nothing bad", "You pay interest on the remaining balance", "Your card gets canceled", "You get bonus points"],
        correctIndex: 1,
      },
      {
        id: '1b',
        question: 'What credit utilization should you aim for?',
        options: ["Under 30%", "Exactly 50%", "Over 75%", "Use it all!"],
        correctIndex: 0,
      },
      {
        id: '1c',
        question: 'Why is building credit history important for students?',
        options: ["It isnt", "For future apartment rentals and loans", "To get free stuff", "For social media clout"],
        correctIndex: 1,
      },
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
      {
        id: '2a',
        question: 'What should an emergency fund cover?',
        options: ["Concert tickets", "Unexpected expenses like car repairs", "Vacation", "New clothes"],
        correctIndex: 1,
      },
      {
        id: '2b',
        question: 'Where should you keep your emergency fund?',
        options: ["Under your mattress", "Invested in stocks", "High-yield savings account", "Cryptocurrency"],
        correctIndex: 2,
      },
      {
        id: '2c',
        question: "What's a good starting goal for an emergency fund?",
        options: ["$50", "$500-$1,000", "$50,000", "$1 million"],
        correctIndex: 1,
      },
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
      {
        id: '3a',
        question: 'In the 50/30/20 rule, what does the 20% represent?',
        options: ["Entertainment", "Rent", "Savings", "Food"],
        correctIndex: 2,
      },
      {
        id: '3b',
        question: 'How many budget categories should you aim for?',
        options: ["As many as possible", "6 or fewer", "Exactly 10", "Just 1"],
        correctIndex: 1,
      },
      {
        id: '3c',
        question: "What's the first step to effective budgeting?",
        options: ["Buy budgeting software", "Track your current spending", "Cut all fun expenses", "Get a higher-paying job"],
        correctIndex: 1,
      },
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
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [showCalculator, setShowCalculator] = useState<'credit' | 'compound' | null>(null)
  
  const completedCount = lessonProgress.filter(p => p.completed).length
  const totalLessons = SAMPLE_LESSONS.length
  const progressPercent = Math.round((completedCount / totalLessons) * 100)
  
  const isLessonCompleted = (lessonId: string) => 
    lessonProgress.some(p => p.lessonId === lessonId && p.completed)
  
  // Show active lesson
  if (activeLesson) {
    return (
      <LessonCard 
        lesson={activeLesson}
        isCompleted={isLessonCompleted(activeLesson.id)}
        onComplete={(score) => {
          onCompleteLesson(activeLesson.id, score)
          setActiveLesson(null)
        }}
        onBack={() => setActiveLesson(null)}
      />
    )
  }
  
  // Show calculator
  if (showCalculator === 'credit') {
    return <CreditPayoffCalculator onBack={() => setShowCalculator(null)} />
  }
  
  if (showCalculator === 'compound') {
    return <CompoundGrowthCalculator onBack={() => setShowCalculator(null)} />
  }
  
  return (
    <div className="pb-32 px-4">
      {/* Header */}
      <div className="pt-8 pb-6">
        <h1 className="text-3xl font-heading font-bold mb-2">Learn Finance</h1>
        <p className="text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
          Bite-sized lessons to level up your money game
        </p>
      </div>
      
      {/* Hero Lesson Card */}
      {SAMPLE_LESSONS.filter(l => !isLessonCompleted(l.id))[0] && (
        <div className="stagger-1">
          <button
            onClick={() => setActiveLesson(SAMPLE_LESSONS.filter(l => !isLessonCompleted(l.id))[0])}
            className="w-full glass-card-solid p-6 text-left transition-all duration-200 hover:scale-102 mb-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-peach uppercase tracking-wide">
                  Up Next
                </span>
                <h2 className="text-xl font-heading font-bold mt-1 mb-2">
                  {SAMPLE_LESSONS.filter(l => !isLessonCompleted(l.id))[0].title}
                  <span className="inline-block w-full h-1 bg-peach rounded-full mt-1" style={{ maxWidth: '60%' }} />
                </h2>
                <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                  {SAMPLE_LESSONS.filter(l => !isLessonCompleted(l.id))[0].description}
                </p>
              </div>
              <svg className="w-6 h-6 text-peach flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}
      
      {/* All Lessons */}
      <div className="stagger-2 mb-8">
        <h3 className="text-sm font-semibold text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-3">
          All Lessons
        </h3>
        <div className="space-y-3">
          {SAMPLE_LESSONS.map((lesson) => {
            const completed = isLessonCompleted(lesson.id)
            return (
              <button
                key={lesson.id}
                onClick={() => setActiveLesson(lesson)}
                className={`w-full glass-card-solid p-4 flex items-center gap-4 text-left transition-all duration-200 hover:scale-101 ${
                  completed ? 'opacity-70' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  completed ? 'bg-sage' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {completed ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-bold">{lesson.order}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{lesson.title}</h4>
                  <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark truncate">
                    {lesson.description}
                  </p>
                </div>
                <svg className="w-5 h-5 text-folio-text-secondary-light dark:text-folio-text-secondary-dark flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Quick Tools */}
      <div className="stagger-3 mb-8">
        <h3 className="text-sm font-semibold text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-3">
          Quick Tools
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setShowCalculator('credit')}
            className="glass-card-solid p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-102 bg-peach/10 dark:bg-peach/20"
          >
            <span className="text-2xl">💳</span>
            <span className="font-medium text-sm">Credit Payoff</span>
            <span className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">Calculator</span>
          </button>
          <button 
            onClick={() => setShowCalculator('compound')}
            className="glass-card-solid p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-102 bg-sage/10 dark:bg-sage/20"
          >
            <span className="text-2xl">📈</span>
            <span className="font-medium text-sm">Compound Growth</span>
            <span className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">Calculator</span>
          </button>
        </div>
      </div>
      
      {/* Progress Ring */}
      <div className="stagger-4 flex flex-col items-center">
        <ProgressRing 
          progress={progressPercent} 
          size={100} 
          strokeWidth={10}
          color="sage"
        />
        <p className="mt-4 text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
          {completedCount}/{totalLessons} lessons complete
        </p>
      </div>
    </div>
  )
}
