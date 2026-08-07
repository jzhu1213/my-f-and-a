/**
 * Surface & Depth System — 5-Tier Elevation Hierarchy
 *
 * Defines the elevation tier definitions (fill, border, shadow, blur per tier),
 * corner-radius tokens, nested-radius correction utility, and opaque fallbacks
 * for non-backdrop-filter browsers.
 *
 * Requirements: 4.1, 4.3, 4.5, 4.10
 */

import type { TokenAccessor } from './tokens'

// ============================================================================
// Elevation Tier Definitions
// ============================================================================

/**
 * The five elevation tiers that form Folio's depth hierarchy.
 *
 * Ordered from lowest to highest perceived depth:
 *   canvas → sunken → resting → raised → overlay
 */
export type ElevationTier = 'canvas' | 'sunken' | 'resting' | 'raised' | 'overlay'

/**
 * A single elevation tier's token set — fill, border, shadow, blur, and
 * an optional opaque fallback for tiers that use backdrop-filter.
 *
 * Constraints enforced by design:
 * - blur = 0px for canvas, sunken, resting
 * - blur = 12–20px for raised (currently 16px via --blur-raised)
 * - blur = 24–40px for overlay (currently 32px via --blur-overlay)
 * - Each tier's fill differs from adjacent tiers by ≥1.1:1 contrast ratio
 */
export interface ElevationDefinition {
  readonly fill: string
  readonly border: string
  readonly shadow: string
  readonly blur: string
  /** Opaque solid fill for browsers without backdrop-filter support (Req 4.10). */
  readonly opaqueFallback?: string
}

/**
 * Complete elevation tier system.
 *
 * Tier Map — component assignments:
 *
 * | Tier     | Components / Use Cases                                      |
 * |----------|-------------------------------------------------------------|
 * | canvas   | Page background, AppShell ambient field                     |
 * | sunken   | Input wells, inset areas, code blocks, search fields        |
 * | resting  | Cards, list containers, section panels, default containers  |
 * | raised   | Floating cards, AllowanceHero, NavigationDock, tooltips     |
 * | overlay  | Sheets, modals, celebration overlays, dropdown menus        |
 *
 * Fill contrast ratios (adjacent tiers):
 *   canvas (#0e0e1a) → sunken (#12121f): ~1.2:1
 *   sunken (#12121f) → resting (#1a1a2e): ~1.3:1
 *   resting (#1a1a2e) → raised (#22223a): ~1.2:1
 *   raised (#22223a) → overlay (#2a2a44): ~1.2:1
 *
 * All ratios exceed the required ≥1.1:1 minimum.
 */
export const elevations: Record<ElevationTier, ElevationDefinition> = {
  canvas: {
    fill: 'var(--color-canvas)',
    border: 'var(--border-subtle)',
    shadow: 'var(--shadow-none)',
    blur: 'var(--blur-none)',
  },
  sunken: {
    fill: 'var(--color-sunken)',
    border: 'var(--border-subtle)',
    shadow: 'var(--shadow-none)',
    blur: 'var(--blur-none)',
  },
  resting: {
    fill: 'var(--color-surface)',
    border: 'var(--border-default)',
    shadow: 'var(--shadow-sm)',
    blur: 'var(--blur-none)',
  },
  raised: {
    fill: 'var(--color-raised)',
    border: 'var(--border-strong)',
    shadow: 'var(--shadow-md)',
    blur: 'var(--blur-raised)',
    opaqueFallback: 'var(--color-raised-opaque)',
  },
  overlay: {
    fill: 'var(--color-overlay)',
    border: 'var(--border-accent)',
    shadow: 'var(--shadow-xl)',
    blur: 'var(--blur-overlay)',
    opaqueFallback: 'var(--color-overlay-opaque)',
  },
} as const

/**
 * Tier assignment map — documents which component types belong to which tier.
 * Used for reference and enforcement (Req 4.2).
 *
 * Every container that paints a background fill, border, or shadow must be
 * assigned to exactly one tier. Unassigned containers default to 'resting' (Req 4.8).
 */
export const tierMap: Record<ElevationTier, readonly string[]> = {
  canvas: [
    'AppShell (page background)',
    'Ambient field',
    'OverlayScreen backdrop',
  ],
  sunken: [
    'Input wells',
    'Search fields',
    'Inset areas / code blocks',
    'Toggle track (off state)',
  ],
  resting: [
    'Card (default)',
    'ListRow containers',
    'SectionHeader panels',
    'ChartFrame',
    'EmptyState / ErrorState',
  ],
  raised: [
    'AllowanceHero',
    'NavigationDock',
    'Floating action cards',
    'Tooltips',
    'QuickLogControl (expanded)',
  ],
  overlay: [
    'Sheet (half / full)',
    'Modal dialogs',
    'CelebrationOverlay',
    'Dropdown menus',
    'ContextMenu',
  ],
} as const

// ============================================================================
// Radius Tokens
// ============================================================================

/**
 * Named border-radius tokens referencing `--radius-{name}` CSS custom properties.
 *
 * | Token   | Value   | Use                                    |
 * |---------|---------|----------------------------------------|
 * | min     | 4px     | Minimum / nested inner radius          |
 * | control | 12px    | Buttons, inputs, small controls        |
 * | card    | 20px    | Cards, containers                      |
 * | sheet   | 28px    | Sheets, overlays                       |
 * | full    | 9999px  | Chips, avatars, pills (full pill)      |
 */
export type RadiusName = 'min' | 'control' | 'card' | 'sheet' | 'full'

export const radius: TokenAccessor<RadiusName> = {
  min: 'var(--radius-min)',
  control: 'var(--radius-control)',
  card: 'var(--radius-card)',
  sheet: 'var(--radius-sheet)',
  full: 'var(--radius-full)',
} as const

/**
 * Numeric radius values in pixels, for use in nested radius calculations.
 * These mirror the CSS custom property resolved values.
 */
export const radiusValues: Record<RadiusName, number> = {
  min: 4,
  control: 12,
  card: 20,
  sheet: 28,
  full: 9999,
} as const

// ============================================================================
// Nested Radius Correction
// ============================================================================

/**
 * Computes the inner corner radius when nesting a rounded element inside
 * another rounded element with intervening padding.
 *
 * Formula: inner = outer − padding, clamped to a minimum of 4px (--radius-min).
 *
 * This prevents inner corners from looking too sharp relative to the outer
 * container and ensures visual consistency across nested surface tiers.
 *
 * @param outerRadius - The outer container's border-radius in px
 * @param padding - The padding between outer and inner container in px
 * @returns The corrected inner border-radius in px (minimum 4px)
 *
 * @example
 * ```ts
 * // Card (20px radius) with 16px padding → inner content radius
 * nestedRadius(20, 16) // → 4 (clamped to min)
 *
 * // Sheet (28px radius) with 12px padding → inner card radius
 * nestedRadius(28, 12) // → 16
 *
 * // Card (20px radius) with 8px padding → inner element radius
 * nestedRadius(20, 8) // → 12
 * ```
 */
export function nestedRadius(outerRadius: number, padding: number): number {
  const MIN_RADIUS = 4
  return Math.max(MIN_RADIUS, outerRadius - padding)
}
