"use client"

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { motion, useMotionValue, useTransform, animate, type MotionValue } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"

/**
 * PullToRefresh — a mobile-first pull-to-refresh wrapper.
 *
 * Wraps scrollable content and detects a downward drag gesture at the top
 * of the scroll container. When the user pulls past a threshold and releases,
 * it triggers a refetch callback and shows a branded accent-ring indicator.
 *
 * The indicator is a ring of dots that progressively fill as the user pulls,
 * then pulse/breathe while refreshing — cohesive with Folio's warm purple
 * mesh aesthetic. Respects prefers-reduced-motion.
 *
 * Uses framer-motion's spring physics for smooth, bouncy interaction.
 * GPU-composited (transform + opacity only).
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
/** Number of dots in the accent ring */
const DOT_COUNT = 8

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pullY = useMotionValue(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const { prefersReducedMotion } = useReducedMotion()

  // Transform pull distance to indicator opacity and scale
  const indicatorOpacity = useTransform(pullY, [0, PULL_THRESHOLD * 0.5, PULL_THRESHOLD], [0, 0.4, 1])
  const indicatorScale = useTransform(pullY, [0, PULL_THRESHOLD], [0.4, 1])
  // Progress 0→1 representing how much of the ring is "filled"
  const pullProgress = useTransform(pullY, [0, PULL_THRESHOLD], [0, 1])
  // Glow intensity increases with pull distance
  const glowOpacity = useTransform(pullY, [PULL_THRESHOLD * 0.5, PULL_THRESHOLD, MAX_PULL], [0, 0.3, 0.6])

  const isAtTop = (): boolean => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollTop <= 0
  }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return
    if (!isAtTop()) return
    isDragging.current = true
    startY.current = e.touches[0].clientY
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
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

    // Prevent native scroll while pulling — requires { passive: false }
    if (clamped > 0) {
      e.preventDefault()
    }
  }, [disabled, isRefreshing, pullY])

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return
    isDragging.current = false

    const currentPull = pullY.get()

    if (currentPull >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh with bouncy settle
      setIsRefreshing(true)
      animate(pullY, PULL_THRESHOLD * 0.6, {
        ...springs.bouncy,
      })

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        animate(pullY, 0, { ...springs.gentle })
      }
    } else {
      // Snap back with snappy spring
      animate(pullY, 0, { ...springs.snappy })
    }
  }, [isRefreshing, onRefresh, pullY])

  // Register touch event listeners with { passive: false } so preventDefault works
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

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
          opacity: indicatorOpacity,
        }}
      >
        <motion.div
          style={{
            scale: indicatorScale,
          }}
        >
          <AccentRingIndicator
            pullProgress={pullProgress}
            glowOpacity={glowOpacity}
            isRefreshing={isRefreshing}
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.div>
      </motion.div>

      {/* Content offset */}
      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  )
}

// ── Branded Accent Ring Indicator ───────────────────────────────────────────

interface AccentRingIndicatorProps {
  pullProgress: MotionValue<number>
  glowOpacity: MotionValue<number>
  isRefreshing: boolean
  prefersReducedMotion: boolean
}

function AccentRingIndicator({
  pullProgress,
  glowOpacity,
  isRefreshing,
  prefersReducedMotion,
}: AccentRingIndicatorProps) {
  // Pre-compute dot positions
  const dots = useMemo(() => {
    const radius = 14
    return Array.from({ length: DOT_COUNT }, (_, i) => {
      const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        index: i,
      }
    })
  }, [])

  return (
    <div
      style={{
        position: "relative",
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {/* Glow backdrop — a soft accent blur behind the ring */}
      <motion.div
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
          opacity: glowOpacity,
          filter: "blur(6px)",
        }}
      />

      {/* Dot ring */}
      {dots.map((dot) => (
        <AccentDot
          key={dot.index}
          x={dot.x}
          y={dot.y}
          index={dot.index}
          pullProgress={pullProgress}
          isRefreshing={isRefreshing}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </div>
  )
}

// ── Individual Dot ──────────────────────────────────────────────────────────

interface AccentDotProps {
  x: number
  y: number
  index: number
  pullProgress: MotionValue<number>
  isRefreshing: boolean
  prefersReducedMotion: boolean
}

function AccentDot({
  x,
  y,
  index,
  pullProgress,
  isRefreshing,
  prefersReducedMotion,
}: AccentDotProps) {
  // Each dot becomes visible when pull progress reaches its threshold
  const dotThreshold = index / DOT_COUNT
  const dotOpacity = useTransform(pullProgress, [dotThreshold, dotThreshold + 0.12], [0.15, 1])

  // Alternate between accent purple and secondary purple for depth
  const isSecondary = index % 2 === 1
  const color = isSecondary ? "var(--accent-400)" : "var(--accent-500)"

  // During refresh: dots pulse/breathe. With reduced motion: just steady opacity.
  const refreshAnimation = prefersReducedMotion
    ? { opacity: 0.8 }
    : {
        opacity: [0.4, 1, 0.4],
        scale: [0.8, 1.2, 0.8],
      }

  const refreshTransition = prefersReducedMotion
    ? { duration: 0.3 }
    : {
        repeat: Infinity,
        duration: 1.2,
        ease: "easeInOut" as const,
        delay: index * 0.1,
      }

  return (
    <motion.div
      style={{
        position: "absolute",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: color,
        left: "50%",
        top: "50%",
        marginLeft: -2.5,
        marginTop: -2.5,
        x,
        y,
        ...(isRefreshing ? {} : { opacity: dotOpacity }),
      }}
      animate={isRefreshing ? refreshAnimation : undefined}
      transition={isRefreshing ? refreshTransition : undefined}
    />
  )
}
