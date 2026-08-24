"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { colorRamp } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { timings, springs, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import type { StreakData } from "@/lib/streaks"
import { formatDateLocal, subtractDaysLocal } from "@/lib/dateUtils"

// ============================================================================
// Types
// ============================================================================

interface StreakDetailViewProps {
  streakData: StreakData
  transactions: { date: string }[]
  isOpen: boolean
  onClose: () => void
  /** Task 485.1: Callback to mark today as a $0 day */
  onMarkZeroSpend?: () => void
  /** Task 485.1: Whether the $0 day button should be enabled */
  canMarkZeroSpend?: boolean
  /** Task 485.2: Grace day message (moved from home screen) */
  graceDayMessage?: string | null
}

// ============================================================================
// Helpers
// ============================================================================

type DayStatus = "active" | "missed" | "grace" | "future"

interface CalendarDay {
  date: string
  dayOfMonth: number
  status: DayStatus
}

function buildLast30Days(
  streakData: StreakData,
  transactions: { date: string }[],
  today: Date
): CalendarDay[] {
  const todayStr = formatDateLocal(today)
  const txDates = new Set(transactions.map(t => t.date))
  const zeroSpendSet = new Set(streakData.zeroSpendDays)

  const days: CalendarDay[] = []

  for (let i = 29; i >= 0; i--) {
    const d = subtractDaysLocal(today, i)
    const dateStr = formatDateLocal(d)
    const dayOfMonth = d.getDate()

    let status: DayStatus
    if (dateStr > todayStr) {
      status = "future"
    } else if (txDates.has(dateStr) || zeroSpendSet.has(dateStr)) {
      status = "active"
    } else {
      // Check if this missed day was covered by a grace day
      // Simple heuristic: if streak is still running and this day is within the streak window
      // we'll mark it as grace. For display purposes, we check if it's a gap inside the streak.
      status = "missed"
    }

    days.push({ date: dateStr, dayOfMonth, status })
  }

  // Mark grace days: walk backwards from today, any missed day within the active streak is grace
  if (streakData.currentStreak > 0) {
    let streakCount = 0
    for (let i = days.length - 1; i >= 0 && streakCount < streakData.currentStreak; i--) {
      const day = days[i]
      if (day.status === "active") {
        streakCount++
      } else if (day.status === "missed") {
        // This missed day is inside the streak — must be a grace day
        day.status = "grace"
        streakCount++
      }
    }
  }

  return days
}

// ============================================================================
// CalendarHeatmap sub-component
// ============================================================================

