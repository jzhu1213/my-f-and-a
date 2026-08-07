/**
 * Premium typography and spacing system for Folio.
 *
 * A pure constants/types module (no side effects, no JSX). Provides a refined
 * 10-tier type scale, variable font-weight constants with a smooth transition
 * helper, letter-spacing refinements, and a 4px vertical-rhythm spacing grid.
 *
 * The scale creates clear visual hierarchy: display tiers dominate (used for
 * the daily allowance amount) while smaller styles keep sections distinct.
 *
 * All style objects are `React.CSSProperties`-compatible so they can be spread
 * directly into inline styles or CSS-in-JS.
 *
 * Requirements: 1.2, 1.7, 2.1, 2.2, 2.4, 2.9, 5.1
 */

import type { CSSProperties } from 'react'

// ============================================================================
// Font family
// ============================================================================

/**
 * Body/display font stack. Matches `body` in `globals.css`.
 * Inter — highly legible, designed for UI, friendly and modern.
 *
 * Use with `fontVariantNumeric: 'tabular-nums'` for aligned numeric columns.
 */
export const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" as const

/**
 * Root font size (px) used to convert the design's px values into `rem`.
 * Using `rem` keeps text scalable when the user changes their browser/OS base
 * font size.
 */
export const ROOT_FONT_SIZE_PX = 16 as const

/**
 * Convert a pixel value to a `rem` string relative to {@link ROOT_FONT_SIZE_PX}.
 */
export function pxToRem(px: number): string {
  return `${px / ROOT_FONT_SIZE_PX}rem`
}

// ============================================================================
// Font weights (variable font axis values)
// ============================================================================

/**
 * Named font-weight constants for Inter's variable weight axis.
 * Exposed so animated numbers can interpolate between concrete weight values.
 */
export const fontWeights = {
  thin: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export type FontWeightName = keyof typeof fontWeights
export type FontWeightValue = (typeof fontWeights)[FontWeightName]

// ============================================================================
// Letter-spacing refinements
// ============================================================================

/**
 * Letter-spacing tokens. Progressively tighter tracking for larger type,
 * neutral for body, and wider (tracked) for overlines / section labels.
 */
export const letterSpacing = {
  /** Very large display type (the daily-allowance number). */
  tighter: '-0.04em',
  /** Titles and headlines. */
  tight: '-0.02em',
  /** Subtle optical correction for mid-size emphasis text. */
  snug: '-0.01em',
  normal: '0em',
  /** Overlines / section labels. */
  wide: '0.08em',
} as const

export type LetterSpacingName = keyof typeof letterSpacing

// ============================================================================
// Type scale
// ============================================================================

/**
 * A single typography style. Shaped to be spread directly into React inline
 * styles or CSS-in-JS. All fields are `React.CSSProperties`-compatible.
 */
export interface TypeStyle {
  fontFamily: string
  /** Font size as a scalable `rem` string or `clamp()` expression. */
  fontSize: string
  fontWeight: FontWeightValue
  lineHeight: number
  letterSpacing: string
  textTransform?: CSSProperties['textTransform']
}

/**
 * The named tiers of the type scale, ordered from most to least prominent.
 * Expanded to 10 tiers for the design overhaul.
 */
export type TypeScaleName =
  | 'display-lg'
  | 'display'
  | 'display-sm'
  | 'title'
  | 'headline'
  | 'subhead'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'overline'

/**
 * The refined Folio 10-tier type scale.
 *
 * - `display-lg` 80px / thin    / tighter — Hero allowance (large values)
 * - `display`    72px / thin    / tighter — Hero allowance (standard), fluid clamp
 * - `display-sm` 56px / light   / tighter — Celebration headlines
 * - `title`      32px / semibold/ tight   — Screen titles
 * - `headline`   24px / semibold/ tight   — Section headings
 * - `subhead`    18px / medium  / snug    — Card titles, emphasis text
 * - `body`       15px / regular / normal  — General content
 * - `body-sm`    13px / regular / normal  — Dense list secondary text
 * - `caption`    11px / medium  / normal  — Labels, hints
 * - `overline`   11px / semibold/ wide, uppercase — Section labels
 *
 * Display tiers use fluid `clamp()` for responsive sizing between 320–430px.
 * All fontSize values reference `var(--type-{tier}-size)` CSS custom properties.
 */
export const typography: Record<TypeScaleName, TypeStyle> = {
  'display-lg': {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-display-lg-size)',
    fontWeight: fontWeights.thin,
    lineHeight: 1.0,
    letterSpacing: letterSpacing.tighter,
  },
  display: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-display-size)',
    fontWeight: fontWeights.thin,
    lineHeight: 1.02,
    letterSpacing: letterSpacing.tighter,
  },
  'display-sm': {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-display-sm-size)',
    fontWeight: fontWeights.light,
    lineHeight: 1.05,
    letterSpacing: letterSpacing.tighter,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-title-size)',
    fontWeight: fontWeights.semibold,
    lineHeight: 1.12,
    letterSpacing: letterSpacing.tight,
  },
  headline: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-headline-size)',
    fontWeight: fontWeights.semibold,
    lineHeight: 1.25,
    letterSpacing: letterSpacing.tight,
  },
  subhead: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-subhead-size)',
    fontWeight: fontWeights.medium,
    lineHeight: 1.3,
    letterSpacing: letterSpacing.snug,
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-body-size)',
    fontWeight: fontWeights.regular,
    lineHeight: 1.5,
    letterSpacing: letterSpacing.normal,
  },
  'body-sm': {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-body-sm-size)',
    fontWeight: fontWeights.regular,
    lineHeight: 1.45,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-caption-size)',
    fontWeight: fontWeights.medium,
    lineHeight: 1.35,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontFamily: FONT_FAMILY,
    fontSize: 'var(--type-overline-size)',
    fontWeight: fontWeights.semibold,
    lineHeight: 1.35,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },
} as const

