"use client"

/**
 * EmptyState — Feedback primitive
 *
 * Encouraging centered message for empty views with an optional primary action button.
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Props:
 * - `action` (boolean) — show a primary action button
 * - `title` (string) — friendly one-liner
 * - `message` (string) — encouraging subtitle
 * - `actionLabel` (string) — CTA text (required when action=true)
 * - `onAction` (() => void) — CTA handler
 * - `illustration` (ReactNode) — optional decorative visual
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { spacingScale } from "@/styles/layout"
import { radius } from "@/styles/surfaces"
import { colorRamp, textColors, gradients, surfaceColors } from "@/styles/colors"

// ============================================================================
// Props
// ============================================================================

export interface EmptyStateProps {
  /** Friendly title line. */
  title: string
  /** Encouraging subtitle / explanation. */
  message: string
  /** Whether to show a primary action button. */
  action?: boolean
  /** CTA button text (required when action=true). */
  actionLabel?: string
  /** CTA handler. */
  onAction?: () => void
  /** Optional decorative illustration (rendered above title). */
  illustration?: ReactNode
}

// ============================================================================
// Component
// ============================================================================

export function EmptyState({
  title,
  message,
  action = false,
  actionLabel,
  onAction,
  illustration,
}: EmptyStateProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? timings.fast : springs.gentle}
      role="status"
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
      {/* Optional illustration */}
      {illustration && (
        <div aria-hidden="true" style={{ marginBottom: spacingScale["4"] }}>
          {illustration}
        </div>
      )}

      {/* Title */}
      <p
        style={{
          ...typography.subhead,
          color: textColors.text,
          margin: 0,
        }}
      >
        {title}
      </p>

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

      {/* Primary action */}
      {action && actionLabel && onAction && (
        <motion.button
          type="button"
          onClick={onAction}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.98 }}
          transition={springs.snappy}
          style={{
            marginTop: spacingScale["4"],
            padding: `${spacingScale["12"]} ${spacingScale["24"]}`,
            borderRadius: radius.full,
            border: "none",
            background: gradients.action,
            color: surfaceColors.canvas,
            fontFamily: FONT_FAMILY,
            fontSize: typography["body-sm"].fontSize,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label={actionLabel}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  )
}
