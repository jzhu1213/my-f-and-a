"use client"

/**
 * AllowanceHero — Composed component
 *
 * Displays the daily allowance amount at display tier (72–80px fluid) with a
 * ProgressRing and status message. Centered composition with gradient text fill
 * via background-clip, tabular-nums for aligned digits.
 *
 * - Display-tier text (fluid 72–80px) for the amount
 * - ProgressRing from primitives (hero size)
 * - Status message below the amount
 * - Gradient text fill via DISPLAY_GRADIENT_CLASS (background-clip)
 * - tabular-nums for digit alignment
 * - Centered vertical composition
 *
 * Requirements: 16.1, 12.1
 */

import React from "react"
import { ProgressRing } from "@/components/ui/primitives/ProgressRing"
import {
  typography,
  FONT_FAMILY,
  TABULAR_NUMS,
  DISPLAY_GRADIENT_CLASS,
} from "@/styles/typography"
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface AllowanceHeroProps {
  /** The daily allowance amount (number). */
  amount: number
  /** Progress percentage (0–100) for the ring. */
  progress: number
  /** Status message text displayed below the amount. */
  statusMessage: string
  /** Progress ring color variant. */
  ringColor?: "accent" | "success" | "warning" | "error"
  /** Whether data is still loading (shows skeleton-like state). */
  loading?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a number as a currency string ($ with 2 decimal places).
 */
function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ============================================================================
// Component
// ============================================================================

export function AllowanceHero({
  amount,
  progress,
  statusMessage,
  ringColor = "accent",
  loading = false,
}: AllowanceHeroProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacingScale["16"],
    textAlign: "center",
  }

  const amountStyle: React.CSSProperties = {
    ...typography.display,
    ...TABULAR_NUMS,
    fontVariantNumeric: "tabular-nums",
    margin: 0,
    padding: 0,
    /* Gradient text is applied via className (DISPLAY_GRADIENT_CLASS) */
  }

  const statusStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: typography["body-sm"].fontWeight,
    lineHeight: typography["body-sm"].lineHeight,
    letterSpacing: typography["body-sm"].letterSpacing,
    color: textColors.sub,
    margin: 0,
  }

  if (loading) {
    return (
      <div style={containerStyle} aria-busy="true" aria-label="Loading allowance">
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "var(--color-surface)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            width: "180px",
            height: "72px",
            borderRadius: "var(--radius-control)",
            background: "var(--color-surface)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            width: "140px",
            height: "18px",
            borderRadius: "var(--radius-min)",
            background: "var(--color-surface)",
            opacity: 0.3,
          }}
        />
      </div>
    )
  }

  return (
    <div style={containerStyle} role="region" aria-label="Daily allowance">
      {/* Progress ring */}
      <ProgressRing
        progress={progress}
        size="hero"
        state="animating"
        color={ringColor}
        aria-label={`Budget progress: ${Math.round(progress)}%`}
      />

      {/* Display-tier amount */}
      <p className={DISPLAY_GRADIENT_CLASS} style={amountStyle} aria-live="polite">
        {formatAmount(amount)}
      </p>

      {/* Status message */}
      <p style={statusStyle}>{statusMessage}</p>
    </div>
  )
}
