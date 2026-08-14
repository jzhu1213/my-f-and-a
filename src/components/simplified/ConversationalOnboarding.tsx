"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'
import type { SpendingMode } from '@/lib/spendingModes'

// ============================================================================
// Types
// ============================================================================

export interface ConversationalOnboardingResult {
  monthlyIncome: number
  biggestBill: number
  spendingMode: SpendingMode
}

export interface ConversationalOnboardingProps {
  /** Called when the user completes all 3 steps */
  onComplete: (result: ConversationalOnboardingResult) => void
  /** Called when the user skips (at any point) */
  onSkip: () => void
}

// ============================================================================
// Constants
// ============================================================================

const INCOME_PRESETS = [500, 1000, 1500, 2000, 3000] as const

const SPENDING_MODES: { value: SpendingMode; label: string; emoji: string; description: string }[] = [
  {
    value: 'tracker',
    label: 'Just watching',
    emoji: '👀',
    description: 'Track spending without limits — see where it goes',
  },
  {
    value: 'guided',
    label: 'Guided budgeting',
    emoji: '🧭',
    description: 'Gentle nudges when you\u2019re close to your daily number',
  },
  {
    value: 'structured',
    label: 'Strict limits',
    emoji: '🎯',
    description: 'Clear boundaries — know exactly what you can spend',
  },
]

const COMMON_BILLS = [
  { label: 'Rent', emoji: '🏠' },
  { label: 'Car', emoji: '🚗' },
  { label: 'Phone', emoji: '📱' },
  { label: 'Insurance', emoji: '🛡️' },
]

// ============================================================================
// Animation Variants
// ============================================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 60 : -60,
    opacity: 0,
  }),
}

