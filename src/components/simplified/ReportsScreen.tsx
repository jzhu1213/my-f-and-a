"use client"

/**
 * ReportsScreen — filtered, exportable spending reports (Task 185.1)
 *
 * Builds on the CSV export (Phase 2 task 116.1) with a formatted PDF report and
 * filters by tag, merchant, or category (reusing the tag + search infrastructure
 * from Phase 3 task 129.x). Lives behind Settings → Data via progressive
 * disclosure — never on the home screen.
 *
 * Guardrails:
 *   • Warm, shame-free copy ("where it went", never "you overspent").
 *   • Soft purple theme; prefers-reduced-motion honored.
 *   • Accessible: labelled controls, keyboard-operable chips, live status.
 *   • Free — no paywall, no bank linking.
 */

import { useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  borderRadius,
} from "@/styles/shared"
import { TRANSACTION_CATEGORIES } from "@/types"
import type { Transaction, TransactionCategory } from "@/types"
import { getRecentTags } from "@/lib/tagUtils"
import {
  buildReportSummary,
  exportReportPDF,
  type ReportFilters,
} from "@/lib/reportUtils"
import { exportTransactionsCSV } from "@/lib/accountUtils"

// ============================================================================
// Types
// ============================================================================

export interface ReportsScreenProps {
  transactions: Transaction[]
  onBack: () => void
  /** Optional toast surface for success/error feedback. */
  onNotify?: (message: string, kind?: "success" | "error") => void
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

export function ReportsScreen({ transactions, onBack, onNotify }: ReportsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [merchant, setMerchant] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const filters: ReportFilters = useMemo(
    () => ({ category, tag, merchant: merchant.trim() || null }),
    [category, tag, merchant]
  )

  const summary = useMemo(
    () => buildReportSummary(transactions, filters),
    [transactions, filters]
  )

  const recentTags = useMemo(() => getRecentTags(transactions, 10), [transactions])

  const hasResults = summary.count > 0

  const handleExportPDF = useCallback(async () => {
    if (!hasResults || isExporting) return
    setIsExporting(true)
    try {
      const count = await exportReportPDF(transactions, filters)
      onNotify?.(
        `Report ready — ${count} ${count === 1 ? "transaction" : "transactions"} 📄`,
        "success"
      )
    } catch {
      onNotify?.("Couldn't build the report just now. Try again in a moment.", "error")
    } finally {
      setIsExporting(false)
    }
  }, [hasResults, isExporting, transactions, filters, onNotify])

  const handleExportCSV = useCallback(() => {
    if (!hasResults) return
    try {
      exportTransactionsCSV(summary.transactions)
      onNotify?.("Filtered transactions exported (CSV)", "success")
    } catch {
      onNotify?.("Couldn't export the CSV just now. Try again in a moment.", "error")
    }
  }, [hasResults, summary.transactions, onNotify])

  const containerStyle = {
    maxWidth: CONTENT_MAX_WIDTH,
    margin: "0 auto",
    padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
    fontFamily: FONT_FAMILY,
  } as const

  // ── Reusable chip styling ────────────────────────────────────────────────
  const chip = (active: boolean) =>
    ({
      padding: "8px 14px",
      borderRadius: borderRadius.full,
      border: active ? "1.5px solid rgba(129, 140, 248, 0.9)" : "1px solid var(--border)",
      background: active ? "rgba(129, 140, 248, 0.18)" : "rgba(255,255,255,0.03)",
      color: active ? "var(--text)" : "var(--sub)",
      fontSize: 13,
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
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 16,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        Reports
      </h2>
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        Filter your history, then save a tidy PDF or spreadsheet — just for you.
      </p>

      {/* ── Category filter ──────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <label
          style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.02em" }}
        >
          Category
        </label>
        <div
          role="group"
          aria-label="Filter by category"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
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

      {/* ── Tag filter ───────────────────────────────────────────────────── */}
      {recentTags.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <label
            style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.02em" }}
          >
            Tag
          </label>
          <div
            role="group"
            aria-label="Filter by tag"
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
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

      {/* ── Merchant filter ──────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <label
          htmlFor="report-merchant"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.02em" }}
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
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: borderRadius.sm,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text)",
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            outline: "none",
          }}
        />
      </GlassCard>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div
          role="status"
          aria-live="polite"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
        >
          <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
            {summary.count} {summary.count === 1 ? "transaction" : "transactions"}
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--sub)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {money(summary.totalExpense)} spent
          </span>
        </div>
        {summary.categoryTotals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {summary.categoryTotals.slice(0, 4).map((c) => (
              <div
                key={c.category}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  fontSize: 13,
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

      {/* ── Export actions ───────────────────────────────────────────────── */}
      <motion.button
        onClick={handleExportPDF}
        disabled={!hasResults || isExporting}
        whileTap={prefersReducedMotion || !hasResults ? undefined : { scale: 0.97 }}
        transition={springs.snappy}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: borderRadius.full,
          background: hasResults ? "rgba(129, 140, 248, 0.85)" : "rgba(129, 140, 248, 0.25)",
          border: "none",
          color: "var(--text)",
          fontSize: 14,
          fontFamily: FONT_FAMILY,
          fontWeight: 600,
          cursor: !hasResults ? "not-allowed" : isExporting ? "wait" : "pointer",
          opacity: isExporting ? 0.7 : 1,
          marginBottom: 12,
        }}
        aria-label="Download a formatted PDF report of the filtered transactions"
      >
        {isExporting ? "Building report…" : "📄 Download PDF report"}
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
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: 14,
          fontFamily: FONT_FAMILY,
          fontWeight: 600,
          cursor: hasResults ? "pointer" : "not-allowed",
          opacity: hasResults ? 1 : 0.5,
        }}
        aria-label="Export the filtered transactions as a CSV spreadsheet"
      >
        ⬇ Export filtered CSV
      </motion.button>

      {!hasResults && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Nothing matches these filters yet — try widening them.
        </p>
      )}
    </div>
  )
}
