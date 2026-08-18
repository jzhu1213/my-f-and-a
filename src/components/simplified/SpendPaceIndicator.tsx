"use client"

import { useMemo } from "react"
import type { Transaction } from "@/types"
import { computeSpendVelocity, velocityToPath } from "@/lib/spendVelocity"
import { motion } from "framer-motion"
import { timings, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { chartLinePatterns } from "@/styles/chartTokens"

// ============================================================================
// SpendPaceIndicator — subtle sparkline showing today's spend pace vs. typical
// ============================================================================

interface SpendPaceIndicatorProps {
  transactions: Transaction[]
  todayStr: string
}

/**
 * A very subtle sparkline beneath the hero that hints at today's spending pace
 * compared to the user's typical day. Not a chart — no axes, no labels, no
 * gridlines. Just two gentle curves: one faint (typical) and one slightly more
 * visible (today).
 *
 * Never shaming — uses opacity differences only, no red/warning colors.
 * Respects prefers-reduced-motion by rendering statically.
 */
export function SpendPaceIndicator({ transactions, todayStr }: SpendPaceIndicatorProps) {
  const { prefersReducedMotion } = useAppReducedMotion()
  const currentHour = new Date().getHours()

  const velocityData = useMemo(
    () => computeSpendVelocity(transactions, todayStr, currentHour),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, todayStr, currentHour]
  )

  if (!velocityData.hasEnoughHistory) return null

  const width = 120
  const height = 28

  const typicalPath = velocityToPath(velocityData.typical, width, height)
  const todayPath = velocityToPath(velocityData.today, width, height, 24)

  // If no today path (no spending yet), still show the typical as a hint
  const hasTodayData = velocityData.today.length >= 2

  return (
    <motion.div
      role="img"
      aria-label="Your spending pace today compared to your usual day"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={timings.normal}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        {/* Typical day — very faint, dashed for CVD differentiation */}
        {typicalPath && (
          <path
            d={typicalPath}
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={chartLinePatterns.dashed}
            opacity={0.12}
            fill="none"
          />
        )}
        {/* Today — slightly more visible, solid for CVD differentiation */}
        {hasTodayData && todayPath && (
          <path
            d={todayPath}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.35}
            fill="none"
            {...(!prefersReducedMotion && {
              strokeDasharray: pathLength(todayPath),
              strokeDashoffset: pathLength(todayPath),
              style: {
                animation: "pace-draw 0.8s ease-out forwards",
              },
            })}
          />
        )}
      </svg>

      {/* Inline keyframe for the draw animation */}
      {!prefersReducedMotion && hasTodayData && (
        <style>{`
          @keyframes pace-draw {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      )}
    </motion.div>
  )
}

/**
 * Approximate SVG path length for dash animation.
 * Good enough for a smooth draw effect without measuring the DOM.
 */
function pathLength(d: string): number {
  // Count coordinates as a rough proxy — each curve segment adds ~40px
  const segments = (d.match(/C/g) || []).length
  return Math.max(segments * 40, 120)
}
