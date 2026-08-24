"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings, useReducedMotion } from "@/lib/animations"
import type { Transaction } from "@/types"
import { toMonthString } from "@/lib/budgetUtils"
import {
  getLargestExpenses,
  getCategoryBreakdown,
} from "@/lib/spendingInsights"
import type { LargestExpense, CategoryBreakdownRow } from "@/lib/spendingInsights"
import { GlassCard } from "@/components/ui/GlassCard"
import { formatCurrency } from "@/lib/currencyUtils"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

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
  const { prefersReducedMotion } = useReducedMotion()

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

  // Build a text summary for screen readers
  const textSummary = useMemo(() => {
    const parts: string[] = []
    if (largestExpenses.length > 0) {
      parts.push(`Top expenses: ${largestExpenses.map(e => `${e.label} $${Math.round(e.amount)}`).join(', ')}.`)
    }
    if (breakdown.length > 0) {
      parts.push(`Category breakdown: ${breakdown.map(r => `${r.label} ${r.percent}%`).join(', ')}.`)
    }
    return parts.join(' ')
  }, [largestExpenses, breakdown])

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label="Spending breakdown insight"
          aria-describedby="insight-breakdown-summary"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : timings.normal}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            {/* Screen reader text summary */}
            <span id="insight-breakdown-summary" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
              {textSummary}
            </span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
              <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.4 }} aria-hidden="true">
                💸
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Section title */}
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.4,
                    marginBottom: spacing.xs,
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
                        <span style={{ fontSize: typography['body-sm'].fontSize }} aria-hidden="true">
                          {exp.emoji}
                        </span>
                        <span
                          style={{
                            fontSize: typography['body-sm'].fontSize,
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
                            fontSize: typography['body-sm'].fontSize,
                            color: "var(--text)",
                            fontFamily: FONT_FAMILY,
                            fontWeight: fontWeights.semibold,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(Math.round(exp.amount), 'USD', { fractionDigits: 0 })}
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
                      gap: spacing.xxs,
                      borderTop: "1px solid var(--fill-06)",
                      paddingTop: 8,
                    }}
                  >
                    {breakdown.map((row) => (
                      <p
                        key={row.category}
                        style={{
                          fontSize: typography.caption.fontSize,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                          lineHeight: 1.4,
                          opacity: 0.85,
                        }}
                      >
                        {row.emoji} {row.label} — {row.percent}% ({formatCurrency(Math.round(row.amount), 'USD', { fractionDigits: 0 })})
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
