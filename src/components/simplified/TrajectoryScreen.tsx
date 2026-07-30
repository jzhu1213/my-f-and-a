"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import {
  computeTrajectory,
  type TrajectoryDirection,
  type TrajectoryInsight,
} from "@/lib/trajectoryUtils"
import type { Transaction, Goal } from "@/types"
import type { Debt } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface TrajectoryScreenProps {
  transactions: Transaction[]
  goals?: Goal[]
  debts?: Debt[]
  savingsRate?: number
  onBack: () => void
}

// ============================================================================
// Direction visual indicators
// ============================================================================

const DIRECTION_DISPLAY: Record<
  TrajectoryDirection,
  { arrow: string; color: string; label: string }
> = {
  improving: { arrow: "↗", color: "var(--success)", label: "Improving" },
  steady: { arrow: "→", color: "var(--sub)", label: "Steady" },
  declining: { arrow: "↘", color: "var(--warning, #f59e0b)", label: "Needs attention" },
}

// ============================================================================
// TrajectoryScreen Component
// ============================================================================

/**
 * Financial Trajectory — a warm, encouraging view that shows directional
 * progress without raw net-worth numbers.
 *
 * Lives in the Tools tab (progressive disclosure). Reframes "net worth"
 * into something approachable for college students.
 */
export function TrajectoryScreen({
  transactions,
  goals,
  debts,
  savingsRate,
  onBack,
}: TrajectoryScreenProps) {
  const trajectory = useMemo(
    () =>
      computeTrajectory({
        transactions,
        goals,
        debts,
        savingsRate,
      }),
    [transactions, goals, debts, savingsRate]
  )

  const { arrow, color, label } = DIRECTION_DISPLAY[trajectory.overall]

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `0 ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Back button ────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 20,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {/* ── Hero area ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ textAlign: "center", marginBottom: 28 }}
      >
        {/* Direction arrow */}
        <div
          style={{
            fontSize: 48,
            color,
            marginBottom: 8,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {arrow}
        </div>

        {/* Direction label */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          {label}
        </p>

        {/* Warm headline */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.3,
            marginBottom: 6,
          }}
        >
          {trajectory.headline}
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "var(--sub)",
            lineHeight: 1.5,
          }}
        >
          Here's how your money habits are trending.
        </p>
      </motion.div>

      {/* ── Insight cards ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trajectory.insights.length === 0 && (
          <GlassCard elevation="low" style={{ padding: "20px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">
              📊
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text)",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Not enough data yet
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
              Log a few weeks of expenses and income — this view will light up
              with trends and insights.
            </p>
          </GlassCard>
        )}

        {trajectory.insights.map((insight, idx) => (
          <InsightCard key={insight.id} insight={insight} index={idx} />
        ))}
      </div>

      {/* ── Footer note ────────────────────────────────────────────── */}
      <p
        style={{
          fontSize: 12,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.5,
        }}
      >
        Trends are based on your logged transactions. The more you log, the
        sharper the picture gets.
      </p>
    </div>
  )
}

// ============================================================================
// InsightCard (internal)
// ============================================================================

function InsightCard({
  insight,
  index,
}: {
  insight: TrajectoryInsight
  index: number
}) {
  const { color } = DIRECTION_DISPLAY[insight.direction]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: 0.05 * index }}
    >
      <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}
            aria-hidden="true"
          >
            {insight.emoji}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              {insight.headline}
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                lineHeight: 1.4,
              }}
            >
              {insight.detail}
            </p>
          </div>
          {/* Tiny direction dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
              marginTop: 6,
              opacity: 0.8,
            }}
            aria-hidden="true"
          />
        </div>
      </GlassCard>
    </motion.div>
  )
}
