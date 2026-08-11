"use client"

/**
 * YearInReviewScreen — a warm, once-a-year recap (Task 183.1)
 *
 * Presents a single celebratory, shareable card that folds a year of quiet
 * tracking into one moment: best streak, most-saved month, top category, and a
 * standout "biggest win". Extends the celebratory month/weekly-review pattern
 * (Phase 1 task 57) and matches the celebration visual language.
 *
 * Guardrails:
 *   • Lives behind Tools (progressive disclosure) — never on the home screen.
 *   • Never a leaderboard or a comparison to other people.
 *   • The share image is strictly opt-in (a button the user taps).
 *   • Warm, shame-free copy; soft purple theme; prefers-reduced-motion honored.
 */

import { useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  borderRadius,
} from "@/styles/shared"
import { computeYearInReview } from "@/lib/yearInReview"
import { renderYearInReviewImage } from "@/lib/yearInReviewImage"
import type { Transaction, Budget } from "@/types"
import type { YearInReviewData } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface YearInReviewScreenProps {
  transactions: Transaction[]
  budgets?: Budget[]
  /** The year to recap. Defaults to the current calendar year. */
  year?: number
  /** Optional YYYY-MM-DD cutoff for a partial/current year. */
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

export function YearInReviewScreen({
  transactions,
  budgets = [],
  year,
  throughDate,
  onBack,
}: YearInReviewScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const resolvedYear = year ?? new Date().getFullYear()

  const review: YearInReviewData = useMemo(
    () => computeYearInReview(transactions, budgets, resolvedYear, throughDate),
    [transactions, budgets, resolvedYear, throughDate]
  )

  // Share-image state (opt-in). `idle → working → done | unsupported`.
  const [shareState, setShareState] = useState<
    "idle" | "working" | "shared" | "downloaded" | "error"
  >("idle")

  const handleShareImage = useCallback(async () => {
    setShareState("working")
    try {
      const blob = await renderYearInReviewImage(review)
      const fileName = `folio-${review.year}-in-review.png`

      // Prefer the native share sheet when it can carry files.
      const file = new File([blob], fileName, { type: "image/png" })
      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean
      }
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `My ${review.year} in Review`,
        })
        setShareState("shared")
        return
      }

      // Fallback: download the image so the user can share it manually.
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShareState("downloaded")
    } catch {
      setShareState("error")
    }
  }, [review])

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
          {resolvedYear} in Review
        </h2>
        <GlassCard elevation="low" style={{ padding: "4px 0", marginTop: 12 }}>
          <EmptyState
            illustration="review"
            title="Your recap is still growing"
            subtitle={`Keep logging as the year goes on. Once there's a bit more to look back on, your ${resolvedYear} recap will appear right here.`}
          />
        </GlassCard>
      </div>
    )
  }

  const { bestStreak, mostSavedMonth, topCategory, biggestWin } = review

  const cardAnim = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

  return (
    <div style={containerStyle}>
      {backButton}

      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        {resolvedYear} in Review
      </h2>
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        A warm look back at your year — just for you.
      </p>

      <motion.div {...cardAnim} transition={prefersReducedMotion ? { duration: 0.2 } : springs.gentle}>
        <GlassCard
          elevation="high"
          glow="celebration"
          style={{ padding: "24px 22px" }}
        >
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

            {mostSavedMonth && (
              <StatRow
                emoji="🌟"
                label="Most-saved month"
                value={mostSavedMonth.monthLabel}
                hint={`You set aside ${money(mostSavedMonth.saved)}`}
              />
            )}

            {topCategory && (
              <StatRow
                emoji={topCategory.emoji}
                label="Where it mostly went"
                value={topCategory.label}
                hint={`${money(topCategory.total)} over the year — no judgment`}
              />
            )}

            {review.totalSaved > 0 && (
              <StatRow
                emoji="💜"
                label="Saved this year"
                value={money(review.totalSaved)}
              />
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Opt-in share image */}
      <div style={{ marginTop: 20 }}>
        <motion.button
          onClick={handleShareImage}
          disabled={shareState === "working"}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={springs.snappy}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: borderRadius.full,
            background: "rgba(129, 140, 248, 0.85)",
            border: "none",
            color: "var(--text)",
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            cursor: shareState === "working" ? "wait" : "pointer",
            opacity: shareState === "working" ? 0.7 : 1,
          }}
          aria-label="Create a shareable image of your year in review"
        >
          {shareState === "working" ? "Creating image…" : "📸 Create a share image"}
        </motion.button>

        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: 10,
            lineHeight: 1.5,
          }}
          role="status"
        >
          {shareState === "shared"
            ? "Shared ✓ — only if you chose to."
            : shareState === "downloaded"
              ? "Saved to your device ✓ — share it wherever you like."
              : shareState === "error"
                ? "Couldn't create the image just now. You can try again."
                : "Optional, and always private until you share it yourself."}
        </p>
      </div>
    </div>
  )
}
