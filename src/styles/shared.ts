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
import type { TransactionCategory } from "@/types"
import { FONT_FAMILY, spacing, pxToRem } from "./typography"

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
 *
 * Example:
 * ```ts
 * <div style={{ background: colorRamp.accent[100], border: `1px solid ${colorRamp.accent[300]}` }} />
 * ```
 *
 * | Step | Typical use |
 * |------|-------------|
 * | 50 | Barely-visible bg (disabled, faint) |
 * | 100 | Subtle bg fill (selected rows, hover) |
 * | 200 | Medium bg fill (accent-muted, chips) |
 * | 300 | Border/ring (focus, selection ring) |
 * | 400 | Stronger border (active selection) |
 * | 500 | Base color (text, icons, badges) |
 * | 600 | Hover state (buttons, links) |
 * | 700 | Active/pressed state |
 * | 800 | Strong/prominent |
 * | 900 | Near-opaque (dark accent use) |
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
 * Per-`TransactionCategory` accent color used for the tinted icon-chip that
 * sits behind a category's icon. Single source of truth so every surface
 * (QuickLogArea, budget cards, transaction rows, CategoryDetailSheet) shows the
 * same color for a given category instead of scattering ad-hoc rgba values.
 *
 * Colors are drawn from the existing warm-purple palette / semantic tokens in
 * `globals.css` where they map naturally (transport→`--blue`, school→`--amber`,
 * health/income→`--green`, rent/fallback→the purple accents) and extended with
 * a few harmonizing hues for the remaining categories. All values are bright
 * enough to clear the WCAG 2.1 AA 3:1 non-text contrast ratio against the warm
 * dark background (`--bg` #12121f), and the icon itself inherits the color via
 * `currentColor`.
 *
 * The `fallback` entry backs unknown/custom categories.
 */
export const CATEGORY_ACCENTS: Record<TransactionCategory | "fallback", string> = {
  food: "#fb923c", // warm orange
  rent: "#a78bfa", // brand purple (accent-2)
  transport: "#60a5fa", // --blue
  school: "#fbbf24", // --amber
  fun: "#f472b6", // warm pink
  health: "#4ade80", // --green / --success
  subscriptions: "#22d3ee", // cyan
  gig: "#c084fc", // violet
  income: "#4ade80", // --green / --success
  other: "#94a3b8", // neutral slate
  fallback: "#818cf8", // --accent
}

/**
 * Resolve a category (built-in or arbitrary custom string) to its accent color,
 * falling back to the purple accent for unknown/custom categories.
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
 *
 * Use these instead of scattered inline `rgba(255, 255, 255, ...)` values:
 * ```ts
 * <div style={{ background: fills[4], border: `1px solid ${fills[8]}` }} />
 * ```
 *
 * | Token | Typical use |
 * |-------|-------------|
 * | 2 | Barely-visible hover bg, faint separator |
 * | 3 | Glass surface default fill |
 * | 4 | Subtle chip/input bg, inactive surface |
 * | 5 | Slightly stronger chip bg |
 * | 6 | Active chip bg, round buttons, borders |
 * | 8 | Selected states, progress tracks, stronger borders |
 * | 10 | Hover-selected, prominent fills |
 * | 12 | Active/selected, toggle tracks |
 * | 15 | Dashed borders, strong overlay strokes |
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
 *
 * Tuned for comfortable reading (~60–70 characters per line at the body size)
 * and one-thumb reach on phones. Folio is phone-first, so this cap only takes
 * effect on tablet / desktop / installed-PWA widths — keeping the primary
 * column calm and centered rather than stretching edge-to-edge. Kept at 560 so
 * the hero number, cards, and copy stay in a single, easily-scanned column.
 */
export const CONTENT_MAX_WIDTH = 560

/** Bottom padding to clear the floating dock. */
export const DOCK_PADDING_BOTTOM = 120

/**
 * Standard horizontal page padding (side gutters) for the simplified screens.
 *
 * 20px gives a generous, thumb-friendly edge margin without squeezing content
 * on narrow phones. Sits just inside `AppShell`'s own safe-area-aware inline
 * padding, so notch / rounded-corner insets are always cleared underneath it.
 */
export const HORIZONTAL_PADDING = 20

/**
 * Major-section vertical rhythm (Phase 6 — task 237.1, "let it breathe").
 *
 * The single source of truth for the gap between top-level sections on the
 * primary screens (e.g. hero → quick actions → recent → tip on Home, and the
 * grouped sections on Tools). Maps to the `spacing.xl` (32px) grid step for a
 * generous, consistent rhythm that reduces perceived clunkiness. Dense areas
 * (chip rows, list rows) intentionally stay tighter and are not driven by this.
 */
export const SECTION_SPACING = spacing.xl

// ============================================================================
// Shared style objects
// ============================================================================

/**
 * Unified section header treatment (Phase 6 — task 238.2).
 *
 * ONE reusable overline-style label used everywhere section headings appear:
 * "Budget Limits", "Goals", "Categories", "Recent", card titles, etc.
 * Replaces the previous two ad-hoc variants (`sectionHeading` / `sectionHeadingStrong`).
 *
 * The style uses the `overline` tier from the type scale — small, uppercase,
 * wide-tracked — to create a clear, lightweight section label that contrasts
 * with the heavier `headline` / `title` levels used for actual content headings.
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
 * @deprecated Use {@link sectionHeader} instead. Kept temporarily for gradual migration.
 */
export const sectionHeading: CSSProperties = sectionHeader

/**
 * @deprecated Use {@link sectionHeader} instead. Kept temporarily for gradual migration.
 */
export const sectionHeadingStrong: CSSProperties = sectionHeader

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
 * Empty state container — centered flex column with generous spacing.
 * Phase 6 (task 264): increased gap and padding for a warmer, more spacious
 * feel when an area has no content.
 */
export const emptyStateContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing.sm, // 12px — slightly more generous
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
 * Empty state action button — accent pill for the primary CTA inside an empty state.
 * Phase 6 (task 264): standard pill styling so every empty state drives the user forward.
 */
export const emptyStateAction: CSSProperties = {
  marginTop: 4,
  padding: "10px 20px",
  borderRadius: 9999,
  border: "none",
  background: colorRamp.accent[200],
  color: "var(--accent, #a78bfa)",
  fontSize: pxToRem(13),
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  cursor: "pointer",
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
  background: fills[6],
  border: `1px solid ${fills[10]}`,
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
// Elevation shadow tokens (Phase 6 — task 244.2)
// ============================================================================

/**
 * Tokenized shadow scale referencing the CSS custom properties defined in
 * globals.css `:root`. Use these in inline styles instead of raw rgba values.
 *
 * | Token | Use case |
 * |-------|----------|
 * | sm | Toggle knobs, small UI controls |
 * | md | Cards, segmented controls |
 * | lg | Elevated panels, toasts, sheets |
 * | xl | Overlays, hero glass, dropdowns |
 * | glowAccent | Selected states, subtle accent glow |
 * | glowAccentStrong | CTA buttons, prominent accent glow |
 */
export const shadows = {
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  glowAccent: "var(--shadow-glow-accent)",
  glowAccentStrong: "var(--shadow-glow-accent-strong)",
} as const

// ============================================================================
// Common surface patterns
// ============================================================================

/**
 * ## Surface Hierarchy (Phase 6 — task 243)
 *
 * Folio uses three surface tiers to create clear visual hierarchy:
 *
 * | Tier | Component | When to use | Example |
 * |------|-----------|-------------|---------|
 * | 1 — Hero/Overlay | `GlassCard elevation="high"` | Single focal hero, celebration overlays, bottom sheets | DailyAllowanceHero, CelebrationOverlay |
 * | 2 — Primary Card | `GlassCard elevation="low"\|"medium"` | Featured insight cards, contextual tips, growth outlook | ContextualTipCard, CombinedGrowthOutlook |
 * | 3 — List/Dense | `Card` | Goal items, debt rows, category rows, settings, funding sources | GoalsScreen items, DebtScreen list |
 *
 * **Rules:**
 * - Never use `GlassCard` for repeating list items — the blur/shadow stacks
 *   create visual noise and collapse hierarchy.
 * - `Card` uses `var(--surface)` (opaque), no `backdrop-filter`, quiet shadow.
 * - Both share `var(--radius-md)` (12px) for consistent rounding.
 * - Glass is reserved for surfaces that need to "float" above the mesh.
 */

/**
 * Glass surface — translucent background with backdrop blur, used for
 * secondary surfaces that sit over the mesh (e.g. inline forms, overlays).
 */
export const glassSurface: CSSProperties = {
  background: fills[3],
  border: `1px solid ${fills[8]}`,
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
  // Phase 6 (task 237.2): the filled track already defines the control; soften
  // the outline to a faint hairline instead of the hard --border so it reads as
  // a calm surface. Selection is carried by the active button's fill + shadow.
  background: fills[4],
  border: `1px solid ${fills[6]}`,
}

/**
 * Segmented control button (active state applied conditionally).
 */
export const segmentedButtonBase: CSSProperties = {
  flex: 1,
  padding: "10px 0",
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
  background: fills[8],
  overflow: "hidden",
}

/**
 * Round stepper/counter button (e.g. split count +/- buttons).
 */
export const roundButton: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: fills[6],
  border: `1px solid ${fills[10]}`,
  fontSize: pxToRem(18),
  fontFamily: FONT_FAMILY,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}
