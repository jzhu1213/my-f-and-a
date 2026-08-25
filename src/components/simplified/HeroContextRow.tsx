"use client"

/**
 * HeroContextRow — consolidated expandable info row below the hero.
 *
 * Replaces 8+ standalone indicator widgets with a single compact row:
 * - When collapsed: one contextual summary line (~13px, muted)
 * - When expanded: a card showing each active indicator as its own row
 * - If nothing is active: renders nothing (zero height)
 *
 * Tapping the collapsed row expands it. Tapping the streak row inside
 * the expanded card still opens StreakDetailView.
 *
 * Task 482 — Phase 21 mass cleanup & reorganization.
 */

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { track } from "@/lib/analytics"
import { FONT_FAMILY, spacing, typography } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import type { PeriodContext } from "@/lib/budgetPeriod"
import type { TimeHorizonStats } from "@/lib/timeHorizonStats"
import type { SpendDownResult } from "@/lib/spendDown"
import type { Transaction } from "@/types"
import { computeSpendVelocity } from "@/lib/spendVelocity"
import { getComingUpAwarenessMessage } from "@/lib/vocabulary"
import type { ComingUpItem } from "./ComingUpSection"

// ============================================================================
// Props
// ============================================================================

export interface HeroContextRowProps {
  /** Whether data is still loading */
  isLoading: boolean
  /** Current streak count (0 if no streak) */
  streakDays: number
  /** Whether streaks feature is enabled */
  streaksEnabled: boolean
  /** Callback to open streak detail view */
  onOpenStreakDetail: () => void
  /** Budget period context (e.g. "Day 8 of 14") */
  periodContext?: PeriodContext | null
  /** Monthly savings rate percentage */
  savingsRate?: number
  /** Whether savings rate badge is enabled */
  savingsRateBadgeEnabled: boolean
  /** Whether pace indicator is enabled */
  paceIndicatorEnabled: boolean
  /** All transactions (for pace computation) */
  transactions: Transaction[]
  /** Today's date string (YYYY-MM-DD) */
  todayStr: string
  /** Time horizon stats (weekend, payday, term) */
  timeHorizonStats?: TimeHorizonStats
  /** Active spend-down plan result */
  activeSpendDown?: SpendDownResult | null
  /** Current allowance amount */
  allowanceAmount: number
  /** Suggested entries total */
  suggestedEntriesTotal?: number
  /** Whether suggestions are included in allowance */
  suggestionsIncludedInAllowance?: boolean
  /** Number of suggested entries */
  suggestedEntriesCount: number
  /** Whether coming-up feature is enabled */
  comingUpEnabled: boolean
  /** Upcoming predicted expense items */
  comingUpItems?: ComingUpItem[]
  /** Task 483.4: Over-budget message to show in collapsed summary */
  overBudgetMessage?: string
  /** Task 485.1: Whether today has no transactions (for $0 day note) */
  noTransactionsToday?: boolean
  /** Task 485.1: Whether today is already marked as $0 day */
  isTodayZeroSpend?: boolean
  /** Task 485.2: Grace day message (shown in streak line when applicable) */
  graceDayMessage?: string | null
  /** Task 487.2: Outstanding splits summary (relocated from home inline chip) */
  outstandingSplits?: { name: string; amount: number }[]
  /** Task 487.2: Callback when user taps the splits summary to open the ledger */
  onOpenReimbursements?: () => void
}

// ============================================================================
// Types for internal indicator items
// ============================================================================

