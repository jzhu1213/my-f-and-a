"use client"

/**
 * ExportSummarySheet — confirmation bottom-sheet before CSV export.
 *
 * Shows a brief summary of what will be exported: count, date range, active
 * filters, and total. Confirm triggers the download, Cancel dismisses.
 *
 * Accessibility: focus trap, Escape to close, returns focus on dismiss.
 *
 * Requirements: 22.7, accessibility standard
 */

import { useCallback, useEffect, useRef, useId } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { shadows } from '@/styles/shared'
import type { ExportSummary } from "@/lib/csvExport"

// ============================================================================
// Props
// ============================================================================

export interface ExportSummarySheetProps {
  /** Whether the sheet is visible. */
  open: boolean
  /** Pre-computed export summary data. */
  summary: ExportSummary | null
  /** Called when user confirms the export. */
  onConfirm: () => void
  /** Called when user cancels / dismisses. */
  onClose: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ExportSummarySheet({ open, summary, onConfirm, onClose }: ExportSummarySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  const handleConfirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  // Focus trap + Escape key + restore focus on close
  useEffect(() => {
    if (open) {
      // Store the previously focused element to return focus later
      previousFocusRef.current = document.activeElement as HTMLElement | null

      // Move focus to the sheet
      const timer = setTimeout(() => {
        sheetRef.current?.focus()
      }, 100)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault()
          onClose()
          return
        }

        // Focus trap: Tab cycles within the dialog
        if (e.key === "Tab" && sheetRef.current) {
          const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusable.length === 0) return

          const first = focusable[0]
          const last = focusable[focusable.length - 1]

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
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => {
        clearTimeout(timer)
        document.removeEventListener("keydown", handleKeyDown)
      }
    } else {
      // Return focus when closed
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [open, onClose])

  if (!summary) return null

  // Build the friendly summary line
  const parts: string[] = []
  parts.push(`Exporting ${summary.count} ${summary.count === 1 ? 'transaction' : 'transactions'}`)
  if (summary.dateRangeLabel) {
    parts.push(`from ${summary.dateRangeLabel}`)
  }
  if (summary.filterDescription) {
    parts.push(summary.filterDescription)
  }
  const summaryLine = parts.join(' ') + '.'
  const totalLine = `Total: ${summary.totalFormatted}`

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="export-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--color-canvas)",
              zIndex: 999,
            }}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="export-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: "var(--surface)",
              borderRadius: `${radius.sheet} ${radius.sheet} 0 0`,
              padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
              fontFamily: FONT_FAMILY,
              boxShadow: shadows.lg,
              outline: "none",
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--sub)",
                opacity: 0.4,
                margin: "0 auto",
                marginBottom: spacing.lg,
              }}
            />

            {/* Title */}
            <h2
              id={titleId}
              style={{
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--fg)",
                margin: 0,
                marginBottom: spacing.sm,
              }}
            >
              Ready to export
            </h2>

            {/* Summary text */}
            <p
              style={{
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.regular,
                color: "var(--sub)",
                margin: 0,
                marginBottom: spacing.xs,
                lineHeight: 1.5,
              }}
            >
              {summaryLine}
            </p>
            <p
              style={{
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--fg)",
                margin: 0,
                marginBottom: spacing.lg,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {totalLine}
            </p>

            {/* File info */}
            <p
              style={{
                fontSize: typography['body-sm'].fontSize,
                color: "var(--sub)",
                margin: 0,
                marginBottom: spacing.lg,
                opacity: 0.7,
              }}
            >
              You&rsquo;ll get a CSV with date, amount, category, note, type, and tags.
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: spacing.sm }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontFamily: FONT_FAMILY,
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.medium,
                  color: "var(--sub)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: radius.control,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontFamily: FONT_FAMILY,
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: "var(--text)",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: radius.control,
                  cursor: "pointer",
                }}
              >
                Export CSV
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
