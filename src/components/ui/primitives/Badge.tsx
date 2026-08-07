"use client"

/**
 * Badge — Feedback primitive
 *
 * Small status indicator with semantic color variants.
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Variants:
 * - `accent` — brand/default (uses --color-accent-* ramp)
 * - `success` — positive states (uses --color-success-* ramp)
 * - `warning` — caution states (uses --color-warning-* ramp)
 * - `error` — danger/error states (uses --color-error-* ramp)
 * - `neutral` — informational, no emphasis (uses surface tokens)
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import type { ReactNode } from "react"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { colorRamp, surfaceColors, textColors } from "@/styles/colors"

// ============================================================================
// Types
// ============================================================================

export type BadgeVariant = "accent" | "success" | "warning" | "error" | "neutral"

export interface BadgeProps {
  /** Semantic color variant. */
  variant?: BadgeVariant
  /** Badge content (text or icon). */
  children: ReactNode
}

// ============================================================================
// Variant Styling
// ============================================================================

interface BadgeStyles {
  background: string
  color: string
  border: string
}

function getVariantStyles(variant: BadgeVariant): BadgeStyles {
  switch (variant) {
    case "accent":
      return {
        background: colorRamp.accent[100],
        color: colorRamp.accent[500],
        border: `1px solid ${colorRamp.accent[300]}`,
      }
    case "success":
      return {
        background: colorRamp.success[100],
        color: colorRamp.success[500],
        border: `1px solid ${colorRamp.success[300]}`,
      }
    case "warning":
      return {
        background: colorRamp.warning[100],
        color: colorRamp.warning[500],
        border: `1px solid ${colorRamp.warning[300]}`,
      }
    case "error":
      return {
        background: colorRamp.error[100],
        color: colorRamp.error[500],
        border: `1px solid ${colorRamp.error[300]}`,
      }
    case "neutral":
      return {
        background: surfaceColors.raised,
        color: textColors.sub,
        border: "1px solid var(--border-subtle)",
      }
  }
}

// ============================================================================
// Component
// ============================================================================

export function Badge({ variant = "neutral", children }: BadgeProps) {
  const styles = getVariantStyles(variant)

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacingScale["4"],
        padding: `${spacingScale["4"]} ${spacingScale["8"]}`,
        borderRadius: radius.full,
        background: styles.background,
        color: styles.color,
        border: styles.border,
        fontFamily: FONT_FAMILY,
        fontSize: typography.caption.fontSize,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {children}
    </span>
  )
}
