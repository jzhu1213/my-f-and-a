"use client"

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/animations'
import type { TutorialStep } from './OnboardingTutorial'
import type { BudgetPreset, OnboardingResult } from '@/types/folio'
import type { TransactionCategory, OnboardingPath } from '@/types'
import { getCategoryEmoji, PRESET_EMOJI } from '@/lib/vocabulary'
import { borderRadius } from '@/styles/shared'
import type { PayCadence } from '@/lib/paySchedule'

// ============================================================================
// Welcome Step (Task 213.1)
// ============================================================================

/**
 * The warm welcome screen — the very first thing new users see.
 * Primary action: "Let's go" (Next button). Always-visible "Skip for now"
 * exits the entire onboarding flow without blocking value.
 *
 * Validates: Requirements 7.1
 */
export const WELCOME_STEP: TutorialStep = {
  type: 'info',
  id: 'welcome',
  title: 'One question every day:',
  subtitle: 'Can I afford this? Folio gives you a single daily number — no spreadsheets, no stress. Just a gentle guide for your spending.',
  emoji: '✨',
}

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
    title: 'Can I afford this today?',
    subtitle: 'This one number is your daily spending guide — tap to see the breakdown.',
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
// Path Router Step
// ============================================================================

/**
 * The branch/router step that asks "how do you want to start?" and sets
 * the active onboarding path. Placed before path-specific steps.
 */
export const PATH_ROUTER_STEP: TutorialStep = {
  type: 'branch',
  id: 'path-router',
  title: 'How do you want to start?',
  subtitle: 'Pick what feels right — you can always change later.',
  emoji: '🚀',
  options: [
    { value: 'express', label: 'I know my numbers', emoji: '🧾', description: 'Enter income + expenses directly' },
    { value: 'preset', label: 'Help me figure it out', emoji: '🧭', description: 'Guided setup with presets' },
    { value: 'paycheck', label: 'I get paychecks', emoji: '💵', description: 'Split your paycheck into buckets' },
    { value: 'minimal', label: 'Just let me try it', emoji: '👀', description: 'Start with a quick estimate' },
  ],
}

// ============================================================================
// Step Builder (Task 212.1)
// ============================================================================

/**
 * Builds the step list for the given onboarding path at runtime.
 * Progress dots will reflect the chosen path's length.
 *
 * - Before a path is selected (path = null):
 *   Welcome → feature demos → path router → setup tail
 * - After a path is selected:
 *   Welcome → path router → path-specific steps → setup tail
 *   (Feature demos are NOT repeated — the user already saw them.)
 *
 * Switching paths re-runs buildStepsForPath with the new path value;
 * tutorialSetupState in page.tsx is maintained independently, so
 * already-entered income/goal values persist across path switches (task 213.3).
 *
 * Task 215.3: The `budgetPreset` parameter controls whether the category-limits
 * step is included in the preset path. Only 'custom' preset users need to manually
 * set category limits — other presets derive limits automatically from the savings %.
 *
 * Task 215.1: The preset path persists through existing Group 30 mechanisms —
 * `handleTutorialComplete` calls `buildOnboardingResult(tutorialSetupState)` which
 * reads monthlyIncome, budgetPreset, and customLimits collected by these steps.
 *
 * Validates: Requirements 7.1
 */
export function buildStepsForPath(path: OnboardingPath, budgetPreset?: BudgetPreset, paycheckMode?: 'full' | 'simple'): TutorialStep[] {
  if (path === null) {
    // No path chosen yet — full intro sequence
    return [WELCOME_STEP, ...TUTORIAL_FEATURE_STEPS, PATH_ROUTER_STEP, ...TUTORIAL_SETUP_STEPS]
  }

  // Once a path is selected, skip the feature demos (already seen) and jump
  // from welcome → router → path-specific setup. Groups 32-35 will inject
  // distinct steps between the router and setup tail per path.
  switch (path) {
    case 'express':
      // Path A: "I know my numbers" — real numeric inputs (Group 32, task 214)
      return [WELCOME_STEP, PATH_ROUTER_STEP, ...EXPRESS_SETUP_STEPS]
    case 'preset':
      // Path B: "Help me figure it out" — guided preset (Group 33, task 215)
      // Category-limits step only shows for 'custom' preset; other presets
      // derive spending limits automatically from their savings percentage.
      return [WELCOME_STEP, PATH_ROUTER_STEP, ...buildPresetSetupSteps(budgetPreset)]
    case 'paycheck':
      // Path C: "I get paychecks" — pay schedule + allocation (Group 34, task 216)
      // Task 217: Now supports full and simple modes
      return [WELCOME_STEP, PATH_ROUTER_STEP, ...buildPaycheckSteps(paycheckMode)]
    case 'minimal':
      // Path D: "Just let me try it" — minimal setup (Group 35)
      return [WELCOME_STEP, PATH_ROUTER_STEP, ...TUTORIAL_SETUP_STEPS]
    default:
      return [WELCOME_STEP, PATH_ROUTER_STEP, ...TUTORIAL_SETUP_STEPS]
  }
}

/**
 * Builds the preset path's setup steps, conditionally including the
 * category-limits step only when the user picks 'custom' preset.
 *
 * Task 215.3: Non-custom presets derive limits from their savings percentage,
 * so the manual category-limits step is unnecessary and would be confusing.
 */
