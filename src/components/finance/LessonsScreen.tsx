"use client"

/**
 * LessonsScreen — A visual learning path organized by topic.
 *
 * Redesigned from a flat card list to a progress path. Lessons are "unlocked"
 * when their trigger fires naturally (the user encounters them in context).
 * Users can revisit any previously-triggered lesson with fresh data.
 *
 * Topics follow the journey: Budgeting → Saving → Credit → Investing → Stocks → Loans
 *
 * Requirements: 26.5
 */

import { useState, useMemo } from 'react'
import { LessonCard } from './LessonCard'
import { CreditPayoffCalculator } from './CreditPayoffCalculator'
import { CompoundGrowthCalculator } from './CompoundGrowthCalculator'
import { CreditScoreCheckin } from './CreditScoreCheckin'
import { GlassCard } from '@/components/ui/GlassCard'
import type { Lesson, UserLessonProgress, LessonTopic } from '@/types'
import { LESSON_TOPICS } from '@/types'
import { LESSONS } from '@/lib/lessonsContent'
import {
  CONTEXTUAL_LESSONS,
  TRIGGER_DEFINITIONS,
  getLessonsByTopic,
} from '@/lib/contextualLessonContent'
import type { ContextualLesson } from '@/lib/contextualLessonContent'
import { getTriggerHistory } from '@/lib/lessonTriggerEngine'
import type { TriggerHistoryEntry } from '@/lib/lessonTriggerEngine'
import { renderLesson, buildLessonTemplateData } from '@/lib/lessonTemplateRenderer'
import type { BuildTemplateDataParams } from '@/lib/lessonTemplateRenderer'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  fills,
  colorRamp,
  glassSurface,
  borderRadius,
} from '@/styles/shared'
import { radius } from '@/styles/surfaces'
import type { SavingsAccount } from '@/types/folio'
import type { Transaction, Budget, Goal } from '@/types'
import type { Debt } from '@/types/folio'

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
  /** User transactions for template rendering with current data */
  transactions?: Transaction[]
  /** User budgets for template rendering */
  budgets?: Budget[]
  /** User goals for template rendering */
  goals?: Goal[]
  /** User debts for template rendering */
  debts?: Debt[]
  /** Daily budget for template rendering */
  dailyBudget?: number
}

// ============================================================================
// Types
// ============================================================================

interface TopicProgress {
  topic: LessonTopic
  emoji: string
  label: string
  lessons: ContextualLesson[]
  unlockedCount: number
  totalCount: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns the set of lesson IDs that have been "unlocked" — i.e., their trigger
 * has fired and the user has seen them in context.
 */
function getUnlockedLessonIds(triggerHistory: TriggerHistoryEntry[]): Set<string> {
  const unlockedIds = new Set<string>()
  for (const entry of triggerHistory) {
    // Find the trigger definition to get the lesson ID
    const triggerDef = TRIGGER_DEFINITIONS.find(t => t.id === entry.triggerId)
    if (triggerDef) {
      unlockedIds.add(triggerDef.lessonId)
    }
  }
  return unlockedIds
}

// ============================================================================
// LessonsScreen
// ============================================================================

export function LessonsScreen({
  lessonProgress,
  onCompleteLesson,
  initialLessonId,
  savingsAccounts,
  transactions = [],
  budgets = [],
  goals = [],
  debts = [],
  dailyBudget = 0,
}: LessonsScreenProps) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(() => {
    if (initialLessonId) {
      return LESSONS.find(l => l.id === initialLessonId) ?? null
    }
    return null
  })
  const [activeContextualLesson, setActiveContextualLesson] = useState<ContextualLesson | null>(null)
  const [showCalculator, setShowCalculator] = useState<'credit' | 'compound' | null>(null)
  const [showCreditScoreCheckin, setShowCreditScoreCheckin] = useState(false)

  const isCompleted = (id: string) => lessonProgress.some(p => p.lessonId === id && p.completed)

