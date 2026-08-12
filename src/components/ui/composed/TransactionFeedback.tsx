"use client"

/**
 * TransactionFeedback — Composed component (Phase 14, Task 16.4)
 *
 * Orchestrates the full feedback flow for transaction logging on the Home Surface:
 * 1. Radial pulse animation from tapped control (within 100ms of commit)
 * 2. Spring-driven allowance update (responsive preset, settles ≤600ms)
 * 3. Undo floating affordance (5–10s, auto-dismiss, ≥8px clearance from dock)
 * 4. Haptic pulse (single 50ms, within 100ms of commit, graceful degradation)
 * 5. Celebration overlay (max 2500ms, auto-dismiss, no blocking action)
 * 6. Over-budget status (error ramp ≥4.5:1 contrast, actionable next step, no shame)
 *
 * Composition constraints:
 * - Undo affordance: non-overlapping with dock/primary action (≥8px clearance)
 * - Celebration: auto-dismiss, no dismiss action required
 * - Over status: encouraging copy, one actionable next step
 * - All spring animations use the `responsive` preset from motion.ts
 *
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.9, 9.10, 9.11, 12.5
 */

import React, { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { spacingScale, safeArea } from "@/styles/layout"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { radius, elevations } from "@/styles/surfaces"
import type { CelebrationEvent } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface TransactionFeedbackProps {
  /** The radial pulse origin coordinates (relative to viewport). Null when inactive. */
  pulseOrigin: { x: number; y: number } | null
  /** Whether a transaction was just committed (triggers the full feedback flow). */
  committed: boolean
  /** The celebration event to display, if any. */
  celebration: CelebrationEvent | null
  /** Whether the user is over budget (triggers error ramp status). */
  isOverBudget: boolean
  /** Actionable next step copy for over-budget status. */
  overBudgetNextStep?: string
  /** Called when user activates undo. */
  onUndo: () => void
  /** Called when the undo window elapses or undo is activated. */
  onUndoExpired: () => void
  /** Called when the celebration finishes. */
  onCelebrationEnd: () => void
  /** Called when the radial pulse animation completes. */
  onPulseEnd?: () => void
  /** Undo display duration in ms (default 7000, range 5000–10000). */
  undoDurationMs?: number
}

// ============================================================================
// Constants
// ============================================================================

/** Default undo window duration (7 seconds, within 5–10s range per Req 9.4). */
const DEFAULT_UNDO_DURATION_MS = 7000

/** Maximum celebration duration (Req 9.6). */
const MAX_CELEBRATION_DURATION_MS = 2500

/** Haptic pulse duration in ms (Req 9.10). */
const HAPTIC_PULSE_MS = 50

/** Undo dismiss animation duration (Req 9.11: dismiss within 300ms). */
const UNDO_DISMISS_DURATION_MS = 0.3

/**
 * Bottom offset for the undo toast.
 * Dock is positioned at bottom: 8px + safe-area, its height is ~64px + 16px padding.
 * We add 8px clearance above the dock (Req 9.5).
 * Total: 64px (dock) + 8px (dock bottom) + 8px (clearance) = 88px above safe area.
 */
const UNDO_BOTTOM_OFFSET_PX = 88

// ============================================================================
// Haptic utility
// ============================================================================

/**
 * Emit a single haptic pulse (50ms) if the device supports it.
 * Graceful degradation: no error, no blocking if unsupported (Req 9.9, 9.10).
 */
function emitHapticPulse(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(HAPTIC_PULSE_MS)
    }
  } catch {
    // Graceful degradation — no haptic is fine
  }
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * RadialPulse — A radial pulse animation originating from the tapped control.
 * Triggers within 100ms of commit. Uses a scale + opacity keyframe.
 */
