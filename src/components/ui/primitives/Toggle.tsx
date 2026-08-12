"use client"

import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { elevations, radius } from "@/styles/surfaces"
import { colorRamp } from "@/styles/colors"

/**
 * Toggle primitive — a switch/toggle control.
 *
 * Sizes:
 * - `sm`: Compact toggle (36×20px track) for dense settings lists.
 * - `md`: Standard toggle (44×24px track) for primary settings.
 *
 * States: on, off, disabled
 *
 * All visual values resolve from the Design_Token_System.
 * Hit area ≥ 44×44px (via padding when sm).
 * Press animation via framer-motion (snappy spring for knob, bouncy for state change).
 * No arbitrary style props exposed.
 *
 * Requirements: 16.1, 16.2, 16.4
 */

// ============================================================================
// Types
// ============================================================================

export interface ToggleProps {
  /** Whether the toggle is on */
  readonly checked: boolean
  /** Callback when toggle state changes */
  readonly onChange?: (checked: boolean) => void
  /** Size variant */
  readonly size?: "sm" | "md"
  /** Disabled state */
  readonly disabled?: boolean
  /** Accessible label */
  readonly "aria-label"?: string
  /** Id of the labelling element */
  readonly "aria-labelledby"?: string
}

// ============================================================================
// Size configurations (all from token-derived values)
// ============================================================================

interface ToggleSizeConfig {
  trackWidth: number
  trackHeight: number
  knobSize: number
  padding: number
  /** Total hit area guaranteed ≥ 44px */
  hitPadding: number
}

const sizeConfigs: Record<"sm" | "md", ToggleSizeConfig> = {
  sm: {
    trackWidth: 36,
    trackHeight: 20,
    knobSize: 16,
    padding: 2,
    hitPadding: 12, // (44 - 20) / 2 = 12 on each side
  },
  md: {
    trackWidth: 44,
    trackHeight: 24,
    knobSize: 20,
    padding: 2,
    hitPadding: 10, // (44 - 24) / 2 = 10 on each side
  },
}

// ============================================================================
// Knob Colors
// ============================================================================

/**
 * Knob fill for off state — using a light tone that ensures contrast
 * against the sunken track fill. Resolves from the color-text CSS token.
 */
const KNOB_FILL_OFF = "var(--color-text, #ffffff)"

/**
 * Knob fill for on state — white for maximum contrast on accent track.
 * Resolves from the color-text CSS token (which is white in the canonical palette).
 */
const KNOB_FILL_ON = "var(--color-text, #ffffff)"

// ============================================================================
// Component
// ============================================================================

export function Toggle({
  checked,
  onChange,
  size = "md",
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ToggleProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const config = sizeConfigs[size]
  const knobTravel = config.trackWidth - config.knobSize - config.padding * 2

  const handleClick = () => {
    if (!disabled) {
      onChange?.(!checked)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onChange?.(!checked)
    }
  }

  return (
    <motion.div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="focus-ring"
      whileTap={disabled ? undefined : (prefersReducedMotion ? { opacity: 0.92 } : { scale: 0.96 })}
      transition={prefersReducedMotion ? timings.fast : springs.snappy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        // Ensure ≥44×44px hit area via padding
        padding: `${config.hitPadding}px`,
        minWidth: "44px",
        minHeight: "44px",
        borderRadius: radius.full,
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Track */}
      <motion.div
        animate={{
          background: checked ? colorRamp.accent[500] : elevations.sunken.fill,
          borderColor: checked ? colorRamp.accent[400] : elevations.resting.border,
        }}
        transition={springs.snappy}
        style={{
          position: "relative",
          width: `${config.trackWidth}px`,
          height: `${config.trackHeight}px`,
          borderRadius: radius.full,
          borderWidth: "1px",
          borderStyle: "solid",
          boxShadow: elevations.resting.shadow,
          overflow: "hidden",
        }}
      >
        {/* Knob */}
        <motion.div
          animate={{
            x: checked ? knobTravel : 0,
          }}
          transition={prefersReducedMotion ? { type: "tween", duration: 0 } : springs.bouncy}
          style={{
            position: "absolute",
            top: `${config.padding}px`,
            left: `${config.padding}px`,
            width: `${config.knobSize}px`,
            height: `${config.knobSize}px`,
            borderRadius: radius.full,
            background: checked ? KNOB_FILL_ON : KNOB_FILL_OFF,
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </motion.div>
    </motion.div>
  )
}


