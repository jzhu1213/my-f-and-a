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
import { FONT_FAMILY, spacing } from "./typography"

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
  fontSize: 13,
  fontWeight: 500,
  color: "var(--sub)",
  fontFamily: FONT_FAMILY,
}

/**
 * Stronger section heading variant used in SettingsScreen card headers —
 * fontWeight 600 with muted color and letter-spacing.
 */
export const sectionHeadingStrong: CSSProperties = {
  fontSize: 13,
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
  fontSize: 14,
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
  fontSize: 14,
  color: "var(--text)",
  textAlign: "center",
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
}

/**
 * Empty state subtitle / description text.
 */
export const emptyStateSubtitle: CSSProperties = {
  fontSize: 12,
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
  fontSize: 14,
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
  fontSize: 13,
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
  fontSize: 13,
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
  whiteSpace: "nowrap",
  backdropFilter: "blur(8px)",
}
