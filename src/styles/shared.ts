/**
 * Shared style objects for reuse across simplified screens.
 *
 * This file serves as a backward-compatible barrel re-export. It preserves all
 * existing exports that components depend on, while also re-exporting from the
 * new token modules introduced in the design overhaul.
 *
 * Requirements: 8.2, 8.4
 */

import type { CSSProperties } from "react"
import type { TransactionCategory } from "@/types"
import { FONT_FAMILY, spacing, pxToRem } from "./typography"

// ============================================================================
// Re-exports from new token modules
// ============================================================================

export type { TokenAccessor } from './tokens'
export { opacity, zIndex } from './tokens'
export type { OpacityStep, ZIndexLayer } from './tokens'

export { surfaceColors, textColors, gradients, semanticColors } from './colors'
export type { SurfaceColorName, TextColorName, GradientName } from './colors'

export { elevations, radius } from './surfaces'
export type { ElevationTier, ElevationDefinition, RadiusName } from './surfaces'

export { spacingScale, safeArea, safeAreaPadding, safeAreaBottom } from './layout'
export type { SpacingStep } from './layout'

export { springPresets, durations, easings } from './motion'
export type { SpringPreset, SpringPresetName, DurationName, EasingName } from './motion'

// ============================================================================
// Color ramp tokens (Phase 6 — task 260.2)
// ============================================================================

/**
 * A color ramp step type. Steps 50–200 are translucent fills, 300–400 are
 * borders/rings, 500 is the base, 600–900 are interactive/prominent states.
 */
export type RampStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

/**
 * A full 10-step color ramp mapping to CSS custom properties.
 * Use in inline styles: `background: colorRamp.accent[100]`.
 */
export type ColorRamp = Record<RampStep, string>

function buildRamp(prefix: string): ColorRamp {
  return {
    50: `var(--${prefix}-50)`,
    100: `var(--${prefix}-100)`,
    200: `var(--${prefix}-200)`,
    300: `var(--${prefix}-300)`,
    400: `var(--${prefix}-400)`,
    500: `var(--${prefix}-500)`,
    600: `var(--${prefix}-600)`,
    700: `var(--${prefix}-700)`,
    800: `var(--${prefix}-800)`,
    900: `var(--${prefix}-900)`,
  }
}

/**
 * Semantic color ramps referencing the CSS custom properties defined in
 * globals.css `:root`. Use these in inline styles instead of ad-hoc
 * `rgba(129, 140, 248, ...)` values.
 */
export const colorRamp = {
  accent: buildRamp('accent'),
  success: buildRamp('success'),
  warning: buildRamp('warning'),
  error: buildRamp('error'),
  blue: buildRamp('blue'),
} as const

// ============================================================================
// Category accent colors (Phase 6 — task 234.1)
// ============================================================================

/**
 * Per-`TransactionCategory` accent color used for the tinted icon-chip.
 *
 * Color-blind-safe palette (CVD-verified):
 * - Each color is distinguishable under protanopia, deuteranopia, and tritanopia
 * - No two adjacent-use colors share the same hue/lightness under simulation
 * - Previously identical health/income are now differentiated (teal vs blue-green)
 * - Purple cluster (drinks/rent/gig) spread across distinct hue angles
 */
export const CATEGORY_ACCENTS: Record<TransactionCategory | "fallback", string> = {
  food: "#fb923c", // warm orange — distinct from amber in all CVD types
  drinks: "#7c3aed", // deep violet — shifted darker to separate from gig/rent
  rent: "#a78bfa", // brand purple (accent-2)
  transport: "#3b82f6", // blue (slightly deeper for CVD contrast vs cyan)
  school: "#f59e0b", // amber — shifted from #fbbf24 for better orange separation
  fun: "#ec4899", // hot pink — shifted for tritanopia distinction from red
  health: "#2dd4bf", // teal — shifted from green to avoid red-green confusion
  subscriptions: "#22d3ee", // cyan — distinct from teal by lightness
  gig: "#d946ef", // magenta/fuchsia — distinct from violet/purple in all CVD types
  income: "#34d399", // emerald — differentiated from health teal by hue
  other: "#94a3b8", // neutral slate
  fallback: "#818cf8", // --accent
}

/**
 * Resolve a category to its accent color, falling back to purple accent.
 */
export function getCategoryAccent(category: TransactionCategory | string): string {
  return (CATEGORY_ACCENTS as Record<string, string>)[category] ?? CATEGORY_ACCENTS.fallback
}

// ============================================================================
// White alpha fill tokens (Phase 6 — task 261.1)
// ============================================================================

/**
 * White alpha fill tokens used for translucent surface backgrounds and borders.
 * Maps to CSS custom properties defined in globals.css (--fill-02 through --fill-15).
 */
export const fills = {
  2: "var(--fill-02)",
  3: "var(--fill-03)",
  4: "var(--fill-04)",
  5: "var(--fill-05)",
  6: "var(--fill-06)",
  8: "var(--fill-08)",
  10: "var(--fill-10)",
  12: "var(--fill-12)",
  15: "var(--fill-15)",
} as const

// ============================================================================
// Layout constants
// ============================================================================

/**
 * Maximum content width used by all simplified screens.
 */
export const CONTENT_MAX_WIDTH = 560

/** Bottom padding to clear the floating dock. */
export const DOCK_PADDING_BOTTOM = 120

