"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import {
  getLastActiveInfo,
  isWelcomeBackDismissed,
  dismissWelcomeBack,
} from "@/lib/reminderPreferences"

// ============================================================================
// Types
// ============================================================================

export interface WelcomeBackBadgeProps {
  /** User's daily allowance amount — shown in the welcome message */
  allowanceAmount?: number
  /** Opens the BackfillSheet to catch up on missed days */
  onCatchMeUp?: () => void
}

// ============================================================================
// Warm welcome-back messages — never guilt-based, never shows days missed
// ============================================================================

/**
 * Build a welcome-back message. If allowance is provided, include it.
 */
function buildWelcomeMessage(allowanceAmount?: number): string {
  if (allowanceAmount != null && allowanceAmount > 0) {
    return `Welcome back! Your allowance today is $${allowanceAmount.toFixed(0)}.`
  }
  const fallback = [
    "Welcome back! Ready to pick up where you left off?",
    "Hey — nice to see you again.",
    "Welcome back! Your budget is here whenever you need it.",
    "Good to see you! Let's check in on your spending.",
  ]
  const index = Math.floor(Math.random() * fallback.length)
  return fallback[index]
}

// ============================================================================
// WelcomeBackBadge Component
// ============================================================================

/**
 * WelcomeBackBadge — a small, dismissible banner shown at the top of the
 * HomeScreen when the user returns after 3+ days of inactivity.
 *
 * - Warm, encouraging copy (never shows how many days were missed)
 * - Shows daily allowance amount when available
 * - "Catch me up" chip to open BackfillSheet for backfilling missed days
 * - Dismisses on tap (outside the catch-me-up button)
 * - Auto-dismisses after 5 seconds ONLY if no "Catch me up" action available
 * - Only shows once per session (persists dismissal in sessionStorage)
 * - Never guilt-based or pressuring
 *
 * Validates: Task 77, Task 395 — Gentle re-engagement & welcome-back experience
 */
export function WelcomeBackBadge({ allowanceAmount, onCatchMeUp }: WelcomeBackBadgeProps) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("")
  const { prefersReducedMotion } = useAppReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Don't show if already dismissed this session
    if (isWelcomeBackDismissed()) return

    const { isReturningUser } = getLastActiveInfo()
    if (!isReturningUser) return

    // Show the badge
    setMessage(buildWelcomeMessage(allowanceAmount))
    setVisible(true)

    // Auto-dismiss after 5 seconds only when there's no catch-me-up action
    // (when there IS a catch-me-up action, let the user interact)
    if (!onCatchMeUp) {
      timerRef.current = setTimeout(() => {
        setVisible(false)
        dismissWelcomeBack()
      }, 5000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [allowanceAmount, onCatchMeUp])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    dismissWelcomeBack()
  }, [])

  const handleCatchMeUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCatchMeUp?.()
      // Don't dismiss — the user might come back from the sheet
    },
    [onCatchMeUp]
  )

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label={`${message}${onCatchMeUp ? " Tap Catch me up to backfill missed days, or tap to dismiss." : " Tap to dismiss."}`}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={prefersReducedMotion ? timings.fast : springs.gentle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            padding: "12px 16px",
            background: "var(--accent-100)",
            border: "1px solid var(--accent-200)",
            borderRadius: radius.control,
            textAlign: "start",
          }}
        >
          <span style={{ fontSize: typography.subhead.fontSize, flexShrink: 0 }} aria-hidden="true">
            👋
          </span>
          <span
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {message}
          </span>

          {/* Catch me up chip — opens BackfillSheet */}
          {onCatchMeUp && (
            <button
              type="button"
              onClick={handleCatchMeUp}
              aria-label="Catch me up — backfill missed days"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 12px",
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: "var(--accent-500)",
                background: "var(--accent-200)",
                border: "1px solid var(--accent-300)",
                borderRadius: radius.control,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Catch me up
            </button>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss welcome back message"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: typography.caption.fontSize,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
              }}
              aria-hidden="true"
            >
              ✕
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
