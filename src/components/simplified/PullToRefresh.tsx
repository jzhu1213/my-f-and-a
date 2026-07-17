"use client"

import { useState, useRef, type ReactNode } from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { springs } from "@/lib/animations"

/**
 * PullToRefresh — a mobile-first pull-to-refresh wrapper.
 *
 * Wraps scrollable content and detects a downward drag gesture at the top
 * of the scroll container. When the user pulls past a threshold and releases,
 * it triggers a refetch callback and shows a subtle spinner.
 *
 * Uses framer-motion's drag gesture for smooth, spring-physics interaction.
 * The spinner fades and scales in gently, keeping the interaction warm.
 *
 * Requirements: 13.1
 */

export interface PullToRefreshProps {
  /** Called when the user completes a pull-to-refresh gesture */
  onRefresh: () => Promise<void>
  /** Content to wrap */
  children: ReactNode
  /** Whether the component is disabled (e.g., already loading) */
  disabled?: boolean
}

/** Pull distance (px) required to trigger a refresh */
const PULL_THRESHOLD = 64
/** Maximum pull distance before rubber-banding */
const MAX_PULL = 120

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pullY = useMotionValue(0)
  const isDragging = useRef(false)
  const startY = useRef(0)

  // Transform pull distance to spinner opacity and scale
  const spinnerOpacity = useTransform(pullY, [0, PULL_THRESHOLD * 0.5, PULL_THRESHOLD], [0, 0.4, 1])
  const spinnerScale = useTransform(pullY, [0, PULL_THRESHOLD], [0.4, 1])
  const spinnerRotation = useTransform(pullY, [0, MAX_PULL], [0, 360])

  const isAtTop = (): boolean => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollTop <= 0
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    if (!isAtTop()) return
    isDragging.current = true
    startY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || disabled || isRefreshing) return
    const currentY = e.touches[0].clientY
    const delta = currentY - startY.current

    if (delta < 0) {
      // Scrolling up — reset and let native scroll handle it
      pullY.set(0)
      return
    }

    if (!isAtTop()) {
      isDragging.current = false
      pullY.set(0)
      return
    }

    // Rubber-band effect: diminishing returns past threshold
    const rubberBand = delta > PULL_THRESHOLD
      ? PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.3
      : delta
    const clamped = Math.min(rubberBand, MAX_PULL)
    pullY.set(clamped)

    // Prevent default scroll while pulling
    if (clamped > 0) {
      e.preventDefault()
    }
  }

  const handleTouchEnd = async () => {
    if (!isDragging.current) return
    isDragging.current = false

    const currentPull = pullY.get()

    if (currentPull >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true)
      animate(pullY, PULL_THRESHOLD * 0.6, { ...springs.gentle })

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        animate(pullY, 0, { ...springs.gentle })
      }
    } else {
      // Snap back
      animate(pullY, 0, { ...springs.snappy })
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Refresh indicator */}
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: PULL_THRESHOLD,
          pointerEvents: "none",
          zIndex: 10,
          y: useTransform(pullY, [0, PULL_THRESHOLD], [-PULL_THRESHOLD, 0]),
          opacity: spinnerOpacity,
        }}
      >
        <motion.div
          style={{
            scale: spinnerScale,
            rotate: isRefreshing ? undefined : spinnerRotation,
          }}
          animate={isRefreshing ? { rotate: 360 } : undefined}
          transition={
            isRefreshing
              ? { repeat: Infinity, duration: 0.8, ease: "linear" }
              : undefined
          }
        >
          <RefreshSpinner isRefreshing={isRefreshing} />
        </motion.div>
      </motion.div>

      {/* Content offset */}
      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  )
}

// ── Spinner icon ────────────────────────────────────────────────────────────

function RefreshSpinner({ isRefreshing }: { isRefreshing: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <path
        d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8 8-3.58 8-8"
        stroke={isRefreshing ? "var(--success)" : "rgba(255,255,255,0.5)"}
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          transition: "stroke 0.2s ease",
        }}
      />
      <path
        d="M20 4v4h-4"
        stroke={isRefreshing ? "var(--success)" : "rgba(255,255,255,0.5)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "stroke 0.2s ease",
        }}
      />
    </svg>
  )
}
