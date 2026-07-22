"use client"

import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/animations'

// ============================================================================
// Types
// ============================================================================

/**
 * A tutorial step that can be an info screen, an interactive "try it once"
 * prompt, or a setup form (income, budget style, limits, confirmation).
 * Info and setup steps advance via Next; interactive steps advance only
 * when `onInteractionComplete` is called (or the user skips).
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
 * animations, and Next/Back/Skip navigation. Supports both informational
 * and interactive ("try it once") steps.
 *
 * Validates: Requirements 7.1, 7.5, 7.6
 */
export function OnboardingTutorial({
  steps,
  onComplete,
  onSkip,
  renderStep,
}: OnboardingTutorialProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [interactionDone, setInteractionDone] = useState(false)

  const currentStep = steps[currentIndex]
  const isLastStep = currentIndex === steps.length - 1
  const isInteractive = currentStep?.type === 'interactive'
  const canAdvance = !isInteractive || interactionDone

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
      setDirection(-1)
      setCurrentIndex(prev => prev - 1)
      setInteractionDone(false)
    }
  }, [currentIndex])

  const completeInteraction = useCallback(() => {
    setInteractionDone(true)
  }, [])

  // Guard against empty steps
  if (!currentStep) return null

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}
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
              {renderStep(currentStep, completeInteraction)}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {/* Primary action button */}
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
            aria-label={isLastStep ? 'Finish tutorial' : 'Next step'}
          >
            {isLastStep
              ? (currentStep.type === 'setup' && currentStep.setupType === 'confirmation'
                ? 'Start using Folio'
                : 'Done')
              : 'Next'}
          </button>

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

            <button
              onClick={onSkip}
              className="text-sm py-2 px-3 rounded-lg transition-colors"
              style={{ color: 'var(--muted)' }}
              aria-label="Skip tutorial"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
