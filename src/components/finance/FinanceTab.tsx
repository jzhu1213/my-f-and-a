"use client"
import { useState } from 'react'
import { LessonCard } from './LessonCard'
import { CreditPayoffCalculator } from './CreditPayoffCalculator'
import { CompoundGrowthCalculator } from './CompoundGrowthCalculator'
import type { Lesson, UserLessonProgress } from '@/types'
import { LESSONS } from '@/lib/lessonsContent'
import { FONT_FAMILY } from '@/styles/typography'

const SAMPLE_LESSONS: Lesson[] = LESSONS

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
            <h1 style={{ fontSize: '36px', fontFamily: FONT_FAMILY, fontWeight: 300, color: 'var(--text)', lineHeight: 1 }}>
              Finance
            </h1>
            <p style={{ marginTop: '10px', fontSize: '14px', color: 'var(--sub)' }}>bite-sized financial literacy</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: '28px', color: 'var(--text)', lineHeight: 1 }}>
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
                    borderRadius: '8px',
                  }}
                >
                  <span style={{
                    fontFamily: FONT_FAMILY,
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
