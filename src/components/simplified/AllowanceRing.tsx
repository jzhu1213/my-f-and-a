"use client"

import { motion } from "framer-motion"
import { timings, useReducedMotion } from "@/lib/animations"
import type { AllowanceStatus } from "@/types/folio"

interface AllowanceRingProps {
  /** Proportion of daily budget consumed (0 to 1). Values > 1 are clamped. */
  progress: number
  /** Current allowance status for color coding */
  status: AllowanceStatus
  /** Diameter of the ring in pixels */
  size?: number
  /** Thickness of the ring stroke in pixels */
  strokeWidth?: number
  /** Content to render inside the ring */
  children?: React.ReactNode
}

/**
 * Returns the stroke color based on allowance status.
 */
function getStatusStrokeColor(status: AllowanceStatus): string {
  switch (status) {
    case "healthy":
      return "var(--success)"
    case "caution":
      return "var(--warning)"
    case "warning":
      return "var(--warning)"
    case "over":
      return "var(--error)"
  }
}

/**
 * AllowanceRing — an animated SVG progress ring that visualizes
 * the proportion of daily budget consumed.
 *
 * Uses framer-motion's motion.circle for GPU-accelerated stroke-dashoffset
 * animation, ensuring smooth 60fps transitions via CSS transforms.
 *
 * A soft color-matched glow behind the progress stroke gives the ring ambient
 * depth (Task 248.1). The glow is achieved via an extra blurred circle behind
 * the main arc — purely decorative and GPU-composited (filter: blur).
 *
 * Validates: Requirements 2.2, 13.5, 15.2
 */
export function AllowanceRing({
  progress,
  status,
  size = 180,
  strokeWidth = 8,
  children,
}: AllowanceRingProps) {
  const prefersReducedMotion = useReducedMotion()
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress))

  // strokeDashoffset: full circumference = no fill, 0 = fully filled
  const offset = circumference * (1 - clampedProgress)

  const strokeColor = getStatusStrokeColor(status)

  const percentUsed = Math.round(clampedProgress * 100)

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percentUsed}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Budget usage: ${percentUsed}% spent today`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: "rotate(-90deg)",
          willChange: "transform",
        }}
        aria-hidden="true"
      >
        {/* SVG filter for the ring glow (Task 248.1) */}
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
        </defs>

        {/* Background track — refined opacity for subtlety */}
        <circle
          fill="transparent"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeOpacity={0.3}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />

        {/* Glow layer behind the progress arc — blurred duplicate (Task 248.1) */}
        <motion.circle
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeOpacity={0.35}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={prefersReducedMotion ? { duration: 0 } : timings.slow}
          filter="url(#ring-glow)"
        />

        {/* Animated progress arc */}
        <motion.circle
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={prefersReducedMotion ? { duration: 0 } : timings.slow}
        />
      </svg>

      {/* Center content (children render inside the ring) */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}