  // Build trigger history and unlocked lesson set
  const triggerHistory = useMemo(() => getTriggerHistory(), [])
  const unlockedLessonIds = useMemo(() => getUnlockedLessonIds(triggerHistory), [triggerHistory])

  // Build template data for rendering lessons with current user data
  const templateData = useMemo(() => {
    const params: BuildTemplateDataParams = {
      transactions,
      budgets,
      goals,
      debts,
      savingsAccounts,
      dailyBudget,
    }
    return buildLessonTemplateData(params)
  }, [transactions, budgets, goals, debts, savingsAccounts, dailyBudget])

  // Build topic progress data
  const topicProgress: TopicProgress[] = useMemo(() => {
    return LESSON_TOPICS.map(topicInfo => {
      const lessons = getLessonsByTopic(topicInfo.topic)
      const unlockedCount = lessons.filter(l => unlockedLessonIds.has(l.id)).length
      return {
        topic: topicInfo.topic,
        emoji: topicInfo.emoji,
        label: topicInfo.label,
        lessons,
        unlockedCount,
        totalCount: lessons.length,
      }
    }).filter(g => g.totalCount > 0)
  }, [unlockedLessonIds])

  // Overall progress
  const totalLessons = CONTEXTUAL_LESSONS.length
  const totalUnlocked = unlockedLessonIds.size
  const mostRecentEntry = triggerHistory.length > 0
    ? triggerHistory[triggerHistory.length - 1]
    : null
  const mostRecentLesson = mostRecentEntry
    ? CONTEXTUAL_LESSONS.find(l => {
        const trigDef = TRIGGER_DEFINITIONS.find(t => t.id === mostRecentEntry.triggerId)
        return trigDef && l.id === trigDef.lessonId
      })
    : null

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

