"use client"

import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'
import type { OnboardingPath } from '@/types'

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
// Animation variants (matching WarmOnboarding)
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
      aria-label="Onboarding tutorial"
    >
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
                borderRadius: 4,
                background: idx === currentIndex ? 'var(--accent)' : 'var(--line)',
              }}
              aria-hidden="true"
            />
          ))}
        </nav>

        {/* Step content with directional slide animation */}
        <div className="relative min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springs.gentle}
              className="flex flex-col flex-1"
            >
              {isBranch ? (
                <div className="flex flex-col items-center text-center flex-1">
                  <motion.span
                    style={{ fontSize: 48, marginBottom: 16 }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={springs.bouncy}
                    aria-hidden="true"
                  >
                    {currentStep.emoji}
                  </motion.span>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: FONT_FAMILY,
                      color: 'var(--text)',
                      marginBottom: 8,
                    }}
                  >
                    {currentStep.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 14,
                      fontFamily: FONT_FAMILY,
                      color: 'var(--sub)',
                      maxWidth: 280,
                      lineHeight: 1.5,
                      marginBottom: 24,
                    }}
                  >
                    {currentStep.subtitle}
                  </p>
                  <div className="flex flex-col gap-2.5 w-full">
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
                        className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                        style={{
                          background: 'var(--surface)',
                          border: '1.5px solid var(--border)',
                        }}
                        aria-label={opt.label}
                      >
                        <span className="text-xl flex-shrink-0">{opt.emoji}</span>
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
              className="w-full py-3.5 rounded-xl font-medium text-base transition-colors"
              style={{
                background: canAdvance ? 'var(--accent)' : 'var(--muted)',
                color: '#fff',
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? 'pointer' : 'not-allowed',
              }}
              aria-label={isLastStep ? 'Finish tutorial' : currentStep.id === 'welcome' ? "Let's go" : 'Next step'}
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
                className="text-sm py-2 px-3 rounded-lg transition-colors"
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
                className="text-sm py-2 px-3 rounded-lg transition-colors"
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
