"use client"

/**
 * ActivityHeatmap — GitHub-style contribution heatmap for transaction logging.
 *
 * Two modes:
 * 1. "Activity" — brighter squares = more transactions logged that day
 * 2. "Category" — spending intensity by category rows across weeks/months
 *
 * Shows last ~6 months of data, horizontally scrollable.
 * Visual record of engagement that never decays from inactivity.
 *
 * Task 434 — Requirements: 25.3
 */

import { useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import type { Transaction, TransactionCategory } from "@/types"
import { formatDateLocal, subtractDaysLocal } from "@/lib/dateUtils"
import { FONT_FAMILY } from "@/styles/typography"
import { colorRamp, getCategoryAccent } from "@/styles/shared"
import { spacing } from "@/styles/typography"

// ============================================================================
// Types
// ============================================================================

export interface ActivityHeatmapProps {
  /** User's transactions to visualize */
  transactions: Transaction[]
  /** Number of months to show (default 6) */
  months?: number
  /** Called when user taps close / back */
  onClose?: () => void
}

type HeatmapMode = "activity" | "category"

// ============================================================================
// Constants
// ============================================================================

const CELL_SIZE = 14
const CELL_GAP = 3
const DAY_LABEL_WIDTH = 28
const MONTH_LABEL_HEIGHT = 20
const LEGEND_HEIGHT = 32

/** Activity intensity color steps (0→4) using accent ramp */
const ACTIVITY_COLORS = [
  "rgba(255, 255, 255, 0.04)", // no activity
  "rgba(129, 140, 248, 0.25)", // light
  "rgba(129, 140, 248, 0.45)", // medium-light
  "rgba(129, 140, 248, 0.7)",  // medium
  "rgba(129, 140, 248, 1.0)",  // high
] as const

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"]

const CATEGORIES_TO_SHOW: TransactionCategory[] = [
  "food", "drinks", "rent", "transport", "school",
  "fun", "health", "subscriptions", "other",
]

// ============================================================================
// Helpers
// ============================================================================

function getIntensityLevel(count: number, maxCount: number): number {
  if (count === 0) return 0
  if (maxCount <= 0) return 1
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function getCategoryIntensityColor(
  amount: number,
  maxAmount: number,
  baseColor: string
): string {
  if (amount === 0) return "rgba(255, 255, 255, 0.04)"
  if (maxAmount <= 0) return baseColor
  const ratio = Math.min(amount / maxAmount, 1)
  // Produce opacity-scaled version
  const alpha = 0.2 + ratio * 0.8
  return `color-mix(in srgb, ${baseColor} ${Math.round(alpha * 100)}%, transparent)`
}

/**
 * Build a map of date → transaction count for activity mode.
 */
function buildActivityMap(
  transactions: Transaction[],
  startDate: string
): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.date >= startDate) {
      map.set(tx.date, (map.get(tx.date) ?? 0) + 1)
    }
  }
  return map
}

/**
 * Build a map of (category, date) → total spending for category mode.
 */
function buildCategoryMap(
  transactions: Transaction[],
  startDate: string
): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.date >= startDate && tx.type === "expense") {
      const key = `${tx.category}::${tx.date}`
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount))
    }
  }
  return map
}

/**
 * Generate array of weeks (columns) from startDate to today.
 * Each week is an array of 7 date strings (Mon–Sun).
 */
