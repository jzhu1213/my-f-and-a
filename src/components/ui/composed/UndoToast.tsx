"use client"

/**
 * UndoToast — Transient undo affordance for deleted transactions.
 *
 * Appears after a swipe-to-delete action and auto-dismisses after a configurable
 * duration (default 5 seconds, Req 14.11). Restores the entry with its original
 * values when activated.
 *
 * Positioned so it does not overlap the bottom dock or primary action (Req 9.5).
 * Uses AnimatePresence for smooth enter/exit transitions.
 *
 * Requirements: 14.11, 9.4, 9.5
 */

import React, { useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { typography, FONT_FAMILY, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { shadows } from "@/styles/shared"
import { springs, timings, useReducedMotion } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export interface UndoToastProps {
  /** Whether the toast is visible. */
  visible: boolean
  /** Message to display (e.g., "Transaction deleted"). */
  message?: string
  /** Duration in ms before auto-dismiss (≥5000ms per Req 14.11). */
  duration?: number
  /** Called when user activates undo. */
  onUndo: () => void
  /** Called when the toast auto-dismisses or is dismissed. */
  onDismiss: () => void
}

// ============================================================================
// Component
// ============================================================================

export function UndoToast({
  visible,
  message = "Transaction deleted",
  duration = 6000,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef<number>(duration)
  const startedAtRef = useRef<number>(Date.now())

  // Auto-dismiss after duration
  useEffect(() => {
    if (!visible) return

    remainingRef.current = duration
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onDismiss()
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, duration, onDismiss])

  /** Pause timer on hover/focus — motor accessibility (Req 27.3) */
  const handlePause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }, [])

  /** Resume timer on mouse leave/blur */
  const handleResume = useCallback(() => {
    if (remainingRef.current <= 0) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onDismiss()
    }, remainingRef.current)
  }, [onDismiss])

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo()
  }, [onUndo])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, transition: springs.sheet }}
          exit={prefersReducedMotion ? { opacity: 0, transition: timings.fast } : { opacity: 0, y: 10, scale: 0.98, transition: { type: "tween", duration: 0.15 } }}
          // Pause auto-dismiss on hover/focus for motor accessibility (Req 27.3)
          onMouseEnter={handlePause}
          onMouseLeave={handleResume}
          onFocus={handlePause}
          onBlur={handleResume}
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: spacingScale["12"],
            padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
            background: elevations.raised.fill,
            border: elevations.raised.border,
            borderRadius: radius.control,
            boxShadow: shadows.xl,
            backdropFilter: `blur(${elevations.raised.blur})`,
            maxWidth: "calc(100vw - 40px)",
          }}
          role="alert"
          aria-live="assertive"
        >
          <span
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: typography["body-sm"].fontSize,
              fontWeight: typography["body-sm"].fontWeight,
              lineHeight: typography["body-sm"].lineHeight,
              color: textColors.text,
              whiteSpace: "nowrap",
            }}
          >
            {message}
          </span>

          <button
            type="button"
            onClick={handleUndo}
            aria-label="Undo delete"
            className="focus-ring"
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: typography["body-sm"].fontSize,
              fontWeight: fontWeights.semibold,
              lineHeight: typography["body-sm"].lineHeight,
              color: colorRamp.accent[400],
              background: "transparent",
              border: "none",
              padding: `${spacingScale["4"]} ${spacingScale["8"]}`,
              cursor: "pointer",
              borderRadius: radius.min,
              whiteSpace: "nowrap",
            }}
          >
            Undo
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