/**
 * Standard horizontal page padding (side gutters) for the simplified screens.
 */
export const HORIZONTAL_PADDING = 20

/**
 * Major-section vertical rhythm.
 */
export const SECTION_SPACING = spacing.xl

// ============================================================================
// Border radius tokens
// ============================================================================

/**
 * Named border-radius tokens (numeric px values for backward compatibility).
 */
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const

// ============================================================================
// Shared style objects
// ============================================================================

/**
 * Unified section header treatment (Phase 6 — task 238.2).
 */
export const sectionHeader: CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontSize: pxToRem(11),
  fontWeight: 600,
  lineHeight: 1.4,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 12,
}

/**
 * @deprecated Use {@link sectionHeader} instead.
 */
export const sectionHeading: CSSProperties = sectionHeader

/**
 * @deprecated Use {@link sectionHeader} instead.
 */
export const sectionHeadingStrong: CSSProperties = sectionHeader

/**
 * Link-style navigation button — "Manage limits →", "See all →", etc.
 * Meets WCAG 2.5.5 minimum 44×44px touch target via minHeight/minWidth.
 */
export const linkButton: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  minHeight: 44,
  minWidth: 44,
  display: "inline-flex",
  alignItems: "center",
  fontSize: pxToRem(14),
  fontWeight: 500,
  color: "var(--sub)",
  cursor: "pointer",
  fontFamily: FONT_FAMILY,
}

/**
 * Empty state container — centered flex column with generous spacing.
 */
export const emptyStateContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing.sm,
  maxWidth: 280,
  margin: "0 auto",
}

/**
 * Empty state title text.
 */
export const emptyStateTitle: CSSProperties = {
  fontSize: pxToRem(15),
  color: "var(--text)",
  textAlign: "center",
  fontFamily: FONT_FAMILY,
  fontWeight: 600,
  lineHeight: 1.4,
}

/**
 * Empty state subtitle / description text.
 */
export const emptyStateSubtitle: CSSProperties = {
  fontSize: pxToRem(13),
  color: "var(--sub)",
  textAlign: "center",
  fontFamily: FONT_FAMILY,
  lineHeight: 1.5,
  opacity: 0.85,
}

/**
 * Empty state action button — accent pill for the primary CTA.
 */
export const emptyStateAction: CSSProperties = {
  marginTop: 4,
  padding: "10px 20px",
  borderRadius: borderRadius.full,
  border: "none",
  background: colorRamp.accent[200],
  color: "var(--accent)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
}

/**
 * List row — flex row with space-between.
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
 * Meets WCAG 2.5.5 minimum 44px touch target height.
 */
export const pillButton: CSSProperties = {
  background: "transparent",
  border: `1.5px solid ${colorRamp.success[400]}`,
  borderRadius: borderRadius.full,
  padding: "10px 20px",
  minHeight: 44,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  color: "var(--success)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
}

/**
 * Chip button — the "Log Again" repeat chip styling.
 * Meets WCAG 2.5.5 minimum 44px touch target height.
 */
export const chipButton: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  minHeight: 44,
  boxSizing: "border-box",
  background: fills[6],
  border: `1px solid ${fills[10]}`,
  borderRadius: borderRadius.full,
  color: "var(--text)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
  whiteSpace: "nowrap",
  backdropFilter: "blur(8px)",
}

// ============================================================================
// Elevation shadow tokens (Phase 6 — task 244.2)
// ============================================================================

/**
 * Tokenized shadow scale referencing CSS custom properties.
 */
export const shadows = {
  none: "var(--shadow-none)",
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  glowAccent: "var(--shadow-glow-accent)",
  glowAccentStrong: "var(--shadow-glow-accent-strong)",
  /** Focus ring — 2px solid accent outline via box-shadow (WCAG 2.4.7). */
  focusRing: "0 0 0 2px var(--focus-ring-color)",
} as const

// ============================================================================
// Common surface patterns
// ============================================================================

/**
 * Glass surface — translucent background with backdrop blur.
 */
export const glassSurface: CSSProperties = {
  background: fills[3],
  border: `1px solid ${fills[8]}`,
  borderRadius: borderRadius.md,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
}

/**
 * Segmented control container.
 * Gap ensures ≥8px spacing between adjacent targets (WCAG 2.5.5).
 */
export const segmentedControl: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: 4,
  borderRadius: borderRadius.md,
  background: fills[4],
  border: `1px solid ${fills[6]}`,
}

/**
 * Segmented control button base.
 * Meets WCAG 2.5.5 minimum 44px touch target height.
 */
export const segmentedButtonBase: CSSProperties = {
  flex: 1,
  padding: "10px 0",
  minHeight: 44,
  boxSizing: "border-box",
  borderRadius: borderRadius.sm,
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
  background: fills[8],
  boxShadow: shadows.sm,
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
  background: colorRamp.error[100],
  border: `1px solid ${colorRamp.error[300]}`,
}

/**
 * Progress track — a thin bar background for budget/goal progress.
 */
export const progressTrack: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 2,
  background: fills[8],
  overflow: "hidden",
}

/**
 * Round stepper/counter button (e.g. split count +/- buttons).
 * Meets WCAG 2.5.5 minimum 44×44px touch target.
 */
export const roundButton: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: fills[6],
  border: `1px solid ${fills[10]}`,
  fontSize: pxToRem(18),
  fontFamily: FONT_FAMILY,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}
