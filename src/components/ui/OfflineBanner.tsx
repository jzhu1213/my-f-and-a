'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { Icon } from '@/components/ui/Icon'

// ============================================================================
// OfflineBanner — warm, on-brand offline status bar
// Requirements: 10.2, 10.4 (extends offlineQueue — user always understands state)
// Phase 6, task 265.1
// ============================================================================

const bannerVariants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const bannerVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

interface OfflineBannerProps {
  /** Whether to show the banner (typically `!isOnline`) */
  visible: boolean
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state when connectivity changes (reappear on next offline cycle)
  useEffect(() => {
    if (visible) {
      setDismissed(false)
    }
  }, [visible])

  const variants = prefersReducedMotion ? bannerVariantsReduced : bannerVariants
  const transition = prefersReducedMotion ? timings.fast : springs.gentle

  const show = visible && !dismissed

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-3 w-full"
          style={{
            background: 'rgba(26, 26, 46, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md, 12px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0.5px 0 rgba(255,255,255,0.06)',
            marginBottom: 12,
          }}
        >
          {/* Offline icon */}
          <span
            className="flex-shrink-0"
            style={{ color: 'var(--warning, #f59e0b)' }}
          >
            <Icon name="status:offline" size={16} strokeWidth={2} />
          </span>

          {/* Message */}
          <p
            className="text-xs flex-1 leading-snug"
            style={{
              color: 'var(--text)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
            }}
          >
            You&apos;re offline — your changes are saved and will sync when you reconnect
          </p>

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 transition-colors duration-150"
            style={{ color: 'var(--sub)', padding: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--sub)')}
            aria-label="Dismiss offline notice"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
