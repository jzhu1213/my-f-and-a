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
import { generateCashFlowForecast, validateForecastIncome } from "@/lib/cashFlowForecast"
import type { ForecastInput, ForecastDay } from "@/lib/cashFlowForecast"
import type { Transaction } from "@/types"
import type { PaySchedule } from "@/lib/paySchedule"
import type { FixedExpense } from "@/lib/fixedExpenses"
import type { SinkingFund } from "@/lib/sinkingFunds"
import type { Disbursement } from "@/lib/disbursements"

// ============================================================================
// Types
// ============================================================================

export interface CashFlowForecastScreenProps {
  /** Current discretionary balance (from allowance or account total) */
  currentBalance: number
  /** User's pay schedule (null = not configured) */
  paySchedule: PaySchedule | null
  /** Active recurring bills */
  bills: FixedExpense[]
  /** Sinking funds */
  sinkingFunds: SinkingFund[]
  /** All transactions (used for scheduled items + income history) */
  transactions: Transaction[]
  /** Active aid/lump-sum disbursements (for irregular/aid income validation) */
  disbursements?: Disbursement[]
  /** Close/back handler */
  onBack: () => void
}

// ============================================================================
// Chart constants
// ============================================================================

const CHART_HEIGHT = 160
const CHART_PADDING_TOP = 20
const CHART_PADDING_BOTTOM = 24

// ============================================================================
// Component
// ============================================================================

/**
 * CashFlowForecastScreen — "Your money through [date]"
 *
 * A full-screen overlay showing a forward-looking projected balance curve.
 * Warm, encouraging framing — helps users see their near-future cash position
 * without shame or anxiety.
 */
