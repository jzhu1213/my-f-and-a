"use client"

/**
 * PeerContextScreen â€” encouraging "typical for a student" framing (Task 186.1)
 *
 * An OPT-IN surface that places the user's monthly spending inside rough,
 * anonymized student ranges â€” purely to reassure ("you're in the comfy
 * middle"), never to compete or shame. It only renders when the user has
 * enabled peer context in Settings and is reached through Tools.
 *
 * Guardrails:
 *   â€¢ Opt-in, OFF by default â€” the toggle lives in Settings.
 *   â€¢ Never on the home screen (progressive disclosure).
 *   â€¢ No leaderboard, no ranking, no comparison to specific people.
 *   â€¢ Warm, shame-free copy; soft purple theme; prefers-reduced-motion honored.
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import { computePeerContext } from "@/lib/peerContextUtils"
import type { Transaction } from "@/types"
import type { PeerBand, PeerContextData } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface PeerContextScreenProps {
  transactions: Transaction[]
  /**
   * The month to summarize, as "YYYY-MM". Defaults to the current calendar
   * month. Passing it explicitly keeps the screen deterministic in tests.
   */
  monthKey?: string
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Whole-dollar display string with tabular alignment in mind. */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`
}

/** A soft, non-judgmental descriptor + accent color for each band. */
function bandChip(band: PeerBand): { label: string; color: string; bg: string } {
  switch (band) {
    case "typical":
      return {
        label: "Right in the middle",
        color: "var(--success)",
        bg: "var(--success-200)",
      }
    case "lighter":
      return {
        label: "A little lighter",
        color: "var(--accent-500)",
        bg: "var(--accent-200)",
      }
    case "above":
      return {
        label: "A bit above â€” all good",
        color: "var(--sub)",
        bg: "var(--fill-06)",
      }
  }
}

// A single category context row.
function ContextRow({
  emoji,
  label,
  monthlySpend,
  band,
  message,
}: {
  emoji: string
  label: string
  monthlySpend: number
  band: PeerBand
  message: string
}) {
  const chip = bandChip(band)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: "14px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: typography.headline.fontSize, lineHeight: 1, flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        {emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.xs,
            marginBottom: 4,
          }}
        >
          <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)" }}>{label}</p>
          <span
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {money(monthlySpend)}
          </span>
        </div>
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.5, marginBottom: spacing.xs }}>
          {message}
        </p>
        <span
          style={{
            display: "inline-block",
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.semibold,
            color: chip.color,
            background: chip.bg,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {chip.label}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function PeerContextScreen({ transactions, monthKey, onBack }: PeerContextScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const resolvedMonthKey = useMemo(() => {
    if (monthKey) return monthKey
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    return `${now.getFullYear()}-${m}`
  }, [monthKey])

  const context: PeerContextData = useMemo(
    () => computePeerContext(transactions, resolvedMonthKey),
    [transactions, resolvedMonthKey]
  )

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
  )

  // â”€â”€ Not-yet state: gentle, never hollow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!context.hasEnoughData) {
    return (
      <div style={containerStyle}>
        {backButton}
        <h1 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", marginBottom: spacing.xs }}>
          How you compare
        </h1>
        <GlassCard elevation="low" style={{ padding: "4px 0", marginTop: spacing.sm }}>
          <EmptyState
            illustration="review"
            title="Not much to compare yet"
            subtitle="Log a few more expenses this month and we'll show some warm, anonymized context â€” just for reassurance, never a scoreboard."
          />
        </GlassCard>
      </div>
    )
  }

  const cardAnim = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

  return (
    <div style={containerStyle}>
      {backButton}

      <h1 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", marginBottom: 6 }}>
        How you compare
      </h1>
      <p style={{ fontSize: typography.body.fontSize, color: "var(--sub)", marginBottom: HORIZONTAL_PADDING, lineHeight: 1.5 }}>
        {context.monthLabel} â€” {context.intro}
      </p>

      <motion.div
        {...cardAnim}
        transition={prefersReducedMotion ? { duration: 0.2 } : springs.gentle}
      >
        <GlassCard elevation="high" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: 6 }}>
            <span style={{ fontSize: typography.headline.fontSize, lineHeight: 1 }} aria-hidden="true">ðŸ’œ</span>
            <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.bold, color: "var(--text)" }}>
              You&apos;re doing just fine
            </p>
          </div>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.5, marginBottom: 6 }}>
            Rough student ranges, just for context â€” never a ranking.
          </p>

          <div style={{ marginTop: 6 }}>
            {context.categories.map((c) => (
              <ContextRow
                key={c.category}
                emoji={c.emoji}
                label={c.label}
                monthlySpend={c.monthlySpend}
                band={c.band}
                message={c.message}
              />
            ))}
          </div>
        </GlassCard>
      </motion.div>

      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: spacing.md,
          lineHeight: 1.5,
        }}
      >
        {context.disclaimer}
      </p>
    </div>
  )
}
