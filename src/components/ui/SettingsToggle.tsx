"use client"

/**
 * SettingsToggle
 *
 * A reusable toggle switch component for settings screens. Encapsulates the
 * 44×26 track with animated knob, accent fill, proper a11y attributes, and
 * prefers-reduced-motion support.
 *
 * Uses the warm purple accent for the active state and the shared shadow token
 * for the knob's subtle lift.
 *
 * Phase 6 — task 267.1: extracted from 8+ repeated inline toggle patterns in
 * SettingsScreen to a single reusable component.
 */

import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { shadows, fills, colorRamp } from "@/styles/shared"
import { textColors } from "@/styles/colors"
import { opacity } from "@/styles/tokens"
import { radius } from "@/styles/surfaces"

export interface SettingsToggleProps {
  /** Whether the toggle is on/checked */
  checked: boolean
  /** Called when toggled */
  onChange: (next: boolean) => void
  /** Accessible label for screen readers */
  ariaLabel: string
  /** If true, disables the toggle */
  disabled?: boolean
}

export function SettingsToggle({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: SettingsToggleProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      whileTap={prefersReducedMotion ? undefined : { scale: disabled ? 1 : 0.95 }}
      transition={springs.snappy}
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: radius.full,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked
          ? colorRamp.accent[400]
          : fills[10],
        position: "relative",
        transition: "background 0.2s ease",
        opacity: disabled ? 0.5 : 1,
        // Extend touch target to 44×44px minimum (WCAG 2.5.5)
        padding: "9px 0",
        boxSizing: "content-box",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: radius.full,
          background: checked ? textColors.text : "var(--sub)",
          transition: "left 0.2s ease, background 0.2s ease",
          boxShadow: shadows.sm,
        }}
      />
    </motion.button>
  )
}