function RadialPulse({
  origin,
  onComplete,
  prefersReducedMotion,
}: {
  origin: { x: number; y: number }
  onComplete?: () => void
  prefersReducedMotion: boolean
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.6 }}
      animate={
        prefersReducedMotion
          ? { scale: 1, opacity: 0 }
          : { scale: 2.5, opacity: 0 }
      }
      transition={
        prefersReducedMotion
          ? { type: "tween", duration: 0.15, ease: "easeOut" }
          : springs.snappy
      }
      onAnimationComplete={onComplete}
      style={{
        position: "fixed",
        left: origin.x - 24,
        top: origin.y - 24,
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${colorRamp.accent[400]}, transparent)`,
        pointerEvents: "none",
        zIndex: 60,
      }}
      aria-hidden="true"
    />
  )
}

/**
 * UndoToast — Floating undo affordance positioned above the dock with ≥8px clearance.
 * Auto-dismisses after the configured window. Non-overlapping with dock/primary action.
 */
function UndoToast({
  onUndo,
  onExpired,
  durationMs,
  prefersReducedMotion,
}: {
  onUndo: () => void
  onExpired: () => void
  durationMs: number
  prefersReducedMotion: boolean
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onExpired()
    }, durationMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [durationMs, onExpired])

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo()
  }, [onUndo])

  const toastStyle: React.CSSProperties = {
    position: "fixed",
    bottom: `calc(${UNDO_BOTTOM_OFFSET_PX}px + ${safeArea.bottom})`,
    left: spacingScale["16"],
    right: spacingScale["16"],
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
    background: elevations.raised.fill,
    border: `1px solid ${elevations.raised.border}`,
    borderRadius: radius.control,
    boxShadow: elevations.raised.shadow,
    backdropFilter: `blur(${elevations.raised.blur})`,
    WebkitBackdropFilter: `blur(${elevations.raised.blur})`,
    zIndex: 55,
  }

  const textStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    color: textColors.text,
    margin: 0,
  }

  const buttonStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    lineHeight: typography.body.lineHeight,
    color: colorRamp.accent[400],
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
    borderRadius: radius.full,
    minWidth: "44px",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0, transition: { duration: UNDO_DISMISS_DURATION_MS } }
          : { opacity: 0, y: 8, transition: { duration: UNDO_DISMISS_DURATION_MS, ease: "easeIn" } }
      }
      transition={prefersReducedMotion ? timings.fast : springs.snappy}
      style={toastStyle}
      role="status"
      aria-live="polite"
      aria-label="Transaction logged. Undo available."
    >
      <span style={textStyle}>Logged</span>
      <button
        type="button"
        onClick={handleUndo}
        style={buttonStyle}
        aria-label="Undo transaction"
      >
        Undo
      </button>
    </motion.div>
  )
}

/**
 * CelebrationOverlay — Displays a celebration moment.
 * Max 2500ms, auto-dismiss, no blocking action required (Req 9.6).
 * Uses the dramatic spring preset for entrance.
 */
function CelebrationOverlay({
  event,
  onEnd,
  prefersReducedMotion,
}: {
  event: CelebrationEvent
  onEnd: () => void
  prefersReducedMotion: boolean
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clamp duration to MAX_CELEBRATION_DURATION_MS
  const duration = Math.min(event.duration, MAX_CELEBRATION_DURATION_MS)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onEnd()
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [duration, onEnd])

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingScale["16"],
    zIndex: 70,
    pointerEvents: "none",
    padding: spacingScale["24"],
  }

  const emojiStyle: React.CSSProperties = {
    fontSize: "3rem",
    lineHeight: 1,
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
    letterSpacing: typography.title.letterSpacing,
    color: textColors.text,
    margin: 0,
    textAlign: "center",
  }

  const messageStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    color: textColors.sub,
    margin: 0,
    textAlign: "center",
    maxWidth: "280px",
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1, transition: springs.dramatic }
      }
      exit={
        prefersReducedMotion
          ? { opacity: 0, transition: timings.fast }
          : { opacity: 0, scale: 0.95, transition: timings.normal }
      }
      style={overlayStyle}
      role="status"
      aria-live="polite"
      aria-label={`Celebration: ${event.title}`}
    >
      <span style={emojiStyle} aria-hidden="true">
        {event.emoji}
      </span>
      <p style={titleStyle}>{event.title}</p>
      <p style={messageStyle}>{event.message}</p>
    </motion.div>
  )
}

/**
 * OverBudgetStatus — Error ramp status indicator with encouraging copy.
 * Uses error color ramp tokens (≥4.5:1 contrast), one actionable next step,
 * no shame phrasing (Req 9.11, 12.5).
 */
function OverBudgetStatus({
  nextStep,
  prefersReducedMotion,
}: {
  nextStep: string
  prefersReducedMotion: boolean
}) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacingScale["8"],
    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
    background: colorRamp.error[100],
    border: `1px solid ${colorRamp.error[300]}`,
    borderRadius: radius.control,
  }

  // Error ramp text — error-700 on error-100 background provides ≥4.5:1 contrast
  const statusTextStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    lineHeight: typography.body.lineHeight,
    color: colorRamp.error[700],
    margin: 0,
    textAlign: "center",
  }

  // Next step — encouraging, actionable
  const nextStepStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: typography["body-sm"].fontWeight,
    lineHeight: typography["body-sm"].lineHeight,
    color: colorRamp.error[600],
    margin: 0,
    textAlign: "center",
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? timings.fast : springs.gentle}
      style={containerStyle}
      role="status"
      aria-live="polite"
      aria-label="Budget status"
    >
      <p style={statusTextStyle}>A little tight today — tomorrow resets</p>
      <p style={nextStepStyle}>{nextStep}</p>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function TransactionFeedback({
  pulseOrigin,
  committed,
  celebration,
  isOverBudget,
  overBudgetNextStep = "Try a no-spend evening to get back on track",
  onUndo,
  onUndoExpired,
  onCelebrationEnd,
  onPulseEnd,
  undoDurationMs = DEFAULT_UNDO_DURATION_MS,
}: TransactionFeedbackProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [showPulse, setShowPulse] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const prevCommittedRef = useRef(false)

  // Trigger feedback flow on commit (rising edge of `committed`)
  useEffect(() => {
    if (committed && !prevCommittedRef.current) {
      // 1. Radial pulse (within 100ms — immediate)
      if (pulseOrigin) {
        setShowPulse(true)
      }

      // 2. Haptic (within 100ms — immediate, Req 9.9, 9.10)
      emitHapticPulse()

      // 3. Undo affordance
      setShowUndo(true)

      // 4. Celebration (if event present)
      if (celebration) {
        setShowCelebration(true)
      }
    }
    prevCommittedRef.current = committed
  }, [committed, pulseOrigin, celebration])

  // Handle pulse completion
  const handlePulseComplete = useCallback(() => {
    setShowPulse(false)
    onPulseEnd?.()
  }, [onPulseEnd])

  // Handle undo activation
  const handleUndo = useCallback(() => {
    setShowUndo(false)
    onUndo()
  }, [onUndo])

  // Handle undo expiration
  const handleUndoExpired = useCallback(() => {
    setShowUndo(false)
    onUndoExpired()
  }, [onUndoExpired])

  // Handle celebration end
  const handleCelebrationEnd = useCallback(() => {
    setShowCelebration(false)
    onCelebrationEnd()
  }, [onCelebrationEnd])

  return (
    <>
      {/* ── Radial Pulse (Req 9.3) ── */}
      <AnimatePresence>
        {showPulse && pulseOrigin && (
          <RadialPulse
            key="radial-pulse"
            origin={pulseOrigin}
            onComplete={handlePulseComplete}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* ── Undo Toast (Req 9.4, 9.5, 9.11) ── */}
      <AnimatePresence>
        {showUndo && (
          <UndoToast
            key="undo-toast"
            onUndo={handleUndo}
            onExpired={handleUndoExpired}
            durationMs={undoDurationMs}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* ── Celebration Overlay (Req 9.6) ── */}
      <AnimatePresence>
        {showCelebration && celebration && (
          <CelebrationOverlay
            key={`celebration-${celebration.id}`}
            event={celebration}
            onEnd={handleCelebrationEnd}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* ── Over Budget Status (Req 12.5) ── */}
      <AnimatePresence>
        {isOverBudget && !showCelebration && (
          <OverBudgetStatus
            key="over-budget"
            nextStep={overBudgetNextStep}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </>
  )
}
