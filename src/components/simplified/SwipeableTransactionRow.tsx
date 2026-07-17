"use client"

import { useState, useRef } from "react"
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion"
import { springs, timings } from "@/lib/animations"

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
  /** Whether to show the bottom border */
  showBorder?: boolean
}

/** Threshold (px) that triggers the delete action on release */
const DELETE_THRESHOLD = -80
/** Max drag distance (px) allowed */
const MAX_DRAG = -120

/**
 * SwipeableTransactionRow — wraps a transaction row with horizontal swipe
 * to reveal a delete action. Swiping left past the threshold triggers delete;
 * releasing before threshold snaps back. The row animates out smoothly on delete.
 *
 * Requirements: 9.4
 */
export function SwipeableTransactionRow({
  id,
  children,
  onDelete,
  onTap,
  showBorder = true,
}: SwipeableTransactionRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const dragX = useMotionValue(0)
  const isDragging = useRef(false)

  // Map drag progress to reveal opacity for the delete button
  const deleteOpacity = useTransform(dragX, [0, -40, -80], [0, 0.5, 1])
  const deleteScale = useTransform(dragX, [0, -60, -100], [0.6, 0.9, 1])

  const handleDragEnd = () => {
    const currentX = dragX.get()
    if (currentX < DELETE_THRESHOLD) {
      // Trigger delete
      setIsDeleting(true)
      onDelete(id)
    }
    // Snap back is handled by framer-motion's dragElastic/dragConstraints
    isDragging.current = false
  }

  const handleDragStart = () => {
    isDragging.current = true
  }

  const handleTap = () => {
    // Only fire tap if we didn't just swipe
    if (!isDragging.current) {
      onTap()
    }
  }

  return (
    <AnimatePresence mode="popLayout">
      {!isDeleting && (
        <motion.div
          layout
          initial={{ opacity: 1, height: "auto" }}
          exit={{
            opacity: 0,
            height: 0,
            marginTop: 0,
            marginBottom: 0,
            transition: { opacity: timings.fast, height: { duration: 0.25, ease: "easeInOut" } },
          }}
          style={{
            position: "relative",
            overflow: "hidden",
            borderBottom: showBorder ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}
        >
          {/* Delete action revealed behind */}
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: deleteOpacity,
              scale: deleteScale,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                color: "#fff",
                background: "var(--error, #f87171)",
                borderRadius: 8,
                padding: "6px 12px",
              }}
            >
              Delete
            </span>
          </motion.div>

          {/* Draggable row content */}
          <motion.div
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: MAX_DRAG, right: 0 }}
            dragElastic={{ left: 0.1, right: 0 }}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleTap}
            style={{
              x: dragX,
              cursor: "pointer",
              touchAction: "pan-y",
              background: "transparent",
            }}
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
