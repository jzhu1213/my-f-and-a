"use client"

/**
 * ReportsScreen â€” filtered, exportable spending reports (Task 185.1)
 *
 * Builds on the CSV export (Phase 2 task 116.1) with a formatted PDF report and
 * filters by tag, merchant, or category (reusing the tag + search infrastructure
 * from Phase 3 task 129.x). Lives behind Settings â†’ Data via progressive
 * disclosure â€” never on the home screen.
 *
 * Guardrails:
 *   â€¢ Warm, shame-free copy ("where it went", never "you overspent").
 *   â€¢ Soft purple theme; prefers-reduced-motion honored.
 *   â€¢ Accessible: labelled controls, keyboard-operable chips, live status.
 *   â€¢ Free â€” no paywall, no bank linking.
 */

import { useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  borderRadius,
} from "@/styles/shared"
import { TRANSACTION_CATEGORIES } from "@/types"
import type { Transaction, TransactionCategory, Goal, Budget } from "@/types"
import { getRecentTags } from "@/lib/tagUtils"
import {
  buildReportSummary,
  exportReportPDF,
  type ReportFilters,
} from "@/lib/reportUtils"
import { exportTransactionsCSV } from "@/lib/accountUtils"
import { exportPeriodSummaryPDF } from "@/lib/exportSummaryPDF"

// ============================================================================
// Types
// ============================================================================

export interface ReportsScreenProps {
  transactions: Transaction[]
  onBack: () => void
  /** Optional toast surface for success/error feedback. */
  onNotify?: (message: string, kind?: "success" | "error") => void
  /** User goals â€” used for period summary PDF. */
  goals?: Goal[]
  /** User budgets â€” used for period summary PDF. */
  budgets?: Budget[]
}

// Expense categories offered as filter chips (dedup'd, expense only).
const EXPENSE_CATEGORIES = TRANSACTION_CATEGORIES.filter(
  (c, i, arr) => c.type === "expense" && arr.findIndex((x) => x.category === c.category) === i
)

// ============================================================================
// Helpers
// ============================================================================

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

// ============================================================================
// Component
// ============================================================================

