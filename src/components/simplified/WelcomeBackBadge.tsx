"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { springs, timings } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import {
  getLastActiveInfo,
  isWelcomeBackDismissed,
  dismissWelcomeBack,
} from "@/lib/reminderPreferences"

// ============================================================================
// Warm welcome-back messages — never guilt-based, never shows days missed
// ============================================================================

const WELCOME_MESSAGES: string[] = [
  "Welcome back! Ready to pick up where you left off?",
  "Hey — nice to see you again.",
  "Welcome back! Your budget is here whenever you need it.",
  "Good to see you! Let's check in on your spending.",
]

/**
 * Pick a welcome-back message (random from pool).
 */
function pickWelcomeMessage(): string {
  const index = Math.floor(Math.random() * WELCOME_MESSAGES.length)
  return WELCOME_MESSAGES[index]
}

// ============================================================================
// WelcomeBackBadge Component
// ============================================================================

/**
 * WelcomeBackBadge — a small, dismissible banner shown at the top of the
 * HomeScreen when the user returns after 3+ days of inactivity.
 *
 * - Warm, encouraging copy (never shows how many days were missed)
 * - Dismisses on tap
 * - Auto-dismisses after 5 seconds
 * - Only shows once per session (persists dismissal in sessionStorage)
 * - Never guilt-based or pressuring
 *
 * Validates: Task 77 — Gentle re-engagement without nagging
 */
export function WelcomeBackBadge() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("")
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    // Don't show if already dismissed this session
    if (isWelcomeBackDismissed()) return

    const { isReturningUser } = getLastActiveInfo()
    if (!isReturningUser) return

    // Show the badge
    setMessage(pickWelcomeMessage())
    setVisible(true)

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setVisible(false)
      dismissWelcomeBack()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    dismissWelcomeBack()
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={handleDismiss}
          role="status"
          aria-live="polite"
          aria-label={`${message} Tap to dismiss.`}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={prefersReducedMotion ? timings.fast : springs.gentle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "rgba(167, 139, 250, 0.08)",
            border: "1px solid rgba(167, 139, 250, 0.2)",
            borderRadius: 12,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 18 }} aria-hidden="true">
            👋
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {message}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted)",
              fontFamily: FONT_FAMILY,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            ✕
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