function buildPresetSetupSteps(budgetPreset?: BudgetPreset): TutorialStep[] {
  const steps: TutorialStep[] = [
    { type: 'setup', id: 'setup-income', setupType: 'income' },
    { type: 'setup', id: 'setup-budget-style', setupType: 'budget-style' },
  ]

  // Only include category-limits for 'custom' preset
  if (budgetPreset === 'custom') {
    steps.push({ type: 'setup', id: 'setup-category-limits', setupType: 'category-limits' })
  }

  steps.push({ type: 'setup', id: 'setup-confirmation', setupType: 'confirmation' })
  return steps
}

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
                borderRadius: borderRadius.full,
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
            color: 'var(--success)',
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
  // Branch steps are handled by the parent (path selection UI)
  if (step.type === 'branch') return null

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
      {step.type === 'info' && step.id !== 'welcome' && (
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
// Express Path Step Definitions (Task 214 — Group 32)
// ============================================================================

/**
 * Express path-specific setup steps for users who "know their numbers":
 * 1. Real numeric income input (typed + slider) — task 214.1
 * 2. Fixed expense capture (add-list) — task 214.2
 * 3. Category limits with weekly/monthly toggle — task 214.3
 * 4. Confirmation with live daily number — task 214.4
 *
 * Each step also shows a live daily-number preview banner (task 214.4).
 */
export const EXPRESS_SETUP_STEPS: TutorialStep[] = [
  {
    type: 'setup',
    id: 'express-income',
    setupType: 'express-income' as 'income',
  },
  {
    type: 'setup',
    id: 'express-fixed-expenses',
    setupType: 'express-fixed-expenses' as 'income',
  },
  {
    type: 'setup',
    id: 'express-category-limits',
    setupType: 'express-category-limits' as 'income',
  },
  {
    type: 'setup',
    id: 'express-confirmation',
    setupType: 'express-confirmation' as 'income',
  },
]

// ============================================================================
// Paycheck Path Steps (Task 216 — Group 34)
// ============================================================================

/**
 * Paycheck path setup steps:
 * Full mode: mode-select → schedule → allocation → confirmation
 * Simple mode: mode-select → simple-split → simple-confirmation
 *
 * Task 217: Added mode selection to let users choose between full
 * schedule modeling and a lightweight "just split my paycheck" flow.
 */
export const PAYCHECK_SETUP_STEPS: TutorialStep[] = [
  {
    type: 'setup',
    id: 'paycheck-mode',
    setupType: 'paycheck-mode' as 'income',
  },
  {
    type: 'setup',
    id: 'paycheck-schedule',
    setupType: 'paycheck-schedule' as 'income',
  },
  {
    type: 'setup',
    id: 'paycheck-allocation',
    setupType: 'paycheck-allocation' as 'income',
  },
  {
    type: 'setup',
    id: 'paycheck-confirmation',
    setupType: 'paycheck-confirmation' as 'income',
  },
]

/** Simple paycheck split steps (task 217) — no schedule modeling */
const PAYCHECK_SIMPLE_STEPS: TutorialStep[] = [
  {
    type: 'setup',
    id: 'paycheck-mode',
    setupType: 'paycheck-mode' as 'income',
  },
  {
    type: 'setup',
    id: 'simple-split',
    setupType: 'simple-split' as 'income',
  },
  {
    type: 'setup',
    id: 'simple-confirmation',
    setupType: 'simple-confirmation' as 'income',
  },
]

/**
 * Builds the paycheck path step list based on the selected mode.
 * Task 217: Supports 'full' (schedule+allocation) and 'simple' (just split) modes.
 */
export function buildPaycheckSteps(paycheckMode?: 'full' | 'simple'): TutorialStep[] {
  if (paycheckMode === 'simple') return PAYCHECK_SIMPLE_STEPS
  return PAYCHECK_SETUP_STEPS
}

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
 * A fixed expense entry captured during the express onboarding path.
 */
export interface SetupFixedExpense {
  id: string
  label: string
  amount: number
  dueDay: number
  category: TransactionCategory
}

/**
 * State managed by the parent for the setup tail steps.
 * Passed into `TutorialSetupStepRenderer` via closure.
 */
export interface TutorialSetupState {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  categoryLimits: Record<string, string>
  /** Fixed expenses entered in the express path (task 214.2) */
  fixedExpenses: SetupFixedExpense[]
  /** Per-category period selection for weekly/monthly toggle (task 214.3) */
  categoryPeriods: Record<string, 'weekly' | 'monthly'>
  /** Paycheck path: pay schedule (task 216.1) */
  paySchedule?: { cadence: PayCadence; anchorDate: string; amount: number }
  /** Paycheck path: allocation split percentages (task 216.3) */
  allocationSplit?: { spend: number; save: number; invest: number; setAside: number }
  /** Paycheck path: mode selection — full (schedule+allocation) or simple (just split) (task 217) */
  paycheckMode?: 'full' | 'simple'
  /** Simple split path: cadence assumption for daily number calculation (task 217.2) */
  simpleCadence?: 'weekly' | 'biweekly' | 'monthly'
}

/**
 * Computes the daily allowance from setup state.
 * Formula: (monthlyIncome * (1 - savingsPercent/100) - totalFixedExpenses) / 30 (rounded)
 *
 * Task 214.4: Now accounts for fixed expenses so the preview is accurate.
 */
export function computeDailyAllowance(state: TutorialSetupState): number {
  const preset = BUDGET_PRESETS.find(p => p.value === state.budgetPreset)
  const savingsPercent = preset?.savingsPercent ?? 0
  const totalFixed = (state.fixedExpenses ?? []).reduce((sum, e) => sum + e.amount, 0)
  const spendable = state.monthlyIncome * (1 - savingsPercent / 100) - totalFixed
  return Math.max(0, Math.round(spendable / 30))
}

/**
 * Converts weekly limits to monthly and builds the OnboardingResult.
 * Task 214.3: Respects per-category period selections from categoryPeriods.
 */
export function buildOnboardingResult(state: TutorialSetupState): OnboardingResult {
  const toMonthly = (weekly: number) => Math.round(weekly * 4.33)
  const customLimits: Partial<Record<TransactionCategory, number>> = {}

  LIMIT_CATEGORIES.forEach(cat => {
    const raw = parseFloat(state.categoryLimits[cat.key] ?? '') || 0
    if (raw > 0) {
      // Use the per-category period override if available, otherwise fall back to the default
      const period = state.categoryPeriods?.[cat.key] ?? (cat.weekly ? 'weekly' : 'monthly')
      customLimits[cat.category] = period === 'weekly' ? toMonthly(raw) : raw
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
 * Task 215.2: Includes a collapsible "Not sure?" helper that offers
 * quick-estimate modes (hourly rate or weekly take-home) to compute monthly income.
 *
 * Validates: Requirement 7.2
 */
function SetupIncomeStep({ value, onChange }: SetupIncomeProps) {
  const [helperOpen, setHelperOpen] = useState(false)
  const [helperMode, setHelperMode] = useState<'hourly' | 'weekly' | null>(null)
  const [hourlyRate, setHourlyRate] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [weeklyAmount, setWeeklyAmount] = useState('')

  const WEEKS_PER_MONTH = 4.33

  const handleHourlyCompute = () => {
    const rate = parseFloat(hourlyRate) || 0
    const hours = parseFloat(hoursPerWeek) || 0
    if (rate > 0 && hours > 0) {
      const monthly = Math.round(rate * hours * WEEKS_PER_MONTH)
      onChange(monthly)
    }
  }

  const handleWeeklyCompute = () => {
    const weekly = parseFloat(weeklyAmount) || 0
    if (weekly > 0) {
      const monthly = Math.round(weekly * WEEKS_PER_MONTH)
      onChange(monthly)
    }
  }

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

      {/* Task 215.2: Collapsible income helper */}
      <div className="w-full mt-6">
        <button
          type="button"
          onClick={() => {
            setHelperOpen(!helperOpen)
            if (!helperOpen) setHelperMode(null)
          }}
          className="text-sm mx-auto block"
          style={{
            color: 'var(--accent)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: '4px 0',
          }}
          aria-expanded={helperOpen}
          aria-controls="income-helper-panel"
        >
          {helperOpen ? 'Hide helper ↑' : 'Not sure of your monthly income?'}
        </button>

        <AnimatePresence>
          {helperOpen && (
            <motion.div
              id="income-helper-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springs.gentle}
              className="overflow-hidden"
            >
              <div
                className="mt-3 p-4 rounded-xl text-left"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
              >
                <p
                  style={{ fontSize: 13, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', marginBottom: 12, textAlign: 'center' }}
                >
                  A rough guess is perfect — you can always adjust later.
                </p>

                {/* Mode selector */}
                {helperMode === null && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setHelperMode('hourly')}
                      className="w-full py-2.5 px-3 rounded-lg text-sm text-left"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'Inter, sans-serif',
                        cursor: 'pointer',
                        borderRadius: 8,
                      }}
                    >
                      💼 I know my hourly rate
                    </button>
                    <button
                      type="button"
                      onClick={() => setHelperMode('weekly')}
                      className="w-full py-2.5 px-3 rounded-lg text-sm text-left"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'Inter, sans-serif',
                        cursor: 'pointer',
                        borderRadius: 8,
                      }}
                    >
                      📅 I know my weekly take-home
                    </button>
                  </div>
                )}

                {/* Hourly rate mode */}
                {helperMode === 'hourly' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>$/hr</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="15"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="flex-1 py-2 px-3 rounded-lg text-sm"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'Inter, sans-serif',
                          outline: 'none',
                          borderRadius: 8,
                        }}
                        aria-label="Hourly rate"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>hrs/wk</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="20"
                        value={hoursPerWeek}
                        onChange={(e) => setHoursPerWeek(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="flex-1 py-2 px-3 rounded-lg text-sm"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'Inter, sans-serif',
                          outline: 'none',
                          borderRadius: 8,
                        }}
                        aria-label="Hours per week"
                      />
                    </div>
                    {parseFloat(hourlyRate) > 0 && parseFloat(hoursPerWeek) > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                        ≈ ${Math.round(parseFloat(hourlyRate) * parseFloat(hoursPerWeek) * WEEKS_PER_MONTH).toLocaleString()}/mo
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setHelperMode(null)}
                        className="flex-1 py-2 rounded-lg text-sm"
                        style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleHourlyCompute}
                        disabled={!parseFloat(hourlyRate) || !parseFloat(hoursPerWeek)}
                        className="flex-1 py-2 rounded-lg text-sm font-medium"
                        style={{
                          background: (parseFloat(hourlyRate) && parseFloat(hoursPerWeek)) ? 'var(--accent)' : 'var(--muted)',
                          color: '#fff',
                          fontFamily: 'Inter, sans-serif',
                          opacity: (parseFloat(hourlyRate) && parseFloat(hoursPerWeek)) ? 1 : 0.5,
                          borderRadius: 8,
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  </div>
                )}

                {/* Weekly take-home mode */}
                {helperMode === 'weekly' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>$/wk</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="500"
                        value={weeklyAmount}
                        onChange={(e) => setWeeklyAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="flex-1 py-2 px-3 rounded-lg text-sm"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'Inter, sans-serif',
                          outline: 'none',
                          borderRadius: 8,
                        }}
                        aria-label="Weekly take-home amount"
                      />
                    </div>
                    {parseFloat(weeklyAmount) > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                        ≈ ${Math.round(parseFloat(weeklyAmount) * WEEKS_PER_MONTH).toLocaleString()}/mo
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setHelperMode(null)}
                        className="flex-1 py-2 rounded-lg text-sm"
                        style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleWeeklyCompute}
                        disabled={!parseFloat(weeklyAmount)}
                        className="flex-1 py-2 rounded-lg text-sm font-medium"
                        style={{
                          background: parseFloat(weeklyAmount) ? 'var(--accent)' : 'var(--muted)',
                          color: '#fff',
                          fontFamily: 'Inter, sans-serif',
                          opacity: parseFloat(weeklyAmount) ? 1 : 0.5,
                          borderRadius: 8,
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
// Express Path Components (Task 214)
// ============================================================================

/**
 * Live daily-number preview banner — visible on every express step.
 * Updates reactively as the user fills in income, expenses, and budgets.
 *
 * Validates: Requirement 7.4 (task 214.4)
 */
function DailyNumberPreview({ dailyAllowance }: { dailyAllowance: number }) {
  return (
    <div
      className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl mb-5"
      style={{
        background: 'rgba(129, 140, 248, 0.08)',
        border: '1px solid rgba(129, 140, 248, 0.2)',
      }}
      aria-live="polite"
      aria-label={`Estimated daily budget: $${dailyAllowance}`}
    >
      <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--sub)' }}>
        Your daily number
      </span>
      <span
        className="tabular-nums"
        style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--accent)' }}
      >
        ${dailyAllowance}/day
      </span>
    </div>
  )
}

interface ExpressIncomeStepProps {
  value: number
  onChange: (value: number) => void
  dailyAllowance: number
}

/**
 * Express income step — typed numeric input + slider that stay in sync.
 * Accepts exact amounts (not just the slider's 100-step increments).
 *
 * Validates: Requirement 7.2 (task 214.1)
 */
function ExpressIncomeStep({ value, onChange, dailyAllowance }: ExpressIncomeStepProps) {
  const [textValue, setTextValue] = useState(value.toString())

  // Sync text field when slider changes
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value)
    onChange(num)
    setTextValue(num.toString())
  }

  // Handle typed input
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setTextValue(raw)
    const num = parseInt(raw, 10) || 0
    onChange(Math.min(num, 99999))
  }

  // Clamp on blur
  const handleBlur = () => {
    const num = parseInt(textValue, 10) || 0
    const clamped = Math.max(0, Math.min(num, 99999))
    onChange(clamped)
    setTextValue(clamped.toString())
  }

  return (
    <div className="flex flex-col items-center text-center">
      <DailyNumberPreview dailyAllowance={dailyAllowance} />

      <div className="text-4xl mb-4" role="img" aria-label="money">
        💰
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        What&apos;s your monthly income?
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24, lineHeight: 1.5 }}
      >
        A rough number is fine — change it anytime.
      </p>

      {/* Typed numeric input */}
      <div className="flex items-center gap-2 mb-5 w-full max-w-[200px]">
        <span style={{ fontSize: 22, color: 'var(--muted)', fontWeight: 600 }}>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          className="flex-1 py-2.5 px-3 rounded-lg text-center text-2xl font-bold tabular-nums"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
          aria-label="Monthly income amount"
        />
      </div>

      {/* Slider assist */}
      <input
        type="range"
        min={0}
        max={15000}
        step={50}
        value={Math.min(value, 15000)}
        onChange={handleSliderChange}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) ${(Math.min(value, 15000) / 15000) * 100}%, var(--line) ${(Math.min(value, 15000) / 15000) * 100}%)`,
        }}
        aria-label="Monthly income slider"
      />
      <div
        className="flex justify-between w-full mt-2 text-xs"
        style={{ color: 'var(--muted)' }}
      >
        <span>$0</span>
        <span>$15,000</span>
      </div>
    </div>
  )
}

interface ExpressFixedExpensesStepProps {
  expenses: SetupFixedExpense[]
  onAdd: (expense: SetupFixedExpense) => void
  onRemove: (id: string) => void
  dailyAllowance: number
}

/**
 * Compact fixed-expense capture — an add-list for rent/subscriptions/bills.
 * These amounts are sunk from the pool before daily division.
 *
 * Validates: Requirement new (task 214.2)
 */
function ExpressFixedExpensesStep({ expenses, onAdd, onRemove, dailyAllowance }: ExpressFixedExpensesStepProps) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [showForm, setShowForm] = useState(false)

  const totalFixed = expenses.reduce((sum, e) => sum + e.amount, 0)

  const handleAdd = () => {
    const parsedAmount = parseFloat(amount) || 0
    const parsedDay = parseInt(dueDay, 10) || 1
    if (!label.trim() || parsedAmount <= 0) return

    onAdd({
      id: crypto.randomUUID(),
      label: label.trim(),
      amount: parsedAmount,
      dueDay: Math.max(1, Math.min(31, parsedDay)),
      category: 'rent',
    })
    setLabel('')
    setAmount('')
    setDueDay('')
    setShowForm(false)
  }

  return (
    <div className="flex flex-col items-center text-center">
      <DailyNumberPreview dailyAllowance={dailyAllowance} />

      <div className="text-4xl mb-4" role="img" aria-label="bills">
        🧾
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        Any fixed monthly bills?
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 20, lineHeight: 1.5 }}
      >
        Rent, subscriptions, utilities — these get subtracted before your daily number is calculated.
      </p>

      {/* Expense list */}
      {expenses.length > 0 && (
        <div className="w-full flex flex-col gap-2 mb-4">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col text-left">
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  {exp.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
                  Due day {exp.dueDay}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  ${exp.amount}
                </span>
                <button
                  onClick={() => onRemove(exp.id)}
                  className="p-1 rounded"
                  style={{ color: 'var(--muted)' }}
                  aria-label={`Remove ${exp.label}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div className="text-right" style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
            Total: ${totalFixed}/mo
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div
          className="w-full flex flex-col gap-2.5 p-3 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <input
            type="text"
            placeholder="Label (e.g. Rent)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            aria-label="Expense label"
          />
          <div className="flex gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="flex-1 py-2 px-3 rounded-lg text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', outline: 'none' }}
                aria-label="Monthly amount"
              />
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Day (1-31)"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-24 py-2 px-3 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', outline: 'none' }}
              aria-label="Due day of month"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!label.trim() || !amount}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{
                background: label.trim() && amount ? 'var(--accent)' : 'var(--muted)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                opacity: label.trim() && amount ? 1 : 0.5,
                borderRadius: 8,
              }}
              aria-label="Add expense"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl text-sm font-medium"
          style={{
            background: 'var(--surface)',
            border: '1.5px dashed var(--border)',
            color: 'var(--sub)',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            borderRadius: 12,
          }}
          aria-label="Add a fixed expense"
        >
          + Add a bill
        </button>
      )}

      {expenses.length === 0 && !showForm && (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', marginTop: 12 }}>
          No worries if you skip this — you can add bills later from Settings.
        </p>
      )}
    </div>
  )
}