export function ReportsScreen({ transactions, onBack, onNotify, goals = [], budgets = [] }: ReportsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [merchant, setMerchant] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [isSummaryExporting, setIsSummaryExporting] = useState(false)

  // Date range state â€” defaults to current month
  const today = new Date()
  const defaultStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const defaultEnd = today.toISOString().split('T')[0]
  const [dateStart, setDateStart] = useState(defaultStart)
  const [dateEnd, setDateEnd] = useState(defaultEnd)

  const filters: ReportFilters = useMemo(
    () => ({ category, tag, merchant: merchant.trim() || null }),
    [category, tag, merchant]
  )

  // Filter transactions by date range first, then apply category/tag/merchant filters
  const dateFilteredTransactions = useMemo(() => {
    if (!dateStart && !dateEnd) return transactions
    return transactions.filter(t => {
      if (dateStart && t.date < dateStart) return false
      if (dateEnd && t.date > dateEnd) return false
      return true
    })
  }, [transactions, dateStart, dateEnd])

  const summary = useMemo(
    () => buildReportSummary(dateFilteredTransactions, filters),
    [dateFilteredTransactions, filters]
  )

  const recentTags = useMemo(() => getRecentTags(transactions, 10), [transactions])

  const hasResults = summary.count > 0

  const handleExportPDF = useCallback(async () => {
    if (!hasResults || isExporting) return
    setIsExporting(true)
    try {
      const count = await exportReportPDF(dateFilteredTransactions, filters)
      onNotify?.(
        `Report ready â€” ${count} ${count === 1 ? "transaction" : "transactions"} ðŸ“„`,
        "success"
      )
    } catch {
      onNotify?.("Couldn't build the report just now. Try again in a moment.", "error")
    } finally {
      setIsExporting(false)
    }
  }, [hasResults, isExporting, dateFilteredTransactions, filters, onNotify])

  const handleExportCSV = useCallback(() => {
    if (!hasResults) return
    try {
      const dateRange = dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined
      exportTransactionsCSV(summary.transactions, { dateRange })
      onNotify?.("Filtered transactions exported (CSV)", "success")
    } catch {
      onNotify?.("Couldn't export the CSV just now. Try again in a moment.", "error")
    }
  }, [hasResults, summary.transactions, dateStart, dateEnd, onNotify])

  const handleExportSummaryPDF = useCallback(async () => {
    if (isSummaryExporting) return
    setIsSummaryExporting(true)
    try {
      const count = await exportPeriodSummaryPDF(transactions, {
        start: dateStart,
        end: dateEnd,
        goals,
        budgets,
      })
      onNotify?.(
        `Period summary ready â€” ${count} ${count === 1 ? "transaction" : "transactions"} ðŸ“„`,
        "success"
      )
    } catch {
      onNotify?.("Couldn't build the summary just now. Try again in a moment.", "error")
    } finally {
      setIsSummaryExporting(false)
    }
  }, [isSummaryExporting, transactions, dateStart, dateEnd, goals, budgets, onNotify])

  const containerStyle = {
    maxWidth: CONTENT_MAX_WIDTH,
    margin: "0 auto",
    padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
    fontFamily: FONT_FAMILY,
  } as const

  // â”€â”€ Reusable chip styling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const chip = (active: boolean) =>
    ({
      padding: "8px 14px",
      borderRadius: borderRadius.full,
      border: active ? "1.5px solid var(--accent-500)" : "1px solid var(--border)",
      background: active ? "var(--accent-200)" : "var(--fill-03)",
      color: active ? "var(--text)" : "var(--sub)",
      fontSize: typography['body-sm'].fontSize,
      fontWeight: active ? 600 : 500,
      fontFamily: FONT_FAMILY,
      cursor: "pointer",
      whiteSpace: "nowrap",
    }) as const

  return (
    <div style={containerStyle}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: typography.body.fontSize,
          cursor: "pointer",
          marginBottom: spacing.md,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        â† Back
      </button>

      <h2 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", marginBottom: 6 }}>
        Reports
      </h2>
      <p style={{ fontSize: typography.body.fontSize, color: "var(--sub)", marginBottom: HORIZONTAL_PADDING, lineHeight: 1.5 }}>
        Filter your history, then save a tidy PDF or spreadsheet â€” just for you.
      </p>

      {/* â”€â”€ Date range â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
        <label
          style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", letterSpacing: "0.02em" }}
        >
          Date range
        </label>
        <div
          style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}
        >
          <input
            type="date"
            aria-label="Start date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: borderRadius.sm,
              border: "1px solid var(--border)",
              background: "var(--fill-03)",
              color: "var(--text)",
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              outline: "none",
            }}
          />
          <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)" }}>to</span>
          <input
            type="date"
            aria-label="End date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: borderRadius.sm,
              border: "1px solid var(--border)",
              background: "var(--fill-03)",
              color: "var(--text)",
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              outline: "none",
            }}
          />
        </div>
      </GlassCard>

      {/* â”€â”€ Category filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
        <label
          style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", letterSpacing: "0.02em" }}
        >
          Category
        </label>
        <div
          role="group"
          aria-label="Filter by category"
          style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs, marginTop: 12 }}
        >
          <button
            type="button"
            onClick={() => setCategory(null)}
            aria-pressed={category === null}
            style={chip(category === null)}
          >
            All
          </button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(category === c.category ? null : c.category)}
              aria-pressed={category === c.category}
              style={chip(category === c.category)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* â”€â”€ Tag filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {recentTags.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
          <label
            style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", letterSpacing: "0.02em" }}
          >
            Tag
          </label>
          <div
            role="group"
            aria-label="Filter by tag"
            style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs, marginTop: 12 }}
          >
            <button
              type="button"
              onClick={() => setTag(null)}
              aria-pressed={tag === null}
              style={chip(tag === null)}
            >
              Any tag
            </button>
            {recentTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                aria-pressed={tag === t}
                style={chip(tag === t)}
              >
                #{t}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* â”€â”€ Merchant filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
        <label
          htmlFor="report-merchant"
          style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", letterSpacing: "0.02em" }}
        >
          Merchant or note
        </label>
        <input
          id="report-merchant"
          type="text"
          inputMode="search"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="e.g. Chipotle, coffee, textbooks"
          style={{
            width: "100%",
            marginTop: spacing.sm,
            padding: "12px 14px",
            borderRadius: borderRadius.sm,
            border: "1px solid var(--border)",
            background: "var(--fill-03)",
            color: "var(--text)",
            fontSize: typography.body.fontSize,
            fontFamily: FONT_FAMILY,
            outline: "none",
          }}
        />
      </GlassCard>

      {/* â”€â”€ Live preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
        <div
          role="status"
          aria-live="polite"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
        >
          <span style={{ fontSize: typography.body.fontSize, color: "var(--text)", fontWeight: fontWeights.semibold }}>
            {summary.count} {summary.count === 1 ? "transaction" : "transactions"}
          </span>
          <span
            style={{
              fontSize: typography.body.fontSize,
              color: "var(--sub)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {money(summary.totalExpense)} spent
          </span>
        </div>
        {summary.categoryTotals.length > 0 && (
          <div style={{ marginTop: spacing.sm }}>
            {summary.categoryTotals.slice(0, 4).map((c) => (
              <div
                key={c.category}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--sub)",
                }}
              >
                <span>
                  {c.emoji} {c.label}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* â”€â”€ Export actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.button
        onClick={handleExportPDF}
        disabled={!hasResults || isExporting}
        whileTap={prefersReducedMotion || !hasResults ? undefined : { scale: 0.97 }}
        transition={springs.snappy}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: borderRadius.full,
          background: hasResults ? "var(--accent-500)" : "var(--accent-300)",
          border: "none",
          color: "var(--text)",
          fontSize: typography.body.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: fontWeights.semibold,
          cursor: !hasResults ? "not-allowed" : isExporting ? "wait" : "pointer",
          opacity: isExporting ? 0.7 : 1,
          marginBottom: spacing.sm,
        }}
        aria-label="Download a formatted PDF report of the filtered transactions"
      >
        {isExporting ? "Building reportâ€¦" : "ðŸ“„ Download PDF report"}
      </motion.button>

      <motion.button
        onClick={handleExportCSV}
        disabled={!hasResults}
        whileTap={prefersReducedMotion || !hasResults ? undefined : { scale: 0.97 }}
        transition={springs.snappy}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: borderRadius.full,
          background: "var(--fill-04)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: typography.body.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: fontWeights.semibold,
          cursor: hasResults ? "pointer" : "not-allowed",
          opacity: hasResults ? 1 : 0.5,
        }}
        aria-label="Export the filtered transactions as a CSV spreadsheet"
      >
        â¬‡ Export filtered CSV
      </motion.button>

      <motion.button
        onClick={handleExportSummaryPDF}
        disabled={isSummaryExporting}
        whileTap={prefersReducedMotion || isSummaryExporting ? undefined : { scale: 0.97 }}
        transition={springs.snappy}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: borderRadius.full,
          background: "var(--fill-04)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: typography.body.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: fontWeights.semibold,
          cursor: isSummaryExporting ? "wait" : "pointer",
          opacity: isSummaryExporting ? 0.7 : 1,
          marginTop: spacing.sm,
        }}
        aria-label="Download a branded period summary PDF with income, spending breakdown, allowance trend, and goal progress"
      >
        {isSummaryExporting ? "Building summaryâ€¦" : "ðŸ“Š Download period summary PDF"}
      </motion.button>

      {!hasResults && (
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: spacing.sm,
            lineHeight: 1.5,
          }}
        >
          Nothing matches these filters yet â€” try widening them.
        </p>
      )}
    </div>
  )
}
