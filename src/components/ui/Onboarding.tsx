"use client"
import { useState } from 'react'
import type { UserType, UserPriority, OnboardingData } from '@/types'

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void
}

const USER_TYPES: { value: UserType; label: string; sub: string }[] = [
  { value: 'student',        label: 'Student',        sub: 'College / university' },
  { value: 'gig_worker',     label: 'Gig Worker',     sub: 'Freelance / delivery / contract' },
  { value: 'small_business', label: 'Small Business', sub: 'Self-employed / entrepreneur' },
]

const PRIORITIES: { value: UserPriority; label: string; sub: string }[] = [
  { value: 'avoid_overdraft',  label: 'Stay in the black',  sub: 'Avoid overdraft' },
  { value: 'pay_debt',         label: 'Pay off debt',       sub: 'Credit cards / loans' },
  { value: 'save',             label: 'Build savings',      sub: 'Emergency fund / goals' },
  { value: 'learn_investing',  label: 'Learn investing',    sub: 'Stocks / index funds' },
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({ userType: null, priority: null })

  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-t-bg">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-12">
            <h1 className="text-4xl font-mono text-t-text tracking-tighter mb-2">folio</h1>
            <p className="text-xs font-mono tracking-widest text-t-muted uppercase">
              personal finance tracker
            </p>
          </div>

          <div className="mb-8" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
            <p className="text-sm text-t-text leading-relaxed">
              Track spending. Set budgets.<br />
              Reach your goals.
            </p>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full btn-primary"
          >
            GET STARTED
          </button>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-8 bg-t-bg">
        <div className="w-full max-w-sm mx-auto animate-slide-up">
          <div className="mb-8">
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">01 / 02</p>
            <h2 className="text-2xl font-mono text-t-text">Who are you?</h2>
          </div>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            {USER_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => { setData(d => ({ ...d, userType: type.value })); setStep(2) }}
                className="w-full flex items-center justify-between py-5 transition-colors hover:bg-t-hover text-left"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <p className="text-sm text-t-text">{type.label}</p>
                  <p className="text-xs text-t-muted mt-0.5">{type.sub}</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-8 bg-t-bg">
      <div className="w-full max-w-sm mx-auto animate-slide-up">
        <div className="mb-8">
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">02 / 02</p>
          <h2 className="text-2xl font-mono text-t-text">Top priority?</h2>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => { const final = { ...data, priority: p.value }; setData(final); onComplete(final) }}
              className="w-full flex items-center justify-between py-5 transition-colors hover:bg-t-hover text-left"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-sm text-t-text">{p.label}</p>
                <p className="text-xs text-t-muted mt-0.5">{p.sub}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep(1)}
          className="mt-6 text-[10px] font-mono tracking-widest text-t-muted uppercase hover:text-t-text transition-colors"
        >
          ← back
        </button>
      </div>
    </div>
  )
}
