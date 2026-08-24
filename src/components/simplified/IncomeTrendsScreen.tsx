"use client"

/**
 * IncomeTrendsScreen — Income over-time visualization & growth metrics.
 *
 * Shows a compact bar chart of monthly income totals (last 6 months) and
 * surfaces positive/neutral growth metrics below. Current month is highlighted
 * with a dashed outline showing projected vs actual.
 *
 * Warm empty state when insufficient income data. Respects reduced motion.
 *
 * Phase 11 — task 355
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { ChartFrame } from "@/components/ui/primitives/ChartFrame"
import { GlassCard } from "@/components/ui/GlassCard"
import { SectionHeader, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { contentColumn, spacingScale } from "@/styles/layout"
import { typography, FONT_FAMILY, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import {
  chartColors,
  chartDimensions,
  chartStrokes,
  chartLabel,
  chartValueLabel,
  chartEntranceMotion,
  CHART_GRADIENT_PREFIX,
} from "@/styles/chartTokens"
import { computeMonthlyIncomeTotals, computeIncomeGrowthMetrics } from "@/lib/incomeTrends"
import { formatCurrency } from "@/lib/currencyUtils"
import type { MonthlyIncomeTotal } from "@/lib/incomeTrends"
import type { Transaction } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface IncomeTrendsScreenProps {
  transactions: Transaction[]
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Format a YYYY-MM string to a short label like "Jan", "Feb" */
function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "short" })
}

