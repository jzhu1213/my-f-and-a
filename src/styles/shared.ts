/**
 * Shared style objects for reuse across simplified screens.
 *
 * Extracts commonly repeated inline style patterns from HomeScreen and
 * SettingsScreen into named, typed constants. All objects are
 * `React.CSSProperties`-compatible.
 *
 * Requirements: 8.2, 8.4
 */

import type { CSSProperties } from "react"
import { FONT_FAMILY, spacing, pxToRem } from "./typography"

// ============================================================================
// Layout constants
// ============================================================================

/** Maximum content width used by all simplified screens. */
export const CONTENT_MAX_WIDTH = 560

/** Bottom padding to clear the floating dock. */
export const DOCK_PADDING_BOTTOM = 120

/** Standard horizontal page padding. */
export const HORIZONTAL_PADDING = 20

// ============================================================================
// Shared style objects
// ============================================================================

/**
 * Section heading / overline label — used for "Budget Limits", "Goals",
 * "Categories", "Recent", etc.
 */
export const sectionHeading: CSSProperties = {
  fontSize: pxToRem(13),
  fontWeight: 500,
  color: "var(--sub)",
  fontFamily: FONT_FAMILY,
}

/**
 * Stronger section heading variant used in SettingsScreen card headers —
 * fontWeight 600 with muted color and letter-spacing.
 */
export const sectionHeadingStrong: CSSProperties = {
  fontSize: pxToRem(13),
  fontWeight: 600,
  color: "var(--muted)",
  letterSpacing: "0.02em",
  marginBottom: 12,
}

/**
 * Link-style navigation button — "Manage limits →", "See all →", etc.
 */
export const linkButton: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: pxToRem(14),
  fontWeight: 500,
  color: "var(--sub)",
  cursor: "pointer",
  fontFamily: FONT_FAMILY,
}

/**
 * Empty state container — centered flex column with gap.
 */
export const emptyStateContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing.sm - 2, // 10px as in existing code
}

/**
 * Empty state title text.
 */
export const emptyStateTitle: CSSProperties = {
  fontSize: pxToRem(14),
  color: "var(--text)",
  textAlign: "center",
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
}

/**
 * Empty state subtitle / description text.
 */
export const emptyStateSubtitle: CSSProperties = {
  fontSize: pxToRem(12),
  color: "var(--sub)",
  textAlign: "center",
  fontFamily: FONT_FAMILY,
  opacity: 0.8,
}

/**
 * List row — flex row with space-between, used for category/goal lists.
 */
export const listRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  fontSize: pxToRem(14),
  color: "var(--text)",
}

/**
 * Ghost pill button — transparent background with rounded border.
 * Used for "Log income" style secondary actions.
 */
export const pillButton: CSSProperties = {
  background: "transparent",
  border: "1.5px solid rgba(74, 222, 128, 0.4)",
  borderRadius: 99,
  padding: "10px 20px",
  color: "var(--success)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
}

/**
 * Chip button — the "Log Again" repeat chip styling.
 */
export const chipButton: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 99,
  color: "var(--text)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
  whiteSpace: "nowrap",
  backdropFilter: "blur(8px)",
}

// ============================================================================
// Border radius tokens
// ============================================================================

/**
 * Named border-radius tokens used across all surfaces and controls.
 * Maps to CSS variables defined in globals.css (--radius-sm, --radius-md, etc.)
 */
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const

// ============================================================================
// Common surface patterns
// ============================================================================

/**
 * Glass surface — translucent background with backdrop blur, used for
 * secondary surfaces that sit over the mesh (e.g. inline forms, overlays).
 */
export const glassSurface: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: borderRadius.md,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
}

/**
 * Segmented control container — wraps a row of toggle buttons.
 */
export const segmentedControl: CSSProperties = {
  display: "flex",
  gap: 6,
  padding: 4,
  borderRadius: borderRadius.md,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid var(--border)",
}

/**
 * Segmented control button (active state applied conditionally).
 */
export const segmentedButtonBase: CSSProperties = {
  flex: 1,
  padding: "10px 0",
  borderRadius: 9,
  border: "none",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
  transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
  textAlign: "center",
}

export const segmentedButtonActive: CSSProperties = {
  color: "var(--text)",
  background: "rgba(255, 255, 255, 0.08)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
}

export const segmentedButtonInactive: CSSProperties = {
  color: "var(--muted)",
  background: "transparent",
  boxShadow: "none",
}

/**
 * Destructive / danger zone container.
 */
export const dangerZone: CSSProperties = {
  padding: 16,
  borderRadius: borderRadius.md,
  background: "rgba(248, 113, 113, 0.1)",
  border: "1px solid rgba(248, 113, 113, 0.3)",
}

/**
 * Progress track — a thin bar background for budget/goal progress.
 */
export const progressTrack: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 2,
  background: "rgba(255, 255, 255, 0.08)",
  overflow: "hidden",
}

/**
 * Round stepper/counter button (e.g. split count +/- buttons).
 */
export const roundButton: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  fontSize: pxToRem(18),
  fontFamily: FONT_FAMILY,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}
