"use client"

/**
 * ProgressRing — Feedback primitive
 *
 * Circular progress indicator with size variants and animation states.
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Sizes:
 * - `sm` — 24px (inline indicators, list items)
 * - `md` — 40px (card-level progress)
 * - `lg` — 64px (section-level progress)
 * - `hero` — 120px (home surface hero ring)
 *
 * States:
 * - `idle` — static ring at current progress
 * - `animating` — spring-animated transition to target progress
 * - `complete` — filled ring with optional completion emphasis
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import { useEffect, useState } from "react"
import { motion, useReducedMotion as useFramerReducedMotion } from "framer-motion"
import { springs } from "@/lib/animations"
import { colorRamp } from "@/styles/colors"
import { FONT_FAMILY } from "@/styles/typography"

// ============================================================================
// Types
// ============================================================================

export type ProgressRingSize = "sm" | "md" | "lg" | "hero"
export type ProgressRingState = "idle" | "animating" | "complete"

export interface ProgressRingProps {
  /** Progress value from 0 to 100. */
  progress: number
  /** Ring size. */
  size?: ProgressRingSize
  /** Animation state. */
  state?: ProgressRingState
  /** Accent color for the progress track. Defaults to accent ramp. */
  color?: "accent" | "success" | "warning" | "error"
  /** Whether to show the percentage label inside. */
  showLabel?: boolean
  /** Accessible label. */
  "aria-label"?: string
}

// ============================================================================
// Size Config
// ============================================================================

interface SizeConfig {
  diameter: number
  strokeWidth: number
  fontSize: string
}

const sizeConfig: Record<ProgressRingSize, SizeConfig> = {
  sm: { diameter: 24, strokeWidth: 2.5, fontSize: "0.5rem" },
  md: { diameter: 40, strokeWidth: 3, fontSize: "0.6875rem" },
  lg: { diameter: 64, strokeWidth: 4, fontSize: "0.8125rem" },
  hero: { diameter: 120, strokeWidth: 5, fontSize: "0.9375rem" },
}

// ============================================================================
// Color Config
// ============================================================================

function getTrackColor(color: string): string {
  switch (color) {
    case "success":
      return colorRamp.success[500]
    case "warning":
      return colorRamp.warning[500]
    case "error":
      return colorRamp.error[500]
    default:
      return colorRamp.accent[500]
  }
}

function getTrailColor(): string {
  return colorRamp.accent[100]
}

// ============================================================================
// Component
// ============================================================================

export function ProgressRing({
  progress,
  size = "md",
  state = "animating",
  color = "accent",
  showLabel = false,
  "aria-label": ariaLabel,
}: ProgressRingProps) {
  const prefersReducedMotion = useFramerReducedMotion()
  const config = sizeConfig[size]
  const { diameter, strokeWidth, fontSize } = config

  // Clamp progress to [0, 100]
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const displayProgress = state === "complete" ? 100 : clampedProgress

  // Animate progress value
  const [animatedProgress, setAnimatedProgress] = useState(
    state === "idle" || prefersReducedMotion ? displayProgress : 0
  )

  useEffect(() => {
    if (state === "idle" || prefersReducedMotion) {
      setAnimatedProgress(displayProgress)
      return
    }
    // Delay slightly for entrance
    const t = setTimeout(() => setAnimatedProgress(displayProgress), 60)
    return () => clearTimeout(t)
  }, [displayProgress, state, prefersReducedMotion])

  // SVG calculations
  const svgRadius = (diameter - strokeWidth) / 2
  const circumference = svgRadius * 2 * Math.PI
  const offset = circumference - (animatedProgress / 100) * circumference

  const trackColor = getTrackColor(color)
  const trailColor = getTrailColor()

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clampedProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Progress: ${Math.round(clampedProgress)}%`}
      style={{
        position: "relative",
        width: diameter,
        height: diameter,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={diameter}
        height={diameter}
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          position: "absolute",
          inset: 0,
        }}
      >
        {/* Background trail */}
        <circle
          fill="transparent"
          stroke={trailColor}
          strokeWidth={strokeWidth}
          r={svgRadius}
          cx={diameter / 2}
          cy={diameter / 2}
        />
        {/* Progress arc */}
        <motion.circle
          fill="transparent"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={svgRadius}
          cx={diameter / 2}
          cy={diameter / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
          animate={{ strokeDashoffset: offset }}
          transition={
            state === "idle" || prefersReducedMotion
              ? { duration: 0 }
              : springs.responsive
          }
        />
      </svg>

      {/* Optional label */}
      {showLabel && (
        <span
          aria-hidden="true"
          style={{
            fontSize,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
            position: "relative",
            zIndex: 1,
          }}
        >
          {Math.round(animatedProgress)}%
        </span>
      )}

      {/* Complete state emphasis */}
      {state === "complete" && !prefersReducedMotion && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.bouncy}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${trackColor}`,
            opacity: 0.3,
          }}
        />
      )}
    </div>
  )
}
