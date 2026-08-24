"use client"

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import type { OnboardingPath } from '@/types'
import { HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

/**
 * A tutorial step that can be an info screen, an interactive "try it once"
 * prompt, a setup form (income, budget style, limits, confirmation),
 * a branch/selector step (path router), or a terminal (non-skippable) step.
 *
 * Info and setup steps advance via Next; interactive steps advance only
 * when `onInteractionComplete` is called (or the user skips).
 * Branch steps set the active onboarding path.
 * Terminal steps are non-skippable (e.g. the guaranteed goal question).
 */
export type TutorialStep =
  | {
      type: 'info'
      id: string
      title: string
      subtitle: string
      emoji: string
    }
  | {
      type: 'interactive'
      id: string
      title: string
      subtitle: string
      emoji: string
      /** Short prompt telling the user what to try, e.g. "Tap the + button" */
      prompt: string
    }
  | {
      type: 'setup'
      id: string
      /** Setup variant — determines which form content to render */
      setupType: 'income' | 'budget-style' | 'category-limits' | 'confirmation'
    }
  | {
      type: 'branch'
      id: string
      title: string
      subtitle: string
      emoji: string
      /** Available path options for the user to choose from */
      options: Array<{ value: OnboardingPath; label: string; emoji: string; description: string }>
    }
  | {
      type: 'terminal'
      id: string
      title: string
      subtitle: string
      emoji: string
      /** Terminal steps cannot be skipped */
      nonSkippable: true
    }

// ============================================================================
// Props
// ============================================================================

export interface OnboardingTutorialProps {
  /** Ordered list of tutorial steps to present */
  steps: TutorialStep[]
  /** Called when the user finishes the last step */
  onComplete: () => void
  /** Called when the user taps Skip */
  onSkip: () => void
  /**
   * Called when a branch step is resolved (user picks a path).
   * The parent should update the step list accordingly.
   */
  onPathSelect?: (path: OnboardingPath) => void
  /**
   * Render prop that receives the current step and a completion callback.
   * For interactive steps, call `completeInteraction()` to unlock advancement.
   * For info steps the callback is a no-op.
   */
  renderStep: (
    step: TutorialStep,
    completeInteraction: () => void,
  ) => ReactNode
}

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

/** Opacity-only fade variants for prefers-reduced-motion users */
const fadeOnlyVariants = {
  enter: () => ({
    x: 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: () => ({
    x: 0,
    opacity: 0,
  }),
}

/** Helper to get a step title for screen-reader announcements */
function getStepTitle(step: TutorialStep): string {
  if (step.type === 'setup') {
    const titles: Record<string, string> = {
      'income': 'Monthly income',
      'budget-style': 'Budget style',
      'category-limits': 'Category limits',
      'confirmation': 'Confirmation',
    }
    // Use the step id for more descriptive titles where possible
    const idTitles: Record<string, string> = {
      'express-income': 'Monthly income',
      'express-fixed-expenses': 'Fixed expenses',
      'express-category-limits': 'Category limits',
      'express-confirmation': 'Confirmation',
      'setup-income': 'Monthly income',
      'setup-budget-style': 'Budget style',
      'setup-category-limits': 'Category limits',
      'setup-confirmation': 'Confirmation',
      'paycheck-mode': 'Paycheck mode',
      'paycheck-schedule': 'Pay schedule',
      'paycheck-allocation': 'Paycheck split',
      'paycheck-confirmation': 'Confirmation',
      'simple-split': 'Simple paycheck split',
      'simple-confirmation': 'Confirmation',
      'minimal-estimate': 'Quick estimate',
      'optional-recent-income': 'Recent income',
      'optional-recent-expense': 'Recent expense',
      'optional-goal': 'Your goal',
    }
    return idTitles[step.id] ?? titles[step.setupType] ?? 'Setup'
  }
  return step.title
}

// ============================================================================
// Component
// ============================================================================

// ---- Condensed Preview (Task 229.2) ----
// Inline version to avoid circular dependency with TutorialSteps.tsx.
// Shows all 3 demo features in a single scrollable view.

function CondensedPreviewInline({ onDismiss }: { onDismiss: () => void }) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div className="flex flex-col items-center text-center flex-1">
      <motion.span
        style={{ fontSize: 40, marginBottom: spacing.sm }}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
        aria-hidden="true"
      >
        👋
      </motion.span>
      <h2
        style={{
          fontSize: typography.subhead.fontSize,
          fontWeight: fontWeights.bold,
          fontFamily: FONT_FAMILY,
          color: 'var(--text)',
          marginBottom: 6,
        }}
      >
        Here&apos;s how Folio works
      </h2>
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          fontFamily: FONT_FAMILY,
          color: 'var(--sub)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: HORIZONTAL_PADDING,
        }}
      >
        Three things that make budgeting feel easy.
      </p>

      {/* Scrollable preview cards */}
      <div
        className="flex flex-col gap-3 w-full overflow-y-auto"
        style={{ maxHeight: 320, paddingBottom: 8 }}
        role="group"
        aria-label="Feature preview"
      >
        {/* 1. Daily allowance card */}
        <div
          style={{
            padding: '16px',
            borderRadius: radius.control,
            background: 'var(--fill-04)',
            border: '1px solid var(--fill-08)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">✨</span>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                color: 'var(--text)',
              }}
            >
              Your daily number
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              style={{
                fontSize: 28,
                fontWeight: fontWeights.bold,
                fontFamily: FONT_FAMILY,
                color: 'var(--success)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              $42
            </span>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                color: 'var(--sub)',
              }}
            >
              left to spend today
            </span>
          </div>
        </div>

        {/* 2. Quick log mini */}
        <div
          style={{
            padding: '16px',
            borderRadius: radius.control,
            background: 'var(--fill-04)',
            border: '1px solid var(--fill-08)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">💸</span>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                color: 'var(--text)',
              }}
            >
              One-tap logging
            </span>
          </div>
          <div className="flex gap-2">
            {[
              { emoji: '🍕', label: 'Food' },
              { emoji: '🚌', label: 'Transport' },
              { emoji: '🎮', label: 'Fun' },
            ].map((cat) => (
              <div
                key={cat.label}
                style={{
                  padding: '8px 12px',
                  borderRadius: radius.card,
                  background: 'var(--fill-06)',
                  border: '1px solid var(--fill-10)',
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--sub)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span aria-hidden="true">{cat.emoji}</span>
                {cat.label}
              </div>
            ))}
          </div>
          <p
            style={{
              marginTop: spacing.xs,
              fontSize: typography.caption.fontSize,
              fontFamily: FONT_FAMILY,
              color: 'var(--muted)',
            }}
          >
            Pick a category, tap an amount — done
          </p>
        </div>

        {/* 3. Category budget peek */}
        <div
          style={{
            padding: '16px',
            borderRadius: radius.control,
            background: 'var(--fill-04)',
            border: '1px solid var(--fill-08)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">📊</span>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                color: 'var(--text)',
              }}
            >
              Category budgets
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: typography.headline.fontSize }}>🍕</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                  }}
                >
                  Food
                </span>
                <span
                  style={{
                    fontSize: typography.caption.fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--sub)',
                  }}
                >
                  $28 / $60
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--fill-08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '47%',
                    height: '100%',
                    borderRadius: 3,
                    background: 'var(--success)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Got it button */}
      <button
        onClick={onDismiss}
        className="w-full mt-5 py-3 rounded-xl font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        style={{
          background: 'var(--accent)',
          color: 'var(--text)',
        }}
        aria-label="Got it, back to setup options"
      >
        Got it — let&apos;s set up
      </button>
    </div>
  )
}

