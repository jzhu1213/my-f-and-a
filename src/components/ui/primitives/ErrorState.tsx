"use client"

/**
 * ErrorState — Feedback primitive
 *
 * Warm, non-judgmental error message with an optional retry button.
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Props:
 * - `retry` (boolean) — show a retry button
 * - `title` (string) — short error title
 * - `message` (string) — friendly explanation
 * - `onRetry` (() => void) — retry handler
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { typography, FONT_FAMILY, fontWeights } from '@/styles/typography'
import { spacingScale } from "@/styles/layout"
import { radius } from "@/styles/surfaces"
import { colorRamp, textColors } from "@/styles/colors"

// ============================================================================
// Props
// ============================================================================

export interface ErrorStateProps {
  /** Short error title. */
  title?: string
  /** Friendly explanation of what went wrong. */
  message?: string
  /** Whether to show a retry button. */
  retry?: boolean
  /** Handler for the retry button. */
  onRetry?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn\u2019t load this \u2014 give it another try?",
  retry = false,
  onRetry,
}: ErrorStateProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? timings.fast : springs.gentle}
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacingScale["12"],
        padding: `${spacingScale["40"]} ${spacingScale["20"]}`,
        maxWidth: 320,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Error indicator */}
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          background: colorRamp.error[100],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colorRamp.error[500],
          fontSize: typography.subhead.fontSize,
          fontWeight: fontWeights.bold,
        }}
      >
        !
      </div>

      {/* Title */}
      <h3
        style={{
          ...typography.subhead,
          color: textColors.text,
          margin: 0,
        }}
      >
        {title}
      </h3>

      {/* Message */}
      <p
        style={{
          ...typography["body-sm"],
          color: textColors.sub,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>

      {/* Retry button */}
      {retry && onRetry && (
        <motion.button
          type="button"
          onClick={onRetry}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.96 }}
          transition={springs.snappy}
          style={{
            marginTop: spacingScale["4"],
            padding: `${spacingScale["12"]} ${spacingScale["24"]}`,
            borderRadius: radius.full,
            border: `1px solid ${colorRamp.error[300]}`,
            background: colorRamp.error[100],
            color: colorRamp.error[500],
            fontFamily: FONT_FAMILY,
            fontSize: typography["body-sm"].fontSize,
            fontWeight: fontWeights.semibold,
            cursor: "pointer",
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Try again"
        >
          Try again
        </motion.button>
      )}
    </motion.div>
  )
}