interface ExpressCategoryLimitsStepProps {
  values: Record<string, string>
  periods: Record<string, 'weekly' | 'monthly'>
  onValueChange: (key: string, value: string) => void
  onPeriodChange: (key: string, period: 'weekly' | 'monthly') => void
  dailyAllowance: number
}

/**
 * Enhanced category limits with per-row weekly/monthly toggle.
 * When toggled to monthly, user types the monthly amount directly.
 * When weekly, shows the ≈ monthly equivalent.
 *
 * Validates: Requirement 7.3 (task 214.3)
 */
function ExpressCategoryLimitsStep({ values, periods, onValueChange, onPeriodChange, dailyAllowance }: ExpressCategoryLimitsStepProps) {
  const toMonthly = (weekly: number) => Math.round(weekly * 4.33)
  const toWeekly = (monthly: number) => Math.round(monthly / 4.33)

  return (
    <div className="flex flex-col">
      <DailyNumberPreview dailyAllowance={dailyAllowance} />

      <div className="text-center mb-5">
        <div className="text-4xl mb-3" role="img" aria-label="limits">
          🎯
        </div>
        <h2
          style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
        >
          Set category budgets
        </h2>
        <p
          style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', lineHeight: 1.5 }}
        >
          Optional — leave blank to skip any category.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {LIMIT_CATEGORIES.filter(c => c.key !== 'rent').map((cat) => {
          const period = periods[cat.key] ?? (cat.weekly ? 'weekly' : 'monthly')
          const val = values[cat.key] ?? ''
          const numVal = parseFloat(val) || 0
          const hint = period === 'weekly' && numVal > 0
            ? `≈ $${toMonthly(numVal)}/mo`
            : period === 'monthly' && numVal > 0
              ? `≈ $${toWeekly(numVal)}/wk`
              : null

          return (
            <div key={cat.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="flex items-center gap-2"
                  style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--text)', fontWeight: 500 }}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label.replace(/ per week$/, '')}</span>
                </label>
                {/* Weekly/Monthly toggle */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => onPeriodChange(cat.key, 'weekly')}
                    className="px-2.5 py-1 text-xs"
                    style={{
                      background: period === 'weekly' ? 'var(--accent)' : 'transparent',
                      color: period === 'weekly' ? '#fff' : 'var(--muted)',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                    }}
                    aria-label={`Set ${cat.label} to weekly`}
                    aria-pressed={period === 'weekly'}
                  >
                    /wk
                  </button>
                  <button
                    onClick={() => onPeriodChange(cat.key, 'monthly')}
                    className="px-2.5 py-1 text-xs"
                    style={{
                      background: period === 'monthly' ? 'var(--accent)' : 'transparent',
                      color: period === 'monthly' ? '#fff' : 'var(--muted)',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                    }}
                    aria-label={`Set ${cat.label} to monthly`}
                    aria-pressed={period === 'monthly'}
                  >
                    /mo
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16, color: 'var(--muted)' }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={period === 'weekly' ? cat.placeholder : String(toMonthly(parseInt(cat.placeholder, 10) || 0))}
                  value={val}
                  onChange={(e) => onValueChange(cat.key, e.target.value.replace(/[^0-9.]/g, ''))}
                  className="flex-1 py-2 px-3 rounded-lg text-base"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                  aria-label={`${cat.label} budget amount`}
                />
                {hint && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {hint}
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

interface ExpressConfirmationStepProps {
  setupState: TutorialSetupState
  dailyAllowance: number
}

/**
 * Express confirmation step — shows the live daily number as the payoff.
 *
 * Validates: Requirements 7.4, 7.7 (task 214.4)
 */
function ExpressConfirmationStep({ setupState, dailyAllowance }: ExpressConfirmationStepProps) {
  const totalFixed = (setupState.fixedExpenses ?? []).reduce((sum, e) => sum + e.amount, 0)
  const preset = BUDGET_PRESETS.find(p => p.value === setupState.budgetPreset)
  const savingsPercent = preset?.savingsPercent ?? 0

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="sparkles">
        ✨
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        Here&apos;s your daily number
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24 }}
      >
        This is how much you can safely spend each day.
      </p>

      {/* Hero daily allowance */}
      <div
        className="rounded-2xl p-6 mb-5 w-full"
        style={{ background: 'var(--surface)', border: '1.5px solid rgba(129, 140, 248, 0.3)' }}
      >
        <div
          className="text-5xl font-bold mb-1 tabular-nums"
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

      {/* Breakdown summary */}
      <div
        className="w-full rounded-xl p-4 text-left"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Monthly income</span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            ${setupState.monthlyIncome.toLocaleString()}
          </span>
        </div>
        {savingsPercent > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Savings ({savingsPercent}%)</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
              −${Math.round(setupState.monthlyIncome * savingsPercent / 100).toLocaleString()}
            </span>
          </div>
        )}
        {totalFixed > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
              Fixed bills ({setupState.fixedExpenses.length})
            </span>
            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
              −${totalFixed.toLocaleString()}
            </span>
          </div>
        )}
        <div
          className="flex justify-between items-center pt-2 mt-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}>Daily spending pool</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}>
            ${dailyAllowance}/day
          </span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', marginTop: 16 }}>
        You can always tweak these numbers in Settings.
      </p>
    </div>
  )
}

// ============================================================================
// Paycheck Path Components (Task 216 — Group 34)
// ============================================================================

/** Cadence options for the pay schedule step */
const CADENCE_OPTIONS: { value: PayCadence; label: string; emoji: string; description: string }[] = [
  { value: 'weekly', label: 'Weekly', emoji: '📅', description: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks', emoji: '📆', description: 'Most common' },
  { value: 'semimonthly', label: 'Twice a month', emoji: '🗓️', description: '1st & 15th, etc.' },
  { value: 'monthly', label: 'Monthly', emoji: '📋', description: 'Once a month' },
  { value: 'irregular', label: 'Irregular / gig', emoji: '🌊', description: 'It varies' },
]

/** Allocation presets for the paycheck path (matches PaycheckSheet pattern) */
const PAYCHECK_ALLOCATION_PRESETS: { label: string; emoji: string; split: [number, number, number, number] }[] = [
  { label: 'Student', emoji: '🎓', split: [80, 10, 5, 5] },
  { label: 'Saver', emoji: '🐷', split: [70, 15, 10, 5] },
  { label: 'Balanced', emoji: '⚖️', split: [60, 20, 10, 10] },
]

interface PayScheduleStepProps {
  value: { cadence: PayCadence; anchorDate: string; amount: number }
  onChange: (schedule: { cadence: PayCadence; anchorDate: string; amount: number }) => void
  /** Task 217.3: callback to switch to simple mode */
  onSwitchToSimple?: () => void
}

/**
 * Paycheck schedule step — collects cadence, anchor payday date, and expected amount.
 * For irregular cadence, the anchor date is optional (task 216.4).
 *
 * Validates: Requirements 7.2, new (task 216.1)
 */
function PayScheduleStep({ value, onChange, onSwitchToSimple }: PayScheduleStepProps) {
  const [amountText, setAmountText] = useState(value.amount > 0 ? value.amount.toString() : '')

  const isIrregular = value.cadence === 'irregular'

  const handleCadenceChange = (cadence: PayCadence) => {
    onChange({ ...value, cadence })
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, anchorDate: e.target.value })
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setAmountText(raw)
    const num = parseFloat(raw) || 0
    onChange({ ...value, amount: num })
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="paycheck">
        💵
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        When do you get paid?
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24, lineHeight: 1.5 }}
      >
        We&apos;ll align your daily number to your pay cycle — no more running out before payday.
      </p>

      {/* Cadence selector */}
      <div className="w-full flex flex-col gap-2 mb-5">
        {CADENCE_OPTIONS.map((opt) => {
          const isSelected = value.cadence === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleCadenceChange(opt.value)}
              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? 'var(--accent-muted)' : 'var(--surface)',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.25)' : 'none',
                cursor: 'pointer',
              }}
              aria-pressed={isSelected}
            >
              <span className="text-lg flex-shrink-0">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
                  {opt.description}
                </div>
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

      {/* Anchor date (skip for irregular) */}
      {!isIrregular && (
        <div className="w-full mb-4">
          <label
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 6, textAlign: 'left' }}
          >
            Your most recent payday
          </label>
          <input
            type="date"
            value={value.anchorDate}
            onChange={handleDateChange}
            className="w-full py-2.5 px-3 rounded-lg text-base"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              borderRadius: 8,
            }}
            aria-label="Most recent payday date"
          />
        </div>
      )}

      {isIrregular && (
        <div
          className="w-full mb-4 p-3 rounded-xl text-left"
          style={{ background: 'rgba(129, 140, 248, 0.06)', border: '1px solid rgba(129, 140, 248, 0.15)', borderRadius: 12 }}
        >
          <p style={{ fontSize: 13, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            No worries — we&apos;ll use a trailing average of your income to smooth things out and show you a &quot;usually $X–$Y&quot; range.
          </p>
        </div>
      )}

      {/* Expected paycheck amount */}
      <div className="w-full">
        <label
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 6, textAlign: 'left' }}
        >
          {isIrregular ? 'Typical paycheck (rough estimate)' : 'Expected paycheck amount'}
        </label>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 600 }}>$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder={isIrregular ? '~800' : '1200'}
            value={amountText}
            onChange={handleAmountChange}
            className="flex-1 py-2.5 px-3 rounded-lg text-lg font-medium tabular-nums"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              borderRadius: 8,
            }}
            aria-label="Expected paycheck amount"
          />
        </div>
      </div>

      {/* Task 217.3: Switch to simple mode */}
      {onSwitchToSimple && (
        <button
          type="button"
          onClick={onSwitchToSimple}
          className="text-sm mt-5"
          style={{
            color: 'var(--accent)',
            fontFamily: 'Inter, sans-serif',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Just split my paycheck simply →
        </button>
      )}
    </div>
  )
}

