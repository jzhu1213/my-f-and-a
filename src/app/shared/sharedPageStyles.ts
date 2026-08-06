/**
 * Shared Page Styles
 *
 * Common style objects and layout patterns used across all four public/shared
 * pages (spending summary, goal, support, pool). Extracted so these pages
 * share a consistent premium look without duplicating token usage.
 *
 * Phase 6 — Task 269.1
 */

import type { CSSProperties } from "react"
import { typography, FONT_FAMILY, TABULAR_NUMS, spacing } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  SECTION_SPACING,
  borderRadius,
  colorRamp,
  fills,
  shadows,
} from "@/styles/shared"

// ============================================================================
// Page container
// ============================================================================

/**
 * Full-page wrapper for all shared pages. Centered, padded, min-height viewport.
 */
export const sharedPageContainer: CSSProperties = {
  maxWidth: CONTENT_MAX_WIDTH,
  margin: "0 auto",
  padding: `60px ${HORIZONTAL_PADDING}px 40px`,
  fontFamily: FONT_FAMILY,
  minHeight: "100vh",
  background: "var(--bg)",
}

// ============================================================================
// Header badge
// ============================================================================

/**
 * The "SHARED VIEW" / "SHARED GOAL" / etc. pill badge at the top of the page.
 */
export const headerBadge: CSSProperties = {
  ...typography.overline,
  padding: "4px 10px",
  borderRadius: borderRadius.full,
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
  gap: 8,
  marginBottom: spacing.lg,
}

/**
 * Subtitle text next to the badge (e.g. "· Budget Summary").
 */
export const headerSubtitle: CSSProperties = {
  ...typography.caption,
  color: "var(--muted)",
}

// ============================================================================
// Not-found / expired state
// ============================================================================

/**
 * Wrapper for the not-found / expired link state.
 */
export const notFoundContainer: CSSProperties = {
  textAlign: "center",
  marginTop: 80,
}

/**
 * Icon wrapper in the not-found state.
 */
export const notFoundIconWrapper: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: colorRamp.error[100],
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 16px",
  color: colorRamp.error[500],
}

/**
 * Title text in the not-found state.
 */
export const notFoundTitle: CSSProperties = {
  ...typography.headline,
  color: "var(--text)",
  marginBottom: 8,
}

/**
 * Description text in the not-found state.
 */
export const notFoundDescription: CSSProperties = {
  ...typography.body,
  color: "var(--sub)",
  maxWidth: 300,
  margin: "0 auto",
}

// ============================================================================
// Loading state
// ============================================================================

export const loadingText: CSSProperties = {
  ...typography.body,
  color: "var(--sub)",
  textAlign: "center",
  marginTop: 80,
}

// ============================================================================
// Section label (overline)
// ============================================================================

export const sectionLabel: CSSProperties = {
  ...typography.overline,
  color: "var(--muted)",
  marginBottom: spacing.sm,
}

// ============================================================================
// Footer / attribution
// ============================================================================

export const footerText: CSSProperties = {
  ...typography.caption,
  color: "var(--muted)",
  textAlign: "center",
  marginTop: spacing.lg,
}

export const footerAttribution: CSSProperties = {
  ...typography.caption,
  color: "var(--muted)",
  textAlign: "center",
  marginTop: spacing.xs,
  opacity: 0.6,
}

// ============================================================================
// Input & action button
// ============================================================================

export const sharedInput: CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  ...typography.body,
  color: "var(--text)",
  background: fills[4],
  border: `1px solid ${fills[8]}`,
  borderRadius: borderRadius.sm,
  outline: "none",
}

export function sharedActionButton(enabled: boolean): CSSProperties {
  return {
    padding: "10px 18px",
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    fontFamily: FONT_FAMILY,
    color: enabled ? "#fff" : "var(--muted)",
    background: enabled ? colorRamp.accent[600] : fills[4],
    border: "none",
    borderRadius: borderRadius.sm,
    cursor: enabled ? "pointer" : "default",
    boxShadow: enabled ? shadows.glowAccent : "none",
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
  color: "var(--sub)",
}

export const detailValue: CSSProperties = {
  ...typography.body,
  fontWeight: 500,
  color: "var(--text)",
  ...TABULAR_NUMS,
}

// ============================================================================
// Section spacing constant
// ============================================================================

export { SECTION_SPACING, TABULAR_NUMS, spacing, colorRamp, fills, shadows, borderRadius, typography, FONT_FAMILY }
