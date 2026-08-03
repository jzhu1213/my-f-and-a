"use client"

import { useState } from 'react'
import { LessonCard } from './LessonCard'
import { CreditPayoffCalculator } from './CreditPayoffCalculator'
import { CompoundGrowthCalculator } from './CompoundGrowthCalculator'
import { CreditScoreCheckin } from './CreditScoreCheckin'
import { GlassCard } from '@/components/ui/GlassCard'
import { MicroLessonCard } from '@/components/simplified/MicroLessonCard'
import type { Lesson, UserLessonProgress } from '@/types'
import { LESSON_TOPICS } from '@/types'
import { LESSONS } from '@/lib/lessonsContent'
import { getUnreadMicroLessons, markMicroLessonRead } from '@/lib/microLessons'
import { FONT_FAMILY } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeading,
} from '@/styles/shared'
import type { SavingsAccount } from '@/types/folio'

// ============================================================================
// Props
// ============================================================================

interface LessonsScreenProps {
  lessonProgress: UserLessonProgress[]
  onCompleteLesson: (lessonId: string, score: number) => void
  /** When provided, auto-opens this lesson on mount (e.g. from a contextual tip link). */
  initialLessonId?: string
  /** Savings accounts for pre-filling the compound growth calculator. */
  savingsAccounts?: SavingsAccount[]
}

// ============================================================================
// LessonsScreen
// ============================================================================

