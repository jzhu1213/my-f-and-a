"use client"
import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import type { Lesson } from '@/types'

interface LessonCardProps {
  lesson: Lesson
  isCompleted: boolean
  onComplete: (score: number) => void
  onBack: () => void
}

// ============================================================================
// Shared inline styles
// ============================================================================

const sectionLabel: React.CSSProperties = {
  fontSize: typography.caption.fontSize,
  fontWeight: fontWeights.medium,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  fontFamily: FONT_FAMILY,
  marginBottom: 4,
}

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 24px',
  borderRadius: radius.full,
  border: 'none',
  background: 'var(--success)',
  color: 'var(--text)',
  fontSize: typography.body.fontSize,
  fontWeight: fontWeights.medium,
  fontFamily: FONT_FAMILY,
  cursor: 'pointer',
  transition: 'opacity 0.2s ease',
}

const ghostButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 24px',
  borderRadius: radius.full,
  border: '1px solid var(--fill-10)',
  background: 'transparent',
  color: 'var(--sub)',
  fontSize: typography.body.fontSize,
  fontWeight: fontWeights.medium,
  fontFamily: FONT_FAMILY,
  cursor: 'pointer',
  transition: 'opacity 0.2s ease',
}

export function LessonCard({ lesson, isCompleted, onComplete, onBack }: LessonCardProps) {
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [showResults, setShowResults] = useState(false)

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers, answerIndex]
    setAnswers(newAnswers)
    if (currentQuestion < lesson.quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResults(true)
    }
  }

  const score = answers.reduce((acc, ans, idx) =>
    acc + (ans === lesson.quizQuestions[idx].correctIndex ? 1 : 0), 0)

  const BackBtn = ({ label }: { label: string }) => (
    <button
      onClick={showResults ? onBack : () => { setShowQuiz(false); setShowResults(false); setCurrentQuestion(0); setAnswers([]) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        padding: '8px 14px',
        borderRadius: radius.full,
        border: '1px solid var(--fill-10)',
        background: 'transparent',
        color: 'var(--sub)',
        fontSize: typography['body-sm'].fontSize,
        fontWeight: fontWeights.medium,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        marginBottom: spacing.xl,
        transition: 'border-color 0.2s ease',
      }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )

  // --------------------------------------------------------------------------
  // Results screen
  // --------------------------------------------------------------------------

  if (showResults) {
    const passed = score >= Math.ceil(lesson.quizQuestions.length / 2)
    return (
      <div style={{ paddingBottom: 80, padding: '40px 20px 80px', fontFamily: FONT_FAMILY }}>
        <BackBtn label="back to lessons" />

        <div style={{ marginBottom: spacing.lg }}>
          <p style={sectionLabel}>Result</p>
          <h2 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY, margin: '4px 0' }}>
            {passed ? 'Great job!' : 'Almost there!'}
          </h2>
          <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, marginTop: 4, color: passed ? 'var(--success)' : 'var(--warning)' }}>
            {score}/{lesson.quizQuestions.length} correct
          </p>
        </div>

        <GlassCard elevation="low" style={{ marginBottom: spacing.lg }}>
          <div style={{ padding: 16 }}>
            {lesson.quizQuestions.map((q, idx) => {
              const correct = answers[idx] === q.correctIndex
              return (
                <div
                  key={q.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: idx < lesson.quizQuestions.length - 1 ? '1px solid var(--fill-06)' : 'none',
                  }}
                >
                  <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--text)', fontFamily: FONT_FAMILY, marginBottom: 6 }}>{q.question}</p>
                  <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, color: correct ? 'var(--success)' : 'var(--error)' }}>
                    {correct ? '✓' : '✗'} {q.options[answers[idx]]}
                  </p>
                  {!correct && (
                    <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)', marginTop: 4 }}>
                      → {q.options[q.correctIndex]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>

        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button onClick={onBack} style={{ ...ghostButton, flex: 1 }}>Lessons</button>
          <button onClick={() => onComplete(score)} style={{ ...primaryButton, flex: 1 }}>
            {passed ? 'Complete' : 'Done'}
          </button>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Quiz screen
  // --------------------------------------------------------------------------

  if (showQuiz) {
    const question = lesson.quizQuestions[currentQuestion]
    return (
      <div style={{ paddingBottom: 80, padding: '40px 20px 80px', fontFamily: FONT_FAMILY }}>
        <BackBtn label="back to lesson" />

        <div style={{ marginBottom: spacing.lg }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: spacing.md }}>
            {lesson.quizQuestions.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: radius.full,
                  transition: 'background 0.3s ease',
                  background: idx < currentQuestion
                    ? (answers[idx] === lesson.quizQuestions[idx].correctIndex ? 'var(--success)' : 'var(--error)')
                    : idx === currentQuestion
                      ? 'var(--muted)'
                      : 'var(--fill-08)',
                }}
              />
            ))}
          </div>
          <p style={sectionLabel}>
            {currentQuestion + 1} / {lesson.quizQuestions.length}
          </p>
        </div>

        <h3 style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY, marginBottom: spacing.lg, lineHeight: 1.5 }}>
          {question.question}
        </h3>

        <div>
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                padding: '14px 12px',
                textAlign: 'left',
                fontSize: typography.body.fontSize,
                color: 'var(--text)',
                fontFamily: FONT_FAMILY,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--fill-06)',
                cursor: 'pointer',
                borderRadius: radius.control,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--fill-04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.medium, color: 'var(--muted)', width: 16, fontFamily: FONT_FAMILY }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Lesson content screen
  // --------------------------------------------------------------------------

  return (
    <div style={{ paddingBottom: 80, padding: '40px 20px 80px', fontFamily: FONT_FAMILY }}>
      <BackBtn label="back to lessons" />

      <div style={{ marginBottom: spacing.lg }}>
        <p style={{ ...sectionLabel, marginBottom: spacing.xs }}>Lesson {lesson.order}</p>
        <h1 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.medium, color: 'var(--text)', fontFamily: FONT_FAMILY, margin: '0 0 8px' }}>
          {lesson.title}
        </h1>
        <div style={{ width: 32, height: 2, borderRadius: radius.full, background: 'var(--muted)' }} />
      </div>

      <div style={{ marginBottom: spacing.xl, paddingTop: 24, borderTop: '1px solid var(--fill-06)' }}>
        {lesson.content.split('\n\n').map((para, idx) => (
          <p key={idx} style={{ fontSize: typography.body.fontSize, color: 'var(--text)', fontFamily: FONT_FAMILY, lineHeight: 1.6, marginBottom: spacing.md }}>
            {para}
          </p>
        ))}
      </div>

      <GlassCard elevation="low" style={{ marginBottom: spacing.xl }}>
        <div style={{ padding: 16 }}>
          <p style={{ ...sectionLabel, marginBottom: spacing.xs }}>Real Example</p>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--text)', fontFamily: FONT_FAMILY, lineHeight: 1.5 }}>
            {lesson.example}
          </p>
        </div>
      </GlassCard>

      <button
        onClick={() => setShowQuiz(true)}
        style={{ ...primaryButton, width: '100%' }}
      >
        Take quiz · {lesson.quizQuestions.length} questions
      </button>

      {isCompleted && (
        <p style={{ textAlign: 'center', fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)', marginTop: spacing.md }}>
          ✓ Completed
        </p>
      )}
    </div>
  )
}