const fadeOnlyVariants = {
  enter: () => ({ x: 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: () => ({ x: 0, opacity: 0 }),
}

// ============================================================================
// Helper: compute daily allowance from income & bill
// ============================================================================

function computeDailyAllowance(monthlyIncome: number, biggestBill: number): number {
  const daysInMonth = 30
  const remaining = Math.max(0, monthlyIncome - biggestBill)
  return Math.round(remaining / daysInMonth)
}

// ============================================================================
// Sub-components
// ============================================================================

/** Step 1: Monthly income question */
function IncomeStep({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const { prefersReducedMotion } = useReducedMotion()

  const handleCustomConfirm = useCallback(() => {
    const parsed = parseInt(customValue, 10)
    if (parsed > 0) {
      onChange(parsed)
    }
  }, [customValue, onChange])

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        style={{ fontSize: 40, marginBottom: 12 }}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
        aria-hidden="true"
      >
        💰
      </motion.span>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        How much money do you have to work with each month?
      </h2>
      <p
        style={{
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        No need to be exact — a rough number works great.
      </p>

      {/* Preset chips */}
      <div
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Monthly income presets"
      >
        {INCOME_PRESETS.map((amount) => {
          const selected = value === amount && !showCustom
          return (
            <motion.button
              key={amount}
              type="button"
              onClick={() => {
                setShowCustom(false)
                onChange(amount)
              }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              aria-pressed={selected}
              aria-label={`$${amount.toLocaleString()} per month`}
              style={{
                padding: '10px 16px',
                borderRadius: borderRadius.full,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                cursor: 'pointer',
                background: selected
                  ? 'rgba(129, 140, 248, 0.15)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: selected
                  ? '1.5px solid rgba(129, 140, 248, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                color: selected ? 'var(--text)' : 'var(--sub)',
                boxShadow: selected
                  ? '0 0 12px rgba(129, 140, 248, 0.12)'
                  : 'none',
              }}
            >
              ${amount.toLocaleString()}
            </motion.button>
          )
        })}

        {/* Custom button */}
        <motion.button
          type="button"
          onClick={() => {
            setShowCustom(true)
            onChange(0)
          }}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          aria-pressed={showCustom}
          aria-label="Enter custom amount"
          style={{
            padding: '10px 16px',
            borderRadius: borderRadius.full,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            cursor: 'pointer',
            background: showCustom
              ? 'rgba(129, 140, 248, 0.15)'
              : 'rgba(255, 255, 255, 0.04)',
            border: showCustom
              ? '1.5px solid rgba(129, 140, 248, 0.5)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            color: showCustom ? 'var(--text)' : 'var(--sub)',
          }}
        >
          Custom
        </motion.button>
      </div>

      {/* Custom input */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
            className="flex items-center gap-2 mt-4"
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                color: 'var(--text)',
              }}
            >
              $
            </span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 2500"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onBlur={handleCustomConfirm}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomConfirm()
              }}
              aria-label="Custom monthly amount"
              style={{
                width: 120,
                padding: '10px 14px',
                borderRadius: borderRadius.md,
                fontSize: 16,
                fontFamily: FONT_FAMILY,
                fontWeight: 600,
                color: 'var(--text)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                outline: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: 'var(--sub)',
                fontFamily: FONT_FAMILY,
              }}
            >
              /month
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Step 2: Biggest monthly bill */
function BiggestBillStep({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [noBill, setNoBill] = useState(false)
  const [inputValue, setInputValue] = useState(value > 0 ? String(value) : '')
  const { prefersReducedMotion } = useReducedMotion()

  const handleInputChange = useCallback((raw: string) => {
    setInputValue(raw)
    const parsed = parseInt(raw, 10)
    if (parsed > 0) {
      setNoBill(false)
      onChange(parsed)
    } else {
      onChange(0)
    }
  }, [onChange])

  const handleNoBill = useCallback(() => {
    setNoBill(true)
    setInputValue('')
    onChange(0)
  }, [onChange])

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        style={{ fontSize: 40, marginBottom: 12 }}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
        aria-hidden="true"
      >
        🏠
      </motion.span>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        What&apos;s your biggest monthly bill?
      </h2>
      <p
        style={{
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Usually rent or housing — helps us figure out your daily spending room.
      </p>

      {/* Amount input */}
      <div className="flex items-center gap-2 mb-4">
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            color: noBill ? 'var(--muted)' : 'var(--text)',
          }}
        >
          $
        </span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="e.g. 800"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          disabled={noBill}
          aria-label="Biggest monthly bill amount"
          style={{
            width: 140,
            padding: '12px 16px',
            borderRadius: borderRadius.md,
            fontSize: 18,
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            color: noBill ? 'var(--muted)' : 'var(--text)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums',
            opacity: noBill ? 0.5 : 1,
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
          }}
        >
          /month
        </span>
      </div>

      {/* "I don't have one" option */}
      <button
        type="button"
        onClick={handleNoBill}
        aria-pressed={noBill}
        style={{
          padding: '8px 16px',
          borderRadius: borderRadius.full,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: FONT_FAMILY,
          cursor: 'pointer',
          background: noBill
            ? 'rgba(129, 140, 248, 0.12)'
            : 'rgba(255, 255, 255, 0.04)',
          border: noBill
            ? '1.5px solid rgba(129, 140, 248, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          color: noBill ? 'var(--text)' : 'var(--sub)',
          marginBottom: 16,
        }}
      >
        I don&apos;t have a big recurring bill
      </button>

      {/* Quick-add bill chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {COMMON_BILLS.map((bill) => (
          <span
            key={bill.label}
            style={{
              padding: '6px 10px',
              borderRadius: borderRadius.full,
              fontSize: 11,
              fontFamily: FONT_FAMILY,
              color: 'var(--muted)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span aria-hidden="true">{bill.emoji}</span>
            {bill.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Step 3: Spending mode picker */
function SpendingModeStep({
  value,
  onChange,
}: {
  value: SpendingMode
  onChange: (v: SpendingMode) => void
}) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        style={{ fontSize: 40, marginBottom: 12 }}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
        aria-hidden="true"
      >
        ✨
      </motion.span>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        How do you want Folio to work?
      </h2>
      <p
        style={{
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        You can always change this later in settings.
      </p>

      <div
        className="flex flex-col gap-3 w-full"
        role="radiogroup"
        aria-label="Choose how Folio works for you"
      >
        {SPENDING_MODES.map((mode) => {
          const selected = value === mode.value
          return (
            <motion.button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              role="radio"
              aria-checked={selected}
              aria-label={`${mode.label}: ${mode.description}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: borderRadius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                background: selected
                  ? 'rgba(129, 140, 248, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selected
                  ? '1.5px solid rgba(129, 140, 248, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: selected
                  ? '0 0 16px rgba(129, 140, 248, 0.08)'
                  : 'none',
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">
                {mode.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    marginBottom: 2,
                  }}
                >
                  {mode.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--sub)',
                    lineHeight: 1.4,
                  }}
                >
                  {mode.description}
                </div>
              </div>
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'white' }}>✓</span>
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/** Live daily allowance preview shown between steps 2 and 3 */
function AllowancePreview({
  monthlyIncome,
  biggestBill,
}: {
  monthlyIncome: number
  biggestBill: number
}) {
  const daily = computeDailyAllowance(monthlyIncome, biggestBill)
  const { prefersReducedMotion } = useReducedMotion()

  if (monthlyIncome <= 0) return null

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0.15 } : springs.gentle}
      style={{
        marginTop: 20,
        padding: '16px 20px',
        borderRadius: borderRadius.lg,
        background: 'rgba(74, 222, 128, 0.06)',
        border: '1px solid rgba(74, 222, 128, 0.15)',
        textAlign: 'center',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Based on your answers, you can spend about $${daily} per day`}
    >
      <p
        style={{
          fontSize: 12,
          fontFamily: FONT_FAMILY,
          color: 'var(--sub)',
          marginBottom: 6,
        }}
      >
        Based on that, you can spend about
      </p>
      <motion.div
        key={daily}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
        style={{
          fontSize: 32,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          color: 'var(--success)',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 20px rgba(74, 222, 128, 0.3)',
        }}
      >
        ${daily}/day
      </motion.div>
      <p
        style={{
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          color: 'var(--muted)',
          marginTop: 4,
        }}
      >
        This gets more accurate as you use Folio
      </p>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConversationalOnboarding — a warm, 3-step conversational intro that gets
 * new users to their first "aha" moment (seeing a daily allowance number)
 * within 30-45 seconds.
 *
 * Steps:
 * 1. Monthly income (quick presets or custom)
 * 2. Biggest monthly bill (with live allowance preview)
 * 3. Spending mode picker (maps to tracker/guided/structured)
 *
 * Every step has a subtle "skip" affordance. Skipping uses fallback defaults.
 *
 * Validates: Requirements 21.1, 21.2, 21.3
 */
export function ConversationalOnboarding({
  onComplete,
  onSkip,
}: ConversationalOnboardingProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [biggestBill, setBiggestBill] = useState(0)
  const [spendingMode, setSpendingMode] = useState<SpendingMode>('guided')
  const [announcement, setAnnouncement] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const { prefersReducedMotion } = useReducedMotion()

  const activeVariants = prefersReducedMotion ? fadeOnlyVariants : slideVariants
  const totalSteps = 3

  // Focus management on step change
  useEffect(() => {
    const titles = ['Monthly income', 'Biggest bill', 'Spending mode']
    setAnnouncement(`Step ${step + 1} of ${totalSteps}: ${titles[step]}`)
    const timer = setTimeout(() => {
      contentRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [step])

  // Can advance from step 1 only if income is set
  const canAdvanceStep0 = monthlyIncome > 0
  // Step 2 always allows advancing (bill can be 0 = "no big bill")
  const canAdvanceStep1 = true
  // Step 3 always has a default selection
  const canAdvanceStep2 = true

  const canAdvance = step === 0 ? canAdvanceStep0 : step === 1 ? canAdvanceStep1 : canAdvanceStep2

  const goNext = useCallback(() => {
    if (step >= totalSteps - 1) {
      onComplete({ monthlyIncome, biggestBill, spendingMode })
      return
    }
    setDirection(1)
    setStep((prev) => prev + 1)
  }, [step, monthlyIncome, biggestBill, spendingMode, onComplete])

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep((prev) => prev - 1)
    }
  }, [step])

  const nextLabel = step === totalSteps - 1 ? "Let's go" : 'Next'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', fontFamily: FONT_FAMILY }}
      role="region"
      aria-label="Set up Folio"
    >
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="w-full max-w-sm relative">
        {/* Progress dots */}
        <nav
          className="flex items-center justify-center gap-2 mb-10"
          aria-label={`Step ${step + 1} of ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className="transition-all duration-300"
              style={{
                width: idx === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: idx === step ? 'var(--accent)' : idx < step ? 'var(--accent)' : 'var(--line)',
                opacity: idx < step ? 0.5 : 1,
              }}
              aria-hidden="true"
            />
          ))}
        </nav>

        {/* Step content */}
        <div
          className="relative min-h-[380px] flex flex-col"
          ref={contentRef}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={activeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={prefersReducedMotion ? { duration: 0.15, ease: 'easeOut' } : springs.gentle}
              className="flex flex-col flex-1"
            >
              {step === 0 && (
                <IncomeStep value={monthlyIncome} onChange={setMonthlyIncome} />
              )}
              {step === 1 && (
                <>
                  <BiggestBillStep value={biggestBill} onChange={setBiggestBill} />
                  <AllowancePreview
                    monthlyIncome={monthlyIncome}
                    biggestBill={biggestBill}
                  />
                </>
              )}
              {step === 2 && (
                <>
                  <SpendingModeStep value={spendingMode} onChange={setSpendingMode} />
                  {/* Show the live preview on step 3 too for continuity */}
                  {monthlyIncome > 0 && (
                    <AllowancePreview
                      monthlyIncome={monthlyIncome}
                      biggestBill={biggestBill}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className="w-full py-3.5 rounded-xl font-medium text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            style={{
              background: canAdvance ? 'var(--accent)' : 'var(--muted)',
              color: 'var(--text)',
              opacity: canAdvance ? 1 : 0.5,
              cursor: canAdvance ? 'pointer' : 'not-allowed',
              fontFamily: FONT_FAMILY,
            }}
            aria-label={nextLabel}
          >
            {nextLabel}
          </button>

          {/* Back / Skip row */}
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={goBack}
                className="text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ color: 'var(--sub)', fontFamily: FONT_FAMILY }}
                aria-label="Go back"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={onSkip}
              className="text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{ color: 'var(--muted)', fontFamily: FONT_FAMILY }}
              aria-label="Skip setup for now"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
