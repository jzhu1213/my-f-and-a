"use client"

/**
 * Sheet — Bottom sheet primitive with half and full sizes.
 *
 * States: presenting (entering), presented (resting), dismissing (exiting).
 *
 * Uses the sheet spring preset (stiffness 380, damping 36, mass 1.0) for
 * present/dismiss transitions. Framer-motion AnimatePresence handles mount/unmount.
 *
 * Visual tokens from Design_Token_System:
 * - Overlay elevation tier: --color-overlay fill, --border-accent (1px --fill-12), --shadow-xl, 32px blur
 * - Corner radius: --radius-sheet (28px) on top corners
 * - Backdrop: semi-transparent overlay with blur
 *
 * Accessibility (Req 18.3, 18.4):
 * - Focus trap: Tab/Shift+Tab cycles within sheet when open
 * - Escape key dismissal
 * - Focus restoration: returns focus to previously focused element on close
 * - Visible focus indicators via focus-ring class
 *
 * Requirements: 16.1, 16.2, 16.4, 4.2, 18.3, 18.4
 */

import {
  type ReactNode,
  forwardRef,
  useEffect,
  useCallback,
  useRef,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { safeArea } from "@/styles/layout"
import { zIndex } from "@/styles/tokens"
import { springs, sheetPresentVariants, sheetPresentVariantsReduced } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export type SheetSize = "half" | "full"

export interface SheetProps {
  /** Whether the sheet is open (controls AnimatePresence). */
  open: boolean
  /** Sheet size: half covers ~50% of viewport, full covers ~95%. */
  size?: SheetSize
  /** Called when the sheet should close (backdrop tap, pull-dismiss, escape). */
  onClose?: () => void
  /** Sheet content. */
  children?: ReactNode
  /** Whether to respect reduced motion preferences. */
  reducedMotion?: boolean
  /** Accessible label for the sheet. */
  "aria-label"?: string
}

// ============================================================================
// Constants
// ============================================================================

const SHEET_HEIGHTS: Record<SheetSize, string> = {
  half: "50vh",
  full: "calc(95vh - env(safe-area-inset-top))",
}

// ============================================================================
// Component
// ============================================================================

/**
 * A bottom sheet that slides up from the bottom of the viewport.
 *
 * - Managed via `open` prop (controlled component)
 * - Backdrop click/tap dismisses
 * - Escape key dismisses
 * - Focus trapped within when presented
 * - Uses sheet spring preset for present/dismiss motion
 * - AnimatePresence handles enter/exit lifecycle
 */
export const Sheet = forwardRef<HTMLDivElement, SheetProps>(function Sheet(
  {
    open,
    size = "half",
    onClose,
    children,
    reducedMotion = false,
    "aria-label": ariaLabel,
  },
  ref
) {
  const tier = elevations.overlay
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const sheetContentRef = useRef<HTMLDivElement | null>(null)

  // Store the previously focused element when opening, restore on close
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    } else if (previouslyFocusedRef.current) {
      // Restore focus on close
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

  // Focus trap: cycle focus within sheet when Tab/Shift+Tab
  useEffect(() => {
    if (!open) return

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      const sheet = sheetContentRef.current
      if (!sheet) return

      const focusableSelector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      const focusableElements = Array.from(
        sheet.querySelectorAll<HTMLElement>(focusableSelector)
      )

      if (focusableElements.length === 0) return

      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: if at first element, wrap to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable.focus()
        }
      } else {
        // Tab: if at last element, wrap to first
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
      const sheet = sheetContentRef.current
      if (sheet) {
        const focusable = sheet.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable) {
          focusable.focus()
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [open])

  const handleBackdropClick = useCallback(() => {
    onClose?.()
  }, [onClose])

  const variants = reducedMotion ? sheetPresentVariantsReduced : sheetPresentVariants

  const sheetStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SHEET_HEIGHTS[size],
    background: tier.fill,
    border: tier.border,
    borderBottom: "none",
    boxShadow: tier.shadow,
    backdropFilter: `blur(${tier.blur})`,
    WebkitBackdropFilter: `blur(${tier.blur})`,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    zIndex: zIndex.sheet,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    paddingBottom: safeArea.bottom,
  }

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    zIndex: zIndex.sheet,
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            style={backdropStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            aria-hidden
          />

          {/* Sheet panel */}
          <motion.div
            ref={(node) => {
              sheetContentRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
            }}
            key="sheet-panel"
            style={sheetStyle}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal
            aria-label={ariaLabel}
            data-sheet-content
          >
            {/* Drag handle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: `${spacingScale["12"]} 0 ${spacingScale["8"]}`,
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "4px",
                  borderRadius: "2px",
                  background: "var(--fill-15)",
                }}
                aria-hidden
              />
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: `0 ${spacingScale["20"]} ${spacingScale["24"]}`,
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
