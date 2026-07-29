"use client"

/**
 * IncomeAnchorBanner — task 95.1
 *
 * A lightweight, dismissible first-run banner that invites the user to anchor
 * their timeline by sharing when they were last paid. Appears ~1 second after
 * the home screen loads for new users (gated by `folio-income-anchor-offered`
 * in localStorage). Tapping "Set it now" opens the existing BackfillSheet
 * directly at the paycheck step; tapping "Skip" dismisses without friction.
 *
 * Design rules:
 * - Shows once, first-run only
 * - Never blocks value — the hero and quick actions are always visible first
 * - Warm copy, no shame, no forced setup
 * - Consistent with the app's glass surfaces + warm-purple palette
 */

import { motion } from 'framer-motion'
import { springs, timings } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

// ============================================================================
// Props
// ============================================================================

export interface IncomeAnchorBannerProps {
  /** Called when the user taps "Set it now" — parent should open BackfillSheet */
  onSetItNow: () => void
  /** Called when the user taps "Skip" — parent should dismiss and not show again */
  onSkip: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * IncomeAnchorBanner — rendered inline on the HomeScreen after the hero section.
 *
 * Entrance: slides up + fades in over 280ms so it doesn't compete with the
 * initial hero render. Exit is handled by the parent via AnimatePresence.
 */
export function IncomeAnchorBanner({ onSetItNow, onSkip }: IncomeAnchorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={timings.normal}
      role="complementary"
      aria-label="Income anchor prompt"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        background: 'rgba(167, 139, 250, 0.07)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        borderRadius: borderRadius.md,
      }}
    >
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}
          aria-hidden="true"
        >
          📅
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: FONT_FAMILY,
              color: 'var(--text)',
              lineHeight: 1.35,
            }}
          >
            Anchor your daily number
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              fontFamily: FONT_FAMILY,
              color: 'var(--sub)',
              lineHeight: 1.5,
            }}
          >
            Tell us when you last got paid and your number gets more accurate — takes about 10 seconds.
          </p>
        </div>
      </div>

      {/* ── Action row ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          onClick={onSetItNow}
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            color: '#fff',
            background: 'rgba(167, 139, 250, 0.65)',
            border: 'none',
            borderRadius: borderRadius.full,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          aria-label="Set your last payday to anchor your daily budget"
        >
          Set it now
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          onClick={onSkip}
          style={{
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: 'var(--sub)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          aria-label="Skip setting payday anchor"
        >
          Skip
        </motion.button>
      </div>
    </motion.div>
  )
}
