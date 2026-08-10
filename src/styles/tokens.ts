/**
 * Core token accessor interface and general-purpose token families.
 *
 * Every accessor maps 1:1 to a CSS custom property defined in globals.css.
 * Components consume `var(--{property})` references — no duplicated literal values.
 *
 * Requirements: 1.2, 1.3
 */

import type React from 'react'

// ============================================================================
// Token Accessor Interface
// ============================================================================

/**
 * A typed accessor that maps token names to their CSS `var()` references.
 * Each key resolves to a string like `'var(--space-md)'`.
 */
export type TokenAccessor<T extends string> = {
  readonly [K in T]: string
}

// ============================================================================
// Opacity Tokens
// ============================================================================

/**
 * Opacity tokens referencing `--opacity-{step}` CSS custom properties.
 *
 * | Step | Value | Use |
 * |------|-------|-----|
 * | 0 | 0 | Fully transparent (hidden) |
 * | 20 | 0.2 | Faint / disabled overlays |
 * | 40 | 0.4 | Muted elements |
 * | 60 | 0.6 | Semi-prominent |
 * | 80 | 0.8 | Near-opaque |
 * | 100 | 1.0 | Fully opaque |
 */
export type OpacityStep = '0' | '20' | '40' | '60' | '80' | '100'

export const opacity: TokenAccessor<OpacityStep> = {
  '0': 'var(--opacity-0)',
  '20': 'var(--opacity-20)',
  '40': 'var(--opacity-40)',
  '60': 'var(--opacity-60)',
  '80': 'var(--opacity-80)',
  '100': 'var(--opacity-100)',
} as const

// ============================================================================
// Z-Index Tokens
// ============================================================================

/**
 * Z-index layer tokens referencing `--z-{layer}` CSS custom properties.
 *
 * | Layer | Use |
 * |-------|-----|
 * | base | Default stacking context |
 * | raised | Cards, floating elements |
 * | dock | Navigation dock |
 * | sheet | Bottom sheets, modals |
 * | overlay | Celebration overlays, toasts |
 */
export type ZIndexLayer = 'base' | 'raised' | 'dock' | 'sheet' | 'overlay'

export const zIndex: TokenAccessor<ZIndexLayer> = {
  base: 'var(--z-base)',
  raised: 'var(--z-raised)',
  dock: 'var(--z-dock)',
  sheet: 'var(--z-sheet)',
  overlay: 'var(--z-overlay)',
} as const

// ============================================================================
// Focus Ring Tokens (Req 18.4: ≥2px thick, ≥3:1 contrast)
// ============================================================================

/**
 * Focus ring style object to apply via onFocus/onBlur or CSS-in-JS.
 * Accent-500 (#818cf8) on darkest surface (#0e0e1a) = 5.7:1 contrast ✓
 *
 * Apply `focusRingStyle` when the element has focus-visible,
 * and `focusRingReset` to clear it on blur.
 */
export const focusRing = {
  color: 'var(--focus-ring-color)',
  width: 'var(--focus-ring-width)',
  offset: 'var(--focus-ring-offset)',
} as const

/** Style to apply when an element has visible focus (keyboard navigation). */
export const focusRingStyle: React.CSSProperties = {
  outline: `2px solid var(--focus-ring-color)`,
  outlineOffset: '2px',
}

/** Style to reset focus ring (when element loses focus). */
export const focusRingReset: React.CSSProperties = {
  outline: 'none',
}
