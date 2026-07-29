"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings } from "@/lib/animations"
import type { Transaction, Budget } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { projectEndOfMonthBalance, getProjectionMessage } from "@/lib/insightUtils"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"

export interface InsightCardProps {
  transactions: Transaction[]
  budgets: Budget[]
  fixedExpenses?: FixedExpense[]
}

/**
 * InsightCard — projects end-of-month balance and displays a warm,
 * non-judgmental insight on the Home screen.
 *
 * Features:
 * - Dismissible (stays dismissed for the session)
 * - Respects reduced motion via framer-motion defaults
 * - Uses GlassCard with low elevation for a subtle presence
 */
export function InsightCard({ transactions, budgets, fixedExpenses }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  const projection = useMemo(
    () => projectEndOfMonthBalance(transactions, budgets, fixedExpenses),
    [transactions, budgets, fixedExpenses]
  )

  const { message, tone } = useMemo(
    () => getProjectionMessage(projection),
    [projection]
  )

  // Don't render if there's nothing meaningful to show
  if (!message || projection.totalMonthlyPool <= 0) {
    return null
  }

  const toneColor =
    tone === "positive"
      ? "var(--success)"
      : tone === "tight"
      ? "var(--warning)"
      : "var(--error)"

  const toneEmoji =
    tone === "positive" ? "📊" : tone === "tight" ? "💡" : "📊"

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label="Monthly projection insight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={timings.normal}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1.4 }} aria-hidden="true">
                {toneEmoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  {message}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    marginTop: 4,
                    opacity: 0.8,
                  }}
                >
                  Based on ~${Math.round(projection.dailyBurnRate)}/day
                  {projection.daysRemaining > 0 && ` · ${projection.daysRemaining} days left`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss insight"
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
