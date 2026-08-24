"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings, useReducedMotion } from "@/lib/animations"
import type { Transaction } from "@/types"
import { toMonthString } from "@/lib/budgetUtils"
import {
  computeMonthOverMonthTrend,
  computeCategoryComparison,
} from "@/lib/spendingInsights"
import type { MonthOverMonthTrend, CategoryComparison } from "@/lib/spendingInsights"
import { GlassCard } from "@/components/ui/GlassCard"
import { formatCurrency } from "@/lib/currencyUtils"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

export interface InsightTrendCardProps {
  transactions: Transaction[]
}

/**
 * InsightTrendCard — shows month-over-month spending trend and top
 * per-category changes with warm, non-judgmental copy.
 *
 * Features:
 * - Dismissible (stays dismissed for the session)
 * - Shows overall trend message
 * - Shows top 2-3 category movers
 * - Respects reduced motion via framer-motion defaults
 * - Uses GlassCard with low elevation for a subtle presence
 *
 * Requirements: 9.4
 */
export function InsightTrendCard({ transactions }: InsightTrendCardProps) {
  const [dismissed, setDismissed] = useState(false)
  const { prefersReducedMotion } = useReducedMotion()

  const currentMonth = useMemo(() => toMonthString(new Date()), [])

  const trend: MonthOverMonthTrend = useMemo(
    () => computeMonthOverMonthTrend(transactions, currentMonth),
    [transactions, currentMonth],
  )

  const categoryChanges: CategoryComparison[] = useMemo(
    () => computeCategoryComparison(transactions, currentMonth),
    [transactions, currentMonth],
  )

  // Don't render if there's nothing meaningful to compare (no prior month data)
  if (trend.priorTotal === 0 && trend.currentTotal === 0) {
    return null
  }

  // Top 3 category movers (skip flat ones)
  const topMovers = categoryChanges
    .filter((c) => c.direction !== "flat")
    .slice(0, 3)

  const trendEmoji =
    trend.direction === "down"
      ? "📉"
      : trend.direction === "up"
      ? "📈"
      : "📊"

  const toneColor =
    trend.direction === "down"
      ? "var(--success)"
      : trend.direction === "up"
      ? "var(--warning)"
      : "var(--sub)"

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label="Month-over-month spending trend"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : timings.normal}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
              <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.4 }} aria-hidden="true">
                {trendEmoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Overall trend message */}
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    color: toneColor,
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.4,
                  }}
                  role="status"
                  aria-live="polite"
                >
                  {trend.message}
                </p>

                {/* Per-category breakdown (top movers) */}
                {topMovers.length > 0 && (
                  <div
                    style={{
                      marginTop: spacing.xs,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {topMovers.map((cat) => (
                      <p
                        key={cat.category}
                        style={{
                          fontSize: typography.caption.fontSize,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                          lineHeight: 1.4,
                          opacity: 0.85,
                        }}
                      >
                        {cat.emoji} {cat.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Comparison amounts */}
                <p
                  style={{
                    fontSize: typography.caption.fontSize,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 6,
                    opacity: 0.7,
                  }}
                >
                  This month: {formatCurrency(Math.round(trend.currentTotal), 'USD', { fractionDigits: 0 })}
                  {trend.priorTotal > 0 &&
                    ` · Last month: ${formatCurrency(Math.round(trend.priorTotal), 'USD', { fractionDigits: 0 })}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss trend insight"
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: typography.body.fontSize,
                  color: "var(--sub)",
                  opacity: 0.6,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </GlassCard>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
