"use client"
import { useState } from 'react'
import type { UserType, UserPriority, OnboardingData } from '@/types'

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void
}

const USER_TYPES: { value: UserType; label: string; emoji: string }[] = [
  { value: 'student', label: 'Student', emoji: '📚' },
  { value: 'gig_worker', label: 'Gig Worker', emoji: '💼' },
  { value: 'small_business', label: 'Small Business', emoji: '🏪' },
]

const PRIORITIES: { value: UserPriority; label: string; emoji: string }[] = [
  { value: 'avoid_overdraft', label: 'Avoid overdraft', emoji: '🛡️' },
  { value: 'pay_debt', label: 'Pay off debt', emoji: '💳' },
  { value: 'save', label: 'Save money', emoji: '🐷' },
  { value: 'learn_investing', label: 'Learn investing', emoji: '📈' },
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    userType: null,
    priority: null,
  })

  const handleUserType = (userType: UserType) => {
    setData(prev => ({ ...prev, userType }))
    setStep(2)
  }

  const handlePriority = (priority: UserPriority) => {
    const finalData = { ...data, priority }
    setData(finalData)
    onComplete(finalData)
  }

  // Screen 1: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 hero-gradient">
        <div className="text-center max-w-md stagger-1">
          {/* Logo */}
          <div className="mb-8 relative inline-block">
            <div className="w-24 h-28 bg-white/90 rounded-lg shadow-xl relative transform rotate-3">
              <div className="absolute top-0 right-0 w-8 h-8 bg-sage-dark rounded-bl-lg rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 right-4 h-1 bg-peach rounded-full" />
            </div>
          </div>
          
          <h1 className="text-4xl font-heading font-bold text-white mb-3">
            Folio
          </h1>
          <p className="text-xl text-white/90 mb-2">
            Your F&A Assistant
          </p>
          <p className="text-white/70 mb-12">
            Simple budgeting + financial literacy for young adults
          </p>
          
          <button
            onClick={() => setStep(1)}
            className="btn-folio bg-white text-sage-dark hover:bg-white/90 text-lg px-10 py-4 shadow-xl"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  // Screen 2: User Type
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col p-8 bg-folio-bg-light dark:bg-folio-bg-dark">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="stagger-1">
            <p className="text-sage-dark dark:text-sage text-sm font-medium mb-2">
              Step 1 of 2
            </p>
            <h2 className="text-3xl font-heading font-bold mb-8">
              What describes you best?
            </h2>
          </div>
          
          <div className="space-y-4">
            {USER_TYPES.map((type, i) => (
              <button
                key={type.value}
                onClick={() => handleUserType(type.value)}
                className={`w-full glass-card-solid flex items-center gap-4 p-5 transition-all duration-200 active:scale-98 hover:border-sage stagger-${i + 2}`}
                style={{ animationDelay: `${(i + 1) * 0.1}s` }}
              >
                <span className="text-3xl">{type.emoji}</span>
                <span className="text-lg font-medium">{type.label}</span>
                <span className="ml-auto text-sage-dark">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Screen 3: Priority
  return (
    <div className="min-h-screen flex flex-col p-8 bg-folio-bg-light dark:bg-folio-bg-dark">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="stagger-1">
          <p className="text-sage-dark dark:text-sage text-sm font-medium mb-2">
            Step 2 of 2
          </p>
          <h2 className="text-3xl font-heading font-bold mb-8">
            Your top priority?
          </h2>
        </div>
        
        <div className="space-y-4">
          {PRIORITIES.map((priority, i) => (
            <button
              key={priority.value}
              onClick={() => handlePriority(priority.value)}
              className={`w-full glass-card-solid flex items-center gap-4 p-5 transition-all duration-200 active:scale-98 hover:border-sage stagger-${i + 2}`}
              style={{ animationDelay: `${(i + 1) * 0.1}s` }}
            >
              <span className="text-3xl">{priority.emoji}</span>
              <span className="text-lg font-medium">{priority.label}</span>
              <span className="ml-auto text-sage-dark">→</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setStep(1)}
          className="mt-8 text-folio-text-secondary-light dark:text-folio-text-secondary-dark text-sm"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

