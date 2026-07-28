"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import { toMonthString } from "@/lib/budgetUtils"
import {
  getLargestExpenses,
  getCategoryBreakdown,
} from "@/lib/spendingInsights"
import type { LargestExpense, CategoryBreakdownRow } from "@/lib/spendingInsights"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"

export interface InsightBreakdownCardProps {
  transactions: Transaction[]
}

/**
 * InsightBreakdownCard — shows top 3 largest expenses and a category spending
 * breakdown for the current month.
 *
 * Features:
 * - Dismissible (stays dismissed for the session)
 * - Shows top 3 biggest expenses with emoji, label, and amount
 * - Shows category breakdown as text rows with percent
 * - Uses warm, non-judgmental tone
 * - Only renders when there are at least 3 expenses in the current month
 * - Respects reduced motion via framer-motion defaults
 * - Uses GlassCard with low elevation
 *
 * Requirements: 9.4
 */
export function InsightBreakdownCard({ transactions }: InsightBreakdownCardProps) {
  const [dismissed, setDismissed] = useState(false)

  const currentMonth = useMemo(() => toMonthString(new Date()), [])

  const largestExpenses: LargestExpense[] = useMemo(
    () => getLargestExpenses(transactions, currentMonth, 3),
    [transactions, currentMonth],
  )

  const breakdown: CategoryBreakdownRow[] = useMemo(
    () => getCategoryBreakdown(transactions, currentMonth),
    [transactions, currentMonth],
  )

  // Only show when there are at least 3 expenses this month
  const monthExpenseCount = useMemo(
    () => transactions.filter(t => t.type === "expense" && t.date.startsWith(currentMonth)).length,
    [transactions, currentMonth],
  )

  if (monthExpenseCount < 3) return null
  if (largestExpenses.length === 0 && breakdown.length === 0) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label="Spending breakdown insight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1.4 }} aria-hidden="true">
                💸
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Section title */}
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.4,
                    marginBottom: 8,
                  }}
                >
                  Here&rsquo;s where it went this month
                </p>

                {/* Top 3 largest expenses */}
                {largestExpenses.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginBottom: 10,
                    }}
                  >
                    {largestExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 12 }} aria-hidden="true">
                          {exp.emoji}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--sub)",
                            fontFamily: FONT_FAMILY,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {exp.label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text)",
                            fontFamily: FONT_FAMILY,
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ${Math.round(exp.amount).toLocaleString("en-US")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category breakdown */}
                {breakdown.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                      paddingTop: 8,
                    }}
                  >
                    {breakdown.map((row) => (
                      <p
                        key={row.category}
                        style={{
                          fontSize: 11,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                          lineHeight: 1.4,
                          opacity: 0.85,
                        }}
                      >
                        {row.emoji} {row.label} — {row.percent}% ($
                        {Math.round(row.amount).toLocaleString("en-US")})
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss spending breakdown"
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
