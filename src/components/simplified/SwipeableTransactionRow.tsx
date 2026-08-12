"use client"

import { useState, useRef } from "react"
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { springPresets } from "@/styles/motion"
import { Icon } from "@/components/ui/Icon"

// ============================================================================
// SwipeableTransactionRow
// ============================================================================

export interface SwipeableTransactionRowProps {
  /** Unique transaction ID */
  id: string
  /** Content to render inside the row */
  children: React.ReactNode
  /** Called when user confirms delete via swipe */
  onDelete: (id: string) => void
  /** Called when user taps the row (navigate to transaction) */
  onTap: () => void
  /** Called when user swipes right to edit */
  onEdit?: (id: string) => void
  /** Whether to show the bottom border */
  showBorder?: boolean
}

/** Threshold (px) that triggers the delete action on release */
const DELETE_THRESHOLD = -80
/** Threshold (px) that triggers the edit action on release */
const EDIT_THRESHOLD = 80
/** Max drag distance (px) allowed left (delete) */
const MAX_DRAG_LEFT = -120
/** Max drag distance (px) allowed right (edit) */
const MAX_DRAG_RIGHT = 120

/**
 * SwipeableTransactionRow — wraps a transaction row with horizontal swipe
 * to reveal actions. Swiping left past the threshold triggers delete;
 * swiping right past the threshold triggers edit. Releasing before threshold
 * snaps back. The row animates out smoothly on delete.
 *
 * Phase 6 (task 255.2): icon-based reveals (Trash2 / Pencil), refined spring
 * physics with dragMomentum for natural feel, subtle scale bounce on threshold.
 *
 * Requirements: 9.4
 */
export function SwipeableTransactionRow({
  id,
  children,
  onDelete,
  onTap,
  onEdit,
  showBorder = true,
}: SwipeableTransactionRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { prefersReducedMotion } = useReducedMotion()
  const dragX = useMotionValue(0)
  const isDragging = useRef(false)

  // Smooth spring for icon scale — gives a haptic-like bounce at threshold
  const rawDeleteScale = useTransform(dragX, [0, -40, -80, -100], [0.5, 0.7, 1, 1.15])
  const rawEditScale = useTransform(dragX, [0, 40, 80, 100], [0.5, 0.7, 1, 1.15])
  const deleteIconScale = useSpring(rawDeleteScale, { stiffness: springPresets.snappy.stiffness, damping: 25 })
  const editIconScale = useSpring(rawEditScale, { stiffness: springPresets.snappy.stiffness, damping: 25 })

  // Map drag progress to reveal opacity
  const deleteOpacity = useTransform(dragX, [0, -30, -60], [0, 0.4, 1])
  const editOpacity = useTransform(dragX, [0, 30, 60], [0, 0.4, 1])

  const handleDragEnd = () => {
    const currentX = dragX.get()
    if (currentX < DELETE_THRESHOLD) {
      setIsDeleting(true)
      onDelete(id)
    } else if (currentX > EDIT_THRESHOLD && onEdit) {
      onEdit(id)
    }
    isDragging.current = false
  }

  const handleDragStart = () => {
    isDragging.current = true
  }

  const handleTap = () => {
    if (!isDragging.current) {
      onTap()
    }
  }

  /** Keyboard alternative for swipe gestures (accessibility) */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      setIsDeleting(true)
      onDelete(id)
    } else if ((e.key === "e" || e.key === "E") && onEdit) {
      e.preventDefault()
      onEdit(id)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onTap()
    }
  }

  return (
    <AnimatePresence mode="popLayout">
      {!isDeleting && (
        <motion.div
          layout={!prefersReducedMotion}
          initial={{ opacity: 1, height: "auto" }}
          exit={{
            opacity: 0,
            height: 0,
            marginTop: 0,
            marginBottom: 0,
            transition: { opacity: timings.fast, height: timings.normal },
          }}
          style={{
            position: "relative",
            overflow: "hidden",
            borderBottom: showBorder ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}
        >
          {/* Delete action revealed behind (swipe left) */}
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: deleteOpacity,
              scale: deleteIconScale,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <span
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: "var(--error)",
                color: "var(--text)",
              }}
            >
              <Icon name="action:delete" size={18} strokeWidth={2} />
            </span>
          </motion.div>

          {/* Edit action revealed behind (swipe right) */}
          {onEdit && (
            <motion.div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: 72,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: editOpacity,
                scale: editIconScale,
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  background: "rgba(129, 140, 248, 0.9)",
                  color: "var(--text)",
                }}
              >
                <Icon name="action:edit" size={18} strokeWidth={2} />
              </span>
            </motion.div>
          )}

          {/* Draggable row content */}
          <motion.div
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: MAX_DRAG_LEFT, right: onEdit ? MAX_DRAG_RIGHT : 0 }}
            dragElastic={{ left: 0.08, right: onEdit ? 0.08 : 0 }}
            dragMomentum
            dragTransition={{ bounceStiffness: springPresets.snappy.stiffness, bounceDamping: springPresets.snappy.damping }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleTap}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Transaction row. Press Enter to view, Delete to remove, E to edit."
            style={{
              x: dragX,
              cursor: "pointer",
              touchAction: "pan-y",
              background: "transparent",
              outline: "none",
            }}
            className="focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:rounded-lg"
            whileTap={{ scale: isDragging.current ? 1 : 0.98 }}
            transition={springs.snappy}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
