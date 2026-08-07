"use client"

/**
 * ListRow — Row primitive for lists with default, dense, and swipeable variants.
 *
 * States: default, hover, pressed, revealed (swipe actions exposed).
 *
 * Resolves all visual values from Design_Token_System:
 * - Surface fill from resting tier (--color-surface)
 * - Border from --border-default (1px --fill-06)
 * - Corner radius from --radius-card (20px)
 * - Hit area ≥44px height
 * - Press treatment: 2% scale down via snappy spring
 * - Swipeable variant: horizontal drag reveals action area
 *
 * Row heights:
 * - default: 64px min-height
 * - dense: 48px min-height (still ≥44px hit target)
 *
 * Requirements: 16.1, 16.2, 16.4, 4.2
 */

import {
  type ReactNode,
  forwardRef,
  useState,
  useCallback,
} from "react"
import { motion, useMotionValue, useTransform, type PanInfo, type Variants } from "framer-motion"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { springs } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export type ListRowVariant = "default" | "dense" | "swipeable"

export interface ListRowProps {
  /** Row variant determines height and interaction style. */
  variant?: ListRowVariant
  /** Row content. */
  children?: ReactNode
  /** Action content revealed on swipe (only rendered for swipeable variant). */
  revealContent?: ReactNode
  /** Called when the row is pressed/tapped. */
  onPress?: () => void
  /** Called when the row's revealed actions are exposed. */
  onReveal?: () => void
  /** Whether the row is in the revealed state (controlled). */
  revealed?: boolean
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
// Constants
// ============================================================================

/** Maximum swipe distance to reveal actions (px). */
const REVEAL_WIDTH = 160

/** Latch threshold: 50% of reveal width. */
const LATCH_THRESHOLD = REVEAL_WIDTH * 0.5

/** Row min-heights per variant. */
const ROW_HEIGHTS: Record<ListRowVariant, string> = {
  default: "64px",
  dense: "48px",
  swipeable: "64px",
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

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  {
    variant = "default",
    children,
    revealContent,
    onPress,
    onReveal,
    revealed: controlledRevealed,
    style,
    className,
    "aria-label": ariaLabel,
    "data-testid": testId,
  },
  ref
) {
  const tier = elevations.resting
  const [internalRevealed, setInternalRevealed] = useState(false)
  const isRevealed = controlledRevealed ?? internalRevealed
  const isSwipeable = variant === "swipeable"

  // Swipe motion value
  const x = useMotionValue(0)
  const revealOpacity = useTransform(x, [-REVEAL_WIDTH, -LATCH_THRESHOLD, 0], [1, 0.6, 0])

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const shouldReveal = info.offset.x < -LATCH_THRESHOLD || info.velocity.x < -400
      if (shouldReveal && !isRevealed) {
        setInternalRevealed(true)
        onReveal?.()
      } else {
        setInternalRevealed(false)
      }
    },
    [isRevealed, onReveal]
  )

  const baseStyle: React.CSSProperties = {
    background: tier.fill,
    border: tier.border,
    borderRadius: radius.card,
    minHeight: ROW_HEIGHTS[variant],
    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
    display: "flex",
    alignItems: "center",
    gap: spacingScale["12"],
    position: "relative",
    overflow: "hidden",
    cursor: onPress ? "pointer" : undefined,
    ...style,
  }

  // Non-swipeable: simple press-interactive row
  if (!isSwipeable) {
    return (
      <motion.div
        ref={ref}
        style={baseStyle}
        className={className}
        variants={pressVariants}
        initial="rest"
        whileTap={onPress ? "pressed" : undefined}
        onClick={onPress}
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        aria-label={ariaLabel}
        data-testid={testId}
        onKeyDown={
          onPress
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onPress()
                }
              }
            : undefined
        }
      >
        {children}
      </motion.div>
    )
  }

  // Swipeable variant: drag to reveal actions
  return (
    <div ref={ref} style={{ ...baseStyle, padding: 0 }} className={className} aria-label={ariaLabel} data-testid={testId}>
      {/* Reveal actions (behind main content) */}
      {revealContent && (
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: `${REVEAL_WIDTH}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: `0 ${spacingScale["16"]}`,
            opacity: revealOpacity,
          }}
          aria-hidden={!isRevealed}
        >
          {revealContent}
        </motion.div>
      )}

      {/* Main row content — draggable */}
      <motion.div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacingScale["12"],
          padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
          width: "100%",
          minHeight: ROW_HEIGHTS[variant],
          background: tier.fill,
          borderRadius: radius.card,
          x,
        }}
        drag="x"
        dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: isRevealed ? -REVEAL_WIDTH : 0 }}
        transition={springs.sheet}
        whileTap={{ scale: 0.98, transition: springs.snappy }}
        onClick={!isRevealed ? onPress : undefined}
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
      >
        {children}
      </motion.div>
    </div>
  )
})
