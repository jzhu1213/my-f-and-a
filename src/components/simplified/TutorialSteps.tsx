"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { springs } from '@/lib/animations'
import type { TutorialStep } from './OnboardingTutorial'
import type { BudgetPreset, OnboardingResult } from '@/types/folio'
import type { TransactionCategory } from '@/types'
import { getCategoryEmoji, PRESET_EMOJI } from '@/lib/vocabulary'

// ============================================================================
// Step Definitions
// ============================================================================

/**
 * Predefined interactive tutorial steps that introduce key Folio features.
 * Each step gives the user a quick "try it once" exercise before advancing.
 *
 * Validates: Requirements 7.1, 7.5
 */
export const TUTORIAL_FEATURE_STEPS: TutorialStep[] = [
  {
    type: 'interactive',
    id: 'try-log-expense',
    title: 'Log an expense',
    subtitle: 'Tap a category, then an amount — that\'s it!',
    emoji: '💸',
    prompt: 'Try tapping a category below, then pick an amount.',
  },
  {
    type: 'interactive',
    id: 'tap-allowance-hero',
    title: 'Your daily allowance',
    subtitle: 'One number tells you if you can afford something today.',
    emoji: '✨',
    prompt: 'Tap the allowance card to see the breakdown.',
  },
  {
    type: 'interactive',
    id: 'view-category-card',
    title: 'Category budgets',
    subtitle: 'See how much you\'ve spent in each category at a glance.',
    emoji: '📊',
    prompt: 'Tap the card below to see details.',
  },
]

// ============================================================================
// Mini Interactive UIs
// ============================================================================

const MINI_CATEGORIES = [
  { emoji: getCategoryEmoji('food'), label: 'Food' },
  { emoji: getCategoryEmoji('transport'), label: 'Transport' },
  { emoji: getCategoryEmoji('fun'), label: 'Fun' },
]

const AMOUNT_CHIPS = ['$5', '$12', '$20']

/**
 * Mini expense flow: pick a category chip, then an amount chip to complete.
 */
function TryLogExpense({ onComplete }: { onComplete: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function handleAmountTap() {
    if (selectedCategory) {
      onComplete()
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 mt-4">
      {/* Category chips */}
      <div className="flex gap-3">
        {MINI_CATEGORIES.map((cat) => {
          const selected = selectedCategory === cat.label
          return (
            <motion.button
              key={cat.label}
              type="button"
              onClick={() => setSelectedCategory(cat.label)}
              whileTap={{ scale: 0.92 }}
              transition={springs.snappy}
              aria-label={`Category: ${cat.label}`}
              aria-pressed={selected}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: selected
                  ? 'rgba(129, 140, 248, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: selected
                  ? '1.5px solid rgba(129, 140, 248, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: selected
                  ? '0 0 10px rgba(129, 140, 248, 0.15)'
                  : 'none',
              }}
            >
              <span style={{ fontSize: 24 }}>{cat.emoji}</span>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  color: selected ? 'var(--text)' : 'var(--sub)',
                }}
              >
                {cat.label}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Amount chips — appear after category is picked */}
      {selectedCategory && (
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          {AMOUNT_CHIPS.map((amt) => (
            <motion.button
              key={amt}
              type="button"
              onClick={handleAmountTap}
              whileTap={{ scale: 0.9 }}
              transition={springs.snappy}
              aria-label={`Amount: ${amt}`}
              style={{
                padding: '10px 20px',
                borderRadius: 99,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--text)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {amt}
            </motion.button>
          ))}
        </motion.div>
      )}

      {!selectedCategory && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            fontFamily: 'Inter, sans-serif',
            textAlign: 'center',
          }}
        >
          Pick a category first ☝️
        </p>
      )}
    </div>
  )
}

/**
 * Mock daily allowance card: tap to reveal the breakdown.
 */
function TapAllowanceHero({ onComplete }: { onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false)

  function handleTap() {
    setRevealed(true)
    onComplete()
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-4">
      <motion.button
        type="button"
        onClick={handleTap}
        whileTap={{ scale: 0.96 }}
        transition={springs.snappy}
        aria-label="Tap to see allowance breakdown"
        style={{
          width: '100%',
          maxWidth: 280,
          padding: '24px 20px',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 38,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            color: '#4ade80',
          }}
        >
          $42
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--sub)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          left today
        </span>
      </motion.button>

      {/* Breakdown slides in after tap */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={springs.gentle}
          style={{
            width: '100%',
            maxWidth: 280,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {[
            { icon: '📅', label: 'Daily budget', value: '$50/day' },
            { icon: '💸', label: 'Spent today', value: '$8' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between"
              style={{
                padding: '8px 0',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: 'var(--sub)',
              }}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{row.icon}</span>
                {row.label}
              </span>
              <span style={{ color: 'var(--text)' }}>{row.value}</span>
            </div>
          ))}

          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
            }}
          >
            Nice! That&apos;s how the breakdown works ✓
          </p>
        </motion.div>
      )}
    </div>
  )
}