interface AllocationSplitStepProps {
  value: { spend: number; save: number; invest: number; setAside: number }
  onChange: (split: { spend: number; save: number; invest: number; setAside: number }) => void
  paycheckAmount: number
}

/** Bucket metadata for the allocation step */
const ALLOC_BUCKETS: { key: 'spend' | 'save' | 'invest' | 'setAside'; label: string; emoji: string; color: string }[] = [
  { key: 'spend', label: 'Spend', emoji: '💸', color: 'var(--text)' },
  { key: 'save', label: 'Save', emoji: '🏦', color: 'var(--success)' },
  { key: 'invest', label: 'Invest', emoji: '📈', color: '#818cf8' },
  { key: 'setAside', label: 'Set Aside', emoji: '🎯', color: 'var(--warning)' },
]

/**
 * Allocation split step — lets the user split their paycheck into
 * spend/save/invest/setAside buckets using preset or custom percentages.
 * The "spend" bucket feeds the discretionary pool (task 216.3).
 *
 * Validates: Requirements 3.1, new (task 216.3)
 */
function AllocationSplitStep({ value, onChange, paycheckAmount }: AllocationSplitStepProps) {
  const [activePreset, setActivePreset] = useState<number | null>(() => {
    // Check if current value matches a preset
    const idx = PAYCHECK_ALLOCATION_PRESETS.findIndex(
      p => p.split[0] === value.spend && p.split[1] === value.save && p.split[2] === value.invest && p.split[3] === value.setAside
    )
    return idx >= 0 ? idx : null
  })

  const handlePresetSelect = (idx: number) => {
    setActivePreset(idx)
    const [spend, save, invest, setAside] = PAYCHECK_ALLOCATION_PRESETS[idx].split
    onChange({ spend, save, invest, setAside })
  }

  const handleSliderChange = (key: 'spend' | 'save' | 'invest' | 'setAside', newVal: number) => {
    // Adjust the "spend" bucket to keep total at 100
    const otherKeys = ALLOC_BUCKETS.map(b => b.key).filter(k => k !== key && k !== 'spend') as ('save' | 'invest' | 'setAside')[]
    const othersTotal = otherKeys.reduce((sum, k) => sum + value[k], 0)
    const spendVal = key === 'spend' ? newVal : Math.max(0, 100 - newVal - othersTotal)
    const updated = { ...value, [key]: newVal, spend: spendVal }

    // If adjusting a non-spend key and total exceeds 100, cap
    const total = updated.spend + updated.save + updated.invest + updated.setAside
    if (total !== 100) {
      updated.spend = Math.max(0, 100 - updated.save - updated.invest - updated.setAside)
    }

    setActivePreset(null)
    onChange(updated)
  }

  const total = value.spend + value.save + value.invest + value.setAside
  const spendDollars = paycheckAmount > 0 ? Math.round(paycheckAmount * value.spend / 100) : 0

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="split">
        🪣
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        Split your paycheck
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 20, lineHeight: 1.5 }}
      >
        Your &quot;Spend&quot; bucket becomes your daily number. The rest is set aside automatically.
      </p>

      {/* Preset chips */}
      <div className="flex gap-2 mb-5 w-full justify-center flex-wrap">
        {PAYCHECK_ALLOCATION_PRESETS.map((preset, idx) => {
          const isActive = activePreset === idx
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetSelect(idx)}
              className="px-3.5 py-2 rounded-full text-sm font-medium"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
              aria-pressed={isActive}
            >
              {preset.emoji} {preset.label}
            </button>
          )
        })}
      </div>

      {/* Bucket sliders */}
      <div className="w-full flex flex-col gap-4">
        {ALLOC_BUCKETS.map((bucket) => {
          const pct = value[bucket.key]
          const dollars = paycheckAmount > 0 ? Math.round(paycheckAmount * pct / 100) : 0
          return (
            <div key={bucket.key} className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 13, fontWeight: 500, color: bucket.color, fontFamily: 'Inter, sans-serif' }}>
                  {bucket.emoji} {bucket.label}
                </span>
                <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  {pct}%{paycheckAmount > 0 && ` · $${dollars}`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={(e) => handleSliderChange(bucket.key, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${bucket.color} ${pct}%, var(--line) ${pct}%)`,
                }}
                aria-label={`${bucket.label} percentage`}
              />
            </div>
          )
        })}
      </div>

      {/* Total check */}
      {total !== 100 && (
        <p style={{ fontSize: 12, color: 'var(--warning)', fontFamily: 'Inter, sans-serif', marginTop: 8 }}>
          Total is {total}% — should be 100%
        </p>
      )}

      {/* Spend preview */}
      {paycheckAmount > 0 && (
        <div
          className="w-full mt-4 px-4 py-2.5 rounded-xl flex items-center justify-between"
          style={{
            background: 'rgba(129, 140, 248, 0.08)',
            border: '1px solid rgba(129, 140, 248, 0.2)',
          }}
          aria-live="polite"
        >
          <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--sub)' }}>
            Spending pool
          </span>
          <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--accent)' }}>
            ${spendDollars}
          </span>
        </div>
      )}
    </div>
  )
}

interface PaycheckConfirmationStepProps {
  setupState: TutorialSetupState
}

/**
 * Paycheck confirmation step — shows the payday-aligned daily number.
 * Uses the pay schedule + allocation to compute a realistic daily figure
 * that reflects the current pay period.
 *
 * Validates: Requirements 7.4, new (task 216.2)
 */
function PaycheckConfirmationStep({ setupState }: PaycheckConfirmationStepProps) {
  const schedule = setupState.paySchedule
  const allocation = setupState.allocationSplit ?? { spend: 80, save: 10, invest: 5, setAside: 5 }
  const paycheckAmount = schedule?.amount ?? 0
  const spendPercent = allocation.spend
  const spendPool = Math.round(paycheckAmount * spendPercent / 100)
  const isIrregular = schedule?.cadence === 'irregular'

  // Estimate days in the pay cycle for the daily number preview
  const cycleDays = (() => {
    switch (schedule?.cadence) {
      case 'weekly': return 7
      case 'biweekly': return 14
      case 'semimonthly': return 15
      case 'monthly': return 30
      case 'irregular': return 14 // fallback
      default: return 14
    }
  })()

  const dailyNumber = spendPool > 0 ? Math.round(spendPool / cycleDays) : 0

  // Monthly equivalent for display
  const monthlyEquivalent = (() => {
    switch (schedule?.cadence) {
      case 'weekly': return paycheckAmount * 4.33
      case 'biweekly': return paycheckAmount * 2.17
      case 'semimonthly': return paycheckAmount * 2
      case 'monthly': return paycheckAmount
      case 'irregular': return paycheckAmount * 2.17 // estimate
      default: return paycheckAmount
    }
  })()

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="sparkles">
        ✨
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        You&apos;re all set!
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24, lineHeight: 1.5 }}
      >
        {isIrregular
          ? "Your daily number will smooth out over time as we learn your rhythm."
          : "Your daily number resets every payday — no more end-of-month panic."
        }
      </p>

      {/* Hero daily number */}
      <div
        className="rounded-2xl p-6 mb-5 w-full"
        style={{ background: 'var(--surface)', border: '1.5px solid rgba(129, 140, 248, 0.3)' }}
      >
        <div
          className="text-5xl font-bold mb-1 tabular-nums"
          style={{ color: 'var(--accent)' }}
          aria-label={`Daily allowance: $${dailyNumber}`}
        >
          {isIrregular ? `~$${dailyNumber}` : `$${dailyNumber}`}
        </div>
        <div className="text-sm" style={{ color: 'var(--sub)' }}>
          per day to spend
        </div>
        {isIrregular && (
          <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            This will adjust as we track your income
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div
        className="w-full rounded-xl p-4 text-left"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Paycheck</span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            ${paycheckAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Pay cadence</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            {CADENCE_OPTIONS.find(c => c.value === schedule?.cadence)?.label ?? 'Biweekly'}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Spend ({spendPercent}%)</span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            ${spendPool.toLocaleString()} per cycle
          </span>
        </div>
        <div
          className="flex justify-between items-center pt-2 mt-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}>
            ÷ {cycleDays} days
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}>
            {isIrregular ? '~' : ''}${dailyNumber}/day
          </span>
        </div>
      </div>

      {monthlyEquivalent > 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', marginTop: 12 }}>
          ≈ ${Math.round(monthlyEquivalent).toLocaleString()}/mo · You can tweak all of this in Settings.
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Simple Bucket Split Components (Task 217 — backup within Path C)
// ============================================================================

interface PaycheckModeStepProps {
  mode: 'full' | 'simple'
  onModeChange: (mode: 'full' | 'simple') => void
}

/**
 * Mode selection step — first step in the paycheck path.
 * Lets the user choose between full schedule setup and a simple split.
 *
 * Validates: Requirements 3.1, new (task 217.1, 217.3)
 */
function PaycheckModeStep({ mode, onModeChange }: PaycheckModeStepProps) {
  const options: { value: 'full' | 'simple'; label: string; emoji: string; description: string }[] = [
    { value: 'full', label: 'Set up my pay schedule', emoji: '📅', description: 'Track cadence, paydays, and allocation — most accurate' },
    { value: 'simple', label: 'Just split my paycheck simply', emoji: '🪣', description: 'Pick a preset split and get a daily number instantly' },
  ]

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="paycheck">
        💵
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        How would you like to set up?
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24, lineHeight: 1.5 }}
      >
        Both paths give you a daily number — pick what feels right. You can always switch later.
      </p>

      <div className="w-full flex flex-col gap-3">
        {options.map((opt) => {
          const isSelected = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onModeChange(opt.value)}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? 'var(--accent-muted)' : 'var(--surface)',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.25)' : 'none',
                cursor: 'pointer',
                borderRadius: 12,
              }}
              aria-pressed={isSelected}
            >
              <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                  {opt.description}
                </div>
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

/** Simple cadence options for the simple split path (task 217.2) */
const SIMPLE_CADENCE_OPTIONS: { value: 'weekly' | 'biweekly' | 'monthly'; label: string; days: number }[] = [
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Every 2 weeks', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
]

interface SimpleSplitStepProps {
  amount: number
  onAmountChange: (amount: number) => void
  allocation: { spend: number; save: number; invest: number; setAside: number }
  onAllocationChange: (split: { spend: number; save: number; invest: number; setAside: number }) => void
  cadence: 'weekly' | 'biweekly' | 'monthly'
  onCadenceChange: (cadence: 'weekly' | 'biweekly' | 'monthly') => void
  onSwitchToFull: () => void
}

/**
 * Simple split step — enter paycheck amount, pick a preset, see daily number.
 * No schedule modeling required. The "spend" bucket + cadence assumption
 * yields a per-day figure immediately (task 217.2).
 *
 * Validates: Requirements 3.1, new (task 217.1, 217.2)
 */
function SimpleSplitStep({
  amount,
  onAmountChange,
  allocation,
  onAllocationChange,
  cadence,
  onCadenceChange,
  onSwitchToFull,
}: SimpleSplitStepProps) {
  const [amountText, setAmountText] = useState(amount > 0 ? amount.toString() : '')
  const [activePreset, setActivePreset] = useState<number | null>(() => {
    const idx = PAYCHECK_ALLOCATION_PRESETS.findIndex(
      p => p.split[0] === allocation.spend && p.split[1] === allocation.save && p.split[2] === allocation.invest && p.split[3] === allocation.setAside
    )
    return idx >= 0 ? idx : null
  })

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setAmountText(raw)
    onAmountChange(parseFloat(raw) || 0)
  }

  const handlePresetSelect = (idx: number) => {
    setActivePreset(idx)
    const [spend, save, invest, setAside] = PAYCHECK_ALLOCATION_PRESETS[idx].split
    onAllocationChange({ spend, save, invest, setAside })
  }

  const handleSliderChange = (key: 'spend' | 'save' | 'invest' | 'setAside', newVal: number) => {
    const otherKeys = ALLOC_BUCKETS.map(b => b.key).filter(k => k !== key && k !== 'spend') as ('save' | 'invest' | 'setAside')[]
    const othersTotal = otherKeys.reduce((sum, k) => sum + allocation[k], 0)
    const updated = { ...allocation, [key]: newVal }
    const total = updated.spend + updated.save + updated.invest + updated.setAside
    if (total !== 100) {
      updated.spend = Math.max(0, 100 - updated.save - updated.invest - updated.setAside)
    }
    setActivePreset(null)
    onAllocationChange(updated)
  }

  // Daily number calculation (task 217.2)
  const cycleDays = SIMPLE_CADENCE_OPTIONS.find(c => c.value === cadence)?.days ?? 14
  const spendPool = amount > 0 ? Math.round(amount * allocation.spend / 100) : 0
  const dailyNumber = spendPool > 0 ? Math.round(spendPool / cycleDays) : 0

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="split">
        🪣
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        Split your paycheck
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 20, lineHeight: 1.5 }}
      >
        A rough number is fine — you can change it anytime.
      </p>

      {/* Paycheck amount input */}
      <div className="w-full mb-5">
        <label
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 6, textAlign: 'left' }}
        >
          Paycheck amount
        </label>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 600 }}>$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1200"
            value={amountText}
            onChange={handleAmountChange}
            className="flex-1 py-2.5 px-3 rounded-lg text-lg font-medium tabular-nums"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              borderRadius: 8,
            }}
            aria-label="Paycheck amount"
          />
        </div>
      </div>

      {/* Cadence assumption (task 217.2) */}
      <div className="w-full mb-5">
        <label
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 6, textAlign: 'left' }}
        >
          How often do you get paid?
        </label>
        <div className="flex gap-2">
          {SIMPLE_CADENCE_OPTIONS.map((opt) => {
            const isActive = cadence === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCadenceChange(opt.value)}
                className="flex-1 py-2 px-2 rounded-lg text-sm font-medium"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface)',
                  color: isActive ? '#fff' : 'var(--text)',
                  border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  borderRadius: 8,
                }}
                aria-pressed={isActive}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex gap-2 mb-4 w-full justify-center flex-wrap">
        {PAYCHECK_ALLOCATION_PRESETS.map((preset, idx) => {
          const isActive = activePreset === idx
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetSelect(idx)}
              className="px-3.5 py-2 rounded-full text-sm font-medium"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
              aria-pressed={isActive}
            >
              {preset.emoji} {preset.label}
            </button>
          )
        })}
      </div>

      {/* Bucket sliders */}
      <div className="w-full flex flex-col gap-3 mb-4">
        {ALLOC_BUCKETS.map((bucket) => {
          const pct = allocation[bucket.key]
          const dollars = amount > 0 ? Math.round(amount * pct / 100) : 0
          return (
            <div key={bucket.key} className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 13, fontWeight: 500, color: bucket.color, fontFamily: 'Inter, sans-serif' }}>
                  {bucket.emoji} {bucket.label}
                </span>
                <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                  {pct}%{amount > 0 && ` · $${dollars}`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={(e) => handleSliderChange(bucket.key, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${bucket.color} ${pct}%, var(--line) ${pct}%)`,
                }}
                aria-label={`${bucket.label} percentage`}
              />
            </div>
          )
        })}
      </div>

      {/* Live daily number preview (task 217.2) */}
      {amount > 0 && (
        <div
          className="w-full px-4 py-3 rounded-xl flex items-center justify-between mb-4"
          style={{
            background: 'rgba(129, 140, 248, 0.08)',
            border: '1px solid rgba(129, 140, 248, 0.2)',
            borderRadius: 12,
          }}
          aria-live="polite"
        >
          <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--sub)' }}>
            Your daily number
          </span>
          <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--accent)' }}>
            ${dailyNumber}/day
          </span>
        </div>
      )}

      {/* Switch to full mode (task 217.3) */}
      <button
        type="button"
        onClick={onSwitchToFull}
        className="text-sm mt-1"
        style={{
          color: 'var(--accent)',
          fontFamily: 'Inter, sans-serif',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        Need more control? Set up my pay schedule →
      </button>
    </div>
  )
}

