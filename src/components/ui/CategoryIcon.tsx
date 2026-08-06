/**
 * CategoryIcon
 *
 * Renders a `TransactionCategory` (or custom category) as a theme-colored icon
 * inside a subtle, per-category tinted circular chip. This is the single
 * surface-agnostic building block that replaces the old `getCategoryEmoji`
 * spans across QuickLogArea, the category budget cards, transaction rows, and
 * `CategoryDetailSheet` (Phase 6, task 234).
 *
 * Resolution order:
 *   1. explicit `iconName` (e.g. a custom category's chosen icon)
 *   2. the built-in category icon (unless `isCustom`)
 *   3. a legacy `emoji` (backward-compat for custom categories created before
 *      the icon set existed — task 234.2)
 *   4. the neutral `category:fallback` icon
 *
 * The chip background is derived from the category's accent color (see
 * {@link getCategoryAccent}) via `color-mix`, and the icon inherits that accent
 * through `currentColor`. Accent colors are bright enough to keep WCAG 2.1 AA
 * non-text contrast (3:1) against the warm dark background.
 *
 * Accessibility: decorative by default (`aria-hidden`) because every surface
 * that uses it pairs the chip with a visible text label or a labeled control.
 * Pass `label` for the rare icon-only case to expose an accessible name.
 */

import type { CSSProperties } from "react"
import { Icon } from "./Icon"
import { getCategoryIconName, type IconName } from "@/lib/icons"
import { getCategoryAccent } from "@/styles/shared"
import type { TransactionCategory } from "@/types"

export interface CategoryIconProps {
  /** Category value (built-in `TransactionCategory` or a custom string). */
  category: TransactionCategory | string
  /** Explicit icon override — used for custom categories with a chosen icon. */
  iconName?: IconName
  /** Legacy emoji fallback for custom categories that predate the icon set. */
  emoji?: string
  /**
   * When true the built-in category→icon mapping is skipped so custom
   * categories fall through to their chosen icon or stored emoji rather than
   * borrowing the "other" glyph.
   */
  isCustom?: boolean
  /** Diameter of the tinted chip, in px. Default 40. */
  size?: number
  /** Icon glyph size, in px. Defaults to ~52% of the chip size. */
  iconSize?: number
  /** Stroke width forwarded to the icon. */
  strokeWidth?: number
  /**
   * Accessible name. When provided the chip is exposed to assistive tech
   * (`role="img"`); otherwise it is treated as decorative (`aria-hidden`).
   */
  label?: string
  style?: CSSProperties
  className?: string
}

export function CategoryIcon({
  category,
  iconName,
  emoji,
  isCustom = false,
  size = 40,
  iconSize,
  strokeWidth,
  label,
  style,
  className,
}: CategoryIconProps) {
  const accent = isCustom && !iconName ? getCategoryAccent("fallback") : getCategoryAccent(category)
  const glyphSize = iconSize ?? Math.round(size * 0.52)

  // Decide what to render inside the chip following the resolution order.
  let content: React.ReactNode
  if (iconName) {
    content = <Icon name={iconName} size={glyphSize} strokeWidth={strokeWidth} />
  } else if (!isCustom) {
    content = <Icon name={getCategoryIconName(category)} size={glyphSize} strokeWidth={strokeWidth} />
  } else if (emoji) {
    content = (
      <span style={{ fontSize: Math.round(glyphSize * 1.05), lineHeight: 1 }} aria-hidden="true">
        {emoji}
      </span>
    )
  } else {
    content = <Icon name="category:fallback" size={glyphSize} strokeWidth={strokeWidth} />
  }

  const a11yProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const }

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: `color-mix(in srgb, ${accent} 15%, transparent)`,
        color: accent,
        ...style,
      }}
      {...a11yProps}
    >
      {content}
    </span>
  )
}
