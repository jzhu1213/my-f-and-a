"use client"

/**
 * OverlayScreen — Full-screen overlay primitive for modal-like surfaces.
 *
 * States: entering, entered, exiting.
 *
 * Used for full-screen overlays that sit above the primary navigation
 * (celebration overlays, full-screen modals, etc.).
 *
 * Uses framer-motion AnimatePresence for enter/exit lifecycle.
 * Transition: gentle spring (opacity + translateY).
 *
 * Visual tokens from Design_Token_System:
 * - Canvas tier fill (--color-canvas) for full-screen background
 * - Z-index: overlay layer (--z-overlay)
 *
 * Requirements: 16.1, 16.2, 16.4
 */

import { type ReactNode, forwardRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { elevations } from "@/styles/surfaces"
import { zIndex } from "@/styles/tokens"
import { safeArea } from "@/styles/layout"
import { springs, timings } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export interface OverlayScreenProps {
  /** Whether the overlay is open (controls AnimatePresence). */
  open: boolean
  /** Called when the overlay should close (escape key, close button). */
  onClose?: () => void
  /** Overlay content. */
  children?: ReactNode
  /** Whether to respect reduced motion preferences. */
  reducedMotion?: boolean
  /** Accessible label for the overlay. */
  "aria-label"?: string
}

// ============================================================================
// Component
// ============================================================================

/**
 * A full-screen overlay that covers the entire viewport.
 *
 * - Managed via `open` prop (controlled component)
 * - Escape key dismisses
 * - Gentle spring entrance (fade + slide up)
 * - Snappy exit (fade + slide down)
 * - AnimatePresence handles enter/exit lifecycle
 */
export const OverlayScreen = forwardRef<HTMLDivElement, OverlayScreenProps>(
  function OverlayScreen(
    { open, onClose, children, reducedMotion = false, "aria-label": ariaLabel },
    ref
  ) {
    const tier = elevations.canvas

    // Escape key handler
    useEffect(() => {
      if (!open) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault()
          onClose?.()
        }
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [open, onClose])

    const overlayStyle: React.CSSProperties = {
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

    // Motion config based on reduced-motion preference
    const enterTransition = reducedMotion
      ? timings.fast
      : springs.gentle

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            key="overlay-screen"
            style={overlayStyle}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={enterTransition}
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
