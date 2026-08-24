"use client"

/**
 * AllowanceHero — Composed component (Phase 14 rebuild, Task 16.2)
 *
 * The daily-allowance amount at display tier (72–80px fluid) is the SINGLE
 * dominant element in the first viewport. No other text exceeds 50% of the
 * display font size within this component.
 *
 * Features (Task 16.2):
 * - Spring-driven digit interpolation on allowance change (responsive preset,
 *   settles within 600ms). Width held constant during animation.
 * - Hero activation reveals calculation breakdown via shared-element continuity
 *   (within 320ms). Shows daily budget, applied rollover, spent today.
 * - Restore hero within 320ms on dismiss.
 * - Error handling: if breakdown unavailable, keep hero visible with last
 *   amount + message.
 *
 * Composition structure:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  [display-tier amount — gradient text, dominant, animated]   │
 * │       gap: --space-24                                        │
 * │  ┌───────────────────────────────────────────────────────┐   │
 * │  │  Progress ring + status message + ambient glow        │   │
 * │  │  (composed group, shared vertical axis ±2px)          │   │
 * │  │  Internal gap: --space-12                             │   │
 * │  └───────────────────────────────────────────────────────┘   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Requirements: 12.1, 12.2, 12.3, 12.6, 12.9, 12.11, 16.1
 */

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion"
import { ProgressRing } from "@/components/ui/primitives/ProgressRing"
import { AmbientGlow } from "@/components/ui/AmbientGlow"
import type { AmbientGlowStatus } from "@/components/ui/AmbientGlow"
import { typography, FONT_FAMILY, TABULAR_NUMS, DISPLAY_GRADIENT_CLASS, fontWeights } from '@/styles/typography'
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"
import { springPresets } from "@/styles/motion"
import { sharedElementConfig } from "@/lib/transitions"
import { useReducedMotion } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export interface AllowanceHeroProps {
  /** The daily allowance amount (number). */
  amount: number
  /** Progress percentage (0–100) for the ring. */
  progress: number
  /** Status message text displayed below the ring. */
  statusMessage: string
  /** Progress ring color variant. */
  ringColor?: "accent" | "success" | "warning" | "error"
  /** Ambient glow status (drives glow color). */
  glowStatus?: AmbientGlowStatus
  /** Whether data is still loading (shows skeleton-like state). */
  loading?: boolean
  /** Daily budget before rollover/spending (for breakdown). */
  dailyBudget?: number | null
  /** Applied rollover from previous days (for breakdown). */
  rollover?: number | null
  /** Amount spent today (for breakdown). */
  spentToday?: number | null
  /** Whether breakdown data is available. */
  breakdownAvailable?: boolean
  /** Error message to show if breakdown is unavailable. */
  breakdownError?: string | null
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Responsive spring preset for value-change animation.
 * Stiffness 600, Damping 35, Mass 0.8 — settles within ~600ms.
 */
const VALUE_CHANGE_SPRING = {
  stiffness: springPresets.responsive.stiffness,
  damping: springPresets.responsive.damping,
  mass: springPresets.responsive.mass,
}

/**
 * Shared-element continuity transition for breakdown reveal/dismiss.
 * Completes within 320ms as specified.
 */
const BREAKDOWN_TRANSITION = {
  type: "spring" as const,
  stiffness: sharedElementConfig.spring.stiffness ?? 600,
  damping: sharedElementConfig.spring.damping ?? 35,
  mass: sharedElementConfig.spring.mass ?? 0.8,
}

/**
 * Tween transition for breakdown panel opacity (fast settle).
 */
const BREAKDOWN_OPACITY_TRANSITION = {
  type: "tween" as const,
  duration: 0.2,
  ease: "easeOut" as const,
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a number as a currency string ($ with 2 decimal places).
 */
function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format a number with sign prefix for breakdown display.
 */
function formatBreakdownAmount(amount: number, prefix: "+" | "−" | ""): string {
  const abs = Math.abs(amount)
  const formatted = `$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  return `${prefix}${formatted}`
}

/**
 * Map ring color prop to AmbientGlow status when not explicitly provided.
 */
function ringColorToGlowStatus(
  ringColor: "accent" | "success" | "warning" | "error"
): AmbientGlowStatus {
  switch (ringColor) {
    case "success":
      return "healthy"
    case "warning":
      return "caution"
    case "error":
      return "warning"
    default:
      return "neutral"
  }
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * AnimatedAmount — Spring-driven digit interpolation using the responsive
 * preset. Width is held constant during animation to prevent adjacent shifts.
 *
 * Uses framer-motion's useMotionValue + useSpring to interpolate between
 * values. The displayed number ticks through intermediate values as the
 * spring settles.
 */
function AnimatedAmount({
  value,
  prefersReducedMotion,
  onClick,
}: {
  value: number
  prefersReducedMotion: boolean
  onClick?: () => void
}) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, VALUE_CHANGE_SPRING)
  const [display, setDisplay] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const [frozenWidth, setFrozenWidth] = useState<number | undefined>(undefined)

  // Subscribe to spring changes to update displayed value
  useEffect(() => {
    if (prefersReducedMotion) return
    const unsubscribe = spring.on("change", (v: number) => setDisplay(v))
    return () => unsubscribe()
  }, [spring, prefersReducedMotion])

  // Drive the spring toward the new target value
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }
    // Freeze width before animation starts to prevent layout shifts
    if (containerRef.current) {
      setFrozenWidth(containerRef.current.offsetWidth)
    }
    motionValue.set(value)

    // Release frozen width after spring settles (~600ms)
    const timer = setTimeout(() => {
      setFrozenWidth(undefined)
    }, 650)
    return () => clearTimeout(timer)
  }, [value, prefersReducedMotion, motionValue])

  const shown = prefersReducedMotion ? value : display

  // Display-tier amount style (72–80px fluid via clamp)
  const amountStyle: React.CSSProperties = {
    ...typography.display,
    ...TABULAR_NUMS,
    fontVariantNumeric: "tabular-nums",
    margin: 0,
    padding: 0,
    position: "relative",
    zIndex: 1,
    cursor: onClick ? "pointer" : undefined,
    // Hold width constant during animation
    ...(frozenWidth != null ? { width: `${frozenWidth}px` } : {}),
    display: "inline-block",
    textAlign: "center",
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        // Hold the container width constant during animation
        minWidth: frozenWidth != null ? `${frozenWidth}px` : undefined,
      }}
    >
      <p
        className={`${DISPLAY_GRADIENT_CLASS}${onClick ? ' focus-ring' : ''}`}
        style={amountStyle}
        aria-live="polite"
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
        aria-label={onClick ? `Daily allowance ${formatAmount(value)}, tap for breakdown` : undefined}
      >
        {formatAmount(shown)}
      </p>
    </div>
  )
}

/**
 * CalculationBreakdown — Reveals the math behind the hero amount.
 * Shows daily budget, applied rollover, and spent today.
 * Enters via shared-element continuity within 320ms.
 */
function CalculationBreakdown({
  dailyBudget,
  rollover,
  spentToday,
  totalAmount,
  onDismiss,
  error,
}: {
  dailyBudget: number
  rollover: number
  spentToday: number
  totalAmount: number
  onDismiss: () => void
  error?: string | null
}) {
  // Breakdown row styles
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${spacingScale["8"]} 0`,
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: typography["body-sm"].fontWeight,
    lineHeight: typography["body-sm"].lineHeight,
    letterSpacing: typography["body-sm"].letterSpacing,
    color: textColors.sub,
    margin: 0,
  }

  const valueStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography["body"].fontSize,
    fontWeight: fontWeights.semibold,
    lineHeight: typography["body"].lineHeight,
    ...TABULAR_NUMS,
    fontVariantNumeric: "tabular-nums",
    color: textColors.text,
    margin: 0,
  }

  const dividerStyle: React.CSSProperties = {
    height: "1px",
    background: "var(--border-resting)",
    margin: `${spacingScale["8"]} 0`,
    opacity: 0.5,
  }

  const totalRowStyle: React.CSSProperties = {
    ...rowStyle,
    paddingTop: spacingScale["12"],
  }

  const totalValueStyle: React.CSSProperties = {
    ...valueStyle,
    fontSize: typography["subhead"].fontSize,
    fontWeight: fontWeights.bold,
  }

  if (error) {
    return (
      <div
        style={{
          padding: `${spacingScale["16"]} ${spacingScale["20"]}`,
          textAlign: "center",
        }}
      >
        <p style={{ ...labelStyle, color: textColors.muted }}>
          {error}
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: `${spacingScale["16"]} ${spacingScale["20"]}`,
        width: "100%",
        maxWidth: "280px",
      }}
      role="region"
      aria-label="Allowance calculation breakdown"
      className="focus-ring"
      onClick={onDismiss}
      onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); onDismiss() } }}
      tabIndex={0}
    >
      {/* Daily Budget */}
      <div style={rowStyle}>
        <span style={labelStyle}>Daily budget</span>
        <span style={valueStyle}>{formatBreakdownAmount(dailyBudget, "")}</span>
      </div>

      {/* Applied Rollover */}
      <div style={rowStyle}>
        <span style={labelStyle}>Rollover</span>
        <span style={{
          ...valueStyle,
          color: rollover >= 0 ? "var(--color-success-500)" : "var(--color-warning-500)",
        }}>
          {formatBreakdownAmount(rollover, rollover >= 0 ? "+" : "−")}
        </span>
      </div>

      {/* Spent Today */}
      <div style={rowStyle}>
        <span style={labelStyle}>Spent today</span>
        <span style={{
          ...valueStyle,
          color: spentToday > 0 ? "var(--color-error-500)" : textColors.text,
        }}>
          {spentToday > 0 ? formatBreakdownAmount(spentToday, "−") : formatBreakdownAmount(0, "")}
        </span>
      </div>

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Total */}
      <div style={totalRowStyle}>
        <span style={{ ...labelStyle, fontWeight: fontWeights.semibold }}>You can spend</span>
        <span style={totalValueStyle}>{formatAmount(totalAmount)}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function AllowanceHero({
  amount,
  progress,
  statusMessage,
  ringColor = "accent",
  glowStatus,
  loading = false,
  dailyBudget,
  rollover,
  spentToday,
  breakdownAvailable = true,
  breakdownError,
}: AllowanceHeroProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Resolve glow status from explicit prop or ring color fallback
  const resolvedGlowStatus = glowStatus ?? ringColorToGlowStatus(ringColor)

  // Determine if we can show the breakdown (all values present)
  const canShowBreakdown = breakdownAvailable &&
    dailyBudget != null &&
    rollover != null &&
    spentToday != null

  const handleHeroActivation = useCallback(() => {
    if (canShowBreakdown || breakdownError) {
      setShowBreakdown(true)
    }
  }, [canShowBreakdown, breakdownError])

  const handleDismiss = useCallback(() => {
    setShowBreakdown(false)
  }, [])

  // ── Container: vertical flex, centered, uses spacing tokens only ──
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacingScale["24"],
    textAlign: "center",
    padding: `${spacingScale["32"]} 0`,
    position: "relative",
  }

  // ── Feedback group: ring + status on shared vertical axis ──
  const feedbackGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacingScale["12"],
    position: "relative",
    zIndex: 1,
  }

  // ── Status message (body-sm tier = 13px, well under 50% of display) ──
  const statusStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: typography["body-sm"].fontWeight,
    lineHeight: typography["body-sm"].lineHeight,
    letterSpacing: typography["body-sm"].letterSpacing,
    color: textColors.sub,
    margin: 0,
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={containerStyle} aria-busy="true" aria-label="Loading allowance">
        <div
          style={{
            width: "220px",
            height: "80px",
            borderRadius: "var(--radius-control)",
            background: "var(--color-surface)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacingScale["12"],
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "var(--color-surface)",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              width: "140px",
              height: "16px",
              borderRadius: "var(--radius-min)",
              background: "var(--color-surface)",
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle} role="region" aria-label="Daily allowance">
      {/* ─── Animated amount with breakdown toggle ─── */}
      <AnimatedAmount
        value={amount}
        prefersReducedMotion={prefersReducedMotion}
        onClick={(canShowBreakdown || breakdownError) ? handleHeroActivation : undefined}
      />

      {/* ─── Calculation breakdown panel (shared-element continuity) ─── */}
      <AnimatePresence mode="wait">
        {showBreakdown && (
          <motion.div
            key="breakdown"
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: prefersReducedMotion
                ? { type: "tween", duration: 0.15 }
                : BREAKDOWN_TRANSITION,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: -4,
              transition: prefersReducedMotion
                ? { type: "tween", duration: 0.1 }
                : { ...BREAKDOWN_TRANSITION, stiffness: 700, damping: 40 },
            }}
            style={{
              background: "var(--color-raised)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--border-raised)",
              boxShadow: "var(--shadow-md)",
              overflow: "hidden",
            }}
          >
            <CalculationBreakdown
              dailyBudget={dailyBudget ?? 0}
              rollover={rollover ?? 0}
              spentToday={spentToday ?? 0}
              totalAmount={amount}
              onDismiss={handleDismiss}
              error={!canShowBreakdown ? (breakdownError ?? "Breakdown unavailable") : null}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Feedback group: ring + status + ambient glow ─── */}
      <div style={feedbackGroupStyle}>
        <AmbientGlow
          status={resolvedGlowStatus}
          size="md"
          intensity="subtle"
          position="center"
        />

        <ProgressRing
          progress={progress}
          size="hero"
          state="animating"
          color={ringColor}
          aria-label={`Budget progress: ${Math.round(progress)}%`}
        />

        <p style={statusStyle}>{statusMessage}</p>
      </div>
    </div>
  )
}