// ============================================================================
// Variable font-weight transitions
// ============================================================================

/**
 * Default duration (ms) for smooth font-weight transitions on animated numbers.
 */
export const FONT_WEIGHT_TRANSITION_MS = 300 as const

/**
 * Default easing for font-weight transitions.
 */
export const FONT_WEIGHT_TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)' as const

/**
 * Build a CSS `transition` value for smoothly animating `font-weight` between
 * variable-font axis values (e.g. as a number ticks up or down).
 */
export function fontWeightTransition(
  durationMs: number = FONT_WEIGHT_TRANSITION_MS,
  easing: string = FONT_WEIGHT_TRANSITION_EASING
): string {
  return `font-weight ${durationMs}ms ${easing}`
}

/**
 * Produce a `React.CSSProperties` object that sets a font weight and the
 * transition needed to animate to a different weight smoothly.
 */
export function animatedFontWeight(
  weight: FontWeightValue,
  durationMs: number = FONT_WEIGHT_TRANSITION_MS,
  easing: string = FONT_WEIGHT_TRANSITION_EASING
): Pick<CSSProperties, 'fontWeight' | 'transition'> {
  return {
    fontWeight: weight,
    transition: fontWeightTransition(durationMs, easing),
  }
}

// ============================================================================
// Vertical rhythm spacing tokens (4px base grid)
// ============================================================================

/**
 * Spacing tokens on a 4px base grid, used for consistent vertical rhythm and
 * layout gaps throughout the simplified app.
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export type SpacingName = keyof typeof spacing
export type SpacingValue = (typeof spacing)[SpacingName]

/**
 * Convert a spacing token to a pixel string (e.g. for `gap`, `margin`,
 * `padding` in inline styles).
 */
export function space(name: SpacingName): string {
  return `${spacing[name]}px`
}

// ============================================================================
// Numeric typography
// ============================================================================

/**
 * Style partial for financial/numeric amounts.
 *
 * Ensures all numbers use Inter with `tabular-nums` so digits align in columns,
 * without resorting to a monospace typeface.
 */
export const TABULAR_NUMS: Pick<CSSProperties, 'fontFamily' | 'fontVariantNumeric'> = {
  fontFamily: FONT_FAMILY,
  fontVariantNumeric: 'tabular-nums',
}

// ============================================================================
// Expressive display typography
// ============================================================================

/**
 * CSS class name for the gradient text fill treatment applied to display-tier
 * elements (daily-allowance hero, celebration headlines).
 *
 * Apply via `className` — the gradient is CSS-only, defined in globals.css.
 * Automatically falls back to plain text under `prefers-reduced-motion: reduce`.
 *
 * Requirements: 2.5, 2.6, 2.11
 */
export const DISPLAY_GRADIENT_CLASS = 'display-gradient-text' as const

/**
 * Expressive display style object combining the display tier with tabular-nums.
 *
 * Use this for monetary hero amounts ($X.XX) that need aligned digits and
 * the expressive gradient treatment. Pair with `DISPLAY_GRADIENT_CLASS` on the
 * element's className for the full visual effect.
 *
 * Requirements: 2.3, 2.5, 2.6
 */
export const expressiveDisplay: CSSProperties = {
  ...typography.display,
  fontVariantNumeric: 'tabular-nums',
}

// ============================================================================
// Convenience helpers
// ============================================================================

/**
 * Return a copy of a type-scale style, optionally overriding the font weight.
 * Handy when a component needs a scale size at a different emphasis.
 */
export function typeStyle(
  name: TypeScaleName,
  weightOverride?: FontWeightValue
): TypeStyle {
  const base = typography[name]
  return weightOverride === undefined
    ? { ...base }
    : { ...base, fontWeight: weightOverride }
}
