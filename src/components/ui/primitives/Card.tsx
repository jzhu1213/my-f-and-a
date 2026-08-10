"use client"

/**
 * Card — Container primitive for resting and raised elevation content.
 *
 * Resolves all visual values from the Design_Token_System:
 * - Fill, border, shadow, blur from Surface_System elevation tiers
 * - Corner radius from --radius-card (20px)
 * - Press treatment: 2% scale down via snappy spring
 *
 * Elevation tiers:
 * - resting: --color-surface fill, --border-default (1px --fill-06), --shadow-sm, 0px blur
 * - raised: --color-raised fill, --border-strong (1px --fill-10), --shadow-md, 16px blur
 *
 * Requirements: 16.1, 16.2, 16.4, 4.2
 */

import { type ReactNode, forwardRef } from "react"
import { motion, type Variants } from "framer-motion"
import { elevations, radius } from "@/styles/surfaces"
import { springs } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export type CardElevation = "resting" | "raised"

export interface CardProps {
  /** Elevation tier determines fill, border, shadow, and blur. */
  elevation?: CardElevation
  /** Card content. */
  children?: ReactNode
  /** Whether the card is interactive (enables press state). */
  interactive?: boolean
  /** Called when an interactive card is pressed. */
  onPress?: () => void
  /** Additional inline styles. */
  style?: React.CSSProperties
  /** CSS class name. */
  className?: string
  /** Accessible label. */
  "aria-label"?: string
  /** Test ID for testing. */
  "data-testid"?: string
}

// ============================================================================
// Motion Variants
// ============================================================================

const pressVariants: Variants = {
  rest: { scale: 1, transition: springs.bouncy },
  pressed: { scale: 0.98, transition: springs.snappy },
}

// ============================================================================
// Component
// ============================================================================

/**
 * A container primitive at the resting or raised elevation tier.
 *
 * - Non-interactive by default (static container)
 * - Set `interactive` for hover/pressed states (2% scale-down on press)
 * - All visual tokens resolved from Surface_System — no arbitrary style props
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    elevation = "resting",
    interactive = false,
    onPress,
    children,
    style,
    className,
    "aria-label": ariaLabel,
    "data-testid": testId,
  },
  ref
) {
  const tier = elevations[elevation]

  const baseStyle: React.CSSProperties = {
    background: tier.fill,
    border: tier.border,
    boxShadow: tier.shadow,
    backdropFilter: elevation === "raised" ? `blur(${tier.blur})` : undefined,
    WebkitBackdropFilter: elevation === "raised" ? `blur(${tier.blur})` : undefined,
    borderRadius: radius.card,
    overflow: "hidden",
    ...style,
  }

  if (!interactive) {
    return (
      <div ref={ref} style={baseStyle} className={className} aria-label={ariaLabel} data-testid={testId}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      style={{ ...baseStyle, cursor: "pointer" }}
      className={`focus-ring${className ? ` ${className}` : ''}`}
      variants={pressVariants}
      initial="rest"
      whileHover="rest"
      whileTap="pressed"
      onClick={onPress}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-testid={testId}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPress?.()
        }
      }}
    >
      {children}
    </motion.div>
  )
})