/**
 * Mock category budget card: tap to reveal spending details.
 */
function ViewCategoryCard({ onComplete }: { onComplete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  function handleTap() {
    setExpanded(true)
    onComplete()
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-4">
      <motion.button
        type="button"
        onClick={handleTap}
        whileTap={{ scale: 0.96 }}
        transition={springs.snappy}
        aria-label="Tap to view category details"
        style={{
          width: '100%',
          maxWidth: 280,
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 28 }}>🍕</span>
        <div className="flex flex-col flex-1">
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text)',
            }}
          >
            Food
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--sub)',
            }}
          >
            $28 of $60 used
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            width: 60,
            height: 6,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '47%',
              height: '100%',
              borderRadius: 3,
              background: '#4ade80',
            }}
          />
        </div>
      </motion.button>

      {/* Details appear after tap */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          style={{
            width: '100%',
            maxWidth: 280,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {[
            { note: 'Lunch — burrito', amount: '$12' },
            { note: 'Coffee', amount: '$6' },
            { note: 'Snacks', amount: '$10' },
          ].map((item) => (
            <div
              key={item.note}
              className="flex items-center justify-between"
              style={{
                padding: '7px 0',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: 'var(--sub)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span>{item.note}</span>
              <span style={{ color: 'var(--text)' }}>{item.amount}</span>
            </div>
          ))}

          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
            }}
          >
            You can always check category details from home ✓
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ============================================================================
// TutorialStepRenderer
// ============================================================================

export interface TutorialStepRendererProps {
  step: TutorialStep
  completeInteraction: () => void
}

/**
 * TutorialStepRenderer — serves as the `renderStep` implementation for
 * OnboardingTutorial. Renders both info steps (emoji + title + subtitle)
 * and interactive steps with mini-UI exercises.
 *
 * Validates: Requirements 7.1, 7.5
 */
export function TutorialStepRenderer({
  step,
  completeInteraction,
}: TutorialStepRendererProps) {
  // Setup steps are handled by TutorialSetupStepRenderer, not here
  if (step.type === 'setup') return null

  return (
    <div className="flex flex-col items-center text-center flex-1">
      {/* Emoji */}
      <motion.span
        style={{ fontSize: 48, marginBottom: 16 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springs.bouncy}
        aria-hidden="true"
      >
        {step.emoji}
      </motion.span>

      {/* Title */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        {step.title}
      </h2>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {step.subtitle}
      </p>

      {/* Interactive content */}
      {step.type === 'interactive' && (
        <div className="w-full mt-2">
          {/* Prompt */}
          <p
            style={{
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            {step.prompt}
          </p>

          {/* Render the appropriate mini-UI */}
          {step.id === 'try-log-expense' && (
            <TryLogExpense onComplete={completeInteraction} />
          )}
          {step.id === 'tap-allowance-hero' && (
            <TapAllowanceHero onComplete={completeInteraction} />
          )}
          {step.id === 'view-category-card' && (
            <ViewCategoryCard onComplete={completeInteraction} />
          )}
        </div>
      )}

      {/* Info steps just show the content — no interactive element needed */}
      {step.type === 'info' && (
        <div style={{ marginTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Tap Next to continue
          </p>
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Setup Step Definitions (Tutorial Tail)
// ============================================================================

/**
 * Setup steps that form the "tutorial tail" — income, budget style,
 * category limits, and confirmation. These are appended after the
 * interactive feature steps.
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.7
 */
export const TUTORIAL_SETUP_STEPS: TutorialStep[] = [
  {
    type: 'setup',
    id: 'setup-income',
    setupType: 'income',
  },
  {
    type: 'setup',
    id: 'setup-budget-style',
    setupType: 'budget-style',
  },
  {
    type: 'setup',
    id: 'setup-category-limits',
    setupType: 'category-limits',
  },
  {
    type: 'setup',
    id: 'setup-confirmation',
    setupType: 'confirmation',
  },
]

// ============================================================================
// Budget Presets (reused from WarmOnboarding)
// ============================================================================

export const BUDGET_PRESETS: Array<{
  value: BudgetPreset
  label: string
  emoji: string
  description: string
  savingsPercent: number | null
}> = [
  { value: 'student_tight', label: 'Tight budget', emoji: PRESET_EMOJI.student_tight, description: '30% savings — every dollar counts', savingsPercent: 30 },
  { value: 'student_moderate', label: 'Some room', emoji: PRESET_EMOJI.student_moderate, description: '20% savings — a little breathing room', savingsPercent: 20 },
  { value: 'young_professional', label: 'Comfortable', emoji: PRESET_EMOJI.young_professional, description: '10% savings — entry-level income', savingsPercent: 10 },
  { value: 'custom', label: 'Custom', emoji: PRESET_EMOJI.custom, description: "I'll set my own limits", savingsPercent: null },
]

// ============================================================================
// Category Limit Steps (adapted from LimitSetupWizard)
// ============================================================================

const LIMIT_CATEGORIES: Array<{
  key: string
  label: string
  emoji: string
  placeholder: string
  weekly: boolean
  category: TransactionCategory
}> = [
  { key: 'rent', label: 'Monthly rent', emoji: getCategoryEmoji('rent'), placeholder: '800', weekly: false, category: 'rent' },
  { key: 'food', label: 'Food per week', emoji: getCategoryEmoji('food'), placeholder: '60', weekly: true, category: 'food' },
  { key: 'fun', label: 'Fun per week', emoji: getCategoryEmoji('fun'), placeholder: '40', weekly: true, category: 'fun' },
]

// ============================================================================
// Setup State Type
// ============================================================================

/**
 * State managed by the parent for the setup tail steps.
 * Passed into `TutorialSetupStepRenderer` via closure.
 */
export interface TutorialSetupState {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  categoryLimits: Record<string, string>
}

/**
 * Computes the daily allowance from setup state.
 * Formula: (monthlyIncome * (1 - savingsPercent/100)) / 30 (rounded)
 */
export function computeDailyAllowance(state: TutorialSetupState): number {
  const preset = BUDGET_PRESETS.find(p => p.value === state.budgetPreset)
  const savingsPercent = preset?.savingsPercent ?? 0
  const spendable = state.monthlyIncome * (1 - savingsPercent / 100)
  return Math.round(spendable / 30)
}

/**
 * Converts weekly limits to monthly and builds the OnboardingResult.
 */
export function buildOnboardingResult(state: TutorialSetupState): OnboardingResult {
  const toMonthly = (weekly: number) => Math.round(weekly * 4.33)
  const customLimits: Partial<Record<TransactionCategory, number>> = {}

  LIMIT_CATEGORIES.forEach(cat => {
    const raw = parseFloat(state.categoryLimits[cat.key] ?? '') || 0
    if (raw > 0) {
      customLimits[cat.category] = cat.weekly ? toMonthly(raw) : raw
    }
  })

  return {
    monthlyIncome: state.monthlyIncome,
    budgetPreset: state.budgetPreset,
    customLimits: Object.keys(customLimits).length > 0
      ? customLimits as Record<TransactionCategory, number>
      : undefined,
  }
}

// ============================================================================
// Setup Step Content Components
// ============================================================================

interface SetupIncomeProps {
  value: number
  onChange: (value: number) => void
}

/**
 * Income slider step for the tutorial tail.
 * Validates: Requirement 7.2
 */
function SetupIncomeStep({ value, onChange }: SetupIncomeProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-5" role="img" aria-label="money">
        💰
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        What&apos;s your monthly income?
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 32, lineHeight: 1.5 }}
      >
        Rough estimate is fine — you can change this later.
      </p>

      <div
        className="text-3xl font-bold mb-6 tabular-nums"
        style={{ color: 'var(--text)' }}
      >
        ${value.toLocaleString()}
      </div>

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

interface SetupBudgetStyleProps {
  selected: BudgetPreset
  onChange: (preset: BudgetPreset) => void
  monthlyIncome: number
}

/**
 * Budget preset picker for the tutorial tail.
 * Validates: Requirement 7.3
 */
function SetupBudgetStyleStep({ selected, onChange, monthlyIncome }: SetupBudgetStyleProps) {
  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4" role="img" aria-label="chart">
          📊
        </div>
        <h2
          style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
        >
          What fits your life?
        </h2>
        <p
          style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)' }}
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

interface SetupCategoryLimitsProps {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

/**
 * Simplified inline category limits for the tutorial tail.
 * Validates: Requirement 7.3 (custom budget path)
 */
function SetupCategoryLimitsStep({ values, onChange }: SetupCategoryLimitsProps) {
  const toMonthly = (weekly: number) => Math.round(weekly * 4.33)

  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4" role="img" aria-label="limits">
          🎯
        </div>
        <h2
          style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
        >
          Set category limits
        </h2>
        <p
          style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', lineHeight: 1.5 }}
        >
          Optional — leave blank to skip any category.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {LIMIT_CATEGORIES.map((cat) => {
          const val = values[cat.key] ?? ''
          const numVal = parseFloat(val) || 0
          const monthlyHint = cat.weekly && numVal > 0
            ? `≈ $${toMonthly(numVal)}/mo`
            : null

          return (
            <div key={cat.key} className="flex flex-col gap-1">
              <label
                className="flex items-center gap-2"
                style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--text)', fontWeight: 500 }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {cat.weekly && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>/wk</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16, color: 'var(--muted)' }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={cat.placeholder}
                  value={val}
                  onChange={(e) => onChange(cat.key, e.target.value.replace(/[^0-9.]/g, ''))}
                  className="flex-1 py-2 px-3 rounded-lg text-base"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                  aria-label={`${cat.label} amount`}
                />
                {monthlyHint && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {monthlyHint}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface SetupConfirmationProps {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  dailyAllowance: number
  categoryLimits: Record<string, string>
}

/**
 * Confirmation step showing the computed daily allowance.
 * Validates: Requirements 7.4, 7.7
 */
function SetupConfirmationStep({ monthlyIncome, budgetPreset, dailyAllowance, categoryLimits }: SetupConfirmationProps) {
  const presetLabel = BUDGET_PRESETS.find(p => p.value === budgetPreset)?.label ?? budgetPreset

  // Summarize non-empty limits
  const activeLimits = LIMIT_CATEGORIES.filter(cat => {
    const val = parseFloat(categoryLimits[cat.key] ?? '') || 0
    return val > 0
  })

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-5" role="img" aria-label="sparkles">
        ✨
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        You&apos;re all set!
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24 }}
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
          aria-label={`Daily allowance: $${dailyAllowance}`}
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
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Budget style</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {presetLabel}
          </span>
        </div>
        {activeLimits.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Limits set</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {activeLimits.map(c => c.emoji).join(' ')} {activeLimits.length} categories
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TutorialSetupStepRenderer
// ============================================================================

export interface TutorialSetupStepRendererProps {
  step: TutorialStep
  completeInteraction: () => void
  /** Setup state managed by the parent */
  setupState: TutorialSetupState
  onIncomeChange: (value: number) => void
  onPresetChange: (preset: BudgetPreset) => void
  onLimitChange: (key: string, value: string) => void
}

/**
 * Extended renderer that handles info, interactive, AND setup steps.
 * For setup steps it renders the appropriate form content using the
 * provided state and callbacks.
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.7
 */
export function TutorialSetupStepRenderer({
  step,
  completeInteraction,
  setupState,
  onIncomeChange,
  onPresetChange,
  onLimitChange,
}: TutorialSetupStepRendererProps) {
  // Setup steps — render the appropriate form
  if (step.type === 'setup') {
    switch (step.setupType) {
      case 'income':
        return (
          <SetupIncomeStep
            value={setupState.monthlyIncome}
            onChange={onIncomeChange}
          />
        )
      case 'budget-style':
        return (
          <SetupBudgetStyleStep
            selected={setupState.budgetPreset}
            onChange={onPresetChange}
            monthlyIncome={setupState.monthlyIncome}
          />
        )
      case 'category-limits':
        return (
          <SetupCategoryLimitsStep
            values={setupState.categoryLimits}
            onChange={onLimitChange}
          />
        )
      case 'confirmation':
        return (
          <SetupConfirmationStep
            monthlyIncome={setupState.monthlyIncome}
            budgetPreset={setupState.budgetPreset}
            dailyAllowance={computeDailyAllowance(setupState)}
            categoryLimits={setupState.categoryLimits}
          />
        )
      default:
        return null
    }
  }

  // Fall through to the original info/interactive rendering
  return (
    <div className="flex flex-col items-center text-center flex-1">
      {/* Emoji */}
      <motion.span
        style={{ fontSize: 48, marginBottom: 16 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springs.bouncy}
        aria-hidden="true"
      >
        {step.emoji}
      </motion.span>

      {/* Title */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        {step.title}
      </h2>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {step.subtitle}
      </p>

      {/* Interactive content */}
      {step.type === 'interactive' && (
        <div className="w-full mt-2">
          <p
            style={{
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            {step.prompt}
          </p>

          {step.id === 'try-log-expense' && (
            <TryLogExpense onComplete={completeInteraction} />
          )}
          {step.id === 'tap-allowance-hero' && (
            <TapAllowanceHero onComplete={completeInteraction} />
          )}
          {step.id === 'view-category-card' && (
            <ViewCategoryCard onComplete={completeInteraction} />
          )}
        </div>
      )}

      {/* Info steps */}
      {step.type === 'info' && (
        <div style={{ marginTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Tap Next to continue
          </p>
        </div>
      )}
    </div>
  )
}
