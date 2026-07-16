"use client"
import { useState } from 'react'
import type { Lesson } from '@/types'

interface LessonCardProps {
  lesson: Lesson
  isCompleted: boolean
  onComplete: (score: number) => void
  onBack: () => void
}

export function LessonCard({ lesson, isCompleted, onComplete, onBack }: LessonCardProps) {
  const [showQuiz,         setShowQuiz]         = useState(false)
  const [currentQuestion,  setCurrentQuestion]  = useState(0)
  const [answers,          setAnswers]          = useState<number[]>([])
  const [showResults,      setShowResults]      = useState(false)

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
      className="flex items-center gap-2 text-xs font-mono tracking-widest text-t-muted hover:text-t-text transition-colors uppercase mb-8"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )

  if (showResults) {
    const passed = score >= Math.ceil(lesson.quizQuestions.length / 2)
    return (
      <div className="pb-20 px-5 pt-10">
        <BackBtn label="back to lessons" />

        <div className="mb-6">
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-1">Result</p>
          <h2 className="text-2xl font-mono text-t-text">{passed ? 'Passed' : 'Not quite'}</h2>
          <p className="text-sm font-mono mt-1" style={{ color: passed ? 'var(--green)' : 'var(--amber)' }}>
            {score}/{lesson.quizQuestions.length} correct
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} className="mb-6">
          {lesson.quizQuestions.map((q, idx) => {
            const correct = answers[idx] === q.correctIndex
            return (
              <div key={q.id} className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs text-t-text mb-2">{q.question}</p>
                <p className="text-xs font-mono" style={{ color: correct ? 'var(--green)' : 'var(--red)' }}>
                  {correct ? '✓' : '✗'} {q.options[answers[idx]]}
                </p>
                {!correct && (
                  <p className="text-xs font-mono text-t-muted mt-0.5">
                    → {q.options[q.correctIndex]}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 btn-ghost">LESSONS</button>
          <button onClick={() => onComplete(score)} className="flex-1 btn-primary">
            {passed ? 'COMPLETE' : 'DONE'}
          </button>
        </div>
      </div>
    )
  }

  if (showQuiz) {
    const question = lesson.quizQuestions[currentQuestion]
    return (
      <div className="pb-20 px-5 pt-10">
        <BackBtn label="back to lesson" />

        <div className="mb-6">
          <div className="flex items-center gap-1 mb-4">
            {lesson.quizQuestions.map((_, idx) => (
              <div
                key={idx}
                className="flex-1 h-[2px] transition-colors"
                style={{
                  background: idx < currentQuestion
                    ? (answers[idx] === lesson.quizQuestions[idx].correctIndex ? 'var(--green)' : 'var(--red)')
                    : idx === currentQuestion
                      ? 'var(--muted)'
                      : 'var(--border)',
                }}
              />
            ))}
          </div>
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase">
            {currentQuestion + 1} / {lesson.quizQuestions.length}
          </p>
        </div>

        <h3 className="text-base text-t-text mb-6 leading-relaxed">{question.question}</h3>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className="w-full flex items-center gap-4 py-4 text-left text-sm text-t-text transition-colors hover:bg-t-hover"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-[10px] font-mono text-t-muted w-4">{String.fromCharCode(65 + idx)}</span>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 px-5 pt-10">
      <BackBtn label="back to lessons" />

      <div className="mb-6">
        <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Lesson {lesson.order}</p>
        <h1 className="text-2xl font-mono text-t-text mb-1">{lesson.title}</h1>
        <div className="w-8 h-[2px]" style={{ background: 'var(--muted)' }} />
      </div>

      <div className="space-y-4 mb-8" style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        {lesson.content.split('\n\n').map((para, idx) => (
          <p key={idx} className="text-sm text-t-text leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      <div
        className="px-4 py-4 mb-8"
        style={{ borderLeft: '2px solid var(--muted)', background: 'var(--surface)' }}
      >
        <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Real Example</p>
        <p className="text-xs text-t-text leading-relaxed">{lesson.example}</p>
      </div>

      <button onClick={() => setShowQuiz(true)} className="w-full btn-primary">
        TAKE QUIZ · {lesson.quizQuestions.length} QUESTIONS
      </button>

      {isCompleted && (
        <p className="text-center text-xs font-mono text-t-muted mt-4 uppercase tracking-widest">
          ✓ completed
        </p>
      )}
    </div>
  )
}
