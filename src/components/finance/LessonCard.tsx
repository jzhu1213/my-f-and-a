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
      // Calculate score
      const score = newAnswers.reduce((acc, ans, idx) => {
        return acc + (ans === lesson.quizQuestions[idx].correctIndex ? 1 : 0)
      }, 0)
      setShowResults(true)
    }
  }
  
  const score = answers.reduce((acc, ans, idx) => {
    return acc + (ans === lesson.quizQuestions[idx].correctIndex ? 1 : 0)
  }, 0)
  
  // Show quiz results
  if (showResults) {
    const passed = score >= Math.ceil(lesson.quizQuestions.length / 2)
    
    return (
      <div className="pb-32 px-4 pt-8">
        <div className="glass-card-solid p-8 text-center">
          <span className="text-6xl mb-4 block">
            {passed ? '🎉' : '📚'}
          </span>
          <h2 className="text-2xl font-heading font-bold mb-2">
            {passed ? 'Great job!' : 'Keep learning!'}
          </h2>
          <p className="text-lg mb-4">
            You scored <span className="font-bold text-sage-dark dark:text-sage">{score}/{lesson.quizQuestions.length}</span>
          </p>
          
          {/* Review answers */}
          <div className="text-left space-y-3 mb-6">
            {lesson.quizQuestions.map((q, idx) => {
              const isCorrect = answers[idx] === q.correctIndex
              return (
                <div key={q.id} className={`p-3 rounded-lg ${isCorrect ? 'bg-sage/20' : 'bg-peach/20'}`}>
                  <p className="text-sm font-medium mb-1">{q.question}</p>
                  <p className="text-xs">
                    {isCorrect ? '✅' : '❌'} Your answer: {q.options[answers[idx]]}
                    {!isCorrect && (
                      <span className="block text-sage-dark dark:text-sage">
                        Correct: {q.options[q.correctIndex]}
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
          
          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 btn-ghost border border-gray-200 dark:border-gray-700">
              Back to Lessons
            </button>
            <button 
              onClick={() => onComplete(score)}
              className="flex-1 btn-sage"
            >
              {passed ? 'Complete ✓' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Show quiz
  if (showQuiz) {
    const question = lesson.quizQuestions[currentQuestion]
    
    return (
      <div className="pb-32 px-4 pt-8">
        <button 
          onClick={() => setShowQuiz(false)}
          className="flex items-center gap-2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to lesson
        </button>
        
        <div className="glass-card-solid p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
              Question {currentQuestion + 1} of {lesson.quizQuestions.length}
            </span>
            <div className="flex gap-1">
              {lesson.quizQuestions.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-2 h-2 rounded-full ${
                    idx < currentQuestion 
                      ? answers[idx] === lesson.quizQuestions[idx].correctIndex
                        ? 'bg-sage'
                        : 'bg-peach'
                      : idx === currentQuestion
                        ? 'bg-gray-400'
                        : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <h3 className="text-xl font-heading font-bold mb-6">
            {question.question}
          </h3>
          
          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-sage transition-all duration-200 active:scale-98"
              >
                <span className="font-medium">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // Show lesson content
  return (
    <div className="pb-32 px-4 pt-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to lessons
      </button>
      
      <article className="glass-card-solid p-6 mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">
          {lesson.title}
        </h1>
        <div className="w-16 h-1 bg-peach rounded-full mb-6" />
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {lesson.content.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="mb-4 text-folio-text-primary-light dark:text-folio-text-primary-dark leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
        
        {/* Example Box */}
        <div className="mt-6 p-4 rounded-xl bg-sage/10 dark:bg-sage/20 border-l-4 border-sage">
          <p className="text-sm font-medium mb-1">💡 Real Example</p>
          <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
            {lesson.example}
          </p>
        </div>
      </article>
      
      {/* Quiz CTA */}
      <button 
        onClick={() => setShowQuiz(true)}
        className="w-full btn-peach text-lg"
      >
        Take the Quiz ({lesson.quizQuestions.length} questions)
      </button>
      
      {isCompleted && (
        <p className="text-center text-sm text-sage-dark dark:text-sage mt-4">
          ✓ You've completed this lesson
        </p>
      )}
    </div>
  )
}