function generateWeeks(startDate: Date, endDate: Date): string[][] {
  const weeks: string[][] = []
  // Align startDate to Monday
  const start = new Date(startDate)
  const dow = start.getDay()
  const offset = dow === 0 ? 6 : dow - 1
  start.setDate(start.getDate() - offset)

  let current = new Date(start)
  while (current <= endDate) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) {
      week.push(formatDateLocal(current))
      current = new Date(current)
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

/**
 * Get month labels positioned by week index.
 */
function getMonthLabels(weeks: string[][]): { label: string; weekIdx: number }[] {
  const labels: { label: string; weekIdx: number }[] = []
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  let lastMonth = -1

  for (let w = 0; w < weeks.length; w++) {
    // Use the Monday of the week to determine month
    const dateStr = weeks[w][0]
    const month = parseInt(dateStr.split("-")[1], 10) - 1
    if (month !== lastMonth) {
      labels.push({ label: MONTH_NAMES[month], weekIdx: w })
      lastMonth = month
    }
  }
  return labels
}

// ============================================================================
// Component
// ============================================================================

export function ActivityHeatmap({
  transactions,
  months = 6,
  onClose,
}: ActivityHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>("activity")
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => new Date(), [])
  const startDate = useMemo(
    () => subtractDaysLocal(today, months * 30),
    [today, months]
  )
  const startDateStr = useMemo(() => formatDateLocal(startDate), [startDate])

  const weeks = useMemo(() => generateWeeks(startDate, today), [startDate, today])
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks])
  const todayStr = useMemo(() => formatDateLocal(today), [today])

  // Activity mode data
  const activityMap = useMemo(
    () => buildActivityMap(transactions, startDateStr),
    [transactions, startDateStr]
  )
  const maxActivity = useMemo(() => {
    let max = 0
    for (const count of activityMap.values()) {
      if (count > max) max = count
    }
    return max
  }, [activityMap])

  // Category mode data
  const categoryMap = useMemo(
    () => buildCategoryMap(transactions, startDateStr),
    [transactions, startDateStr]
  )
  const maxCategorySpend = useMemo(() => {
    let max = 0
    for (const amount of categoryMap.values()) {
      if (amount > max) max = amount
    }
    return max
  }, [categoryMap])

  // Compute summary stats for accessibility
  const totalDaysActive = activityMap.size
  const totalTransactions = useMemo(
    () => Array.from(activityMap.values()).reduce((sum, c) => sum + c, 0),
    [activityMap]
  )

  // Grid dimensions
  const gridWidth = weeks.length * (CELL_SIZE + CELL_GAP)

  // ── Reduced motion check ──
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // ── Activity grid renderer ──
  const renderActivityGrid = () => (
    <div
      role="img"
      aria-label={`Activity heatmap showing ${totalDaysActive} active days with ${totalTransactions} transactions logged in the last ${months} months`}
      style={{ display: "flex", flexDirection: "row", gap: CELL_GAP }}
    >
      {weeks.map((week, wIdx) => (
        <div key={wIdx} style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}>
          {week.map((dateStr, dIdx) => {
            const count = activityMap.get(dateStr) ?? 0
            const level = getIntensityLevel(count, maxActivity)
            const isFuture = dateStr > todayStr
            const cellLabel = isFuture ? undefined : `${dateStr}: ${count} transaction${count !== 1 ? "s" : ""}`
            return (
              <div
                key={dateStr}
                title={isFuture ? "" : cellLabel}
                aria-label={cellLabel}
                aria-hidden={isFuture ? true : undefined}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 3,
                  background: isFuture ? "transparent" : ACTIVITY_COLORS[level],
                  opacity: isFuture ? 0 : 1,
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )

  // ── Category grid renderer ──
  const renderCategoryGrid = () => (
    <div
      role="img"
      aria-label={`Category spending heatmap showing spending intensity by category over the last ${months} months`}
      style={{ display: "flex", flexDirection: "column", gap: CELL_GAP + 2 }}
    >
      {CATEGORIES_TO_SHOW.map((category) => {
        const baseColor = getCategoryAccent(category)
        return (
          <div key={category} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: CELL_GAP }}>
            <span
              style={{
                width: 64,
                fontSize: 10,
                fontFamily: FONT_FAMILY,
                color: "var(--sub)",
                textTransform: "capitalize",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {category}
            </span>
            <div style={{ display: "flex", flexDirection: "row", gap: CELL_GAP }}>
              {weeks.map((week, wIdx) => {
                // Aggregate the week for this category
                let weekTotal = 0
                for (const dateStr of week) {
                  weekTotal += categoryMap.get(`${category}::${dateStr}`) ?? 0
                }
                const isFuture = week[0] > todayStr
                const cellLabel = isFuture ? undefined : `${category} week of ${week[0]}: $${weekTotal.toFixed(0)}`
                return (
                  <div
                    key={wIdx}
                    title={isFuture ? "" : cellLabel}
                    aria-label={cellLabel}
                    aria-hidden={isFuture ? true : undefined}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: 3,
                      background: isFuture
                        ? "transparent"
                        : weekTotal > 0
                          ? getCategoryIntensityColor(weekTotal, maxCategorySpend, baseColor)
                          : "rgba(255, 255, 255, 0.04)",
                      opacity: isFuture ? 0 : 1,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Toggle button styles ──
  const toggleBtnBase: CSSProperties = {
    border: "none",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    fontWeight: 500,
    cursor: "pointer",
    transition: prefersReducedMotion ? "none" : "background 0.15s, color 0.15s",
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
      }}
    >
      {/* ── Header with mode toggle ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text)",
            margin: 0,
          }}
        >
          Activity Heatmap
        </h3>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: 10,
            padding: 3,
          }}
          role="tablist"
          aria-label="Heatmap mode"
        >
          <button
            role="tab"
            aria-selected={mode === "activity"}
            onClick={() => setMode("activity")}
            style={{
              ...toggleBtnBase,
              background: mode === "activity" ? colorRamp.accent[100] : "transparent",
              color: mode === "activity" ? "var(--text)" : "var(--sub)",
            }}
          >
            Activity
          </button>
          <button
            role="tab"
            aria-selected={mode === "category"}
            onClick={() => setMode("category")}
            style={{
              ...toggleBtnBase,
              background: mode === "category" ? colorRamp.accent[100] : "transparent",
              color: mode === "category" ? "var(--text)" : "var(--sub)",
            }}
          >
            Category
          </button>
        </div>
      </div>

      {/* ── Scrollable heatmap area ── */}
      <div
        ref={scrollRef}
        role="region"
        aria-label="Scrollable heatmap"
        tabIndex={0}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 4,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {mode === "activity" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Month labels */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                paddingLeft: DAY_LABEL_WIDTH,
                gap: CELL_GAP,
                height: MONTH_LABEL_HEIGHT,
                alignItems: "flex-end",
              }}
              aria-hidden
            >
              {monthLabels.map(({ label, weekIdx }) => (
                <span
                  key={`${label}-${weekIdx}`}
                  style={{
                    position: "absolute" as const,
                    left: DAY_LABEL_WIDTH + weekIdx * (CELL_SIZE + CELL_GAP),
                    fontSize: 10,
                    fontFamily: FONT_FAMILY,
                    color: "var(--sub)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Heatmap with day labels */}
            <div style={{ display: "flex", flexDirection: "row" }}>
              {/* Day-of-week labels */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: CELL_GAP,
                  width: DAY_LABEL_WIDTH,
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {DAY_LABELS.map((label, idx) => (
                  <span
                    key={idx}
                    style={{
                      height: CELL_SIZE,
                      fontSize: 10,
                      fontFamily: FONT_FAMILY,
                      color: "var(--sub)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Grid */}
              {renderActivityGrid()}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Month labels for category mode */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                paddingLeft: 64 + CELL_GAP,
                gap: CELL_GAP,
                height: MONTH_LABEL_HEIGHT,
                alignItems: "flex-end",
                position: "relative",
              }}
              aria-hidden
            >
              {monthLabels.map(({ label, weekIdx }) => (
                <span
                  key={`${label}-${weekIdx}`}
                  style={{
                    position: "absolute",
                    left: 64 + CELL_GAP + weekIdx * (CELL_SIZE + CELL_GAP),
                    fontSize: 10,
                    fontFamily: FONT_FAMILY,
                    color: "var(--sub)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Category rows */}
            {renderCategoryGrid()}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingTop: 4,
        }}
        aria-hidden
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
          }}
        >
          Less
        </span>
        {(mode === "activity" ? ACTIVITY_COLORS : []).map((color, idx) => (
          <div
            key={idx}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: color,
            }}
          />
        ))}
        {mode === "category" && (
          <>
            {[0.04, 0.25, 0.5, 0.75, 1.0].map((alpha, idx) => (
              <div
                key={idx}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background:
                    idx === 0
                      ? "rgba(255, 255, 255, 0.04)"
                      : `rgba(129, 140, 248, ${alpha})`,
                }}
              />
            ))}
          </>
        )}
        <span
          style={{
            fontSize: 10,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
          }}
        >
          More
        </span>
      </div>

      {/* ── Screen reader summary ── */}
      <div className="sr-only" aria-live="polite">
        {mode === "activity"
          ? `Activity heatmap: ${totalDaysActive} days with transactions, ${totalTransactions} total entries in the last ${months} months.`
          : `Category spending heatmap: showing spending intensity for ${CATEGORIES_TO_SHOW.length} categories over ${weeks.length} weeks.`}
      </div>
    </div>
  )
}