function CalendarHeatmap({ days, streakData }: { days: CalendarDay[]; streakData: StreakData }) {
  const activeDays = days.filter(d => d.status === "active").length
  const graceDays = days.filter(d => d.status === "grace").length

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 4,
        width: "100%",
      }}
      aria-label={`Last 30 days: ${activeDays} active days, ${graceDays} grace days used, current streak ${streakData.currentStreak} days`}
      role="img"
    >
      {/* Day-of-week headers */}
      {["M", "T", "W", "T", "F", "S", "S"].map((label, idx) => (
        <span
          key={`header-${idx}`}
          style={{
            fontSize: typography.caption.fontSize,
            color: "var(--sub)",
            fontFamily: FONT_FAMILY,
            textAlign: "center",
            opacity: 0.6,
          }}
          aria-hidden
        >
          {label}
        </span>
      ))}

      {/* Offset empty cells for alignment — first day's day-of-week */}
      {days.length > 0 && (() => {
        const firstDate = new Date(days[0].date + "T12:00:00")
        const dow = firstDate.getDay() // 0=Sun
        const offset = dow === 0 ? 6 : dow - 1 // Convert to Mon=0
        return Array.from({ length: offset }).map((_, i) => (
          <span key={`offset-${i}`} />
        ))
      })()}

      {days.map((day) => {
        const bgColor =
          day.status === "active"
            ? colorRamp.success[400]
            : day.status === "grace"
            ? "var(--warning-400)"
            : "var(--fill-06)"
        const borderColor =
          day.status === "grace"
            ? "var(--warning-400)"
            : "transparent"

        return (
          <div
            key={day.date}
            title={`${day.date}: ${day.status}`}
            style={{
              width: "100%",
              aspectRatio: "1",
              borderRadius: radius.min,
              background: bgColor,
              border: `1px solid ${borderColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                color:
                  day.status === "active"
                    ? "var(--text)"
                    : day.status === "grace"
                    ? "var(--warning)"
                    : "var(--sub)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
                opacity: day.status === "missed" ? 0.5 : 1,
              }}
            >
              {day.dayOfMonth}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// StreakDetailView Component
// ============================================================================

/**
 * Compact streak detail overlay showing current streak, longest streak,
 * total active days, and a 30-day calendar heatmap.
 *
 * Task 430.2 — Requirements: 25.1
 */
export function StreakDetailView({
  streakData,
  transactions,
  isOpen,
  onClose,
  onMarkZeroSpend,
  canMarkZeroSpend,
  graceDayMessage,
}: StreakDetailViewProps) {
  const { prefersReducedMotion } = useAppReducedMotion()

  const calendarDays = useMemo(
    () => buildLast30Days(streakData, transactions, new Date()),
    [streakData, transactions]
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--color-canvas)",
              zIndex: 999,
            }}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-label="Streak details"
            aria-modal="true"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 60 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 60 }
            }
            transition={springs.gentle}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "70vh",
              background: "var(--surface)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: "24px 20px 32px",
              zIndex: 1000,
              overflowY: "auto",
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--fill-15)",
                margin: "0 auto 20px",
              }}
              aria-hidden
            />

            {/* Title */}
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              🔥 Your Streak
            </h2>

            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: spacing.sm,
                marginBottom: spacing.lg,
              }}
            >
              <StatCard
                label="Current"
                value={streakData.currentStreak}
                unit="days"
                accent
              />
              <StatCard
                label="Longest"
                value={streakData.longestStreak}
                unit="days"
              />
              <StatCard
                label="Total active"
                value={streakData.totalActiveDays}
                unit="days"
              />
            </div>

            {/* Calendar heatmap */}
            <div style={{ marginBottom: spacing.md }}>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  color: "var(--sub)",
                }}
              >
                Last 30 days
              </p>
              <CalendarHeatmap days={calendarDays} streakData={streakData} />
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                gap: spacing.md,
                justifyContent: "center",
                marginTop: spacing.sm,
              }}
            >
              <LegendItem color={colorRamp.success[400]} label="Active" />
              <LegendItem color="var(--warning-400)" label="Grace day" />
              <LegendItem color="var(--fill-06)" label="Missed" />
            </div>

            {/* Grace day message (task 485.2 — moved from home screen) */}
            {graceDayMessage && (
              <div
                style={{
                  marginTop: spacing.md,
                  padding: "10px 14px",
                  background: "var(--warning-100)",
                  border: "1px solid var(--warning-200)",
                  borderRadius: radius.control,
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <span style={{ fontSize: typography['body-sm'].fontSize }} aria-hidden>🔥</span>
                <span
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.4,
                  }}
                >
                  {graceDayMessage}
                </span>
              </div>
            )}

            {/* $0 Day marker (task 485.1 — moved from home screen) */}
            {onMarkZeroSpend && canMarkZeroSpend && (
              <button
                type="button"
                onClick={onMarkZeroSpend}
                aria-label="Mark today as a zero-spend day to keep your streak"
                style={{
                  display: "block",
                  margin: "16px auto 0",
                  padding: "10px 20px",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  color: "var(--accent)",
                  background: "var(--accent-100)",
                  border: "1px solid var(--accent-200)",
                  borderRadius: radius.full,
                  cursor: "pointer",
                }}
              >
                Mark today as $0 day
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                display: "block",
                margin: "24px auto 0",
                padding: "10px 24px",
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                color: "var(--sub)",
                background: "var(--fill-06)",
                border: "1px solid var(--fill-10)",
                borderRadius: radius.full,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number
  unit: string
  accent?: boolean
}) {
  return (
    <div
      aria-label={`${label}: ${value} ${unit}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 8px",
        background: accent
          ? "var(--accent-100)"
          : "var(--fill-04)",
        border: `1px solid ${
          accent ? "var(--accent-200)" : "var(--fill-08)"
        }`,
        borderRadius: radius.control,
      }}
    >
      <span
        style={{
          fontSize: typography.headline.fontSize,
          fontWeight: fontWeights.bold,
          fontFamily: FONT_FAMILY,
          color: accent ? "var(--accent)" : "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: typography.caption.fontSize,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          marginTop: 2,
        }}
      >
        {unit}
      </span>
      <span
        style={{
          fontSize: typography.caption.fontSize,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          opacity: 0.7,
          marginTop: 2,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
        }}
        aria-hidden
      />
      <span
        style={{
          fontSize: typography.caption.fontSize,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
        }}
      >
        {label}
      </span>
    </div>
  )
}
