"use client"

import { useEffect, useCallback, useRef, type ReactNode } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { timings, sheetSpring, useReducedMotion } from "@/lib/animations"
import { sheetPresentationConfig } from "@/lib/transitions"

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
  /**
   * When true, animates the sheet in from the FAB origin (center-bottom scale)
   * rather than sliding up from the bottom edge. Creates the illusion of the
   * FAB expanding into the sheet. Default: false.
   */
  originFromFab?: boolean
}

// ============================================================================
// Animation variants
// ============================================================================

/**
 * Polished sheet spring — slightly under-damped for native-feeling liveliness
 * without visible overshoot. Uses the shared `sheetSpring` from animations.ts.
 */

/** Drag-to-dismiss thresholds */
const DRAG_DISMISS_DISTANCE = 100 // px
const DRAG_DISMISS_VELOCITY = 500 // px/s

const sheetVariantsFull = {
  hidden: { y: "100%" },
  visible: { y: "0%", transition: sheetSpring },
  exit: { y: "100%", transition: { type: "tween" as const, duration: 0.25, ease: "easeIn" as const } },
}

/**
 * Origin-scale variants: the sheet scales up from the FAB position (center-bottom)
 * giving the illusion of the FAB morphing into the full sheet. GPU-composited
 * (scale + opacity + translateY only).
 */
const sheetVariantsFabOrigin = {
  hidden: { opacity: 0, scale: 0.3, y: "40%" },
  visible: {
    opacity: 1,
    scale: 1,
    y: "0%",
    transition: sheetSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.4,
    y: "30%",
    transition: { type: "tween" as const, duration: 0.2, ease: "easeIn" as const },
  },
}

const sheetVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

const backdropVariants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  visible: {
    opacity: sheetPresentationConfig.backdropDimOpacity,
    backdropFilter: `blur(${sheetPresentationConfig.backdropBlur})`,
    transition: sheetPresentationConfig.backdropTransition,
  },
  exit: { opacity: 0, backdropFilter: "blur(0px)", transition: { type: "tween" as const, duration: 0.2, ease: "easeIn" as const } },
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
  originFromFab = false,
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

      // Move focus to the sheet container itself rather than the first
      // interactive element. Focusing an <input> would trigger the iOS virtual
      // keyboard, pushing the fixed-position sheet up. The container has
      // tabIndex={-1} so focus moves there without activating a keyboard.
      const timer = setTimeout(() => {
        sheetRef.current?.focus()
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

  const sheetVars = prefersReducedMotion
    ? sheetVariantsReduced
    : originFromFab
      ? sheetVariantsFabOrigin
      : sheetVariantsFull

  // ── Drag-to-dismiss handler ─────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (preventClose || prefersReducedMotion) return
      const { offset, velocity } = info
      if (offset.y > DRAG_DISMISS_DISTANCE || velocity.y > DRAG_DISMISS_VELOCITY) {
        onClose()
      }
    },
    [onClose, preventClose, prefersReducedMotion]
  )

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
              background: "rgba(0, 0, 0, 1)",
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
            drag={prefersReducedMotion || preventClose ? undefined : "y"}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
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
              overflow: "hidden",
              willChange: "transform",
              transform: "translate3d(0, 0, 0)",
              transformOrigin: originFromFab ? "center bottom" : undefined,
              paddingBottom: "max(32px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Drag handle */}
            <div className="sheet-handle" />

            {/* Scrollable content wrapper */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