interface SimpleConfirmationStepProps {
  amount: number
  allocation: { spend: number; save: number; invest: number; setAside: number }
  cadence: 'weekly' | 'biweekly' | 'monthly'
}

/**
 * Simple confirmation step — shows the daily number derived from the simple split.
 * No payday-alignment talk, just "Your paycheck of $X split at Y% = $Z/day".
 *
 * Validates: Requirements 7.4, new (task 217.2)
 */
function SimpleConfirmationStep({ amount, allocation, cadence }: SimpleConfirmationStepProps) {
  const cycleDays = SIMPLE_CADENCE_OPTIONS.find(c => c.value === cadence)?.days ?? 14
  const spendPool = Math.round(amount * allocation.spend / 100)
  const dailyNumber = spendPool > 0 ? Math.round(spendPool / cycleDays) : 0
  const cadenceLabel = SIMPLE_CADENCE_OPTIONS.find(c => c.value === cadence)?.label ?? 'Biweekly'

  // Monthly equivalent for context
  const monthlyMultiplier = cadence === 'weekly' ? 4.33 : cadence === 'biweekly' ? 2.17 : 1
  const monthlyEquivalent = Math.round(amount * monthlyMultiplier)

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-4xl mb-4" role="img" aria-label="sparkles">
        ✨
      </div>
      <h2
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text)', marginBottom: 8 }}
      >
        You&apos;re all set!
      </h2>
      <p
        style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--sub)', marginBottom: 24, lineHeight: 1.5 }}
      >
        Your spending money, divided into a simple daily number.
      </p>

      {/* Hero daily number */}
      <div
        className="rounded-2xl p-6 mb-5 w-full"
        style={{ background: 'var(--surface)', border: '1.5px solid rgba(129, 140, 248, 0.3)' }}
      >
        <div
          className="text-5xl font-bold mb-1 tabular-nums"
          style={{ color: 'var(--accent)' }}
          aria-label={`Daily allowance: $${dailyNumber}`}
        >
          ${dailyNumber}
        </div>
        <div className="text-sm" style={{ color: 'var(--sub)' }}>
          per day to spend
        </div>
      </div>

      {/* Breakdown */}
      <div
        className="w-full rounded-xl p-4 text-left"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Paycheck</span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            ${amount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Paid</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            {cadenceLabel}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>Spend ({allocation.spend}%)</span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
            ${spendPool.toLocaleString()} per cycle
          </span>
        </div>
        <div
          className="flex justify-between items-center pt-2 mt-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--sub)', fontFamily: 'Inter, sans-serif' }}>
            ÷ {cycleDays} days
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}>
            ${dailyNumber}/day
          </span>
        </div>
      </div>

      {monthlyEquivalent > 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', marginTop: 12 }}>
          ≈ ${monthlyEquivalent.toLocaleString()}/mo · You can tweak all of this in Settings.
        </p>
      )}
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
  /** Express path: add a fixed expense (task 214.2) */
  onAddFixedExpense?: (expense: SetupFixedExpense) => void
  /** Express path: remove a fixed expense (task 214.2) */
  onRemoveFixedExpense?: (id: string) => void
  /** Express path: change category period (task 214.3) */
  onPeriodChange?: (key: string, period: 'weekly' | 'monthly') => void
  /** Paycheck path: update pay schedule (task 216.1) */
  onPayScheduleChange?: (schedule: { cadence: PayCadence; anchorDate: string; amount: number }) => void
  /** Paycheck path: update allocation split (task 216.3) */
  onAllocationSplitChange?: (split: { spend: number; save: number; invest: number; setAside: number }) => void
  /** Paycheck path: update paycheck mode — full or simple (task 217) */
  onPaycheckModeChange?: (mode: 'full' | 'simple') => void
  /** Paycheck path: update simple cadence assumption (task 217.2) */
  onSimpleCadenceChange?: (cadence: 'weekly' | 'biweekly' | 'monthly') => void
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
  onAddFixedExpense,
  onRemoveFixedExpense,
  onPeriodChange,
  onPayScheduleChange,
  onAllocationSplitChange,
  onPaycheckModeChange,
  onSimpleCadenceChange,
}: TutorialSetupStepRendererProps) {
  // Setup steps — render the appropriate form
  if (step.type === 'setup') {
    const dailyAllowance = computeDailyAllowance(setupState)

    // Express path steps (identified by step id prefix)
    if (step.id === 'express-income') {
      return (
        <ExpressIncomeStep
          value={setupState.monthlyIncome}
          onChange={onIncomeChange}
          dailyAllowance={dailyAllowance}
        />
      )
    }
    if (step.id === 'express-fixed-expenses') {
      return (
        <ExpressFixedExpensesStep
          expenses={setupState.fixedExpenses ?? []}
          onAdd={(expense) => onAddFixedExpense?.(expense)}
          onRemove={(id) => onRemoveFixedExpense?.(id)}
          dailyAllowance={dailyAllowance}
        />
      )
    }
    if (step.id === 'express-category-limits') {
      return (
        <ExpressCategoryLimitsStep
          values={setupState.categoryLimits}
          periods={setupState.categoryPeriods ?? {}}
          onValueChange={onLimitChange}
          onPeriodChange={(key, period) => onPeriodChange?.(key, period)}
          dailyAllowance={dailyAllowance}
        />
      )
    }
    if (step.id === 'express-confirmation') {
      return (
        <ExpressConfirmationStep
          setupState={setupState}
          dailyAllowance={dailyAllowance}
        />
      )
    }

    // Paycheck path steps (identified by step id prefix)
    if (step.id === 'paycheck-mode') {
      return (
        <PaycheckModeStep
          mode={setupState.paycheckMode ?? 'full'}
          onModeChange={(mode) => onPaycheckModeChange?.(mode)}
        />
      )
    }
    if (step.id === 'simple-split') {
      return (
        <SimpleSplitStep
          amount={setupState.paySchedule?.amount ?? 0}
          onAmountChange={(amount) => onPayScheduleChange?.({ cadence: 'biweekly', anchorDate: '', amount })}
          allocation={setupState.allocationSplit ?? { spend: 80, save: 10, invest: 5, setAside: 5 }}
          onAllocationChange={(split) => onAllocationSplitChange?.(split)}
          cadence={setupState.simpleCadence ?? 'biweekly'}
          onCadenceChange={(cadence) => onSimpleCadenceChange?.(cadence)}
          onSwitchToFull={() => onPaycheckModeChange?.('full')}
        />
      )
    }
    if (step.id === 'simple-confirmation') {
      return (
        <SimpleConfirmationStep
          amount={setupState.paySchedule?.amount ?? 0}
          allocation={setupState.allocationSplit ?? { spend: 80, save: 10, invest: 5, setAside: 5 }}
          cadence={setupState.simpleCadence ?? 'biweekly'}
        />
      )
    }
    if (step.id === 'paycheck-schedule') {
      return (
        <PayScheduleStep
          value={setupState.paySchedule ?? { cadence: 'biweekly', anchorDate: '', amount: 0 }}
          onChange={(schedule) => onPayScheduleChange?.(schedule)}
          onSwitchToSimple={() => onPaycheckModeChange?.('simple')}
        />
      )
    }
    if (step.id === 'paycheck-allocation') {
      return (
        <AllocationSplitStep
          value={setupState.allocationSplit ?? { spend: 80, save: 10, invest: 5, setAside: 5 }}
          onChange={(split) => onAllocationSplitChange?.(split)}
          paycheckAmount={setupState.paySchedule?.amount ?? 0}
        />
      )
    }
    if (step.id === 'paycheck-confirmation') {
      return (
        <PaycheckConfirmationStep
          setupState={setupState}
        />
      )
    }

    // Standard (non-express) setup steps
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

  // Branch steps are rendered by the parent (path selection UI) — skip here
  if (step.type === 'branch') return null

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
