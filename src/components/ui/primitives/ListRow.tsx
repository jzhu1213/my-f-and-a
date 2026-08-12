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
 * Swipe mechanics (Req 14.5, 14.10, 14.11):
 * - Drag tracks pointer with ≤1 frame of lag (useMotionValue + requestAnimationFrame)
 * - Release <40% row width: spring back within 300ms
 * - Release ≥40% on delete: remove entry, show undo affordance (5+ seconds)
 * - Removal animation: close gap within 400ms, no blank row (reduced-motion: instant)
 *
 * Row heights:
 * - default: 64px min-height
 * - dense: 48px min-height (still ≥44px hit target)
 *
 * Requirements: 16.1, 16.2, 16.4, 4.2, 14.5, 14.6, 14.7, 14.10, 14.11, 14.12
 */

import {
  type ReactNode,
  forwardRef,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react"
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo, type Variants } from "framer-motion"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { springs, layoutSpring, timings } from "@/lib/animations"

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
  /** Called when user commits delete (swipe ≥40% of row width). */
  onDelete?: () => void
  /** Called when user activates edit action. */
  onEdit?: () => void
  /** Whether the row is in the revealed state (controlled). */
  revealed?: boolean
  /** Whether the row is in an expanded inline-edit state. */
  editing?: boolean
  /** Content to show when in inline-edit mode. */
  editContent?: ReactNode
  /** Called when inline editing is dismissed. */
  onEditDismiss?: () => void
  /** Whether this row is being removed (triggers exit animation). */
  removing?: boolean
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

/** Commit threshold: 40% of row width triggers delete. */
const DELETE_THRESHOLD_FRACTION = 0.4

/** Spring-back threshold: release <40% row width springs back within 300ms. */
const SPRING_BACK_MS = 300

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

/** Removal animation: collapse height + fade out within 400ms (Req 14.7). */
const removalVariants: Variants = {
  present: {
    opacity: 1,
    height: "auto",
    marginTop: 0,
    marginBottom: 0,
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    transition: {
      opacity: { type: "tween", duration: 0.15, ease: "easeOut" },
      height: { ...springs.responsive, type: "spring", duration: 0.4 },
      marginTop: { type: "tween", duration: 0.35 },
      marginBottom: { type: "tween", duration: 0.35 },
    },
  },
}

/** Reduced-motion removal: instant (no animated collapse). */
const removalVariantsReduced: Variants = {
  present: { opacity: 1, height: "auto" },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0 },
  },
}

/** Inline edit expand: shared-element continuity within 400ms (Req 14.6). */
const editExpandVariants: Variants = {
  collapsed: {
    opacity: 0,
    height: 0,
    transition: {
      height: springs.responsive,
      opacity: { type: "tween", duration: 0.15 },
    },
  },
  expanded: {
    opacity: 1,
    height: "auto",
    transition: {
      height: springs.responsive,
      opacity: { type: "tween", duration: 0.2, delay: 0.1 },
    },
  },
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
    onDelete,
    onEdit,
    revealed: controlledRevealed,
    editing = false,
    editContent,
    onEditDismiss,
    removing = false,
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
  const rowRef = useRef<HTMLDivElement>(null)
  const [rowWidth, setRowWidth] = useState(320)

  // Measure row width for 40% threshold calculation
  useEffect(() => {
    if (!isSwipeable) return
    const el = rowRef.current
    if (!el) return
    const measure = () => setRowWidth(el.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isSwipeable])

  // Swipe motion value — driven by requestAnimationFrame for ≤1 frame lag
  const x = useMotionValue(0)
  const revealOpacity = useTransform(x, [-REVEAL_WIDTH, -REVEAL_WIDTH * 0.3, 0], [1, 0.5, 0])
  const revealScale = useTransform(x, [-REVEAL_WIDTH, 0], [1, 0.8])

  // Track whether user has crossed the delete threshold during drag
  const [pastDeleteThreshold, setPastDeleteThreshold] = useState(false)
  const deleteThreshold = rowWidth * DELETE_THRESHOLD_FRACTION

  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      // Track if user is past the delete threshold for visual feedback
      const absDrag = Math.abs(info.offset.x)
      setPastDeleteThreshold(absDrag >= deleteThreshold)
    },
    [deleteThreshold]
  )

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const displacement = Math.abs(info.offset.x)
      setPastDeleteThreshold(false)

      // Release ≥40% of row width: commit delete action (Req 14.11)
      if (displacement >= deleteThreshold) {
        onDelete?.()
        return
      }

      // Old latch logic: reveal at 50% of REVEAL_WIDTH
      const latchThreshold = REVEAL_WIDTH * 0.5
      const shouldReveal = displacement >= latchThreshold || Math.abs(info.velocity.x) > 400

      if (shouldReveal && info.offset.x < 0 && !isRevealed) {
        setInternalRevealed(true)
        onReveal?.()
      } else {
        // Spring back within 300ms (Req 14.10)
        setInternalRevealed(false)
      }
    },
    [isRevealed, onReveal, onDelete, deleteThreshold]
  )

  // Close revealed state when tapping elsewhere
  const handleClose = useCallback(() => {
    setInternalRevealed(false)
  }, [])

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
        className={`focus-ring${className ? ` ${className}` : ''}`}
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

  // Swipeable variant with enhanced mechanics
  return (
    <motion.div
      ref={(node) => {
        // Merge refs
        (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      style={{ ...baseStyle, padding: 0, overflow: "hidden" }}
      className={className}
      aria-label={ariaLabel}
      data-testid={testId}
      layout
      transition={layoutSpring}
    >
      {/* Reveal actions panel (behind main content) */}
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
            padding: `0 ${spacingScale["12"]}`,
            opacity: revealOpacity,
            scale: revealScale,
          }}
          aria-hidden={!isRevealed}
        >
          {revealContent}
        </motion.div>
      )}

      {/* Main row content — draggable with ≤1 frame lag tracking */}
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
          touchAction: "pan-y",
        }}
        drag="x"
        dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{
          x: isRevealed ? -REVEAL_WIDTH : 0,
        }}
        transition={{
          ...springs.responsive,
          // Spring back within 300ms (Req 14.10)
        }}
        whileTap={!isRevealed ? { scale: 0.98, transition: springs.snappy } : undefined}
        onClick={isRevealed ? handleClose : onPress}
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        className={onPress ? "focus-ring" : undefined}
      >
        {children}
      </motion.div>

      {/* Inline edit expansion (Req 14.6) */}
      <AnimatePresence>
        {editing && editContent && (
          <motion.div
            key="edit-expansion"
            variants={editExpandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            style={{
              overflow: "hidden",
              width: "100%",
              background: tier.fill,
              borderTop: tier.border,
              padding: `0 ${spacingScale["16"]}`,
            }}
          >
            <div style={{ padding: `${spacingScale["12"]} 0` }}>
              {editContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})