/**
 * A reusable tutorial step engine with progress dots, directional slide
 * animations, and Next/Back/Skip navigation. Supports informational,
 * interactive ("try it once"), branch (path selection), and terminal
 * (non-skippable) steps.
 *
 * Navigation rules:
 * - Back from the first path step (index right after a branch step) returns
 *   to the branch step.
 * - Skip on a path step advances the cascade (next step) rather than exiting.
 * - Terminal steps hide the Skip button entirely.
 *
 * Validates: Requirements 7.1, 7.5, 7.6
 */
export function OnboardingTutorial({
  steps,
  onComplete,
  onSkip,
  onPathSelect,
  renderStep,
}: OnboardingTutorialProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [interactionDone, setInteractionDone] = useState(false)
  // Task 229.1: Condensed preview overlay shown from the router
  const [showPreview, setShowPreview] = useState(false)

  // Accessibility: focus management on step change
  const stepContentRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')

  // Reduced motion support (task 226.2)
  const { prefersReducedMotion } = useReducedMotion()
  const activeVariants = prefersReducedMotion ? fadeOnlyVariants : slideVariants

  const currentStep = steps[currentIndex]
  const isLastStep = currentIndex === steps.length - 1
  const isInteractive = currentStep?.type === 'interactive'
  const isBranch = currentStep?.type === 'branch'
  const isTerminal = currentStep?.type === 'terminal'
  const canAdvance = !isInteractive || interactionDone

  // Determine if current step is right after a branch step (first path step)
  const isFirstPathStep = currentIndex > 0 && steps[currentIndex - 1]?.type === 'branch'

  // Find the branch step index (to enable "back to router")
  const branchIndex = steps.findIndex(s => s.type === 'branch')

  // Focus management: move focus to new step content on step change (task 226.1)
  useEffect(() => {
    if (currentStep) {
      // Announce step change to screen readers
      const title = getStepTitle(currentStep)
      setAnnouncement(`Step ${currentIndex + 1} of ${steps.length}: ${title}`)

      // Focus the step content area after a short delay for animation
      const timer = setTimeout(() => {
        stepContentRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, currentStep, steps.length])

  // ---- Navigation ----

  const goNext = useCallback(() => {
    if (!canAdvance) return
    if (isLastStep) {
      onComplete()
      return
    }
    setDirection(1)
    setCurrentIndex(prev => prev + 1)
    setInteractionDone(false)
  }, [canAdvance, isLastStep, onComplete])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      // If we're at the first path step, go back to the branch/router step
      if (isFirstPathStep && branchIndex >= 0) {
        setDirection(-1)
        setCurrentIndex(branchIndex)
      } else {
        setDirection(-1)
        setCurrentIndex(prev => prev - 1)
      }
      setInteractionDone(false)
    }
  }, [currentIndex, isFirstPathStep, branchIndex])

  const handleSkip = useCallback(() => {
    // On path steps (after a branch), skip advances to next step in the cascade
    // rather than exiting the entire tutorial.
    const isAfterBranch = branchIndex >= 0 && currentIndex > branchIndex
    if (isAfterBranch && !isLastStep) {
      setDirection(1)
      setCurrentIndex(prev => prev + 1)
      setInteractionDone(false)
    } else {
      // Task 229.1: No demos before the branch anymore, so skip on welcome
      // or any pre-branch step exits the tutorial entirely.
      onSkip()
    }
  }, [branchIndex, currentIndex, isLastStep, onSkip])

  const completeInteraction = useCallback(() => {
    setInteractionDone(true)
  }, [])

  // Guard against empty steps
  if (!currentStep) return null

  // Determine if Skip should be hidden
  // Terminal steps are non-skippable; branch steps require a path choice
  const hideSkip = isTerminal || isBranch

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', fontFamily: FONT_FAMILY }}
      role="region"
      aria-label="Getting started"
    >
      {/* Live region for screen-reader step announcements (task 226.1) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="w-full max-w-sm relative">
        {/* Progress dots */}
        <nav
          className="flex items-center justify-center gap-2 mb-10"
          aria-label={`Step ${currentIndex + 1} of ${steps.length}`}
        >
          {steps.map((_, idx) => (
            <div
              key={idx}
              className="transition-all duration-300"
              style={{
                width: idx === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: radius.min,
                background: idx === currentIndex ? 'var(--accent)' : 'var(--line)',
              }}
              aria-hidden="true"
            />
          ))}
        </nav>

        {/* Step content with directional slide animation */}
        <div
          className="relative min-h-[380px] flex flex-col"
          ref={stepContentRef}
          tabIndex={-1}
          style={{ outline: 'none' }}
          aria-label={getStepTitle(currentStep)}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={activeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={prefersReducedMotion ? { duration: 0.15, ease: 'easeOut' } : springs.gentle}
              className="flex flex-col flex-1"
            >
              {isBranch ? (
                <div className="flex flex-col items-center text-center flex-1">
                  {/* Task 229.2: Show condensed preview overlay when requested */}
                  {showPreview ? (
                    <CondensedPreviewInline onDismiss={() => setShowPreview(false)} />
                  ) : (
                    <>
                      <motion.span
                        style={{ fontSize: 48, marginBottom: spacing.md }}
                        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                        transition={prefersReducedMotion ? { duration: 0.15 } : springs.bouncy}
                        aria-hidden="true"
                      >
                        {currentStep.emoji}
                      </motion.span>
                      <h2
                        style={{
                          fontSize: typography.headline.fontSize,
                          fontWeight: fontWeights.bold,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--text)',
                          marginBottom: spacing.xs,
                        }}
                      >
                        {currentStep.title}
                      </h2>
                      <p
                        style={{
                          fontSize: typography.body.fontSize,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--sub)',
                          maxWidth: 280,
                          lineHeight: 1.5,
                          marginBottom: spacing.lg,
                        }}
                      >
                        {currentStep.subtitle}
                      </p>
                      <div className="flex flex-col gap-2.5 w-full" role="group" aria-label="Choose a setup path">
                        {currentStep.options.map((opt) => (
                          <button
                            key={opt.value ?? opt.label}
                            onClick={() => {
                              onPathSelect?.(opt.value)
                              // Advance past the branch step
                              setDirection(1)
                              setCurrentIndex(prev => prev + 1)
                              setInteractionDone(false)
                            }}
                            className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                            style={{
                              background: 'var(--surface)',
                              border: '1.5px solid var(--border)',
                            }}
                            aria-label={`${opt.label}: ${opt.description}`}
                          >
                            <span className="text-xl flex-shrink-0" aria-hidden="true">{opt.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-sm font-medium"
                                style={{ color: 'var(--text)', fontFamily: FONT_FAMILY }}
                              >
                                {opt.label}
                              </div>
                              <div
                                className="text-xs"
                                style={{ color: 'var(--sub)', fontFamily: FONT_FAMILY }}
                              >
                                {opt.description}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* Task 229.1: "Show me how it works" secondary link */}
                      <button
                        onClick={() => setShowPreview(true)}
                        className="mt-4 text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        style={{ color: 'var(--sub)', fontFamily: FONT_FAMILY }}
                        aria-label="Show me how Folio works first"
                      >
                        👋 Show me how it works first
                      </button>
                    </>
                  )}
                </div>
              ) : (
                renderStep(currentStep, completeInteraction)
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {/* Primary action button — hidden for branch steps (selection advances) */}
          {!isBranch && (
            <button
              onClick={goNext}
              disabled={!canAdvance}
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              style={{
                background: canAdvance ? 'var(--accent)' : 'var(--muted)',
                color: 'var(--text)',
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? 'pointer' : 'not-allowed',
              }}
              aria-label={isLastStep ? 'Finish setup' : currentStep.id === 'welcome' ? "Let's go" : 'Next step'}
            >
              {isLastStep
                ? (currentStep.type === 'setup' && currentStep.setupType === 'confirmation'
                  ? 'Start using Folio'
                  : 'Done')
                : currentStep.id === 'welcome'
                  ? "Let's go"
                  : 'Next'}
            </button>
          )}

          {/* Back / Skip row */}
          <div className="flex items-center justify-between">
            {currentIndex > 0 ? (
              <button
                onClick={goBack}
                className="text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ color: 'var(--sub)' }}
                aria-label="Go back"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {!hideSkip && (
              <button
                onClick={handleSkip}
                className="text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ color: 'var(--muted)' }}
                aria-label={currentStep.id === 'welcome' ? 'Skip for now' : 'Skip'}
              >
                {currentStep.id === 'welcome' ? 'Skip for now' : 'Skip'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
