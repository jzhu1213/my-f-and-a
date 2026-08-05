"use client"

/**
 * TermReviewScreen — a warm, richer end-of-period recap (Task 184.1)
 *
 * Extends the month-in-review pattern (improvement 5.4) into a term-aware
 * moment. When the user has an academic term set (Phase 2 task 121.1) it recaps
 * the whole term — total saved, the strongest month, top categories, and a
 * standout "biggest win". With no term set it degrades gracefully to a single
 * month, so nothing breaks.
 *
 * Guardrails:
 *   • Lives behind Tools (progressive disclosure) — never on the home screen.
 *   • Never a leaderboard or a comparison to other people.
 *   • Warm, shame-free copy; soft purple theme; prefers-reduced-motion honored.
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  emptyStateContainer,
  emptyStateTitle,
  emptyStateSubtitle,
} from "@/styles/shared"
import { computeTermReview } from "@/lib/termReview"
import type { Transaction, Budget } from "@/types"
import type { TermSchedule } from "@/lib/termSchedule"
import type { TermReviewData } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface TermReviewScreenProps {
  transactions: Transaction[]
  budgets?: Budget[]
  /** The active term schedule, or null for a graceful monthly recap. */
  termSchedule?: TermSchedule | null
  /**
   * YYYY-MM-DD cutoff (inclusive). Defaults to today. Anything after is ignored
   * so an in-progress term/month recaps only what has happened so far.
   */
  throughDate?: string
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Whole-dollar display string with tabular alignment in mind. */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`
}

// A single stat row inside the recap card.
function StatRow({
  emoji,
  label,
  value,
  hint,
}: {
  emoji: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
        {emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 2 }}>{label}</p>
        <p
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.3,
          }}
        >
          {value}
        </p>
        {hint && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{hint}</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function TermReviewScreen({
  transactions,
  budgets = [],
  termSchedule = null,
  throughDate,
  onBack,
}: TermReviewScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const resolvedThrough = useMemo(() => {
    if (throughDate) return throughDate
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    return `${now.getFullYear()}-${m}-${d}`
  }, [throughDate])

  const review: TermReviewData = useMemo(
    () => computeTermReview(transactions, budgets, termSchedule, resolvedThrough),
    [transactions, budgets, termSchedule, resolvedThrough]
  )

  const heading = review.mode === "term" ? "Term in Review" : "Month in Review"

  const containerStyle = {
    maxWidth: CONTENT_MAX_WIDTH,
    margin: "0 auto",
    padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
    fontFamily: FONT_FAMILY,
  } as const

  const backButton = (
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
  )

  // ── Not-yet state: gentle, never hollow ──────────────────────────────────
  if (!review.hasEnoughData) {
    return (
      <div style={containerStyle}>
        {backButton}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          {heading}
        </h2>
        <GlassCard elevation="low" style={{ padding: "28px 22px", marginTop: 12 }}>
          <div style={emptyStateContainer}>
            <span style={{ fontSize: 34 }} aria-hidden="true">🌱</span>
            <p style={emptyStateTitle}>Your recap is still growing</p>
            <p style={{ ...emptyStateSubtitle, maxWidth: 320 }}>
              Keep logging as {review.mode === "term" ? "the term" : "the month"} goes
              on. Once there&apos;s a bit more to look back on, your {review.periodLabel}{" "}
              recap will appear right here.
            </p>
          </div>
        </GlassCard>
      </div>
    )
  }

  const { bestStreak, bestMonth, topCategories, biggestWin } = review

  const cardAnim = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

  return (
    <div style={containerStyle}>
      {backButton}

      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        {heading}
      </h2>
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        {review.periodLabel} — a warm look back, just for you.
      </p>

      <motion.div {...cardAnim} transition={prefersReducedMotion ? { duration: 0.2 } : springs.gentle}>
        <GlassCard elevation="high" glow="celebration" style={{ padding: "24px 22px" }}>
          {/* Header — the celebratory biggest win */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">
              🎉
            </div>
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
                lineHeight: 1.25,
              }}
            >
              {biggestWin.headline}
            </p>
            <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5 }}>
              {biggestWin.detail}
            </p>
          </div>

          {/* Stats */}
          <div style={{ marginTop: 8 }}>
            <StatRow
              emoji="🔥"
              label="Best streak"
              value={
                bestStreak > 0
                  ? `${bestStreak} ${bestStreak === 1 ? "day" : "days"}`
                  : "A fresh start"
              }
              hint={bestStreak > 0 ? "days in a row inside your daily number" : undefined}
            />

            {review.totalSaved > 0 && (
              <StatRow
                emoji="💜"
                label={review.mode === "term" ? "Saved this term" : "Saved this month"}
                value={money(review.totalSaved)}
              />
            )}

            {review.mode === "term" && bestMonth && (
              <StatRow
                emoji="🌟"
                label="Strongest month"
                value={bestMonth.monthLabel}
                hint={`You set aside ${money(bestMonth.saved)}`}
              />
            )}

            {topCategories.length > 0 && (
              <StatRow
                emoji={topCategories[0].emoji}
                label="Where it mostly went"
                value={topCategories[0].label}
                hint={`${money(topCategories[0].total)} ${
                  review.mode === "term" ? "over the term" : "this month"
                } — no judgment`}
              />
            )}

            {topCategories.length > 1 && (
              <StatRow
                emoji="🧾"
                label="Also up there"
                value={topCategories
                  .slice(1)
                  .map((c) => c.label)
                  .join(" · ")}
                hint={topCategories
                  .slice(1)
                  .map((c) => money(c.total))
                  .join(" · ")}
              />
            )}
          </div>
        </GlassCard>
      </motion.div>

      <p
        style={{
          fontSize: 12,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 16,
          lineHeight: 1.5,
        }}
      >
        {review.transactionCount} logged over {review.daysInPeriod}{" "}
        {review.daysInPeriod === 1 ? "day" : "days"}. Always private, just for you.
      </p>
    </div>
  )
}
