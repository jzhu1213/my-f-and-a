/**
 * Icon
 *
 * The single wrapper every surface uses to render an icon. It takes a
 * *semantic* name (e.g. `category:food`, `tool:debt`, `nav:home`), looks the
 * concrete Lucide glyph up in the central {@link ICON_REGISTRY}, and renders it
 * with Folio's consistent defaults:
 *
 *   - **size** 20px (matches the app's optical icon rhythm; nav/chrome override)
 *   - **strokeWidth** 1.6 (matches the old hand-rolled `AppShell` SVGs)
 *   - **color** `currentColor` so icons inherit the surrounding theme text color
 *     and never break the warm-purple palette
 *
 * Accessibility: icons are decorative by default (`aria-hidden`). Pass `label`
 * to give an icon an accessible name (renders `role="img"` + `aria-label`);
 * only do this for icon-only controls that don't already have a labeled parent.
 *
 * Because everything routes through this component + the registry, swapping the
 * underlying icon set later is a change to `src/lib/icons.ts` alone.
 */

import type { LucideProps } from 'lucide-react'
import { ICON_REGISTRY, type IconName } from '@/lib/icons'

export interface IconProps extends Omit<LucideProps, 'ref' | 'name'> {
  /** Semantic icon name resolved through the central registry. */
  name: IconName
  /**
   * Accessible name for icon-only controls. When omitted the icon is treated as
   * decorative and hidden from assistive tech (`aria-hidden`).
   */
  label?: string
}

/** Default optical size, in px. */
const DEFAULT_SIZE = 20
/** Default stroke width — matches the legacy hand-rolled AppShell SVGs. */
const DEFAULT_STROKE_WIDTH = 1.6

export function Icon({
  name,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  label,
  ...rest
}: IconProps) {
  const Glyph = ICON_REGISTRY[name]

  const a11yProps = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      {...a11yProps}
      {...rest}
    />
  )
}
