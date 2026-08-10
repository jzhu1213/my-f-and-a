/**
 * Shared Page Styles
 *
 * Common style objects and layout patterns used across all four public/shared
 * pages (spending summary, goal, support, pool). Every visual value is sourced
 * from the Design_Token_System — zero page-local overrides.
 *
 * Imports from:
 * - @/styles/typography  → typography tiers, FONT_FAMILY, TABULAR_NUMS
 * - @/styles/colors      → textColors, colorRamp, semanticColors
 * - @/styles/layout      → spacingScale, CONTENT_MAX_WIDTH, HORIZONTAL_PADDING
 * - @/styles/surfaces    → elevations, radius
 *
 * Phase 17, Task 19.4 — Design Token System rebuild
 * Requirements: 15.8, 15.9, 15.10
 */

import type { CSSProperties } from "react"
import { typography, FONT_FAMILY, TABULAR_NUMS, spacing } from "@/styles/typography"
import { colorRamp, textColors, semanticColors } from "@/styles/colors"
import { CONTENT_MAX_WIDTH, HORIZONTAL_PADDING, spacingScale } from "@/styles/layout"
import { elevations, radius } from "@/styles/surfaces"

// ============================================================================
// Page container
// ============================================================================

/**
 * Full-page wrapper for all shared pages. Centered, padded, min-height viewport.
 * Uses canvas-tier fill from the Surface_System.
 */
export const sharedPageContainer: CSSProperties = {
  maxWidth: CONTENT_MAX_WIDTH,
  margin: "0 auto",
  padding: `${spacingScale["64"]} ${HORIZONTAL_PADDING}px ${spacingScale["40"]}`,
  fontFamily: FONT_FAMILY,
  minHeight: "100vh",
  background: elevations.canvas.fill,
}

// ============================================================================
// Header badge
// ============================================================================

/**
 * The "SHARED VIEW" / "SHARED GOAL" / etc. pill badge at the top of the page.
 */
export const headerBadge: CSSProperties = {
  ...typography.overline,
  padding: `${spacingScale["4"]} ${spacingScale["12"]}`,
  borderRadius: radius.full,
  background: colorRamp.accent[100],
  border: `1px solid ${colorRamp.accent[300]}`,
  color: colorRamp.accent[500],
}

/**
 * Container row for the badge + optional subtitle.
 */
export const headerBadgeRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacingScale["8"],
  marginBottom: spacingScale["24"],
}

/**
 * Subtitle text next to the badge (e.g. "· Budget Summary").
 */
export const headerSubtitle: CSSProperties = {
  ...typography.caption,
  color: textColors.muted,
}

// ============================================================================
// Not-found / expired state
// ============================================================================

/**
 * Wrapper for the not-found / expired link state.
 */
export const notFoundContainer: CSSProperties = {
  textAlign: "center",
  marginTop: spacingScale["96"],
}

/**
 * Icon wrapper in the not-found state.
 */
export const notFoundIconWrapper: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: radius.full,
  background: colorRamp.error[100],
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: `0 auto ${spacingScale["16"]}`,
  color: colorRamp.error[500],
}

/**
 * Title text in the not-found state.
 */
export const notFoundTitle: CSSProperties = {
  ...typography.headline,
  color: textColors.text,
  marginBottom: spacingScale["8"],
}

/**
 * Description text in the not-found state.
 */
export const notFoundDescription: CSSProperties = {
  ...typography.body,
  color: textColors.sub,
  maxWidth: 300,
  margin: "0 auto",
}

// ============================================================================
// Loading state
// ============================================================================

export const loadingText: CSSProperties = {
  ...typography.body,
  color: textColors.sub,
  textAlign: "center",
  marginTop: spacingScale["96"],
}

// ============================================================================
// Section label (overline)
// ============================================================================

export const sectionLabel: CSSProperties = {
  ...typography.overline,
  color: textColors.muted,
  marginBottom: spacingScale["12"],
}

// ============================================================================
// Card styles (from Surface_System)
// ============================================================================

/**
 * Style for a resting-tier card. Replaces GlassCard elevation="low".
 */
export const cardResting: CSSProperties = {
  background: elevations.resting.fill,
  border: elevations.resting.border,
  boxShadow: elevations.resting.shadow,
  borderRadius: radius.card,
}

/**
 * Style for a raised-tier card. Replaces GlassCard elevation="medium"/"high".
 */
export const cardRaised: CSSProperties = {
  background: elevations.raised.fill,
  border: elevations.raised.border,
  boxShadow: elevations.raised.shadow,
  backdropFilter: `blur(${elevations.raised.blur})`,
  WebkitBackdropFilter: `blur(${elevations.raised.blur})`,
  borderRadius: radius.card,
}

// ============================================================================
// Progress bar (token-based replacement for progressTrack from shared.ts)
// ============================================================================

/**
 * Progress track — a thin bar background for budget/goal progress.
 * Uses sunken-tier fill from Surface_System.
 */
export const progressTrack: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: radius.min,
  background: elevations.sunken.fill,
  overflow: "hidden",
}

// ============================================================================
// Footer / attribution
// ============================================================================

export const footerText: CSSProperties = {
  ...typography.caption,
  color: textColors.muted,
  textAlign: "center",
  marginTop: spacingScale["24"],
}

export const footerAttribution: CSSProperties = {
  ...typography.caption,
  color: textColors.muted,
  textAlign: "center",
  marginTop: spacingScale["4"],
  opacity: 0.6,
}

// ============================================================================
// Input & action button
// ============================================================================

export const sharedInput: CSSProperties = {
  flex: 1,
  padding: `${spacingScale["12"]} ${spacingScale["12"]}`,
  ...typography.body,
  color: textColors.text,
  background: elevations.sunken.fill,
  border: elevations.sunken.border,
  borderRadius: radius.control,
  outline: "none",
}

export function sharedActionButton(enabled: boolean): CSSProperties {
  return {
    padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    fontFamily: FONT_FAMILY,
    color: enabled ? textColors.text : textColors.muted,
    background: enabled ? colorRamp.accent[600] : elevations.sunken.fill,
    border: "none",
    borderRadius: radius.control,
    cursor: enabled ? "pointer" : "default",
    boxShadow: enabled ? "var(--shadow-glow-accent)" : "none",
    transition: "background 0.2s, box-shadow 0.2s",
  }
}

// ============================================================================
// Detail rows (key/value)
// ============================================================================

export const detailRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

export const detailLabel: CSSProperties = {
  ...typography.body,
  color: textColors.sub,
}

export const detailValue: CSSProperties = {
  ...typography.body,
  fontWeight: 500,
  color: textColors.text,
  ...TABULAR_NUMS,
}

// ============================================================================
// Re-exports for page convenience (from Design_Token_System only)
// ============================================================================

export { TABULAR_NUMS, spacing, colorRamp, typography, FONT_FAMILY }
export { textColors, semanticColors }
export { spacingScale, CONTENT_MAX_WIDTH, HORIZONTAL_PADDING }
export { elevations, radius }
