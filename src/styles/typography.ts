/**
 * Premium typography and spacing system for Folio.
 *
 * A pure constants/types module (no side effects, no JSX). Provides a refined
 * type scale, variable font-weight constants with a smooth transition helper,
 * letter-spacing refinements, and a 4px vertical-rhythm spacing grid.
 *
 * The scale is intentionally designed to create clear visual hierarchy: the
 * Display style dominates (used for the daily allowance amount) while smaller
 * styles keep sections distinct and calm.
 *
 * All style objects are `React.CSSProperties`-compatible so they can be spread
 * directly into inline styles or CSS-in-JS alongside the existing Tailwind
 * usage across the app.
 *
 * Requirements: 8.2 (Inter font family), 8.4 (friendlier visual hierarchy),
 * 15.5 (scalable text via rem-based sizing).
 */

import type { CSSProperties } from 'react'

// ============================================================================
// Font family
// ============================================================================

/**
 * Body/display font stack. Matches `body` in `globals.css` (Requirement 8.2).
 */
export const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" as const

/**
 * Root font size (px) used to convert the design's px values into `rem`.
 * Using `rem` keeps text scalable when the user changes their browser/OS base
 * font size (Requirement 15.5).
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
 * Named font-weight constants for Inter's variable weight axis. Exposed so
 * animated numbers can interpolate between concrete weight values.
 */
export const fontWeights = {
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
 * Letter-spacing tokens. Tighter for large display type, neutral for body,
 * and wider (tracked) for overlines/labels (Requirement 8.4).
 */
export const letterSpacing = {
  tight: '-0.02em',
  normal: '0em',
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
  /** Font size as a scalable `rem` string. */
  fontSize: string
  fontWeight: FontWeightValue
  lineHeight: number
  letterSpacing: string
  textTransform?: CSSProperties['textTransform']
}

/**
 * The named tiers of the type scale, ordered from most to least prominent.
 */
export type TypeScaleName =
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'caption'
  | 'overline'

/**
 * The refined Folio type scale.
 *
 * - `display`  56px / light   — dominates the screen (daily allowance amount)
 * - `title`    28px / medium  — screen and major section titles
 * - `headline` 20px / medium  — sub-section headings
 * - `body`     15px / regular — general content (matches globals.css body)
 * - `caption`  12px / medium  — secondary labels and hints
 * - `overline` 10px / semibold uppercase tracked — eyebrow labels
 */
export const typography: Record<TypeScaleName, TypeStyle> = {
  display: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(56),
    fontWeight: fontWeights.light,
    lineHeight: 1.05,
    letterSpacing: letterSpacing.tight,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(28),
    fontWeight: fontWeights.medium,
    lineHeight: 1.2,
    letterSpacing: letterSpacing.tight,
  },
  headline: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(20),
    fontWeight: fontWeights.medium,
    lineHeight: 1.3,
    letterSpacing: letterSpacing.normal,
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(15),
    fontWeight: fontWeights.regular,
    lineHeight: 1.5,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(12),
    fontWeight: fontWeights.medium,
    lineHeight: 1.4,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(10),
    fontWeight: fontWeights.semibold,
    lineHeight: 1.4,
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
 *
 * Example:
 * ```ts
 * const style: CSSProperties = {
 *   fontWeight: fontWeights.medium,
 *   transition: fontWeightTransition(),
 * }
 * ```
 */
export function fontWeightTransition(
  durationMs: number = FONT_WEIGHT_TRANSITION_MS,
  easing: string = FONT_WEIGHT_TRANSITION_EASING
): string {
  return `font-weight ${durationMs}ms ${easing}`
}

/**
 * Produce a `React.CSSProperties` object that sets a font weight and the
 * transition needed to animate to a different weight smoothly. Useful for
 * numeric values that shift weight based on status or emphasis.
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
