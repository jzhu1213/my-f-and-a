"use client"

import { useEffect, useCallback, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings, useReducedMotion } from "@/lib/animations"

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
 * Standardized sheet spring: stiffness 400, damping 30 — the snappy feel
 * from ExpenseSheet/IncomeSheet. ~150ms settle time for "quick in, quick out."
 */
const SHEET_SPRING = { type: "spring" as const, stiffness: 400, damping: 30 }

const sheetVariantsFull = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: SHEET_SPRING },
  exit: { y: "100%", transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const } },
}

const sheetVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
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

  // ── Escape key handler ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventClose) {
        onClose()
      }
    },
    [onClose, preventClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

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
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
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
