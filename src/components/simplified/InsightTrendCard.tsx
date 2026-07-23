"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import { toMonthString } from "@/lib/budgetUtils"
import {
  computeMonthOverMonthTrend,
  computeCategoryComparison,
} from "@/lib/spendingInsights"
import type { MonthOverMonthTrend, CategoryComparison } from "@/lib/spendingInsights"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"

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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1.4 }} aria-hidden="true">
                {trendEmoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Overall trend message */}
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
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
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {topMovers.map((cat) => (
                      <p
                        key={cat.category}
                        style={{
                          fontSize: 11,
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
                    fontSize: 11,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    marginTop: 6,
                    opacity: 0.7,
                  }}
                >
                  This month: ${Math.round(trend.currentTotal).toLocaleString("en-US")}
                  {trend.priorTotal > 0 &&
                    ` · Last month: $${Math.round(trend.priorTotal).toLocaleString("en-US")}`}
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
                  cursor: "pointer",
                  fontSize: 14,
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
