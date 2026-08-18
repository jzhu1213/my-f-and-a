'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { Icon } from '@/components/ui/Icon'
import { semanticColors } from '@/styles/colors'
import { FONT_FAMILY } from '@/styles/typography'

// ============================================================================
// PartialLoadBanner — subtle, tappable retry indicator for partial data failures
// Requirements: 28.6 (Task 475.2 — partial data loading)
// Shows when some data sources fail but others succeed, so the app doesn't
// blank the entire screen. Warm and encouraging, not alarming.
// ============================================================================

const bannerVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const bannerVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

interface PartialLoadBannerProps {
  /** Whether to show the banner (failedSources.length > 0 && !loadError) */
  visible: boolean
  /** Called when the user taps the banner to retry */
  onRetry: () => void
}

export function PartialLoadBanner({ visible, onRetry }: PartialLoadBannerProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const variants = prefersReducedMotion ? bannerVariantsReduced : bannerVariants
  const transition = prefersReducedMotion ? timings.fast : springs.gentle

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          onClick={onRetry}
          role="status"
          aria-live="polite"
          aria-label="Some data couldn't load. Tap to retry."
          className="flex items-center gap-3 px-4 py-3 w-full text-left"
          style={{
            background: 'rgba(26, 26, 46, 0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            marginBottom: 12,
            cursor: 'pointer',
          }}
        >
          {/* Warning icon */}
          <span
            className="flex-shrink-0"
            style={{ color: semanticColors.caution }}
          >
            <Icon name="status:warning" size={16} strokeWidth={2} />
          </span>

          {/* Message */}
          <p
            className="text-xs flex-1 leading-snug"
            style={{
              color: 'var(--text)',
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              margin: 0,
            }}
          >
            Some data couldn&apos;t load — tap to retry
          </p>

          {/* Retry arrow */}
          <span
            className="flex-shrink-0"
            style={{ color: 'var(--sub)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
