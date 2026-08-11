/**
 * Color system tokens for Folio.
 *
 * Provides typed accessors for color ramps, surface fills, text colors,
 * and gradient tokens — all referencing CSS custom properties from globals.css.
 *
 * Requirements: 1.2, 1.3, 2.1
 */

import type { TokenAccessor } from './tokens'

// ============================================================================
// Color Ramp Types
// ============================================================================

/**
 * A color ramp step (50–900). Steps 50–200 are translucent fills, 300–400 are
 * borders/rings, 500 is the base, 600–900 are interactive/prominent states.
 */
export type RampStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

/**
 * A full 10-step color ramp mapping to CSS custom properties.
 */
export type ColorRamp = Record<RampStep, string>

// ============================================================================
// Color Ramp Builder
// ============================================================================

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

// ============================================================================
// Semantic Color Ramps
// ============================================================================

/**
 * Semantic color ramps referencing the CSS custom properties defined in
 * globals.css `:root`. Use in inline styles instead of ad-hoc rgba values.
 *
 * Example:
 * ```ts
 * <div style={{ background: colorRamp.accent[100], border: `1px solid ${colorRamp.accent[300]}` }} />
 * ```
 */
export const colorRamp = {
  accent: buildRamp('accent'),
  success: buildRamp('success'),
  caution: buildRamp('caution'),
  warning: buildRamp('warning'),
  error: buildRamp('error'),
  blue: buildRamp('blue'),
  info: buildRamp('blue'),
} as const

// ============================================================================
// Surface Colors
// ============================================================================

/**
 * Surface fill colors referencing `--color-{name}` CSS custom properties.
 * These map to the five elevation tier backgrounds.
 */
export type SurfaceColorName = 'canvas' | 'sunken' | 'surface' | 'raised' | 'overlay'

export const surfaceColors: TokenAccessor<SurfaceColorName> = {
  canvas: 'var(--color-canvas)',
  sunken: 'var(--color-sunken)',
  surface: 'var(--color-surface)',
  raised: 'var(--color-raised)',
  overlay: 'var(--color-overlay)',
} as const

// ============================================================================
// Text Colors
// ============================================================================

/**
 * Text color tokens referencing CSS custom properties.
 *
 * | Token | Use |
 * |-------|-----|
 * | text | Primary body text (#fff) |
 * | sub | Secondary text, descriptions |
 * | muted | Tertiary text, hints, labels |
 */
export type TextColorName = 'text' | 'sub' | 'muted'

export const textColors: TokenAccessor<TextColorName> = {
  text: 'var(--text)',
  sub: 'var(--sub)',
  muted: 'var(--muted)',
} as const

// ============================================================================
// Gradient Tokens
// ============================================================================

/**
 * Named gradient tokens referencing `--gradient-{name}` CSS custom properties.
 *
 * | Token | Role |
 * |-------|------|
 * | ambient | Page field (radial, top-center) |
 * | hero | Hero emphasis (radial accent) |
 * | action | Primary button fill (linear 135°) |
 * | celebration | Milestone moments (conic) |
 */
export type GradientName = 'ambient' | 'hero' | 'action' | 'celebration'

export const gradients: TokenAccessor<GradientName> = {
  ambient: 'var(--gradient-ambient)',
  hero: 'var(--gradient-hero)',
  action: 'var(--gradient-action)',
  celebration: 'var(--gradient-celebration)',
} as const

// ============================================================================
// Semantic Color Mappings
// ============================================================================

/**
 * Semantic color accessors for common use cases.
 */
export const semanticColors = {
  /** Accent / brand color */
  accent: 'var(--accent)',
  /** Success / positive actions */
  success: 'var(--success)',
  /** Caution / approaching-limit states */
  caution: 'var(--caution)',
  /** Warning states */
  warning: 'var(--warning)',
  /** Error / danger states */
  error: 'var(--error)',
  /** Informational blue */
  blue: 'var(--blue)',
  /** Info alias (maps to blue) */
  info: 'var(--info)',
  /** Border — subtle */
  borderSubtle: 'var(--border-subtle)',
  /** Border — default */
  borderDefault: 'var(--border-default)',
  /** Border — strong */
  borderStrong: 'var(--border-strong)',
  /** Border — accent */
  borderAccent: 'var(--border-accent)',
} as const


// ============================================================================
// Resolved Color Values (for Canvas API / non-DOM contexts)
// ============================================================================

/**
 * Resolved hex values for use where CSS `var()` cannot be applied
 * (e.g., canvas-confetti, Canvas 2D context, WebGL).
 *
 * These MUST stay in sync with the corresponding CSS custom properties
 * in globals.css. Update both locations when changing values.
 */
export const resolvedColors = {
  accent500: '#818cf8',
  success500: '#4ade80',
  warning500: '#fbbf24',
  warning600: '#eab308',
  caution500: '#facc15',
  error500: '#f87171',
  blue500: '#3b82f6',
  text: '#ffffff',
  canvas: '#0e0e1a',
  pink500: '#f472b6',
} as const
