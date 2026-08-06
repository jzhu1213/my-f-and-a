/**
 * Card
 *
 * A lightweight, non-glass solid surface for list items, settings rows, and
 * dense content. Uses `var(--surface)` background (opaque), no backdrop-filter.
 *
 * ## Surface Hierarchy
 *
 * Folio's design system defines three surface tiers:
 *
 * - **Tier 1 (Hero/Overlay)**: `GlassCard elevation="high"`
 *   Daily allowance hero, celebration overlays, bottom sheets.
 *   Full glassmorphism, strong blur, prominent shadow.
 *
 * - **Tier 2 (Primary Card)**: `GlassCard elevation="low" | "medium"`
 *   Contextual tips, growth outlook, featured tool cards.
 *   Light/medium glass for focal cards that deserve visual prominence.
 *
 * - **Tier 3 (List/Dense)**: `Card`
 *   Goal items, debt items, category rows, settings rows, funding sources.
 *   Solid surface, quiet shadow, no blur. Reserves glass for focal surfaces.
 *
 * This component is a plain typed wrapper (no hooks), so it stays a server
 * component and can be used anywhere.
 *
 * Accessibility: the opaque `var(--surface)` fill (#1a1a2e) against pure-white
 * `--text` keeps WCAG AA contrast comfortably. The same border-radius tokens
 * and shadow scale as GlassCard ensure visual consistency.
 */

import type { HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional padding shorthand. Pass a number (px) or CSS string. */
  padding?: string | number
}

export function Card({
  className = '',
  style,
  padding,
  children,
  ...rest
}: CardProps) {
  const classes = ['card', className].filter(Boolean).join(' ')

  const paddingStyle =
    padding !== undefined
      ? { padding: typeof padding === 'number' ? `${padding}px` : padding }
      : {}

  return (
    <div
      className={classes}
      style={{ ...paddingStyle, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
