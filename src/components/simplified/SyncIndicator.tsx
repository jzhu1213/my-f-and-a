'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { Icon } from '@/components/ui/Icon'

// ============================================================================
// SyncIndicator — premium glass-card sync status (warm, on-brand)
// Requirements: 10.3, 10.4
// Phase 6, task 265.1 — redesigned with Icon system, glass aesthetic, framer-motion
// ============================================================================

interface SyncIndicatorProps {
  /** Number of transactions awaiting sync */
  pendingCount: number
  /** Whether any items have permanently failed */
  hasFailed: boolean
  /** Number of items recently synced (for brief "synced ✓" display) */
  recentlySyncedCount?: number
  /** Whether the network is currently online */
  isOnline?: boolean
  /** Callback to retry failed transactions */
  onRetry: () => void
  /** Callback to dismiss failed items */
  onDismiss?: () => void
}

const cardVariants = {
  initial: { opacity: 0, y: -8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
}

const cardVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** Glass card inline styles matching the Toast component's aesthetic */
const glassCardStyle: React.CSSProperties = {
  background: 'rgba(26, 26, 46, 0.85)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md, 12px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0.5px 0 rgba(255,255,255,0.06)',
}

const pillButtonStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '4px 10px',
  border: '1px solid var(--line)',
  borderRadius: '20px',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all 150ms ease',
}

export function SyncIndicator({
  pendingCount,
  hasFailed,
  recentlySyncedCount = 0,
  isOnline = true,
  onRetry,
  onDismiss,
}: SyncIndicatorProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const variants = prefersReducedMotion ? cardVariantsReduced : cardVariants
  const transition = prefersReducedMotion ? timings.fast : springs.snappy

  // Determine what to show
  const showSynced = pendingCount === 0 && recentlySyncedCount > 0
  const showFailed = hasFailed && pendingCount > 0
  const showPending = !hasFailed && pendingCount > 0
  const showNothing = pendingCount === 0 && recentlySyncedCount === 0

  if (showNothing) return null

  return (
    <AnimatePresence mode="wait">
      {/* Synced state — brief, auto-dismissing */}
      {showSynced && (
        <motion.div
          key="synced"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-3 w-full"
          style={glassCardStyle}
        >
          <span className="flex-shrink-0" style={{ color: 'var(--success)' }}>
            <Icon name="toast:success" size={16} strokeWidth={2} />
          </span>
          <p
            className="text-xs flex-1 leading-snug"
            style={{
              color: 'var(--text)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
            }}
          >
            All caught up ✓
          </p>
        </motion.div>
      )}

      {/* Failed state — warm copy + retry/dismiss */}
      {showFailed && (
        <motion.div
          key="failed"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 px-4 py-3 w-full"
          style={glassCardStyle}
        >
          <span className="flex-shrink-0" style={{ color: 'var(--warning)' }}>
            <Icon name="status:error" size={16} strokeWidth={2} />
          </span>
          <p
            className="text-xs flex-1 leading-snug"
            style={{
              color: 'var(--text)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
            }}
          >
            Some changes couldn&apos;t sync — we&apos;ll keep trying
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onRetry}
              style={{ ...pillButtonStyle, color: 'var(--text)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--line)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Retry
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{ ...pillButtonStyle, color: 'var(--sub)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--line)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--line)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Pending/syncing state — calm, informational */}
      {showPending && (
        <motion.div
          key="pending"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-3 w-full"
          style={glassCardStyle}
        >
          <span className="flex-shrink-0" style={{ color: 'var(--blue)' }}>
            <motion.span
              className="inline-flex"
              animate={prefersReducedMotion ? {} : { rotate: 360 }}
              transition={prefersReducedMotion ? {} : { duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Icon name="status:retry" size={16} strokeWidth={2} />
            </motion.span>
          </span>
          <p
            className="text-xs flex-1 leading-snug"
            style={{
              color: 'var(--text)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
            }}
          >
            {isOnline
              ? `Syncing ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}…`
              : `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} saved — will sync when online`}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