export function CashFlowForecastScreen({
  currentBalance,
  paySchedule,
  bills,
  sinkingFunds,
  transactions,
  disbursements,
  onBack,
}: CashFlowForecastScreenProps) {
  // Derive scheduled transactions and income history from transactions
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const scheduledTransactions = useMemo(
    () => transactions.filter((t) => t.date > today && t.type === "expense"),
    [transactions, today]
  )

  const incomeHistory = useMemo(
    () => transactions.filter((t) => t.type === "income"),
    [transactions]
  )

  // Generate the forecast
  const forecast = useMemo(() => {
    const input: ForecastInput = {
      currentBalance,
      paySchedule,
      bills,
      sinkingFunds,
      scheduledTransactions,
      incomeHistory,
    }
    return generateCashFlowForecast(input)
  }, [currentBalance, paySchedule, bills, sinkingFunds, scheduledTransactions, incomeHistory])

  // Validate irregular / aid-based income against the forecast (task 154.1).
  // Only surface a note when the income assumptions aren't fully reliable.
  const incomeValidation = useMemo(
    () =>
      validateForecastIncome({
        paySchedule,
        incomeHistory,
        disbursements,
      }),
    [paySchedule, incomeHistory, disbursements]
  )

  // SVG chart path
  const chartPath = useMemo(() => {
    if (forecast.days.length < 2) return ""

    const balances = forecast.days.map((d) => d.projectedBalance)
    const maxBal = Math.max(...balances, 1)
    const minBal = Math.min(...balances, 0)
    const range = maxBal - minBal || 1

    const width = 100 // percentage-based viewBox width
    const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

    const points = forecast.days.map((_, i) => {
      const x = (i / (forecast.days.length - 1)) * width
      const y =
        CHART_PADDING_TOP +
        usableHeight -
        ((balances[i] - minBal) / range) * usableHeight
      return { x, y }
    })

    // Build SVG path
    const pathParts = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    return pathParts.join(" ")
  }, [forecast.days])

  // Area fill path (path + close at bottom)
  const areaPath = useMemo(() => {
    if (!chartPath || forecast.days.length < 2) return ""
    const width = 100
    return `${chartPath} L ${width} ${CHART_HEIGHT - CHART_PADDING_BOTTOM} L 0 ${CHART_HEIGHT - CHART_PADDING_BOTTOM} Z`
  }, [chartPath, forecast.days.length])

  // Key events for the timeline
  const keyEvents = useMemo(() => {
    return forecast.days
      .filter((d) => d.events.length > 0)
      .flatMap((d) =>
        d.events
          .filter((e) => e.type !== "sinking-reserve")
          .map((e) => ({
            date: d.date,
            ...e,
          }))
      )
      .slice(0, 8) // Limit to 8 events to avoid clutter
  }, [forecast.days])

  // Summary message
  const summaryMessage = useMemo(() => {
    if (forecast.summary.willGoNegative) {
      return "Heads up — your balance might dip below zero. Consider adjusting upcoming spending."
    }
    if (forecast.summary.lowestBalance < 50) {
      return `You'll get a bit tight (down to $${Math.round(forecast.summary.lowestBalance)}) — keep an eye on bigger purchases.`
    }
    return `You'll stay above $${Math.round(forecast.summary.lowestBalance)} — looking good!`
  }, [forecast.summary])

  const summaryColor = forecast.summary.willGoNegative
    ? "var(--error)"
    : forecast.summary.lowestBalance < 50
    ? "var(--warning, #f5a623)"
    : "var(--success)"

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

      {/* ── Title ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ marginBottom: 20 }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Your money through {forecast.summary.endDateLabel}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: summaryColor,
            lineHeight: 1.5,
          }}
        >
          {summaryMessage}
        </p>
      </motion.div>

      {/* ── Income confidence note (irregular / aid income) ────────── */}
      {incomeValidation.confidence !== "high" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.05 }}
          style={{ marginBottom: 16 }}
        >
          <GlassCard elevation="low" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }} aria-hidden="true">
                {incomeValidation.hasAidIncome ? "🎓" : "📊"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--sub)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}
                >
                  {incomeValidation.confidence === "low"
                    ? "Income not projected"
                    : "Estimated income"}
                </p>
                <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                  {incomeValidation.note}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Balance Chart ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.1 }}
      >
        <GlassCard elevation="low" style={{ padding: "20px 16px", marginBottom: 16 }}>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--sub)" }}>Today</span>
            <span style={{ fontSize: 12, color: "var(--sub)" }}>{forecast.summary.endDateLabel}</span>
          </div>

          {forecast.days.length >= 2 ? (
            <svg
              viewBox={`0 0 100 ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              style={{ width: "100%", height: CHART_HEIGHT, display: "block" }}
              aria-label={`Balance projection chart from $${Math.round(currentBalance)} today to $${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0)} on ${forecast.summary.endDateLabel}`}
              role="img"
            >
              {/* Area fill */}
              <path
                d={areaPath}
                fill="rgba(139, 92, 246, 0.12)"
                stroke="none"
              />
              {/* Line */}
              <path
                d={chartPath}
                fill="none"
                stroke="rgba(139, 92, 246, 0.8)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {/* Zero line if balance dips negative */}
              {forecast.summary.willGoNegative && (
                <ZeroLine days={forecast.days} chartHeight={CHART_HEIGHT} />
              )}
            </svg>
          ) : (
            <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 13, color: "var(--sub)" }}>Not enough data to chart</p>
            </div>
          )}

          {/* Start/end balance labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              ${Math.round(currentBalance).toLocaleString("en-US")}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: forecast.days.length > 0
                  ? forecast.days[forecast.days.length - 1].projectedBalance < 0
                    ? "var(--error)"
                    : "var(--text)"
                  : "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0).toLocaleString("en-US")}
            </span>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Key Events Timeline ────────────────────────────────────── */}
      {keyEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
        >
          <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
              Upcoming events
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {keyEvents.map((event, i) => (
                <div
                  key={`${event.date}-${event.label}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
                    {event.type === "income" ? "💰" : event.type === "bill" ? "📅" : "📝"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {event.label}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--sub)" }}>
                      {formatEventDate(event.date)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: event.amount >= 0 ? "var(--success)" : "var(--text)",
                      flexShrink: 0,
                    }}
                  >
                    {event.amount >= 0 ? "+" : "\u2212"}${Math.abs(Math.round(event.amount)).toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

/** Renders a dashed zero line on the chart when balance goes negative. */
function ZeroLine({ days, chartHeight }: { days: ForecastDay[]; chartHeight: number }) {
  const balances = days.map((d) => d.projectedBalance)
  const maxBal = Math.max(...balances, 1)
  const minBal = Math.min(...balances, 0)
  const range = maxBal - minBal || 1
  const usableHeight = chartHeight - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

  const zeroY = CHART_PADDING_TOP + usableHeight - ((0 - minBal) / range) * usableHeight

  return (
    <line
      x1={0}
      y1={zeroY}
      x2={100}
      y2={zeroY}
      stroke="rgba(239, 68, 68, 0.4)"
      strokeWidth="0.8"
      strokeDasharray="3 2"
      vectorEffect="non-scaling-stroke"
    />
  )
}

/** Format a YYYY-MM-DD date to a friendly short label. */
function formatEventDate(isoDate: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const parts = isoDate.split("-").map(Number)
  return `${months[parts[1] - 1]} ${parts[2]}`
}
