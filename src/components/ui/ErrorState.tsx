'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { Icon } from '@/components/ui/Icon'
import { emptyStateContainer, emptyStateTitle, emptyStateSubtitle, emptyStateAction } from '@/styles/shared'

// ============================================================================
// ErrorState — reusable inline error state (warm, on-brand)
// Requirements: extends offlineQueue — user always understands what happened
// Phase 6, task 265.1
// ============================================================================

const entranceVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

const entranceVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

interface ErrorStateProps {
  /** Title text (default: "Something went wrong") */
  title?: string
  /** Subtitle text (default: "We couldn't load this — give it another try?") */
  message?: string
  /** Retry callback — shows the "Try again" button when provided */
  onRetry?: () => void
  /** Compact mode — less padding, suitable for inline card areas */
  compact?: boolean
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this — give it another try?",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const variants = prefersReducedMotion ? entranceVariantsReduced : entranceVariants
  const transition = prefersReducedMotion ? timings.fast : springs.gentle

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      transition={transition}
      style={{
        ...emptyStateContainer,
        padding: compact ? '24px 16px' : '40px 16px',
      }}
    >
      {/* Error icon */}
      <span style={{ color: 'var(--warning, #f59e0b)' }}>
        <Icon name="status:error" size={28} strokeWidth={1.6} />
      </span>

      {/* Title */}
      <h3 style={emptyStateTitle}>{title}</h3>

      {/* Subtitle */}
      <p style={emptyStateSubtitle}>{message}</p>

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={emptyStateAction}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.85'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Try again
        </button>
      )}
    </motion.div>
  )
}