  if (activeContextualLesson) {
    // Render the contextual lesson with fresh data in a simple detail view
    const rendered = renderLesson(activeContextualLesson, templateData)
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
        <button
          onClick={() => setActiveContextualLesson(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
            fontSize: typography.body.fontSize,
            marginBottom: HORIZONTAL_PADDING,
            padding: 0,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to learning path
        </button>

        <GlassCard elevation="high">
          <div style={{ padding: spacing.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>{rendered.emoji}</span>
              <h2 style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.semibold, color: 'var(--text)', fontFamily: FONT_FAMILY, margin: 0 }}>
                {rendered.title}
              </h2>
            </div>

            <p style={{ fontSize: typography.body.fontSize, color: 'var(--text)', fontFamily: FONT_FAMILY, lineHeight: 1.6, marginBottom: spacing.md }}>
              {rendered.microContent}
            </p>

            {rendered.deepDiveContent && (
              <div style={{ marginTop: spacing.md, paddingTop: 16, borderTop: '1px solid var(--fill-08)' }}>
                <p style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.medium, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Deep dive
                </p>
                <p style={{ fontSize: typography.body.fontSize, color: 'var(--sub)', fontFamily: FONT_FAMILY, lineHeight: 1.7 }}>
                  {rendered.deepDiveContent}
                </p>
              </div>
            )}

            {rendered.relatedLessonId && (
              <button
                onClick={() => {
                  const related = LESSONS.find(l => l.id === rendered.relatedLessonId)
                  if (related) {
                    setActiveContextualLesson(null)
                    setActiveLesson(related)
                  }
                }}
                style={{
                  marginTop: HORIZONTAL_PADDING,
                  padding: '10px 16px',
                  background: fills[6],
                  border: `1px solid ${fills[10]}`,
                  borderRadius: borderRadius.sm,
                  color: 'var(--accent)',
                  fontFamily: FONT_FAMILY,
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  cursor: 'pointer',
                }}
              >
                Read the full lesson →
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    )
  }

  if (showCalculator === 'credit') return <CreditPayoffCalculator onBack={() => setShowCalculator(null)} />
  if (showCalculator === 'compound') return <CompoundGrowthCalculator onBack={() => setShowCalculator(null)} savingsAccounts={savingsAccounts} />
  if (showCreditScoreCheckin) return <CreditScoreCheckin onBack={() => setShowCreditScoreCheckin(false)} />

  // --------------------------------------------------------------------------
  // Main learning path
  // --------------------------------------------------------------------------

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
      {/* Journey Header                                                       */}
      {/* ------------------------------------------------------------------ */}
      <GlassCard elevation="medium" glow={totalUnlocked === totalLessons ? 'celebration' : 'none'}>
        <div style={{ padding: spacing.lg }}>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your journey so far
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.xs, marginBottom: 12 }}>
            <span style={{ fontSize: 36, fontWeight: fontWeights.light, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
              {totalUnlocked}
            </span>
            <span style={{ fontSize: typography.body.fontSize, color: 'var(--muted)', fontFamily: FONT_FAMILY }}>
              / {totalLessons} lessons discovered
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6,
            borderRadius: radius.full,
            background: 'var(--fill-08)',
            overflow: 'hidden',
            marginBottom: spacing.sm,
          }}>
            <div style={{
              height: '100%',
              width: `${totalLessons > 0 ? Math.round((totalUnlocked / totalLessons) * 100) : 0}%`,
              borderRadius: radius.full,
              background: 'var(--success)',
              transition: 'width 0.4s ease',
            }} />
          </div>

          <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', fontFamily: FONT_FAMILY }}>
            {totalUnlocked === 0
              ? "Lessons unlock as you use the app — they find you at the right moment."
              : totalUnlocked === totalLessons
                ? "You've discovered every lesson — impressive!"
                : "Keep using the app and new lessons will unlock naturally."}
          </p>
        </div>
      </GlassCard>

      {/* ------------------------------------------------------------------ */}
      {/* Most Recent Lesson                                                   */}
      {/* ------------------------------------------------------------------ */}
      {mostRecentLesson && (
        <div style={{ marginTop: spacing.lg }}>
          <p style={{ ...sectionHeader, marginBottom: spacing.sm }}>Recently learned</p>
          <GlassCard elevation="high" glow="healthy">
            <button
              onClick={() => setActiveContextualLesson(mostRecentLesson)}
              style={{
                width: '100%',
                padding: HORIZONTAL_PADDING,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: typography.headline.fontSize, flexShrink: 0 }}>{mostRecentLesson.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY, marginBottom: 4 }}>
                  {mostRecentLesson.title}
                </p>
                <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', fontFamily: FONT_FAMILY, lineHeight: 1.4 }}>
                  {mostRecentLesson.microContent.slice(0, 80)}…
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
      {/* Learning Path — Topics as a vertical timeline                        */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: spacing.xl }}>
        <p style={{ ...sectionHeader, marginBottom: HORIZONTAL_PADDING }}>Learning path</p>

        <div style={{ position: 'relative', paddingLeft: 28 }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: 10,
            top: 12,
            bottom: 12,
            width: 2,
            background: fills[8],
            borderRadius: 1,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: HORIZONTAL_PADDING }}>
            {topicProgress.map((group, idx) => {
              const progressPct = group.totalCount > 0
                ? Math.round((group.unlockedCount / group.totalCount) * 100)
                : 0
              const isComplete = group.unlockedCount === group.totalCount
              const hasProgress = group.unlockedCount > 0

              return (
                <div key={group.topic} style={{ position: 'relative' }}>
                  {/* Topic node circle */}
                  <div style={{
                    position: 'absolute',
                    left: -28,
                    top: 14,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isComplete
                      ? 'var(--success-200)'
                      : hasProgress
                        ? colorRamp.accent[100]
                        : fills[6],
                    border: isComplete
                      ? '2px solid var(--success)'
                      : hasProgress
                        ? `2px solid ${colorRamp.accent[500]}`
                        : `2px solid ${fills[10]}`,
                  }}>
                    {isComplete ? (
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="var(--success)" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: typography.caption.fontSize }}>{group.emoji}</span>
                    )}
                  </div>

                  {/* Topic card */}
                  <GlassCard elevation="low">
                    <div style={{ padding: spacing.md }}>
                      {/* Topic header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 10 }}>
                        <span style={{ fontSize: typography.subhead.fontSize }}>{group.emoji}</span>
                        <span style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                          {group.label}
                        </span>
                        <span style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginLeft: 'auto' }}>
                          {group.unlockedCount}/{group.totalCount}
                        </span>
                      </div>

                      {/* Topic progress bar */}
                      <div style={{
                        height: 4,
                        borderRadius: 2,
                        background: fills[8],
                        overflow: 'hidden',
                        marginBottom: spacing.sm,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${progressPct}%`,
                          borderRadius: 2,
                          background: isComplete ? 'var(--success)' : colorRamp.accent[500],
                          transition: 'width 0.4s ease',
                        }} />
                      </div>

                      {/* Lesson rows */}
                      {group.lessons.map(lesson => {
                        const isUnlocked = unlockedLessonIds.has(lesson.id)
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => {
                              if (isUnlocked) {
                                setActiveContextualLesson(lesson)
                              }
                            }}
                            disabled={!isUnlocked}
                            aria-label={isUnlocked ? `Revisit: ${lesson.title}` : `Locked: ${lesson.title}`}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              padding: '10px 4px',
                              background: 'none',
                              border: 'none',
                              borderTop: '1px solid var(--fill-06)',
                              cursor: isUnlocked ? 'pointer' : 'default',
                              textAlign: 'left',
                              opacity: isUnlocked ? 1 : 0.5,
                            }}
                          >
                            {/* Status indicator */}
                            <div style={{
                              width: 26,
                              height: 26,
                              borderRadius: radius.full,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isUnlocked
                                ? 'var(--success-200)'
                                : 'var(--fill-04)',
                              flexShrink: 0,
                            }}>
                              {isUnlocked ? (
                                <span style={{ fontSize: typography['body-sm'].fontSize }}>{lesson.emoji}</span>
                              ) : (
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </div>

                            {/* Title */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: typography['body-sm'].fontSize,
                                fontWeight: fontWeights.medium,
                                color: isUnlocked ? 'var(--text)' : 'var(--muted)',
                                fontFamily: FONT_FAMILY,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                margin: 0,
                              }}>
                                {lesson.title}
                              </p>
                              {isUnlocked && (
                                <p style={{
                                  fontSize: typography.caption.fontSize,
                                  color: 'var(--sub)',
                                  fontFamily: FONT_FAMILY,
                                  margin: '2px 0 0',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  Tap to revisit with current data
                                </p>
                              )}
                            </div>

                            {/* Chevron or lock */}
                            {isUnlocked ? (
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            ) : (
                              <span style={{ fontSize: typography.caption.fontSize, color: 'var(--muted)', fontFamily: FONT_FAMILY, flexShrink: 0 }}>
                                locked
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </GlassCard>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Calculators                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: spacing.xl }}>
        <p style={{ ...sectionHeader, marginBottom: spacing.sm }}>Calculators</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {[
            { key: 'credit' as const, label: 'Credit Payoff', sub: 'How fast can you clear debt?', emoji: '💳' },
            { key: 'compound' as const, label: 'Compound Growth', sub: 'Visualize your money growing', emoji: '📈' },
          ].map(tool => (
            <GlassCard key={tool.key} elevation="low">
              <button
                onClick={() => setShowCalculator(tool.key)}
                style={{
                  width: '100%',
                  padding: spacing.md,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: typography.subhead.fontSize }}>{tool.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                    {tool.label}
                  </p>
                  <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginTop: 2 }}>
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
                padding: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: typography.subhead.fontSize }}>📊</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                  Credit Score Check-In
                </p>
                <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginTop: 2 }}>
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
