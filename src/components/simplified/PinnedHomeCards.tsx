"use client"

/**
 * PinnedHomeCards — Compact, glanceable card variants for the home screen.
 *
 * Each card type renders in a 2-line max compact format. Tapping a card
 * navigates to the full tool screen for that feature.
 *
 * Requirement 18.6 — Pinnable home cards
 */

import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  glassSurface,
  borderRadius,
  fills,
  colorRamp,
} from "@/styles/shared"
import type { PinnedCard, PinnedCardType } from "@/lib/homeWidgets"
import { CARD_META } from "@/lib/homeWidgets"
import type { Goal, Transaction } from "@/types"
import type { ConfidenceTier } from "@/lib/confidenceScore"
import type { GardenMetrics } from "@/lib/gardenProgress"
import { isLearningEnabled } from "@/lib/educationPreferences"

// ============================================================================
// Props
// ============================================================================

export interface PinnedHomeCardsProps {
  /** The user's pinned cards (ordered) */
  pinnedCards: PinnedCard[]
  /** User goals for goal_progress card */
  goals?: Goal[]
  /** User transactions for income/spend data */
  transactions?: Transaction[]
  /** Upcoming bills data */
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  /** Savings total for savings_snapshot */
  savingsTotal?: number
  /** Monthly income received so far */
  monthlyIncomeReceived?: number
  /** Monthly income expected */
  monthlyIncomeExpected?: number
  /** Spend pace status */
  spendPaceStatus?: 'on_track' | 'ahead' | 'behind'
  /** Shared budget summary for the pinnable card (task 360.3) */
  sharedBudgetSummary?: { name: string; remaining: number; monthlyLimit: number }
  /** Confidence tier and trend for the pinnable card (task 365.2) */
  confidenceTier?: ConfidenceTier | null
  confidenceTrend?: "up" | "stable" | "down"
  /** Garden metrics for the progress garden card (task 435) */
  gardenMetrics?: GardenMetrics
  /** Learning progress data for the learning_progress card (task 445.3) */
  learningProgress?: { topicLabel: string; unlocked: number; total: number; recentLessonTitle?: string }
  /** Navigate to a tool screen */
  onNavigate?: (cardType: PinnedCardType) => void
}

// ============================================================================
// Individual Compact Cards
// ============================================================================

function GoalProgressCard({ goals, onTap }: { goals?: Goal[]; onTap?: () => void }) {
  const topGoal = goals?.find(g => g.targetAmount > 0 && g.currentAmount < g.targetAmount)
  const progress = topGoal
    ? Math.min(100, Math.round((topGoal.currentAmount / topGoal.targetAmount) * 100))
    : 0
  const label = topGoal?.name ?? 'No active goal'

  return (
    <CompactCardShell type="goal_progress" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>{label}</p>
          {topGoal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: fills[8], overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: colorRamp.accent[500],
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={cardValueStyle}>{progress}%</span>
            </div>
          ) : (
            <p style={cardSubStyle}>Tap to set one up</p>
          )}
        </div>
      </div>
    </CompactCardShell>
  )
}

function TopObligationCard({
  upcomingBills,
  onTap,
}: {
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  onTap?: () => void
}) {
  const next = upcomingBills?.[0]

  return (
    <CompactCardShell type="top_obligation" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">📋</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {next ? (
            <>
              <p style={cardTitleStyle}>{next.label}</p>
              <p style={cardSubStyle}>
                ${next.amount.toFixed(0)} · due day {next.dueDay}
              </p>
            </>
          ) : (
            <>
              <p style={cardTitleStyle}>No upcoming bills</p>
              <p style={cardSubStyle}>You're all clear</p>
            </>
          )}
        </div>
      </div>
    </CompactCardShell>
  )
}

