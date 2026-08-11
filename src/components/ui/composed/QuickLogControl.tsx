"use client"

/**
 * QuickLogControl — Composed component
 *
 * A circular button with gradient fill (--gradient-action) and an animated
 * glow ring. This is the highest-contrast interactive element in the viewport.
 *
 * - Gradient fill from --gradient-action token
 * - Animated glow ring using framer-motion (pulse)
 * - Highest contrast: dark icon on bright gradient (≥10:1)
 * - Hit area ≥44×44px
 * - Reduced motion: static glow, no pulse animation
 *
 * Requirements: 16.1, 11.4
 */

import React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Icon } from "@/components/ui/Icon"
import { gradients, colorRamp, surfaceColors } from "@/styles/colors"
import { springPresets } from "@/styles/motion"

// ============================================================================
// Types
// ============================================================================

export interface QuickLogControlProps {
  /** Called when the control is tapped. */
  onPress: () => void
  /** Accessible label. Defaults to "Log expense". */
  "aria-label"?: string
  /** Size of the control in px. Defaults to 56. */
  size?: number
}

// ============================================================================
// Constants
// ============================================================================

const GLOW_PULSE_VARIANTS = {
  idle: {
    opacity: 0.4,
    scale: 1,
  },
  pulse: {
    opacity: [0.4, 0.7, 0.4],
    scale: [1, 1.15, 1],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

const PRESS_SPRING = {
  type: "spring" as const,
  stiffness: springPresets.snappy.stiffness,
  damping: springPresets.snappy.damping,
  mass: springPresets.snappy.mass,
}

// ============================================================================
// Component
// ============================================================================

export function QuickLogControl({
  onPress,
  "aria-label": ariaLabel = "Log expense",
  size = 56,
}: QuickLogControlProps) {
  const prefersReducedMotion = useReducedMotion()

  const buttonStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${size}px`,
    height: `${size}px`,
    minWidth: "44px",
    minHeight: "44px",
    borderRadius: "50%",
    background: gradients.action,
    border: "none",
    cursor: "pointer",
    padding: 0,
    WebkitTapHighlightColor: "transparent",
    color: surfaceColors.canvas,
    zIndex: 1,
  }

  const glowStyle: React.CSSProperties = {
    position: "absolute",
    inset: "-6px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${colorRamp.accent[500]} 0%, transparent 70%)`,
    filter: "blur(8px)",
    pointerEvents: "none",
    zIndex: -1,
  }

  return (
    <motion.button
      type="button"
      onClick={onPress}
      aria-label={ariaLabel}
      className="focus-ring"
      style={buttonStyle}
      whileTap={{ scale: 0.92 }}
      transition={PRESS_SPRING}
    >
      {/* Glow ring */}
      <motion.div
        style={glowStyle}
        variants={GLOW_PULSE_VARIANTS}
        initial="idle"
        animate={prefersReducedMotion ? "idle" : "pulse"}
      />

      {/* Plus icon — high contrast (black on bright gradient) */}
      <Icon name="action:add" size={24} strokeWidth={2.2} />
    </motion.button>
  )
}
