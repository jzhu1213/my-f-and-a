"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { ChartFrame } from "@/components/ui/primitives/ChartFrame"
import { Icon } from "@/components/ui/Icon"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import {
  chartColors,
  chartDimensions,
  chartStrokes,
  chartLabel,
  chartValueLabel,
  CHART_GRADIENT_PREFIX,
  chartSeriesStyles,
} from "@/styles/chartTokens"
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

const CHART_HEIGHT = chartDimensions.height
const CHART_PADDING_TOP = chartDimensions.paddingTop
const CHART_PADDING_BOTTOM = chartDimensions.paddingBottom

// ============================================================================
// Component
// ============================================================================

/**
 * CashFlowForecastScreen â€” "Your money through [date]"
 *
 * A full-screen overlay showing a forward-looking projected balance curve.
 * Warm, encouraging framing â€” helps users see their near-future cash position
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
      return "Heads up â€” your balance might dip below zero. Consider adjusting upcoming spending."
    }
    if (forecast.summary.lowestBalance < 50) {
      return `You'll get a bit tight (down to $${Math.round(forecast.summary.lowestBalance)}) â€” keep an eye on bigger purchases.`
    }
    return `You'll stay above $${Math.round(forecast.summary.lowestBalance)} â€” looking good!`
  }, [forecast.summary])

  const summaryColor = forecast.summary.willGoNegative
    ? "var(--error)"
    : forecast.summary.lowestBalance < 50
    ? "var(--warning)"
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
      {/* â”€â”€ Back button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: typography.body.fontSize,
          cursor: "pointer",
          marginBottom: HORIZONTAL_PADDING,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        â† Back
      </button>

      {/* â”€â”€ Title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ marginBottom: HORIZONTAL_PADDING }}
      >
        <h1
          style={{
            fontSize: typography.headline.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Your money through {forecast.summary.endDateLabel}
        </h1>
        <p
          style={{
            fontSize: typography.body.fontSize,
            color: summaryColor,
            lineHeight: 1.5,
          }}
        >
          {summaryMessage}
        </p>
      </motion.div>

      {/* â”€â”€ Income confidence note (irregular / aid income) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {incomeValidation.confidence !== "high" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.05 }}
          style={{ marginBottom: spacing.md }}
        >
          <GlassCard elevation="low" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
              <span style={{ lineHeight: 1.3, flexShrink: 0, display: "inline-flex", opacity: 0.8 }} aria-hidden="true">
                <Icon name={incomeValidation.hasAidIncome ? "category:school" : "status:tracking"} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.semibold,
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
                <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--text)", lineHeight: 1.5 }}>
                  {incomeValidation.note}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* â”€â”€ Balance Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.1 }}
      >
        {/* Screen reader text summary for the chart */}
        <span id="cashflow-chart-summary" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
          {`Cash flow forecast: starting at $${Math.round(currentBalance)}, ending at $${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0)} by ${forecast.summary.endDateLabel}. ${forecast.summary.willGoNegative ? 'Balance is projected to go negative during this period.' : `Lowest projected balance: $${Math.round(forecast.summary.lowestBalance)}.`}`}
        </span>
        <ChartFrame
          type="line"
          state={forecast.days.length >= 2 ? "loaded" : "error"}
          height={CHART_HEIGHT + 60}
          errorMessage="Not enough data to chart"
          aria-label={`Balance projection chart from $${Math.round(currentBalance)} today to $${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0)} on ${forecast.summary.endDateLabel}`}
          aria-describedby="cashflow-chart-summary"
        >
          <div style={{ padding: "20px 16px" }}>
            <div style={{ marginBottom: spacing.xs, display: "flex", justifyContent: "space-between" }}>
              <span style={chartLabel}>Today</span>
              <span style={chartLabel}>{forecast.summary.endDateLabel}</span>
            </div>

            <svg
              viewBox={`0 0 100 ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              style={{ width: "100%", height: CHART_HEIGHT, display: "block" }}
              role="img"
              aria-label={`Balance projection from $${Math.round(currentBalance)} to $${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0)}`}
            >
              {/* Gradient fill */}
              <defs>
                <linearGradient id={`${CHART_GRADIENT_PREFIX}-cashflow`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.secondary} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={chartColors.secondary} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              <path
                d={areaPath}
                fill={`url(#${CHART_GRADIENT_PREFIX}-cashflow)`}
                stroke="none"
              />
              {/* Line â€” uses dashed pattern for CVD differentiation (secondary series) */}
              <path
                d={chartPath}
                fill="none"
                stroke={chartColors.secondary}
                strokeWidth={chartStrokes.lineWidthLight}
                strokeDasharray={chartSeriesStyles.secondary.dashPattern}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
              {/* Zero line if balance dips negative */}
              {forecast.summary.willGoNegative && (
                <ZeroLine days={forecast.days} chartHeight={CHART_HEIGHT} />
              )}
            </svg>

            {/* Start/end balance labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: spacing.xs }}>
              <span style={{ ...chartValueLabel, fontWeight: fontWeights.semibold, color: "var(--text)" }}>
                ${Math.round(currentBalance).toLocaleString("en-US")}
              </span>
              <span
                style={{
                  ...chartValueLabel,
                  fontWeight: fontWeights.semibold,
                  color: forecast.days.length > 0
                    ? forecast.days[forecast.days.length - 1].projectedBalance < 0
                      ? "var(--error)"
                      : "var(--text)"
                    : "var(--text)",
                }}
              >
                ${Math.round(forecast.days[forecast.days.length - 1]?.projectedBalance ?? 0).toLocaleString("en-US")}
              </span>
            </div>
          </div>
        </ChartFrame>
      </motion.div>

      {/* â”€â”€ Key Events Timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {keyEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
        >
          <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--text)", marginBottom: spacing.sm }}>
              Upcoming events
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {keyEvents.map((event, i) => (
                <div
                  key={`${event.date}-${event.label}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: spacing.sm }}
                >
                  <span style={{ flexShrink: 0, display: "inline-flex", opacity: 0.8 }} aria-hidden="true">
                    <Icon name={event.type === "income" ? "category:income" : event.type === "bill" ? "breakdown:scheduled" : "action:edit"} size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {event.label}
                    </p>
                    <p style={{ fontSize: typography.caption.fontSize, color: "var(--sub)" }}>
                      {formatEventDate(event.date)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.semibold,
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
      stroke={chartColors.danger}
      strokeWidth={chartStrokes.dangerWidth}
      strokeDasharray={chartStrokes.dashPattern}
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
