"use client"

/**
 * EmptyState
 *
 * A warm, illustrated empty-state component that replaces bare emoji + text
 * patterns throughout the app. Renders a small inline SVG illustration, a
 * friendly one-liner title, an encouraging subtitle, and an optional primary
 * action button so the user is never left at a dead end.
 *
 * Phase 6, task 264 — "Empty states with personality."
 *
 * Accessibility:
 * - Illustrations are decorative (`aria-hidden`)
 * - Action button has an explicit aria-label when provided
 * - Respects `prefers-reduced-motion` for entrance animation
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   illustration="transactions"
 *   title="Ready when you are"
 *   subtitle="Log your first expense and Folio starts learning your habits"
 *   actionLabel="Log expense →"
 *   onAction={() => openExpenseSheet()}
 * />
 * ```
 */

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import {
  emptyStateContainer,
  emptyStateTitle,
  emptyStateSubtitle,
  emptyStateAction,
  borderRadius,
  colorRamp,
} from "@/styles/shared"
import { semanticColors } from "@/styles/colors"
import { typography, fontWeights, FONT_FAMILY } from '@/styles/typography'

// ============================================================================
// Illustration types & SVGs
// ============================================================================

/**
 * Named illustration presets. Each maps to a hand-crafted inline SVG that
 * adapts to the accent theme via `currentColor` and CSS variables.
 */
export type EmptyStateIllustration =
  | "transactions"
  | "goals"
  | "filter"
  | "review"
  | "budget"
  | "generic"

/** Props for the EmptyState component. */
export interface EmptyStateProps {
  /** Named illustration preset, or a custom ReactNode. */
  illustration: EmptyStateIllustration | ReactNode
  /** Primary warm one-liner. */
  title: string
  /** Encouraging subtitle. */
  subtitle: string
  /** Primary action button label. */
  actionLabel?: string
  /** Handler for the primary action button. */
  onAction?: () => void
  /** Optional secondary action label. */
  secondaryLabel?: string
  /** Handler for the secondary action. */
  onSecondary?: () => void
  /** Accessible label override for the action button. */
  actionAriaLabel?: string
  /** Custom accent color for the action button. Defaults to accent purple. */
  actionColor?: "accent" | "success"
}

// ============================================================================
// Inline SVG illustrations (48×48, `currentColor` + accent vars)
// ============================================================================

function IllustrationTransactions() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Notepad body */}
      <rect x="12" y="8" width="24" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      {/* Lines on notepad */}
      <line x1="17" y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="17" y1="23" x2="28" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="17" y1="29" x2="25" y2="29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Sparkle (top-right) */}
      <path
        d="M36 10 L37 13 L40 14 L37 15 L36 18 L35 15 L32 14 L35 13 Z"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Small sparkle (bottom-left) */}
      <circle cx="10" cy="36" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

function IllustrationGoals() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Gentle hill */}
      <path
        d="M4 40 Q16 28 24 30 Q32 32 44 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
        fill="none"
      />
      {/* Flag pole */}
      <line x1="32" y1="12" x2="32" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Flag */}
      <path
        d="M32 12 L40 16 L32 20 Z"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Small star accent */}
      <path
        d="M14 14 L15 16 L17 16.5 L15.5 18 L16 20 L14 19 L12 20 L12.5 18 L11 16.5 L13 16 Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  )
}

function IllustrationFilter() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Magnifying glass */}
      <circle cx="22" cy="22" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <line x1="29.5" y1="29.5" x2="37" y2="37" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Soft horizontal lines inside (representing filtered-out content) */}
      <line x1="17" y1="20" x2="27" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="18" y1="24" x2="25" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Gentle dot accent */}
      <circle cx="38" cy="12" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

function IllustrationReview() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Pot / soil line */}
      <path
        d="M16 38 Q24 40 32 38"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Stem */}
      <line x1="24" y1="20" x2="24" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Left leaf */}
      <path
        d="M24 28 Q18 24 20 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Right leaf */}
      <path
        d="M24 24 Q30 20 30 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Sparkle top */}
      <path
        d="M24 8 L25 11 L28 12 L25 13 L24 16 L23 13 L20 12 L23 11 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}

function IllustrationBudget() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Target rings */}
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.6" />
      {/* Sparkle accent */}
      <path
        d="M38 10 L39 12.5 L41.5 13.5 L39 14.5 L38 17 L37 14.5 L34.5 13.5 L37 12.5 Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  )
}

function IllustrationGeneric() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: semanticColors.accent }}
    >
      {/* Central sparkle */}
      <path
        d="M24 12 L26 19 L33 20 L26 22 L24 29 L22 22 L15 20 L22 19 Z"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Small orbiting dots */}
      <circle cx="12" cy="32" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="36" cy="32" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="18" cy="38" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

/** Resolves a named illustration key to its SVG component. */
function resolveIllustration(illustration: EmptyStateIllustration): ReactNode {
  switch (illustration) {
    case "transactions":
      return <IllustrationTransactions />
    case "goals":
      return <IllustrationGoals />
    case "filter":
      return <IllustrationFilter />
    case "review":
      return <IllustrationReview />
    case "budget":
      return <IllustrationBudget />
    case "generic":
    default:
      return <IllustrationGeneric />
  }
}

// ============================================================================
// Component
// ============================================================================

export function EmptyState({
  illustration,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  actionAriaLabel,
  actionColor = "accent",
}: EmptyStateProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const illustrationNode =
    typeof illustration === "string"
      ? resolveIllustration(illustration as EmptyStateIllustration)
      : illustration

  const actionBg =
    actionColor === "success" ? colorRamp.success[200] : colorRamp.accent[200]
  const actionBorder =
    actionColor === "success"
      ? `1px solid ${colorRamp.success[300]}`
      : `1px solid ${colorRamp.accent[300]}`
  const actionTextColor =
    actionColor === "success" ? semanticColors.success : semanticColors.accent

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? timings.fast : springs.gentle}
      style={{
        ...emptyStateContainer,
        padding: "32px 20px",
      }}
    >
      {/* Illustration */}
      <div style={{ marginBottom: 4 }}>{illustrationNode}</div>

      {/* Title */}
      <p style={emptyStateTitle}>{title}</p>

      {/* Subtitle */}
      <p style={emptyStateSubtitle}>{subtitle}</p>

      {/* Primary action */}
      {actionLabel && onAction && (
        <motion.button
          type="button"
          onClick={onAction}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.96 }}
          transition={springs.snappy}
          style={{
            ...emptyStateAction,
            background: actionBg,
            border: actionBorder,
            color: actionTextColor,
          }}
          aria-label={actionAriaLabel ?? actionLabel}
        >
          {actionLabel}
        </motion.button>
      )}

      {/* Secondary action */}
      {secondaryLabel && onSecondary && (
        <motion.button
          type="button"
          onClick={onSecondary}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.96 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            padding: "6px 12px",
            color: "var(--sub)",
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            cursor: "pointer",
            opacity: 0.8,
          }}
        >
          {secondaryLabel}
        </motion.button>
      )}
    </motion.div>
  )
}