function SavingsSnapshotCard({
  savingsTotal,
  onTap,
}: {
  savingsTotal?: number
  onTap?: () => void
}) {
  return (
    <CompactCardShell type="savings_snapshot" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🐷</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>Savings</p>
          <p style={cardValueStyle}>
            ${(savingsTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </CompactCardShell>
  )
}

function IncomeTrackerCard({
  monthlyIncomeReceived,
  monthlyIncomeExpected,
  onTap,
}: {
  monthlyIncomeReceived?: number
  monthlyIncomeExpected?: number
  onTap?: () => void
}) {
  const received = monthlyIncomeReceived ?? 0
  const expected = monthlyIncomeExpected ?? 0
  const pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0

  return (
    <CompactCardShell type="income_tracker" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">💵</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>Income this month</p>
          <p style={cardSubStyle}>
            ${received.toLocaleString()} of ${expected.toLocaleString()} ({pct}%)
          </p>
        </div>
      </div>
    </CompactCardShell>
  )
}

function SpendPaceCard({
  spendPaceStatus,
  onTap,
}: {
  spendPaceStatus?: 'on_track' | 'ahead' | 'behind'
  onTap?: () => void
}) {
  const statusLabel =
    spendPaceStatus === 'ahead'
      ? 'Ahead of pace'
      : spendPaceStatus === 'behind'
        ? 'Under pace — nice!'
        : 'On track'
  const statusColor =
    spendPaceStatus === 'ahead'
      ? 'var(--warning)'
      : spendPaceStatus === 'behind'
        ? 'var(--success)'
        : 'var(--sub)'

  return (
    <CompactCardShell type="spend_pace" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">📈</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>Spend Pace</p>
          <p style={{ ...cardSubStyle, color: statusColor }}>{statusLabel}</p>
        </div>
      </div>
    </CompactCardShell>
  )
}

function UpcomingBillCard({
  upcomingBills,
  onTap,
}: {
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  onTap?: () => void
}) {
  const next = upcomingBills?.[0]

  return (
    <CompactCardShell type="upcoming_bill" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {next ? (
            <>
              <p style={cardTitleStyle}>{next.label}</p>
              <p style={cardSubStyle}>${next.amount.toFixed(0)} · day {next.dueDay}</p>
            </>
          ) : (
            <>
              <p style={cardTitleStyle}>No bills coming up</p>
              <p style={cardSubStyle}>Smooth sailing</p>
            </>
          )}
        </div>
      </div>
    </CompactCardShell>
  )
}

function SharedBudgetCard({
  sharedBudgetSummary,
  onTap,
}: {
  sharedBudgetSummary?: { name: string; remaining: number; monthlyLimit: number }
  onTap?: () => void
}) {
  const name = sharedBudgetSummary?.name ?? 'Shared Budget'
  const remaining = sharedBudgetSummary?.remaining ?? 0
  const limit = sharedBudgetSummary?.monthlyLimit ?? 0
  const pct = limit > 0 ? Math.min(100, Math.round(((limit - remaining) / limit) * 100)) : 0

  return (
    <CompactCardShell type="shared_budget" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🤝</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>{name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: fills[8], overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: pct >= 80 ? 'var(--warning)' : colorRamp.accent[500],
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={cardValueStyle}>${remaining.toFixed(0)} left</span>
          </div>
        </div>
      </div>
    </CompactCardShell>
  )
}

function ConfidenceCard({
  tier,
  trend,
  onTap,
}: {
  tier?: ConfidenceTier | null
  trend?: "up" | "stable" | "down"
  onTap?: () => void
}) {
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendColor = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--warning)' : 'var(--sub)'

  return (
    <CompactCardShell type="confidence" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">✨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>{tier ?? 'Confidence'}</p>
          <p style={{ ...cardSubStyle, color: trendColor }}>
            {trendArrow} {trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Stable'}
          </p>
        </div>
      </div>
    </CompactCardShell>
  )
}

function ProgressGardenCard({
  gardenMetrics,
  onTap,
}: {
  gardenMetrics?: GardenMetrics
  onTap?: () => void
}) {
  const metrics = gardenMetrics ?? {
    completedGoals: 0,
    currentStreak: 0,
    totalActiveDays: 0,
    completedChallenges: 0,
    totalSpendingTracked: 0,
  }
  const activeCount = [
    metrics.completedGoals > 0,
    metrics.currentStreak >= 7,
    metrics.totalActiveDays >= 10,
    metrics.completedChallenges >= 5,
    metrics.totalSpendingTracked >= 1000,
  ].filter(Boolean).length

  return (
    <CompactCardShell type="progress_garden" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🌱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>Progress Garden</p>
          <p style={cardSubStyle}>
            {activeCount === 0
              ? 'Start tracking to grow your garden'
              : `${activeCount} of 5 elements growing`}
          </p>
        </div>
      </div>
    </CompactCardShell>
  )
}

function LearningProgressCard({
  learningProgress,
  onTap,
}: {
  learningProgress?: { topicLabel: string; unlocked: number; total: number; recentLessonTitle?: string }
  onTap?: () => void
}) {
  const progress = learningProgress
  const unlocked = progress?.unlocked ?? 0
  const total = progress?.total ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((unlocked / total) * 100)) : 0

  return (
    <CompactCardShell type="learning_progress" onTap={onTap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, width: '100%' }}>
        <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">📚</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={cardTitleStyle}>
            {progress?.recentLessonTitle
              ? progress.recentLessonTitle
              : 'Learning Journey'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: fills[8], overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: colorRamp.accent[500],
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={cardValueStyle}>{unlocked}/{total}</span>
          </div>
        </div>
      </div>
    </CompactCardShell>
  )
}

// ============================================================================
// Compact Card Shell
// ============================================================================

function CompactCardShell({
  type,
  onTap,
  children,
}: {
  type: PinnedCardType
  onTap?: () => void
  children: React.ReactNode
}) {
  const { prefersReducedMotion } = useReducedMotion()
  const meta = CARD_META[type]

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={springs.bouncy}
      aria-label={`${meta.label} — tap for details`}
      style={{
        ...glassSurface,
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '12px 14px',
        cursor: 'pointer',
        textAlign: "start",
      }}
    >
      {children}
    </motion.button>
  )
}

// ============================================================================
// Styles
// ============================================================================

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: typography['body-sm'].fontSize,
  fontWeight: fontWeights.medium,
  color: 'var(--text)',
  fontFamily: FONT_FAMILY,
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const cardSubStyle: React.CSSProperties = {
  margin: 0,
  fontSize: typography['body-sm'].fontSize,
  color: 'var(--sub)',
  fontFamily: FONT_FAMILY,
  lineHeight: 1.3,
  fontVariantNumeric: 'tabular-nums',
}

const cardValueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: typography['body-sm'].fontSize,
  fontWeight: fontWeights.semibold,
  color: 'var(--accent)',
  fontFamily: FONT_FAMILY,
  lineHeight: 1.3,
  fontVariantNumeric: 'tabular-nums',
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PinnedHomeCards — renders the user's pinned compact cards in order.
 * Empty by default (no cards until user opts in). Max 3.
 */
export function PinnedHomeCards({
  pinnedCards,
  goals,
  transactions,
  upcomingBills,
  savingsTotal,
  monthlyIncomeReceived,
  monthlyIncomeExpected,
  spendPaceStatus,
  sharedBudgetSummary,
  confidenceTier,
  confidenceTrend,
  gardenMetrics,
  learningProgress,
  onNavigate,
}: PinnedHomeCardsProps) {
  if (pinnedCards.length === 0) return null

  const handleTap = (type: PinnedCardType) => {
    onNavigate?.(type)
  }

  return (
    <motion.section
      aria-label="Pinned cards"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}
    >
      {pinnedCards.map((card) => {
        switch (card.type) {
          case 'goal_progress':
            return (
              <GoalProgressCard
                key={card.type}
                goals={goals}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'top_obligation':
            return (
              <TopObligationCard
                key={card.type}
                upcomingBills={upcomingBills}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'savings_snapshot':
            return (
              <SavingsSnapshotCard
                key={card.type}
                savingsTotal={savingsTotal}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'income_tracker':
            return (
              <IncomeTrackerCard
                key={card.type}
                monthlyIncomeReceived={monthlyIncomeReceived}
                monthlyIncomeExpected={monthlyIncomeExpected}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'spend_pace':
            return (
              <SpendPaceCard
                key={card.type}
                spendPaceStatus={spendPaceStatus}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'upcoming_bill':
            return (
              <UpcomingBillCard
                key={card.type}
                upcomingBills={upcomingBills}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'shared_budget':
            return (
              <SharedBudgetCard
                key={card.type}
                sharedBudgetSummary={sharedBudgetSummary}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'confidence':
            return (
              <ConfidenceCard
                key={card.type}
                tier={confidenceTier}
                trend={confidenceTrend}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'progress_garden':
            return (
              <ProgressGardenCard
                key={card.type}
                gardenMetrics={gardenMetrics}
                onTap={() => handleTap(card.type)}
              />
            )
          case 'learning_progress':
            if (!isLearningEnabled()) return null
            return (
              <LearningProgressCard
                key={card.type}
                learningProgress={learningProgress}
                onTap={() => handleTap(card.type)}
              />
            )
          default:
            return null
        }
      })}
    </motion.section>
  )
}
