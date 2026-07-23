"use client"
import { useState } from 'react'
import type { TransactionCategory } from '@/types'

export type LimitSetupResult = Partial<Record<TransactionCategory, number>>

interface LimitSetupWizardProps {
  onComplete: (limits: LimitSetupResult) => void
  onSkip: () => void
}

const STEPS = [
  {
    key: 'rent',
    title: 'Monthly rent',
    subtitle: 'What do you pay for housing each month?',
    placeholder: '800',
    weekly: false,
    category: 'rent' as TransactionCategory,
  },
  {
    key: 'food',
    title: 'Food & groceries',
    subtitle: 'How much can you spend on food per week?',
    placeholder: '60',
    weekly: true,
    category: 'food' as TransactionCategory,
  },
  {
    key: 'fun',
    title: 'Going out & fun',
    subtitle: 'Dining out, drinks, entertainment — per week',
    placeholder: '40',
    weekly: true,
    category: 'fun' as TransactionCategory,
  },
]

export function LimitSetupWizard({ onComplete, onSkip }: LimitSetupWizardProps) {
  const [step,   setStep]   = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})

  const current = STEPS[step]
  const value   = values[current.key] ?? ''

  const handleAmountChange = (v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '')
    setValues(prev => ({ ...prev, [current.key]: cleaned }))
  }

  const toMonthly = (weekly: number) => Math.round(weekly * 4.33)

  const handleNext = () => {
    const num = parseFloat(value) || 0

    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
      return
    }

    // Build limits from all steps
    const limits: LimitSetupResult = {}
    STEPS.forEach(s => {
      const n = parseFloat(values[s.key] ?? '') || 0
      if (n <= 0) return
      limits[s.category] = s.weekly ? toMonthly(n) : n
    })

    // Sensible default for transport if food/fun set
    if (limits.food && !limits.transport) {
      limits.transport = toMonthly(25)
    }

    onComplete(limits)
  }

  const handleSkipStep = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onSkip()
  }

  const weeklyHint = current.weekly && value
    ? `≈ $${toMonthly(parseFloat(value)).toFixed(0)}/mo`
    : null

  return (
    <div className="min-h-screen flex flex-col px-8 pt-16 pb-10" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col animate-slide-up">
        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: '2px', borderRadius: '1px',
                background: i <= step ? 'var(--text)' : 'var(--border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <p className="label mb-3">Step {step + 1} of {STEPS.length}</p>
        <h2 style={{ fontSize: '24px', color: 'var(--text)', marginBottom: '8px', lineHeight: 1.3 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--sub)', marginBottom: '32px', lineHeight: 1.5 }}>
          {current.subtitle}
        </p>

        <div className="flex items-baseline gap-2 mb-2">
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '28px', fontWeight: 300, color: 'var(--muted)' }}>$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder={current.placeholder}
            value={value}
            onChange={e => handleAmountChange(e.target.value)}
            autoFocus
            style={{
              flex: 1, background: 'transparent', outline: 'none',
              fontSize: '48px', fontFamily: "'Inter', sans-serif", fontWeight: 300,
              color: 'var(--text)',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '8px',
              caretColor: 'var(--text)',
            }}
          />
          {current.weekly && (
            <span className="label" style={{ flexShrink: 0 }}>/wk</span>
          )}
        </div>

        {weeklyHint && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: 'var(--muted)', marginBottom: '24px' }}>
            {weeklyHint}
          </p>
        )}

        <div className="flex-1" />

        <div className="space-y-3 pt-8">
          <button
            onClick={handleNext}
            className="w-full btn-primary"
          >
            {step < STEPS.length - 1 ? 'Continue' : 'Finish setup'}
          </button>
          <button onClick={handleSkipStep} className="w-full btn-ghost" style={{ color: 'var(--muted)' }}>
            {step < STEPS.length - 1 ? 'Skip for now' : 'Skip setup'}
          </button>
        </div>
      </div>
    </div>
  )
}