/** Format a dollar amount concisely */
function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`
  }
  return formatCurrency(Math.round(amount), 'USD', { fractionDigits: 0 })
}

/** Format a YYYY-MM string to a readable month+year */
function formatMonthFull(month: string): string {
  const [y, m] = month.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

// ============================================================================
// Chart Component
// ============================================================================

function IncomeBarChart({
  data,
  currentMonth,
}: {
  data: MonthlyIncomeTotal[]
  currentMonth: string
}) {
  const { prefersReducedMotion } = useReducedMotion()

  const maxTotal = Math.max(...data.map((d) => d.total), 1)

  // SVG viewBox: 100 wide x 140 tall
  const viewBoxWidth = 100
  const viewBoxHeight = 140
  const barAreaTop = 16
  const barAreaBottom = 120
  const barAreaHeight = barAreaBottom - barAreaTop
  const barCount = data.length
  const gap = 2
  const totalGaps = (barCount - 1) * gap
  const barWidth = (viewBoxWidth - 12 - totalGaps) / barCount // 6px padding on each side
  const startX = 6

  const gradientId = `${CHART_GRADIENT_PREFIX}-income-trends`

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Monthly income bar chart"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartColors.primaryGradientFrom} />
          <stop offset="100%" stopColor={chartColors.primaryGradientTo} />
        </linearGradient>
      </defs>

      {data.map((d, i) => {
        const x = startX + i * (barWidth + gap)
        const heightPct = maxTotal > 0 ? d.total / maxTotal : 0
        const barH = Math.max(heightPct * barAreaHeight, 1)
        const y = barAreaBottom - barH
        const isCurrent = d.month === currentMonth
        const barFill = isCurrent ? `url(#${gradientId})` : chartColors.primaryFill

        return (
          <g key={d.month}>
            {/* Bar */}
            <motion.rect
              x={x}
              width={barWidth}
              rx={1.5}
              fill={barFill}
              stroke={isCurrent ? chartColors.primary : "none"}
              strokeWidth={isCurrent ? 0.6 : 0}
              strokeDasharray={isCurrent ? chartStrokes.dashPattern : undefined}
              initial={
                prefersReducedMotion
                  ? { y, height: barH, opacity: 1 }
                  : { y: barAreaBottom, height: 0, opacity: 0 }
              }
              animate={{ y, height: barH, opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: chartEntranceMotion.duration,
                      ease: chartEntranceMotion.ease,
                      delay: i * 0.05,
                    }
              }
            />
            {/* Value label above bar */}
            {d.total > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 3}
                textAnchor="middle"
                style={{
                  ...chartValueLabel,
                  fontSize: 5.5,
                  fill: isCurrent ? chartColors.primary : (chartValueLabel.color as string),
                }}
              >
                {formatAmount(d.total)}
              </text>
            )}
            {/* Month label below */}
            <text
              x={x + barWidth / 2}
              y={barAreaBottom + 10}
              textAnchor="middle"
              style={{
                ...chartLabel,
                fontSize: 5,
                fill: isCurrent ? chartColors.primary : (chartLabel.color as string),
                fontWeight: isCurrent ? 600 : 500,
              }}
            >
              {formatMonthLabel(d.month)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================================
// Metric Card
// ============================================================================

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card
      style={{
        padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
        flex: 1,
        minWidth: 130,
      }}
    >
      <p
        style={{
          ...typography.caption,
          color: textColors.muted,
          marginBottom: spacingScale["2"],
        }}
      >
        {label}
      </p>
      <p
        style={{
          ...typography.subhead,
          color: accent ? colorRamp.success[500] : textColors.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </Card>
  )
}

// ============================================================================
// Main Screen
// ============================================================================

export function IncomeTrendsScreen({ transactions, onBack }: IncomeTrendsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const now = useMemo(() => new Date(), [])

  const monthlyTotals = useMemo(
    () => computeMonthlyIncomeTotals(transactions, 6, now),
    [transactions, now]
  )

  const metrics = useMemo(
    () => computeIncomeGrowthMetrics(monthlyTotals, now),
    [monthlyTotals, now]
  )

  const currentMonth = useMemo(() => {
    const d = now
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [now])

  const hasIncomeData = monthlyTotals.some((m) => m.total > 0)

  // Determine chart state
  const chartState = hasIncomeData ? "loaded" : "loaded"

  return (
    <div style={{ ...contentColumn, paddingTop: spacingScale["16"] }}>
      {/* ── Back button ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacingScale["4"],
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: `${spacingScale["8"]} 0`,
          marginBottom: spacingScale["16"],
          color: textColors.sub,
          fontFamily: FONT_FAMILY,
          fontSize: typography["body-sm"].fontSize,
          fontWeight: fontWeights.medium,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {/* ── Header ──────────────────────────────────────────────── */}
      <SectionHeader>Income Trends</SectionHeader>
      <p
        style={{
          ...typography["body-sm"],
          color: textColors.sub,
          marginBottom: spacingScale["24"],
        }}
      >
        Your income over time — watch yourself earn more.
      </p>

      {/* ── Chart ───────────────────────────────────────────────── */}
      {!hasIncomeData ? (
        <GlassCard>
          <div
            style={{
              padding: spacingScale["32"],
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacingScale["12"],
            }}
          >
            <Icon name="category:income" size={32} />
            <p style={{ ...typography.body, color: textColors.sub }}>
              No income logged yet
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.muted }}>
              Once you start logging income, you'll see your trends here.
            </p>
          </div>
        </GlassCard>
      ) : (
        <ChartFrame
          type="bar"
          state={chartState}
          height={chartDimensions.height + 40}
          aria-label="Income trends bar chart"
        >
          <div style={{ padding: `${spacingScale["12"]} ${spacingScale["8"]}` }}>
            <IncomeBarChart data={monthlyTotals} currentMonth={currentMonth} />
          </div>
        </ChartFrame>
      )}

      {/* ── Growth Metrics ──────────────────────────────────────── */}
      {hasIncomeData && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: chartEntranceMotion.ease, delay: 0.2 }
          }
          style={{ marginTop: spacingScale["24"] }}
        >
          <p
            style={{
              ...typography.caption,
              color: textColors.muted,
              marginBottom: spacingScale["12"],
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Highlights
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacingScale["12"],
            }}
          >
            {/* Current month pace */}
            {metrics.currentMonthPace > 0 && (
              <MetricCard
                label="This month so far"
                value={formatAmount(metrics.currentMonthPace)}
                accent
              />
            )}

            {/* Projection */}
            {metrics.currentMonthProjection > 0 && metrics.currentMonthPace > 0 && (
              <MetricCard
                label="Month projection"
                value={formatAmount(metrics.currentMonthProjection)}
              />
            )}

            {/* MoM change — only show if positive or zero */}
            {metrics.monthOverMonthChange !== null && metrics.monthOverMonthChange >= 0 && (
              <MetricCard
                label="vs. last month"
                value={`+${metrics.monthOverMonthChange.toFixed(1)}%`}
                accent
              />
            )}

            {/* Average monthly */}
            {metrics.averageMonthly > 0 && (
              <MetricCard
                label="Monthly average"
                value={formatAmount(metrics.averageMonthly)}
              />
            )}

            {/* Best month */}
            {metrics.bestMonth && (
              <MetricCard
                label="Best month"
                value={`${formatAmount(metrics.bestMonth.total)} · ${formatMonthLabel(metrics.bestMonth.month)}`}
              />
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
