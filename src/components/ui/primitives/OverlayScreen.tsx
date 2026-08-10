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
 * Accessibility (Req 18.3, 18.4):
 * - Focus trap: Tab/Shift+Tab cycles within overlay when open
 * - Escape key dismissal
 * - Focus restoration: returns focus to previously focused element on close
 *
 * Requirements: 16.1, 16.2, 16.4, 18.3, 18.4
 */

import { type ReactNode, forwardRef, useEffect, useRef } from "react"
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
    const previouslyFocusedRef = useRef<HTMLElement | null>(null)
    const overlayRef = useRef<HTMLDivElement | null>(null)

    // Store the previously focused element when opening, restore on close
    useEffect(() => {
      if (open) {
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      } else if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus()
        previouslyFocusedRef.current = null
      }
    }, [open])

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

    // Focus trap: cycle focus within overlay when Tab/Shift+Tab
    useEffect(() => {
      if (!open) return

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return

        const overlay = overlayRef.current
        if (!overlay) return

        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        const focusableElements = Array.from(
          overlay.querySelectorAll<HTMLElement>(focusableSelector)
        )

        if (focusableElements.length === 0) return

        const firstFocusable = focusableElements[0]
        const lastFocusable = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault()
            lastFocusable.focus()
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault()
            firstFocusable.focus()
          }
        }
      }

      document.addEventListener("keydown", handleTabKey)
      return () => document.removeEventListener("keydown", handleTabKey)
    }, [open])

    // Focus first focusable element on present
    useEffect(() => {
      if (!open) return

      const timer = setTimeout(() => {
        const overlay = overlayRef.current
        if (overlay) {
          const focusable = overlay.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          if (focusable) {
            focusable.focus()
          }
        }
      }, 100)

      return () => clearTimeout(timer)
    }, [open])

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
            ref={(node) => {
              overlayRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
            }}
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
