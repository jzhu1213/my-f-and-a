"use client"

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/animations'
import type { OnboardingResult, BudgetPreset } from '@/types/folio'

// ============================================================================
// Props
// ============================================================================

interface WarmOnboardingProps {
  onComplete: (config: OnboardingResult) => void
  onSkip: () => void
}

// ============================================================================
// Step Definitions
// ============================================================================

type StepId = 'welcome' | 'income' | 'budget-style' | 'confirmation'

const STEPS: StepId[] = ['welcome', 'income', 'budget-style', 'confirmation']

const BUDGET_PRESETS: Array<{
  value: BudgetPreset
  label: string
  emoji: string
  description: string
  savingsPercent: number | null // null for custom
}> = [
  { value: 'student_tight', label: 'Tight budget', emoji: '🎓', description: '30% savings — every dollar counts', savingsPercent: 30 },
  { value: 'student_moderate', label: 'Some room', emoji: '☕', description: '20% savings — a little breathing room', savingsPercent: 20 },
  { value: 'young_professional', label: 'Comfortable', emoji: '💼', description: '10% savings — entry-level income', savingsPercent: 10 },
  { value: 'custom', label: 'Custom', emoji: '✨', description: "I'll set my own limits", savingsPercent: null },
]

// ============================================================================
// Animation variants
// ============================================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
}

// ============================================================================
// Component
// ============================================================================

