/**
 * Motion system tokens for Folio.
 *
 * Provides 6 spring presets with explicit stiffness/damping/mass, plus
 * duration and easing tokens referencing CSS custom properties.
 *
 * Requirements: 1.2, 2.1
 */

import type { TokenAccessor } from './tokens'

// ============================================================================
// Spring Presets
// ============================================================================

/**
 * A spring physics configuration for framer-motion.
 */
export interface SpringPreset {
  readonly stiffness: number
  readonly damping: number
  readonly mass: number
}

/**
 * Named spring preset identifiers.
 */
export type SpringPresetName = 'snappy' | 'gentle' | 'bouncy' | 'responsive' | 'sheet' | 'dramatic'

/**
 * 6 spring presets for the motion system.
 *
 * | Preset | Character |
 * |--------|-----------|
 * | snappy | Quick settle — taps, toggles |
 * | gentle | Soft reveals — content entrance |
 * | bouncy | Celebratory overshoot |
 * | responsive | Layout shifts — dock, resize |
 * | sheet | Sheet present/dismiss |
 * | dramatic | Milestone celebrations |
 */
export const springPresets: Record<SpringPresetName, SpringPreset> = {
  snappy: { stiffness: 400, damping: 30, mass: 1.0 },
  gentle: { stiffness: 200, damping: 24, mass: 1.0 },
  bouncy: { stiffness: 500, damping: 15, mass: 1.0 },
  responsive: { stiffness: 600, damping: 35, mass: 0.8 },
  sheet: { stiffness: 380, damping: 36, mass: 1.0 },
  dramatic: { stiffness: 420, damping: 14, mass: 0.9 },
} as const

// ============================================================================
// Duration Tokens
// ============================================================================

/**
 * Duration token names referencing `--duration-{name}` CSS custom properties.
 *
 * | Token | Typical value | Use |
 * |-------|---------------|-----|
 * | instant | 0ms | Immediate state changes |
 * | fast | 100ms | Micro-interactions |
 * | normal | 200ms | Standard transitions |
 * | slow | 350ms | Surface enters |
 * | slower | 500ms | Complex choreography |
 */
export type DurationName = 'instant' | 'fast' | 'normal' | 'slow' | 'slower'

export const durations: TokenAccessor<DurationName> = {
  instant: 'var(--duration-instant)',
  fast: 'var(--duration-fast)',
  normal: 'var(--duration-normal)',
  slow: 'var(--duration-slow)',
  slower: 'var(--duration-slower)',
} as const

// ============================================================================
// Easing Tokens
// ============================================================================

/**
 * Easing token names referencing `--ease-{name}` CSS custom properties.
 *
 * | Token | Character |
 * |-------|-----------|
 * | default | General-purpose ease-in-out |
 * | in | Accelerate into motion |
 * | out | Decelerate to rest |
 * | spring | Overshoot-settle curve |
 */
export type EasingName = 'default' | 'in' | 'out' | 'spring'

export const easings: TokenAccessor<EasingName> = {
  default: 'var(--ease-default)',
  in: 'var(--ease-in)',
  out: 'var(--ease-out)',
  spring: 'var(--ease-spring)',
} as const
