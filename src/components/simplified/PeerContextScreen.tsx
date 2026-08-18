"use client"

/**
 * PeerContextScreen — encouraging "typical for a student" framing (Task 186.1)
 *
 * An OPT-IN surface that places the user's monthly spending inside rough,
 * anonymized student ranges — purely to reassure ("you're in the comfy
 * middle"), never to compete or shame. It only renders when the user has
 * enabled peer context in Settings and is reached through Tools.
 *
 * Guardrails:
 *   • Opt-in, OFF by default — the toggle lives in Settings.
 *   • Never on the home screen (progressive disclosure).
 *   • No leaderboard, no ranking, no comparison to specific people.
 *   • Warm, shame-free copy; soft purple theme; prefers-reduced-motion honored.
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY } from "@/styles/typography"
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
        bg: "rgba(52, 211, 153, 0.12)",
      }
    case "lighter":
      return {
        label: "A little lighter",
        color: "rgba(167, 139, 250, 0.95)",
        bg: "rgba(167, 139, 250, 0.12)",
      }
    case "above":
      return {
        label: "A bit above — all good",
        color: "var(--sub)",
        bg: "rgba(255, 255, 255, 0.06)",
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
        gap: 14,
        padding: "14px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        {emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{label}</p>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {money(monthlySpend)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 8 }}>
          {message}
        </p>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
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
  if (!context.hasEnoughData) {
    return (
      <div style={containerStyle}>
        {backButton}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          How you compare
        </h1>
        <GlassCard elevation="low" style={{ padding: "4px 0", marginTop: 12 }}>
          <EmptyState
            illustration="review"
            title="Not much to compare yet"
            subtitle="Log a few more expenses this month and we'll show some warm, anonymized context — just for reassurance, never a scoreboard."
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

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        How you compare
      </h1>
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        {context.monthLabel} — {context.intro}
      </p>

      <motion.div
        {...cardAnim}
        transition={prefersReducedMotion ? { duration: 0.2 } : springs.gentle}
      >
        <GlassCard elevation="high" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">💜</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              You&apos;re doing just fine
            </p>
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 6 }}>
            Rough student ranges, just for context — never a ranking.
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
          fontSize: 12,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 16,
          lineHeight: 1.5,
        }}
      >
        {context.disclaimer}
      </p>
    </div>
  )
}