interface IndicatorItem {
  key: string
  emoji: string
  text: string
  ariaLabel: string
  onTap?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function HeroContextRow({
  isLoading,
  streakDays,
  streaksEnabled,
  onOpenStreakDetail,
  periodContext,
  savingsRate,
  savingsRateBadgeEnabled,
  paceIndicatorEnabled,
  transactions,
  todayStr,
  timeHorizonStats,
  activeSpendDown,
  allowanceAmount,
  suggestedEntriesTotal,
  suggestionsIncludedInAllowance,
  suggestedEntriesCount,
  comingUpEnabled,
  comingUpItems,
  overBudgetMessage,
  noTransactionsToday,
  isTodayZeroSpend,
  graceDayMessage,
  outstandingSplits,
  onOpenReimbursements,
}: HeroContextRowProps) {
  const { prefersReducedMotion } = useAppReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // ── Build list of active indicators ──────────────────────────────────────
  const indicators = useMemo((): IndicatorItem[] => {
    const items: IndicatorItem[] = []

    // 0. Over-budget message (Task 483.4) — appears first in collapsed summary
    if (overBudgetMessage) {
      items.push({
        key: "overbudget",
        emoji: "💡",
        text: overBudgetMessage,
        ariaLabel: overBudgetMessage,
      })
    }

    // 1. Streak (with grace day annotation — task 485.2)
    if (streaksEnabled && streakDays > 0) {
      const streakText = graceDayMessage
        ? `${streakDays} ${streakDays === 1 ? "day" : "days"} (grace day)`
        : `${streakDays} ${streakDays === 1 ? "day" : "days"}`
      items.push({
        key: "streak",
        emoji: "🔥",
        text: streakText,
        ariaLabel: `${streakDays}-day streak${graceDayMessage ? ' (grace day active)' : ''}. Tap for details.`,
        onTap: onOpenStreakDetail,
      })
    }

    // 1b. $0 day note — shown in expanded view when no transactions today and streak is active (task 485.1)
    if (streaksEnabled && streakDays > 0 && noTransactionsToday && !isTodayZeroSpend) {
      items.push({
        key: "zero-spend-note",
        emoji: "💡",
        text: "No spend yet — log one or mark $0 to keep your streak.",
        ariaLabel: "No spend yet today. Log a transaction or mark as zero-spend day to keep your streak.",
      })
    }

    // 2. Period context
    if (periodContext) {
      items.push({
        key: "period",
        emoji: "📅",
        text: periodContext.label,
        ariaLabel: `Budget period: ${periodContext.label}`,
      })
    }

    // 3. Savings rate
    if (savingsRateBadgeEnabled && typeof savingsRate === "number" && savingsRate > 0) {
      items.push({
        key: "savings",
        emoji: "💪",
        text: `saving ${savingsRate}%`,
        ariaLabel: `You're saving ${savingsRate}% of your income this month`,
      })
    }

    // 4. Spend pace
    if (paceIndicatorEnabled && transactions.length > 0) {
      const currentHour = new Date().getHours()
      const velocityData = computeSpendVelocity(transactions, todayStr, currentHour)
      if (velocityData.hasEnoughHistory) {
        // Determine pace status by comparing today's cumulative to typical
        const todayLatest = velocityData.today.length > 0
          ? velocityData.today[velocityData.today.length - 1].value
          : 0
        const typicalAtSameHour = velocityData.typical.length > currentHour
          ? velocityData.typical[currentHour].value
          : 0
        const isAhead = todayLatest > typicalAtSameHour * 1.1
        items.push({
          key: "pace",
          emoji: "📈",
          text: isAhead ? "Pace: ahead" : "Pace: on track",
          ariaLabel: isAhead
            ? "Spending pace is ahead of your typical day"
            : "Spending pace is on track with your typical day",
        })
      }
    }

    // 5. Time horizons
    if (timeHorizonStats) {
      const { weekend, payday, term } = timeHorizonStats
      if (weekend) {
        items.push({
          key: "weekend",
          emoji: "🎉",
          text: `$${weekend.amount} ${weekend.label.toLowerCase()}`,
          ariaLabel: `${weekend.label}: $${weekend.amount} safe to spend`,
        })
      }
      if (payday) {
        items.push({
          key: "payday",
          emoji: "💵",
          text: `$${Math.round(payday.dailyAmount)}/day · ${payday.daysLeft}d to payday`,
          ariaLabel: `$${Math.round(payday.dailyAmount)} per day until payday, ${payday.daysLeft} days left`,
        })
      }
      if (term) {
        items.push({
          key: "term",
          emoji: "📚",
          text: `$${Math.round(term.dailyAmount)}/day · ${term.daysLeft}d left`,
          ariaLabel: `${term.label}: $${Math.round(term.dailyAmount)} per day, ${term.daysLeft} days remaining`,
        })
      }
    }

    // 6. Spend-down
    if (activeSpendDown) {
      items.push({
        key: "spenddown",
        emoji: "💰",
        text: `$${activeSpendDown.dailyAmount}/day · $${activeSpendDown.remaining} left`,
        ariaLabel: `${activeSpendDown.label}: $${activeSpendDown.dailyAmount} per day, $${activeSpendDown.remaining} left`,
      })
    }

    // 7. Suggestion allowance impact
    if (suggestedEntriesCount > 0 && suggestionsIncludedInAllowance) {
      const afterBills = Math.max(0, Math.round(allowanceAmount - (suggestedEntriesTotal ?? 0)))
      items.push({
        key: "suggestions",
        emoji: "📋",
        text: `~$${afterBills}/day after expected bills`,
        ariaLabel: `Approximately $${afterBills} per day after expected bills`,
      })
    }

    // 8. Coming-up awareness
    if (comingUpEnabled && comingUpItems && comingUpItems.length > 0) {
      const sorted = [...comingUpItems].sort((a, b) => b.predictedAmount - a.predictedAmount)
      const msg = getComingUpAwarenessMessage(allowanceAmount, sorted[0] ?? null)
      if (msg) {
        items.push({
          key: "comingup",
          emoji: "📅",
          text: msg,
          ariaLabel: msg,
        })
      }
    }

    // 9. Outstanding splits (task 487.2 — relocated from inline home chip)
    if (outstandingSplits && outstandingSplits.length > 0) {
      const totalOwed = Math.round(outstandingSplits.reduce((sum, s) => sum + s.amount, 0))
      items.push({
        key: "splits",
        emoji: "💸",
        text: `${outstandingSplits.length} ${outstandingSplits.length === 1 ? 'split' : 'splits'} to settle · $${totalOwed}`,
        ariaLabel: `${outstandingSplits.length} splits to settle, $${totalOwed} total. Tap to open ledger.`,
        onTap: onOpenReimbursements,
      })
    }

    return items
  }, [
    overBudgetMessage,
    streaksEnabled,
    streakDays,
    graceDayMessage,
    noTransactionsToday,
    isTodayZeroSpend,
    onOpenStreakDetail,
    periodContext,
    savingsRate,
    savingsRateBadgeEnabled,
    paceIndicatorEnabled,
    transactions,
    todayStr,
    timeHorizonStats,
    activeSpendDown,
    allowanceAmount,
    suggestedEntriesTotal,
    suggestionsIncludedInAllowance,
    suggestedEntriesCount,
    comingUpEnabled,
    comingUpItems,
    outstandingSplits,
    onOpenReimbursements,
  ])

  // ── Don't render if nothing is active ────────────────────────────────────
  if (isLoading || indicators.length === 0) return null

  // ── Build collapsed summary (pick top 3 items, join with " · ") ──────────
  const summaryParts = indicators.slice(0, 3).map((ind) =>
    ind.key === "streak" ? `${ind.emoji} ${ind.text}` : ind.text
  )
  const summaryText = summaryParts.join(" · ")

  return (
    <div style={{ marginTop: spacing.xs, width: "100%" }}>
      {/* Collapsed: single tappable summary line */}
      <motion.button
        type="button"
        onClick={() => setExpanded((prev) => {
          const next = !prev
          if (next) {
            track('hero_context_expanded')
          }
          return next
        })}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse context info" : `${summaryText}. Tap to expand.`}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={timings.normal}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "6px 14px",
          background: "transparent",
          border: "none",
          borderRadius: radius.control,
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
      >
        <span
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--sub)",
            opacity: 0.85,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {summaryText}
        </span>
        <span
          style={{
            fontSize: typography.caption.fontSize,
            color: "var(--sub)",
            opacity: 0.5,
            transition: "transform 0.2s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          ▼
        </span>
      </motion.button>

      {/* Expanded: all active indicators */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={timings.normal}
            style={{
              overflow: "hidden",
              marginTop: 6,
            }}
          >
            <div
              style={{
                background: "var(--fill-04)",
                border: "1px solid var(--fill-08)",
                borderRadius: radius.control,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: spacing.xs,
              }}
            >
              {indicators.map((item) => (
                <IndicatorRow key={item.key} item={item} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// IndicatorRow — a single row inside the expanded card
// ============================================================================

function IndicatorRow({ item }: { item: IndicatorItem }) {
  const isInteractive = !!item.onTap

  const content = (
    <>
      <span style={{ fontSize: typography['body-sm'].fontSize, flexShrink: 0 }} aria-hidden>
        {item.emoji}
      </span>
      <span
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          opacity: 0.85,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {item.text}
      </span>
    </>
  )

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={item.onTap}
        aria-label={item.ariaLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.xs,
          padding: "4px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
          textAlign: "start",
          width: "100%",
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      role="status"
      aria-label={item.ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.xs,
        padding: "4px 0",
      }}
    >
      {content}
    </div>
  )
}
