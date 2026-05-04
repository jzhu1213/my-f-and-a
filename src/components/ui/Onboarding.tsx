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
  { value: 'avoid_overdraft', label: 'Stay in the black', sub: 'Avoid overdraft' },
  { value: 'pay_debt',        label: 'Pay off debt',      sub: 'Credit cards / loans' },
  { value: 'save',            label: 'Build savings',     sub: 'Emergency fund / goals' },
  { value: 'learn_investing', label: 'Learn investing',   sub: 'Stocks / index funds' },
]

function ChevronRight() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      strokeWidth={1.5} style={{ color: 'var(--muted)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({ userType: null, priority: null })

  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm animate-slide-up">
          {/* Logo mark */}
          <div className="mb-12">
            <div className="flex items-end gap-2 mb-3">
              <span className="text-5xl font-mono font-light" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                folio
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-px w-8" style={{ background: 'var(--line)' }} />
              <span className="label">personal finance</span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-10 space-y-3">
            {['Track every dollar', 'Set and hit budgets', 'Reach your savings goals'].map((line, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--muted)' }} />
                <span className="text-sm" style={{ color: 'var(--sub)' }}>{line}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setStep(1)} className="w-full btn-primary">
            Get Started
          </button>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-8" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm mx-auto animate-slide-up">
          <div className="mb-8">
            <p className="label mb-2">01 / 02</p>
            <h2 className="text-2xl font-mono" style={{ color: 'var(--text)', fontWeight: 300 }}>Who are you?</h2>
          </div>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            {USER_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => { setData(d => ({ ...d, userType: type.value })); setStep(2) }}
                className="t-row w-full text-left py-4 px-0 gap-0"
              >
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{type.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{type.sub}</p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm mx-auto animate-slide-up">
        <div className="mb-8">
          <p className="label mb-2">02 / 02</p>
          <h2 className="text-2xl font-mono" style={{ color: 'var(--text)', fontWeight: 300 }}>Top priority?</h2>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => { const final = { ...data, priority: p.value }; setData(final); onComplete(final) }}
              className="t-row w-full text-left py-4 px-0 gap-0"
            >
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text)' }}>{p.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{p.sub}</p>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep(1)}
          className="mt-7 label hover:text-t-sub transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          ← back
        </button>
      </div>
    </div>
  )
}
