/**
 * GlassCard
 *
 * A reusable frosted-glass surface for the premium Folio UI. It renders a
 * translucent, blurred panel (`backdrop-filter: blur(16px) saturate(180%)`)
 * over the animated mesh background, with a 1px gradient rim (bright top,
 * fading to transparent) and a soft drop-shadow.
 *
 * - `elevation` controls blur intensity, rim brightness and shadow depth.
 * - `glow` adds a contextual colored halo tied to allowance status (healthy,
 *   caution, warning, over) or celebrations — or any custom CSS color.
 *
 * The visual treatment lives in `.glass-card*` classes in globals.css. This
 * component is a plain typed wrapper (no hooks), so it stays a server
 * component and can be used anywhere.
 *
 * Accessibility: the translucent fill is only ~4% white over the dark theme
 * background, so the effective surface stays dark and the theme's pure-white
 * text keeps WCAG AA contrast. Browsers without `backdrop-filter` fall back to
 * an opaque surface (handled in globals.css) so text is never unreadable.
 */

import type { HTMLAttributes } from 'react'

/** How much the card lifts off the background. */
export type GlassElevation = 'low' | 'medium' | 'high'

/** Semantic halo presets that map to allowance status and celebrations. */
export type GlowPreset =
  | 'none'
  | 'healthy'
  | 'caution'
  | 'warning'
  | 'over'
  | 'celebration'

/**
 * Any custom CSS color for the halo (e.g. `#facc15`, `rgba(...)`, `var(--x)`).
 * The `& {}` keeps the preset literals visible in editor autocomplete while
 * still allowing arbitrary strings.
 */
export type GlowColor = string & {}

/** Accepted values for the `glow` prop. */
export type GlassGlow = GlowPreset | GlowColor

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Blur intensity, rim brightness and shadow depth. Defaults to `medium`. */
  elevation?: GlassElevation
  /** Contextual colored edge lighting. Defaults to `none`. */
  glow?: GlassGlow
}

/** Halo colors for the semantic glow presets (tuned to the warm theme). */
const GLOW_PRESET_COLORS: Record<Exclude<GlowPreset, 'none'>, string> = {
  healthy: 'rgba(74, 222, 128, 0.35)', // --success green
  caution: 'rgba(251, 191, 36, 0.35)', // --warning amber
  warning: 'rgba(251, 146, 60, 0.40)', // urgent orange
  over: 'rgba(248, 113, 113, 0.42)', // --error red
  celebration: 'rgba(252, 211, 77, 0.45)', // warm gold
}

function resolveGlow(glow: GlassGlow): string | null {
  if (glow === 'none') return null
  if (glow in GLOW_PRESET_COLORS) {
    return GLOW_PRESET_COLORS[glow as Exclude<GlowPreset, 'none'>]
  }
  // Any other string is treated as a custom CSS color.
  return glow
}

export function GlassCard({
  elevation = 'medium',
  glow = 'none',
  className = '',
  style,
  children,
  ...rest
}: GlassCardProps) {
  const glowColor = resolveGlow(glow)

  const classes = [
    'glass-card',
    `glass-card--${elevation}`,
    glowColor ? 'glass-card--glow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      style={
        glowColor
          ? ({ ...style, ['--glass-glow' as string]: glowColor } as typeof style)
          : style
      }
      {...rest}
    >
      {children}
    </div>
  )
}
