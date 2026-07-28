"use client"

import { useEffect, useCallback, useRef, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"

// ============================================================================
// Types
// ============================================================================

export interface BottomSheetProps {
  /** Whether the sheet is visible. Drives enter/exit animation. */
  isOpen: boolean
  /** Close the sheet (backdrop tap, Escape key, close button). */
  onClose: () => void
  /** Sheet content. */
  children: ReactNode
  /** Maximum height of the sheet container. Default: '90vh'. */
  maxHeight?: string
  /** Minimum height of the sheet container (optional). */
  minHeight?: string
  /** Additional className on the sheet container (optional). */
  className?: string
  /** Accessible label for the dialog. */
  ariaLabel?: string
  /**
   * When true, the backdrop click is disabled (useful during async submission).
   * Default: false.
   */
  preventClose?: boolean
}

// ============================================================================
// Animation variants
// ============================================================================

/**
 * Standardized sheet spring matching animations.ts snappy preset (task 3.5).
 * ~150ms settle time for "quick in, quick out" sheet interactions.
 */
const SHEET_SPRING = springs.snappy

const sheetVariantsFull = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: SHEET_SPRING },
  exit: { y: "100%", transition: timings.normal },
}

const sheetVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

// ============================================================================
// BottomSheet
// ============================================================================

/**
 * BottomSheet — shared chrome wrapper for all bottom-sheet UIs in Folio.
 *
 * Encapsulates:
 * - Fixed backdrop with tap-to-close
 * - Animated sheet container (slide-up spring or opacity cross-fade)
 * - Drag handle (`.sheet-handle`)
 * - GPU compositing hints (`willChange`, `translate3d`)
 * - Safe-area-inset-bottom padding for notched devices
 * - Escape key dismissal
 * - `role="dialog"` + `aria-modal="true"` for accessibility
 * - `prefers-reduced-motion` awareness
 *
 * Each consumer sheet just wraps its content:
 * ```tsx
 * <BottomSheet isOpen={isOpen} onClose={onClose} ariaLabel="Log expense">
 *   {/* sheet content *\/}
 * </BottomSheet>
 * ```
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  maxHeight = "90vh",
  minHeight,
  className,
  ariaLabel,
  preventClose = false,
}: BottomSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // ── Focus trap: query focusable elements within the sheet ───────────────
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!sheetRef.current) return []
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')
    return Array.from(sheetRef.current.querySelectorAll<HTMLElement>(selector))
  }, [])

  // ── Keyboard handler: Escape + Tab/Shift+Tab focus trap ─────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventClose) {
        onClose()
        return
      }

      if (e.key === "Tab") {
        const focusable = getFocusableElements()
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          // Shift+Tab: wrap from first to last
          if (document.activeElement === first || !sheetRef.current?.contains(document.activeElement)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          // Tab: wrap from last to first
          if (document.activeElement === last || !sheetRef.current?.contains(document.activeElement)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [onClose, preventClose, getFocusableElements]
  )

  // ── Manage focus on open/close ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before the sheet opened
      previousFocusRef.current = document.activeElement as HTMLElement | null

      document.addEventListener("keydown", handleKeyDown)

      // Move focus to the first focusable element inside the sheet
      // Use a short delay to allow the animation to start and DOM to settle
      const timer = setTimeout(() => {
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
          focusable[0].focus()
        } else {
          // If no focusable children, focus the sheet container itself
          sheetRef.current?.focus()
        }
      }, 50)

      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        clearTimeout(timer)
      }
    } else {
      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [isOpen, handleKeyDown, getFocusableElements])

  const sheetVars = prefersReducedMotion ? sheetVariantsReduced : sheetVariantsFull

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bottom-sheet-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={preventClose ? undefined : onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0, 0, 0, 0.6)",
            }}
          />

          {/* Sheet container */}
          <motion.div
            key="bottom-sheet-panel"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            variants={sheetVars}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={className}
            style={{
              position: "fixed",
              insetInline: 0,
              bottom: 0,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              maxHeight,
              minHeight,
              overflowY: "auto",
              willChange: "transform",
              transform: "translate3d(0, 0, 0)",
              paddingBottom: "max(32px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Drag handle */}
            <div className="sheet-handle" />

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
