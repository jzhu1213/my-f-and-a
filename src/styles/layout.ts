/**
 * Layout system tokens for Folio.
 *
 * Provides a 12-step spacing scale (4px grid, 2–96px range), content column
 * constraints, and safe area utilities — all referencing CSS custom properties.
 *
 * Requirements: 1.2, 5.1
 */

import type { TokenAccessor } from './tokens'
import type React from 'react'

// ============================================================================
// Spacing Scale (4px grid)
// ============================================================================

/**
 * Spacing token names mapping to pixel values on a 4px base grid.
 */
export type SpacingStep =
  | '2' | '4' | '6' | '8'
  | '12' | '16' | '20' | '24'
  | '32' | '40' | '48' | '64' | '96'

/**
 * 13-step spacing scale referencing `--space-{px}` CSS custom properties.
 *
 * | Token | Value | Use |
 * |-------|-------|-----|
 * | 2 | 2px | Hairline adjustments |
 * | 4 | 4px | Tight internal padding |
 * | 6 | 6px | Chip internal gap |
 * | 8 | 8px | Row gaps, control spacing |
 * | 12 | 12px | Within-group gaps |
 * | 16 | 16px | Standard padding |
 * | 20 | 20px | Horizontal page gutters |
 * | 24 | 24px | Section internal spacing |
 * | 32 | 32px | Between-section gap (min) |
 * | 40 | 40px | Major section gap |
 * | 48 | 48px | Between-section gap (max) |
 * | 64 | 64px | Page-level vertical spacing |
 * | 96 | 96px | Hero vertical breathing room |
 */
export const spacingScale: TokenAccessor<SpacingStep> = {
  '2': 'var(--space-2)',
  '4': 'var(--space-4)',
  '6': 'var(--space-6)',
  '8': 'var(--space-8)',
  '12': 'var(--space-12)',
  '16': 'var(--space-16)',
  '20': 'var(--space-20)',
  '24': 'var(--space-24)',
  '32': 'var(--space-32)',
  '40': 'var(--space-40)',
  '48': 'var(--space-48)',
  '64': 'var(--space-64)',
  '96': 'var(--space-96)',
} as const

// ============================================================================
// Content Column
// ============================================================================

/**
 * Maximum content width (px) for the primary content column.
 *
 * Reduced from 560px to 480px for a tighter, more focused reading experience.
 * On viewports wider than this, the column is centered with equal margins.
 */
export const CONTENT_MAX_WIDTH = 480 as const

/**
 * Standard horizontal page padding (px) for side gutters.
 *
 * 20px gives a generous, thumb-friendly edge margin without squeezing content
 * on narrow phones. At 320px viewport, minimum 16px is maintained.
 */
export const HORIZONTAL_PADDING = 20 as const

// ============================================================================
// Safe Area Utilities
// ============================================================================

/**
 * CSS `env()` safe area inset references for notch / rounded-corner devices.
 * Use these in inline styles or CSS calculations.
 */
export const safeArea = {
  top: 'env(safe-area-inset-top)',
  right: 'env(safe-area-inset-right)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
} as const

/**
 * Build a `padding` value that includes safe area insets.
 * Useful for full-bleed containers that need to respect device notches.
 *
 * Example:
 * ```ts
 * padding: safeAreaPadding(16) // '16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))'
 * ```
 */
export function safeAreaPadding(basePx: number): string {
  return `${basePx}px calc(${basePx}px + ${safeArea.right}) ${basePx}px calc(${basePx}px + ${safeArea.left})`
}

/**
 * Build a `padding-bottom` value that clears both a fixed element and the
 * safe area inset. Common for pages with a floating dock.
 *
 * Example:
 * ```ts
 * paddingBottom: safeAreaBottom(120) // 'calc(120px + env(safe-area-inset-bottom))'
 * ```
 */
export function safeAreaBottom(basePx: number): string {
  return `calc(${basePx}px + ${safeArea.bottom})`
}

/**
 * Build a `padding-top` value that clears the top chrome (status bar, notch,
 * Dynamic Island) plus a base offset. Common for sticky headers and top bars.
 *
 * Example:
 * ```ts
 * paddingTop: safeAreaTop(56) // 'calc(56px + env(safe-area-inset-top))'
 * ```
 */
export function safeAreaTop(basePx: number): string {
  return `calc(${basePx}px + ${safeArea.top})`
}

// ============================================================================
// Content Column Style Object
// ============================================================================

/**
 * Minimum horizontal padding at very small viewports (320px).
 */
export const HORIZONTAL_PADDING_MIN = 16 as const

/**
 * Inline style object for the content column layout.
 *
 * Provides:
 * - max-width: 480px
 * - horizontal padding: 20px (matches HORIZONTAL_PADDING)
 * - centered via margin: 0 auto
 * - width: 100% to fill available space up to max-width
 *
 * For responsive padding (16px at 320px, 20px at ≥390px) and viewport-based
 * centering (margin auto at ≥768px only), use the `.content-column` CSS class
 * in globals.css which applies media queries.
 *
 * Requirements: 5.2, 5.3, 5.4
 */
export const contentColumn: React.CSSProperties = {
  width: '100%',
  maxWidth: `${CONTENT_MAX_WIDTH}px`,
  marginInlineStart: 'auto',
  marginInlineEnd: 'auto',
  paddingInlineStart: `${HORIZONTAL_PADDING}px`,
  paddingInlineEnd: `${HORIZONTAL_PADDING}px`,
  boxSizing: 'border-box',
}