export function WarmOnboarding({ onComplete, onSkip }: WarmOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)

  // Form state
  const [monthlyIncome, setMonthlyIncome] = useState(2000)
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>('student_moderate')

  const stepId = STEPS[currentStep]

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1)
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep])

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleComplete = useCallback(() => {
    onComplete({
      monthlyIncome,
      budgetPreset,
    })
  }, [onComplete, monthlyIncome, budgetPreset])

  const selectedPreset = BUDGET_PRESETS.find(p => p.value === budgetPreset)
  const savingsPercent = selectedPreset?.savingsPercent ?? 0
  const spendableIncome = monthlyIncome * (1 - savingsPercent / 100)
  const dailyAllowance = Math.round(spendableIncome / 30)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="w-full max-w-sm relative">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className="transition-all duration-300"
              style={{
                width: idx === currentStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: idx === currentStep ? 'var(--accent)' : 'var(--line)',
              }}
            />
          ))}
        </div>

        {/* Step content with animations */}
        <div className="relative min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={stepId}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springs.gentle}
              className="flex flex-col flex-1"
            >
              {stepId === 'welcome' && (
                <WelcomeStep />
              )}
              {stepId === 'income' && (
                <IncomeStep
                  value={monthlyIncome}
                  onChange={setMonthlyIncome}
                />
              )}
              {stepId === 'budget-style' && (
                <BudgetStyleStep
                  selected={budgetPreset}
                  onChange={setBudgetPreset}
                  monthlyIncome={monthlyIncome}
                />
              )}
              {stepId === 'confirmation' && (
                <ConfirmationStep
                  monthlyIncome={monthlyIncome}
                  budgetPreset={budgetPreset}
                  dailyAllowance={dailyAllowance}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {stepId === 'welcome' && (
            <button
              onClick={goNext}
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              Let&apos;s go
            </button>
          )}

          {stepId === 'income' && (
            <button
              onClick={goNext}
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              Continue
            </button>
          )}

          {stepId === 'budget-style' && (
            <button
              onClick={goNext}
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              Continue
            </button>
          )}

          {stepId === 'confirmation' && (
            <button
              onClick={handleComplete}
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              Start using Folio
            </button>
          )}

          {/* Back / Skip row */}
          <div className="flex items-center justify-between">
            {currentStep > 0 ? (
              <button
                onClick={goBack}
                className="text-sm py-2 px-3 rounded-lg transition-colors"
                style={{ color: 'var(--sub)' }}
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={onSkip}
              className="text-sm py-2 px-3 rounded-lg transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Step: Welcome
// ============================================================================

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-5xl mb-6" role="img" aria-label="waving hand">
        👋
      </div>
      <h1
        className="text-2xl font-semibold mb-3"
        style={{ color: 'var(--text)' }}
      >
        Hey! Let&apos;s get you set up in 30 seconds
      </h1>
      <p
        className="text-base leading-relaxed"
        style={{ color: 'var(--sub)' }}
      >
        Folio helps you answer one simple question every day:
        <br />
        <span className="font-medium" style={{ color: 'var(--text)' }}>
          &ldquo;Can I afford this?&rdquo;
        </span>
      </p>
    </div>
  )
}

// ============================================================================
// Step: Income
// ============================================================================

interface IncomeStepProps {
  value: number
  onChange: (value: number) => void
}

function IncomeStep({ value, onChange }: IncomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-5" role="img" aria-label="money">
        💰
      </div>
      <h2
        className="text-xl font-semibold mb-2"
        style={{ color: 'var(--text)' }}
      >
        What&apos;s your monthly income?
      </h2>
      <p
        className="text-sm mb-8"
        style={{ color: 'var(--sub)' }}
      >
        Rough estimate is fine — you can change this later.
      </p>

      {/* Income display */}
      <div
        className="text-3xl font-bold mb-6 tabular-nums"
        style={{ color: 'var(--text)' }}
      >
        ${value.toLocaleString()}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={500}
        max={10000}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) ${((value - 500) / 9500) * 100}%, var(--line) ${((value - 500) / 9500) * 100}%)`,
        }}
        aria-label="Monthly income slider"
      />
      <div
        className="flex justify-between w-full mt-2 text-xs"
        style={{ color: 'var(--muted)' }}
      >
        <span>$500</span>
        <span>$10,000</span>
      </div>
    </div>
  )
}

// ============================================================================
// Step: Budget Style
// ============================================================================

interface BudgetStyleStepProps {
  selected: BudgetPreset
  onChange: (preset: BudgetPreset) => void
  monthlyIncome: number
}

function BudgetStyleStep({ selected, onChange, monthlyIncome }: BudgetStyleStepProps) {
  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4" role="img" aria-label="chart">
          📊
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text)' }}
        >
          What fits your life?
        </h2>
        <p
          className="text-sm"
          style={{ color: 'var(--sub)' }}
        >
          Pick a starting point — you can always adjust.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {BUDGET_PRESETS.map((preset) => {
          const isSelected = selected === preset.value
          const monthlySpending = preset.savingsPercent !== null
            ? Math.round(monthlyIncome * (1 - preset.savingsPercent / 100))
            : null
          const dailySpending = monthlySpending !== null
            ? Math.round(monthlySpending / 30)
            : null

          return (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
              style={{
                background: isSelected ? 'var(--accent-muted)' : 'var(--surface)',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.25)' : 'none',
              }}
            >
              <span className="text-xl flex-shrink-0">{preset.emoji}</span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium"
                  style={{ color: 'var(--text)' }}
                >
                  {preset.label}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--sub)' }}
                >
                  {preset.description}
                </div>
                {monthlySpending !== null && dailySpending !== null && (
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'var(--muted)' }}
                  >
                    ~${monthlySpending.toLocaleString()}/mo to spend · ~${dailySpending}/day
                  </div>
                )}
              </div>
              {isSelected && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Step: Confirmation
// ============================================================================

interface ConfirmationStepProps {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  dailyAllowance: number
}

function ConfirmationStep({ monthlyIncome, budgetPreset, dailyAllowance }: ConfirmationStepProps) {
  const presetLabel = BUDGET_PRESETS.find(p => p.value === budgetPreset)?.label ?? budgetPreset

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-5" role="img" aria-label="sparkles">
        ✨
      </div>
      <h2
        className="text-xl font-semibold mb-2"
        style={{ color: 'var(--text)' }}
      >
        You&apos;re all set!
      </h2>
      <p
        className="text-sm mb-8"
        style={{ color: 'var(--sub)' }}
      >
        Here&apos;s your starting daily budget:
      </p>

      {/* Daily allowance display */}
      <div
        className="rounded-2xl p-6 mb-6 w-full"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="text-4xl font-bold mb-1 tabular-nums"
          style={{ color: 'var(--accent)' }}
        >
          ${dailyAllowance}
        </div>
        <div
          className="text-sm"
          style={{ color: 'var(--sub)' }}
        >
          per day to spend
        </div>
      </div>

      {/* Summary */}
      <div
        className="w-full rounded-xl p-4 text-left"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Monthly income</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            ${monthlyIncome.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Budget style</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {presetLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
