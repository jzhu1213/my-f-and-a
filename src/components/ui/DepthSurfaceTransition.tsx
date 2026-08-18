"use client"

/**
 * DepthSurfaceTransition — Wrapper that applies the correct entry transition
 * for a depth surface (full-screen overlay opened from Tools or other sources).
 *
 * Two entry modes:
 * 1. **Shared-element continuity** — When the depth surface is opened from a
 *    visible Tools row (the user taps a row), supply a `layoutId`. The transition
 *    uses `sharedElementConfig.spring` and completes within 400ms.
 *
 * 2. **Standard surface entrance** — When the depth surface is opened without a
 *    visible origin (deep link, back nav, programmatic navigation, scrolled-out
 *    origin), omit `layoutId`. The transition uses a gentle opacity + translateY
 *    completing within 400ms.
 *
 * Both modes respect `prefers-reduced-motion` via reduced variants.
 *
 * Requirements: 15.6, 15.7
 */

import { type ReactNode, forwardRef, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import {
  sharedElementVariants,
  sharedElementVariantsReduced,
  childEntryVariants,
  childEntryVariantsReduced,
  sharedElementConfig,
} from "@/lib/transitions"
import { elevations } from "@/styles/surfaces"
import { zIndex } from "@/styles/tokens"
import { safeArea } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface DepthSurfaceTransitionProps {
  /** Whether the depth surface is visible. Controls AnimatePresence. */
  open: boolean
  /**
   * Optional layoutId for shared-element continuity.
   * When present, the origin Tools row and this surface share the same
   * layoutId, enabling framer-motion's automatic layout animation.
   * When absent, uses standard surface entrance (opacity + translateY).
   */
  layoutId?: string
  /** Content of the depth surface. */
  children?: ReactNode
  /** Accessible label for the depth surface. */
  "aria-label"?: string
  /** Called when the surface should dismiss (e.g. Escape key). */
  onClose?: () => void
}

// ============================================================================
// Component
// ============================================================================

export const DepthSurfaceTransition = forwardRef<HTMLDivElement, DepthSurfaceTransitionProps>(
  function DepthSurfaceTransition(
    { open, layoutId, children, "aria-label": ariaLabel, onClose },
    ref
  ) {
    const { prefersReducedMotion } = useReducedMotion()
    const tier = elevations.canvas
    const previouslyFocusedRef = useRef<HTMLElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Focus restoration: store previously focused element on open, restore on close
    useEffect(() => {
      if (open) {
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      } else if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus()
        previouslyFocusedRef.current = null
      }
    }, [open])

    // Escape key dismissal
    useEffect(() => {
      if (!open || !onClose) return
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault()
          onClose()
        }
      }
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [open, onClose])

    // Focus trap: cycle Tab/Shift+Tab within the surface
    useEffect(() => {
      if (!open) return
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return
        const container = containerRef.current
        if (!container) return
        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(focusableSelector)
        )
        if (focusableElements.length === 0) return
        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
      document.addEventListener("keydown", handleTabKey)
      return () => document.removeEventListener("keydown", handleTabKey)
    }, [open])

    // Focus first interactive element on open (Req 27.1 — 450.3)
    useEffect(() => {
      if (!open) return

      const timer = setTimeout(() => {
        const container = containerRef.current
        if (container) {
          const focusable = container.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          if (focusable) {
            focusable.focus()
          }
        }
      }, 100)

      return () => clearTimeout(timer)
    }, [open])

    const containerStyle: React.CSSProperties = {
      position: "fixed",
      inset: 0,
      background: tier.fill,
      zIndex: zIndex.overlay,
      display: "flex",
      flexDirection: "column",
      overflow: "auto",
      paddingTop: safeArea.top,
      paddingBottom: safeArea.bottom,
    }

    // Pick variants based on whether we have a layoutId (shared-element) or not
    const hasSharedOrigin = !!layoutId
    const variants = hasSharedOrigin
      ? (prefersReducedMotion ? sharedElementVariantsReduced : sharedElementVariants)
      : (prefersReducedMotion ? childEntryVariantsReduced : childEntryVariants)

    // Transition config: shared-element uses spring, standard uses gentle spring
    const transition = hasSharedOrigin
      ? sharedElementConfig.spring
      : (prefersReducedMotion
          ? { type: "tween" as const, duration: 0.15 }
          : { type: "spring" as const, stiffness: 200, damping: 24, mass: 1.0 }
        )

    return (
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            ref={(node) => {
              containerRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) ref.current = node
            }}
            key="depth-surface"
            layoutId={layoutId}
            style={containerStyle}
            variants={variants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={transition}
            role="dialog"
            aria-modal
            aria-label={ariaLabel}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }
)
