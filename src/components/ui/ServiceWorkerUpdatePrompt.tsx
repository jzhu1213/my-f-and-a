'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'

// ============================================================================
// ServiceWorkerUpdatePrompt — subtle "Update available" toast
// Requirements: 28.7 — Service worker & PWA optimization
// Task 476.3 — Show update prompt rather than force-reloading mid-session
// ============================================================================

const bannerVariants = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
}

const bannerVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

interface ServiceWorkerUpdatePromptProps {
  /** Whether an update is available */
  visible: boolean
  /** Called when the user taps to refresh */
  onUpdate: () => void
}

export function ServiceWorkerUpdatePrompt({ visible, onUpdate }: ServiceWorkerUpdatePromptProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const variants = prefersReducedMotion ? bannerVariantsReduced : bannerVariants
  const transition = prefersReducedMotion ? timings.fast : springs.gentle

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          role="status"
          aria-live="polite"
          aria-label="App update available"
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            background: 'rgba(26, 26, 46, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {/* Update icon */}
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </span>

          {/* Message */}
          <p
            style={{
              color: 'var(--text)',
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: '0.8125rem',
              lineHeight: 1.4,
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Update available
          </p>

          {/* Tap to refresh button */}
          <button
            onClick={onUpdate}
            style={{
              color: 'var(--accent)',
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              fontSize: '0.8125rem',
              lineHeight: 1.4,
              background: 'rgba(139, 92, 246, 0.12)',
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)')}
            aria-label="Tap to refresh and apply update"
          >
            Refresh
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
