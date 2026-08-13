"use client"

import { useMemo, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import { detectAllPatterns } from "@/lib/spendingInsights"
import { selectBestInsight, recordInsightShown } from "@/lib/insightCadence"
import {
  compileMonthlyDigest,
  isEndOfBudgetPeriod,
} from "@/lib/monthlyDigest"
import { RichInsightCard } from "./RichInsightCard"
import { MonthlyDigestCard } from "./MonthlyDigestCard"
import { spacingScale } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface InsightsFeedProps {
  /** All user transactions for insight detection. */
  transactions: Transaction[]
  /** The user's daily budget/allowance amount. */
  dailyBudget: number
  /** Reference date (defaults to now). Useful for testing. */
  currentDate?: Date
}

// ============================================================================
// Component
// ============================================================================

/**
 * InsightsFeed — A container that orchestrates insight delivery.
 *
 * Renders at most one RichInsightCard (respecting cadence limits) and
 * optionally a MonthlyDigestCard when the budget period is ending.
 *
 * Can be used:
 * - In the tip card slot on HomeScreen
 * - As an inline widget in the Tools/Reviews section
 *
 * Relies on:
 * - `detectAllPatterns()` for insight generation
 * - `selectBestInsight()` for cadence-aware selection
 * - `compileMonthlyDigest()` for end-of-period summaries
 *
 * Requirements: 19.4
 */
export function InsightsFeed({
  transactions,
  dailyBudget,
  currentDate,
}: InsightsFeedProps) {
  const now = useMemo(() => currentDate ?? new Date(), [currentDate])

  // Detect all available insights
  const allInsights = useMemo(
    () => detectAllPatterns(transactions, dailyBudget, now),
    [transactions, dailyBudget, now],
  )

  // Select the best one (respects cadence: max 1/day, 3/week)
  const selectedInsight = useMemo(
    () => selectBestInsight(allInsights, now),
    [allInsights, now],
  )

  // Compile monthly digest (only at end of budget period)
  const monthlyDigest = useMemo(() => {
    if (!isEndOfBudgetPeriod(now)) return null
    return compileMonthlyDigest(transactions, dailyBudget, now)
  }, [transactions, dailyBudget, now])

  // Record that the insight was shown (side effect on mount)
  const handleInsightShown = useCallback(() => {
    if (selectedInsight) {
      recordInsightShown(selectedInsight.id, selectedInsight.type, selectedInsight.tone, now)
    }
  }, [selectedInsight, now])

  // Record on first render (insight is "shown" when rendered)
  useMemo(() => {
    handleInsightShown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInsight?.id])

  // Don't render if nothing to show
  if (!selectedInsight && !monthlyDigest) return null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingScale["12"],
      }}
      aria-label="Spending insights"
    >
      <AnimatePresence mode="sync">
        {/* Monthly digest card (shown at end of period) */}
        {monthlyDigest && (
          <MonthlyDigestCard
            key={`digest-${monthlyDigest.month}`}
            digest={monthlyDigest}
          />
        )}

        {/* Single cadenced insight card */}
        {selectedInsight && (
          <RichInsightCard
            key={selectedInsight.id}
            insight={selectedInsight}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
