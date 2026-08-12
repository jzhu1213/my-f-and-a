"use client"

import { useId } from "react"
import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { textColors } from "@/styles/colors"
import { typography } from "@/styles/typography"

/**
 * SegmentedControl primitive — a horizontal segment selector.
 *
 * Props:
 * - `items`: Array of segment labels (string[]).
 * - `selectedIndex`: Currently selected segment index.
 * - `onChange`: Callback with the newly selected index.
 *
 * Per-segment states: default, selected
 *
 * Uses a spring-driven shared indicator (layoutId) for the selected segment
 * that glides between positions. All visual values from Surface_System tokens.
 * Hit area ≥ 44×44px per segment.
 * No arbitrary style props exposed.
 *
 * Requirements: 16.1, 16.2, 16.4
 */

// ============================================================================
// Types
// ============================================================================

export interface SegmentedControlProps {
  /** Segment labels */
  readonly items: readonly string[]
  /** Index of currently selected segment */
  readonly selectedIndex: number
  /** Callback when selection changes */
  readonly onChange?: (index: number) => void
  /** Disabled state */
  readonly disabled?: boolean
  /** Accessible label for the control group */
  readonly "aria-label"?: string
}

// ============================================================================
// Styles (token-derived)
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
  background: elevations.sunken.fill,
  border: `1px solid ${elevations.resting.border}`,
  borderRadius: radius.control,
  padding: spacingScale[4],
  gap: spacingScale[2],
  boxShadow: elevations.resting.shadow,
}

const segmentStyles: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  minWidth: "44px",
  padding: `${spacingScale[8]} ${spacingScale[16]}`,
  borderRadius: radius.min,
  cursor: "pointer",
  userSelect: "none",
  border: "none",
  background: "transparent",
  zIndex: 1,
  ...typography.body,
  whiteSpace: "nowrap",
}

// ============================================================================
// Component
// ============================================================================

export function SegmentedControl({
  items,
  selectedIndex,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  const id = useId()
  const layoutId = `${id}-indicator`
  const { prefersReducedMotion } = useReducedMotion()

  const handleSelect = (index: number) => {
    if (disabled) return
    onChange?.(index)
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault()
        if (index < items.length - 1) {
          onChange?.(index + 1)
        }
        break
      case "ArrowLeft":
        e.preventDefault()
        if (index > 0) {
          onChange?.(index - 1)
        }
        break
      case "Enter":
      case " ":
        e.preventDefault()
        onChange?.(index)
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        ...containerStyles,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : undefined,
      }}
    >
      {items.map((label, index) => {
        const isSelected = index === selectedIndex
        return (
          <motion.button
            key={label}
            role="tab"
            aria-selected={isSelected}
            aria-disabled={disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => handleSelect(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="focus-ring"
            whileTap={disabled ? undefined : (prefersReducedMotion ? { opacity: 0.92 } : { scale: 0.96 })}
            transition={prefersReducedMotion ? timings.fast : springs.snappy}
            style={{
              ...segmentStyles,
              color: isSelected ? textColors.text : textColors.muted,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {/* Animated background indicator for selected segment */}
            {isSelected && (
              <motion.div
                layoutId={layoutId}
                transition={prefersReducedMotion ? timings.fast : springs.responsive}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: elevations.raised.fill,
                  border: `1px solid ${elevations.raised.border}`,
                  borderRadius: radius.min,
                  boxShadow: elevations.raised.shadow,
                  zIndex: -1,
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
