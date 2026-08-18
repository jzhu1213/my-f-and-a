"use client"

/**
 * ChartFrame — Feedback primitive
 *
 * Container wrapper that handles loading/loaded/error states for chart content.
 * Children render the actual chart; ChartFrame provides the structural shell,
 * loading skeleton, and error recovery UI.
 *
 * Types:
 * - `line` — line chart container
 * - `bar` — bar chart container
 * - `ring` — ring/donut chart container
 *
 * States:
 * - `loading` — shows skeleton placeholder matching chart dimensions
 * - `loaded` — renders children (the actual chart)
 * - `error` — shows inline error with optional retry
 *
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import type { ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { spacingScale } from "@/styles/layout"
import { radius, elevations } from "@/styles/surfaces"
import { textColors, colorRamp } from "@/styles/colors"
import { chartEntranceMotion } from "@/styles/chartTokens"
import { Skeleton } from "./Skeleton"

// ============================================================================
// Types
// ============================================================================

export type ChartFrameType = "line" | "bar" | "ring"
export type ChartFrameState = "loading" | "loaded" | "error"

export interface ChartFrameProps {
  /** Type of chart being wrapped. Affects skeleton shape. */
  type?: ChartFrameType
  /** Current state of the chart data. */
  state?: ChartFrameState
  /** Chart content (rendered only in `loaded` state). */
  children?: ReactNode
  /** Chart height in px. Default 200. */
  height?: number
  /** Error message (shown in `error` state). */
  errorMessage?: string
  /** Retry handler for error state. */
  onRetry?: () => void
  /** Accessible label for the chart region. */
  "aria-label"?: string
  /** Links chart to an accessible text description. */
  "aria-describedby"?: string
}

// ============================================================================
// Skeleton by type
// ============================================================================

function ChartSkeleton({ type, height }: { type: ChartFrameType; height: number }) {
  if (type === "ring") {
    const ringSize = Math.min(height - 32, 120)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height,
        }}
      >
        <Skeleton variant="circle" size={ringSize} />
      </div>
    )
  }

  if (type === "bar") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacingScale["8"],
          height,
          padding: `${spacingScale["16"]} ${spacingScale["8"]}`,
        }}
      >
        {[60, 80, 45, 90, 55, 70].map((pct, i) => (
          <Skeleton
            key={i}
            variant="rect"
            width="100%"
            height={`${pct}%`}
            style={{ flex: 1 }}
          />
        ))}
      </div>
    )
  }

  // Line chart skeleton
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height,
        padding: spacingScale["16"],
      }}
    >
      <Skeleton variant="text" width="40%" height={12} />
      <Skeleton variant="rect" width="100%" height={Math.max(40, height - 80)} />
      <Skeleton variant="text" width="60%" height={10} />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function ChartFrame({
  type = "line",
  state = "loading",
  children,
  height = 200,
  errorMessage = "Chart data unavailable",
  onRetry,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: ChartFrameProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div
      role="figure"
      aria-label={ariaLabel ?? `${type} chart`}
      aria-describedby={ariaDescribedBy}
      style={{
        position: "relative",
        width: "100%",
        minHeight: height,
        borderRadius: radius.card,
        background: elevations.resting.fill,
        border: elevations.resting.border,
        boxShadow: elevations.resting.shadow,
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : timings.fast}
          >
            <ChartSkeleton type={type} height={height} />
          </motion.div>
        )}

        {state === "loaded" && (
          <motion.div
            key="loaded"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: chartEntranceMotion.duration, ease: chartEntranceMotion.ease }}
            style={{ minHeight: height }}
          >
            {children}
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : springs.gentle}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: spacingScale["12"],
              minHeight: height,
              padding: spacingScale["24"],
              textAlign: "center",
            }}
          >
            <p
              style={{
                ...typography["body-sm"],
                color: textColors.muted,
                margin: 0,
              }}
            >
              {errorMessage}
            </p>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                  borderRadius: radius.full,
                  border: `1px solid ${colorRamp.error[300]}`,
                  background: colorRamp.error[100],
                  color: colorRamp.error[500],
                  fontFamily: FONT_FAMILY,
                  fontSize: typography.caption.fontSize,
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 44,
                  minWidth: 44,
                }}
                aria-label="Retry loading chart"
              >
                Retry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