export function LessonsScreen({ lessonProgress, onCompleteLesson, initialLessonId, savingsAccounts }: LessonsScreenProps) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(() => {
    if (initialLessonId) {
      return LESSONS.find(l => l.id === initialLessonId) ?? null
    }
    return null
  })
  const [showCalculator, setShowCalculator] = useState<'credit' | 'compound' | null>(null)
  const [showCreditScoreCheckin, setShowCreditScoreCheckin] = useState(false)
  const [readMicroIds, setReadMicroIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const stored = localStorage.getItem('folio-read-micro-lessons')
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    } catch { return new Set<string>() }
  })

  const completedCount = lessonProgress.filter(p => p.completed).length
  const totalLessons = LESSONS.length
  const isCompleted = (id: string) => lessonProgress.some(p => p.lessonId === id && p.completed)
  const nextLesson = LESSONS.find(l => !isCompleted(l.id))

  // Group lessons by topic
  const lessonsByTopic = LESSON_TOPICS.map(topicInfo => ({
    ...topicInfo,
    lessons: LESSONS.filter(l => l.topic === topicInfo.topic),
  })).filter(g => g.lessons.length > 0)

  // --------------------------------------------------------------------------
  // Sub-screen renders (lesson detail, calculators)
  // --------------------------------------------------------------------------

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

  if (showCalculator === 'credit') return <CreditPayoffCalculator onBack={() => setShowCalculator(null)} />
  if (showCalculator === 'compound') return <CompoundGrowthCalculator onBack={() => setShowCalculator(null)} savingsAccounts={savingsAccounts} />
  if (showCreditScoreCheckin) return <CreditScoreCheckin onBack={() => setShowCreditScoreCheckin(false)} />

  // --------------------------------------------------------------------------
  // Main lessons list
  // --------------------------------------------------------------------------

  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div
      style={{
        paddingBottom: DOCK_PADDING_BOTTOM,
        maxWidth: CONTENT_MAX_WIDTH,
        margin: '0 auto',
        padding: `48px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Progress Summary                                                    */}
      {/* ------------------------------------------------------------------ */}
      <GlassCard elevation="medium" glow={completedCount === totalLessons ? 'celebration' : 'none'}>
        <div style={{ padding: 24 }}>
          <p style={{ ...sectionHeading, marginBottom: 12 }}>Your progress</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 300, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
              {completedCount}
            </span>
            <span style={{ fontSize: 16, color: 'var(--muted)', fontFamily: FONT_FAMILY }}>
              / {totalLessons} lessons
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6,
            borderRadius: 99,
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              borderRadius: 99,
              background: 'var(--success)',
              transition: 'width 0.4s ease',
            }} />
          </div>

          <p style={{ fontSize: 13, color: 'var(--sub)', fontFamily: FONT_FAMILY }}>
            {completedCount === 0
              ? "Ready to start? Bite-sized lessons ahead."
              : completedCount === totalLessons
                ? "You've completed every lesson — nice work!"
                : "Keep going, you're building real knowledge."}
          </p>
        </div>
      </GlassCard>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Tips (micro-lessons)                                           */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const unreadMicro = getUnreadMicroLessons().filter(m => !readMicroIds.has(m.id)).slice(0, 3)
        if (unreadMicro.length === 0) return null
        return (
          <div style={{ marginTop: 24 }}>
            <p style={{ ...sectionHeading, marginBottom: 12 }}>Quick tips</p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 8,
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {unreadMicro.map(ml => (
                <div key={ml.id} style={{ scrollSnapAlign: 'start' }}>
                  <MicroLessonCard
                    lesson={ml}
                    onLearnMore={(lessonId) => {
                      const lesson = LESSONS.find(l => l.id === lessonId)
                      if (lesson) setActiveLesson(lesson)
                    }}
                    onDismiss={(id) => {
                      markMicroLessonRead(id)
                      setReadMicroIds(prev => new Set([...prev, id]))
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* Up Next                                                              */}
      {/* ------------------------------------------------------------------ */}
      {nextLesson && (
        <div style={{ marginTop: 28 }}>
          <p style={{ ...sectionHeading, marginBottom: 12 }}>Up next</p>
          <GlassCard elevation="high" glow="healthy">
            <button
              onClick={() => setActiveLesson(nextLesson)}
              style={{
                width: '100%',
                padding: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY, marginBottom: 4 }}>
                  {nextLesson.title}
                </p>
                <p style={{ fontSize: 13, color: 'var(--sub)', fontFamily: FONT_FAMILY }}>
                  {nextLesson.description}
                </p>
              </div>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--sub)', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </GlassCard>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Topic Groups                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: 32 }}>
        <p style={{ ...sectionHeading, marginBottom: 16 }}>Topics</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lessonsByTopic.map(group => (
            <GlassCard key={group.topic} elevation="low">
              <div style={{ padding: 16 }}>
                {/* Topic header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{group.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                    {group.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginLeft: 'auto' }}>
                    {group.lessons.filter(l => isCompleted(l.id)).length}/{group.lessons.length}
                  </span>
                </div>

                {/* Lesson rows */}
                {group.lessons.map(lesson => {
                  const done = isCompleted(lesson.id)
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLesson(lesson)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 4px',
                        background: 'none',
                        border: 'none',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* Status indicator */}
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 99,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: done ? 'rgba(6, 214, 160, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                        flexShrink: 0,
                      }}>
                        {done ? (
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--success)" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', fontFamily: FONT_FAMILY }}>
                            {lesson.order}
                          </span>
                        )}
                      </div>

                      {/* Title and description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: done ? 'var(--sub)' : 'var(--text)',
                          fontFamily: FONT_FAMILY,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {lesson.title}
                        </p>
                      </div>

                      {/* Chevron */}
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Calculators                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: 32 }}>
        <p style={{ ...sectionHeading, marginBottom: 12 }}>Calculators</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'credit' as const, label: 'Credit Payoff', sub: 'How fast can you clear debt?', emoji: '💳' },
            { key: 'compound' as const, label: 'Compound Growth', sub: 'Visualize your money growing', emoji: '📈' },
          ].map(tool => (
            <GlassCard key={tool.key} elevation="low">
              <button
                onClick={() => setShowCalculator(tool.key)}
                style={{
                  width: '100%',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20 }}>{tool.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                    {tool.label}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginTop: 2 }}>
                    {tool.sub}
                  </p>
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </GlassCard>
          ))}

          {/* Credit Score Check-In */}
          <GlassCard elevation="low">
            <button
              onClick={() => setShowCreditScoreCheckin(true)}
              style={{
                width: '100%',
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20 }}>📊</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                  Credit Score Check-In
                </p>
                <p style={{ fontSize: 12, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginTop: 2 }}>
                  Track your score over time
                </p>
              </div>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
