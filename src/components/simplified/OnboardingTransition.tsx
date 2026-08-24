"use client"

import { motion } from 'framer-motion'
import { springs, useReducedMotion, timings } from '@/lib/animations'
import { FONT_FAMILY, typography, fontWeights } from '@/styles/typography'

// ============================================================================
// OnboardingTransition (Task 391.1)
// ============================================================================

interface OnboardingTransitionProps {
  /** The computed daily allowance from onboarding inputs */
  dailyAllowance: number
}

/**
 * OnboardingTransition — a brief animated handoff between the conversational
 * onboarding and the home screen.
 *
 * The daily allowance number scales up and repositions from its onboarding
 * preview appearance (centered, green, 32px) toward the hero position (top,
 * larger). The surrounding UI fades out, then the whole screen fades into
 * the home screen render.
 *
 * Under reduced motion: simple crossfade (no scale/position animation).
 *
 * Validates: Requirements 21.1
 */
export function OnboardingTransition({ dailyAllowance }: OnboardingTransitionProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'var(--bg)', fontFamily: FONT_FAMILY }}
      role="status"
      aria-label={`Your daily allowance is $${dailyAllowance}. Loading your home screen.`}
    >
      {/* Background fade out */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'var(--bg)' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={prefersReducedMotion ? timings.fast : { duration: 0.6, ease: 'easeOut' }}
      />

      {/* Allowance number — morphs from onboarding preview size to hero size */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1, y: 0 }
        }
        animate={prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1.25, y: -60 }
        }
        transition={prefersReducedMotion ? timings.fast : springs.gentle}
      >
        {/* Subtitle fades out as the number moves */}
        <motion.p
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={prefersReducedMotion ? timings.fast : { duration: 0.3, ease: 'easeOut' }}
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: 'var(--sub)',
            margin: 0,
          }}
        >
          Your daily number
        </motion.p>

        {/* The hero number — starts at onboarding preview style */}
        <motion.div
          initial={prefersReducedMotion
            ? { opacity: 0.8 }
            : { opacity: 1, scale: 1 }
          }
          animate={prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 1, scale: 1.15 }
          }
          transition={prefersReducedMotion ? timings.fast : springs.gentle}
          style={{
            fontSize: typography.title.fontSize,
            fontWeight: fontWeights.bold,
            fontFamily: FONT_FAMILY,
            color: 'var(--success)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 24px var(--success-300)',
          }}
        >
          ${dailyAllowance}/day
        </motion.div>
      </motion.div>

      {/* Overall screen fade to white/transparent for the home screen to appear */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--bg)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={prefersReducedMotion
          ? { delay: 0.1, duration: 0.15 }
          : { delay: 0.45, duration: 0.25, ease: 'easeIn' }
        }
      />
    </div>
  )
}
