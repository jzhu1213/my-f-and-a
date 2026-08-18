"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { ChartFrame } from "@/components/ui/primitives/ChartFrame"
import { FONT_FAMILY } from "@/styles/typography"
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
  progressBar,
  chartMotion,
  CHART_GRADIENT_PREFIX,
} from "@/styles/chartTokens"
import {
  computeTrajectory,
  type TrajectoryDirection,
  type TrajectoryInsight,
} from "@/lib/trajectoryUtils"
import {
  computeProgressCurve,
  type ProgressCurveData,
} from "@/lib/progressCurveUtils"
import type { Transaction, Goal } from "@/types"
import type { Debt, SavingsAccount, SavingsAccountType } from "@/types/folio"
import { SAVINGS_ACCOUNT_TYPES, DEBT_TYPES } from "@/types/folio"
import type { SinkingFund } from "@/lib/sinkingFunds"
import type { FundingSource } from "@/lib/fundingSources"
import { computeTotalSavingsBalance, computeMonthlyContributions } from "@/lib/savingsAccountUtils"

// ============================================================================
// Types
// ============================================================================

export interface TrajectoryScreenProps {
  transactions: Transaction[]
  goals?: Goal[]
  debts?: Debt[]
  savingsRate?: number
  savingsAccounts?: SavingsAccount[]
  totalSetAside?: number
  sinkingFunds?: SinkingFund[]
  fundingSources?: FundingSource[]
  onBack: () => void
}

// ============================================================================
// Direction visual indicators
// ============================================================================

const DIRECTION_DISPLAY: Record<
  TrajectoryDirection,
  { arrow: string; color: string; label: string }
> = {
  improving: { arrow: "↗", color: "var(--success)", label: "Improving" },
  steady: { arrow: "→", color: "var(--sub)", label: "Steady" },
  declining: { arrow: "↘", color: "var(--warning)", label: "Needs attention" },
}

// ============================================================================
// Helpers
// ============================================================================

/** Format a dollar amount for display, no cents. */
function formatDollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}

/** Get metadata for a savings account type. */
function getSavingsTypeLabel(type: SavingsAccountType): { emoji: string; label: string } {
  const meta = SAVINGS_ACCOUNT_TYPES.find(t => t.type === type)
  return meta ? { emoji: meta.emoji, label: meta.label } : { emoji: "📁", label: "Other" }
}

/** Get metadata for a debt type. */
function getDebtTypeEmoji(type: string): string {
  const meta = DEBT_TYPES.find(t => t.type === type)
  return meta?.emoji ?? "📄"
}

// ============================================================================
// TrajectoryScreen Component
// ============================================================================

/**
 * Financial Health — a warm, unified progress view that combines savings,
 * debt, set-aside, and goals into one encouraging "where am I heading" screen.
 *
 * Framed as trajectory and progress, never raw net worth or shame.
 */
export function TrajectoryScreen({
  transactions,
  goals,
  debts,
  savingsRate,
  savingsAccounts,
  totalSetAside,
  sinkingFunds,
  fundingSources,
  onBack,
}: TrajectoryScreenProps) {
  const trajectory = useMemo(
    () =>
      computeTrajectory({
        transactions,
        goals,
        debts,
        savingsRate,
        savingsAccounts,
        totalSetAside,
        sinkingFunds,
      }),
    [transactions, goals, debts, savingsRate, savingsAccounts, totalSetAside, sinkingFunds]
  )

  // ── Compute summary pills for the Financial Health section ─────
  const summaryPills = useMemo(() => {
    const pills: { label: string; arrow: string; color: string; direction: TrajectoryDirection }[] = []

    // Savings direction
    if (savingsAccounts && savingsAccounts.length > 0) {
      const monthlyContrib = computeMonthlyContributions(savingsAccounts)
      const totalBalance = computeTotalSavingsBalance(savingsAccounts)
      if (totalBalance > 0 || monthlyContrib > 0) {
        const dir: TrajectoryDirection = monthlyContrib > 0 ? "improving" : "steady"
        pills.push({
          label: "Savings",
          arrow: dir === "improving" ? "↗" : "→",
          color: dir === "improving" ? "var(--success)" : "var(--sub)",
          direction: dir,
        })
      }
    }

    // Debt direction
    if (debts && debts.length > 0) {
      const totalDebt = debts.reduce((s, d) => s + (d.balance ?? 0), 0)
      if (totalDebt > 0) {
        pills.push({
          label: "Debt",
          arrow: "↘",
          color: "var(--success)",
          direction: "improving",
        })
      }
    }

    // Cushion (set-aside + savings combined)
    const hasSetAside = (totalSetAside ?? 0) > 0
    const hasSavings = savingsAccounts && savingsAccounts.length > 0 && computeTotalSavingsBalance(savingsAccounts) > 0
    if (hasSetAside || hasSavings) {
      const dir: TrajectoryDirection = hasSetAside && hasSavings ? "improving" : "steady"
      pills.push({
        label: "Cushion",
        arrow: dir === "improving" ? "↗" : "→",
        color: dir === "improving" ? "var(--success)" : "var(--sub)",
        direction: dir,
      })
    }

    return pills
  }, [savingsAccounts, debts, totalSetAside])

  // ── Progress data computations ─────────────────────────────────
  const totalSavingsBalance = useMemo(
    () => savingsAccounts ? computeTotalSavingsBalance(savingsAccounts) : 0,
    [savingsAccounts]
  )

  const monthlyContributions = useMemo(
    () => savingsAccounts ? computeMonthlyContributions(savingsAccounts) : 0,
    [savingsAccounts]
  )

  const totalDebt = useMemo(
    () => debts ? debts.reduce((s, d) => s + (d.balance ?? 0), 0) : 0,
    [debts]
  )

  const totalMonthlySetAside = useMemo(() => {
    const sinkingReserves = sinkingFunds
      ? sinkingFunds.reduce((s, f) => s + f.monthlyReserve, 0)
      : 0
    return sinkingReserves + (totalSetAside ?? 0)
  }, [sinkingFunds, totalSetAside])

  const activeGoals = useMemo(
    () => goals ? goals.filter(g => g.currentAmount < g.targetAmount) : [],
    [goals]
  )

  // ── Growth projection (12-month horizon) ───────────────────────
  const progressCurve = useMemo<ProgressCurveData | null>(() => {
    if ((!savingsAccounts || savingsAccounts.length === 0) && (!debts || debts.length === 0)) {
      return null
    }
    return computeProgressCurve(
      savingsAccounts ?? [],
      debts ?? [],
      12
    )
  }, [savingsAccounts, debts])

  const { arrow, color, label } = DIRECTION_DISPLAY[trajectory.overall]

  // Determine which progress sections to show
  const showSavings = savingsAccounts && savingsAccounts.length > 0
  const showDebt = debts && debts.length > 0 && totalDebt > 0
  const showSetAside = totalMonthlySetAside > 0
  const showGoals = activeGoals.length > 0
  const showProjection = progressCurve !== null
  const showProgressSection = showSavings || showDebt || showSetAside || showGoals

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `0 ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Back button ────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 20,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {/* ── Hero area ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ textAlign: "center", marginBottom: 28 }}
      >
        <div
          style={{
            fontSize: 48,
            color,
            marginBottom: 8,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {arrow}
        </div>

        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          {label}
        </p>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.3,
            marginBottom: 6,
          }}
        >
          {trajectory.headline}
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "var(--sub)",
            lineHeight: 1.5,
          }}
        >
          Here&apos;s your progress and where you&apos;re heading.
        </p>
      </motion.div>

      {/* ── Financial Health Summary pills ─────────────────────────── */}
      {summaryPills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {summaryPills.map((pill) => (
            <div
              key={pill.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 20,
                background: "var(--surface)",
                border: "1px solid var(--border, rgba(255,255,255,0.06))",
                fontSize: 13,
                fontWeight: 500,
                color: pill.color,
                fontFamily: FONT_FAMILY,
              }}
            >
              <span>{pill.label}</span>
              <span style={{ fontSize: 15 }}>{pill.arrow}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Progress Section ───────────────────────────────────────── */}
      {showProgressSection && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
          style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 4,
            }}
          >
            Your progress
          </p>

          {/* ── Savings Balance Card ──────────────────────────────── */}
          {showSavings && (
            <SavingsBalanceCard
              accounts={savingsAccounts!}
              totalBalance={totalSavingsBalance}
              monthlyContributions={monthlyContributions}
            />
          )}

          {/* ── Debt Progress Card ────────────────────────────────── */}
          {showDebt && (
            <DebtProgressCard debts={debts!} totalDebt={totalDebt} />
          )}

          {/* ── Set-Aside Card ────────────────────────────────────── */}
          {showSetAside && (
            <SetAsideCard
              sinkingFunds={sinkingFunds ?? []}
              totalSetAside={totalSetAside ?? 0}
              totalMonthlySetAside={totalMonthlySetAside}
            />
          )}

          {/* ── Goals Progress Card ───────────────────────────────── */}
          {showGoals && (
            <GoalsProgressCard goals={activeGoals} />
          )}
        </motion.div>
      )}

      {/* ── Progress Curve Section ─────────────────────────────────── */}
      {showProjection && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
          style={{ marginBottom: 20 }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 10,
            }}
          >
            Your momentum (12-month projection)
          </p>

          <ProgressCurveCard curve={progressCurve!} />
        </motion.div>
      )}

      {/* ── Insight cards ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trajectory.insights.length === 0 && !showProgressSection && (
          <EmptyState
            illustration="review"
            title="Not enough data yet"
            subtitle="Log a few weeks of expenses and income — this view will light up with trends and insights."
          />
        )}

        {trajectory.insights.length > 0 && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 4,
            }}
          >
            Trends &amp; insights
          </p>
        )}

        {trajectory.insights.map((insight, idx) => (
          <InsightCard key={insight.id} insight={insight} index={idx} />
        ))}
      </div>

      {/* ── Savings empty state (encourage tracking) ───────────────── */}
      {(!savingsAccounts || savingsAccounts.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
          style={{ marginTop: 16 }}
        >
          <EmptyState
            illustration="goals"
            title="Track your savings too"
            subtitle="Add savings accounts to see your full financial picture here — every little bit you set aside counts."
          />
        </motion.div>
      )}

      {/* ── Footer note ────────────────────────────────────────────── */}
      <p
        style={{
          fontSize: 12,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.5,
        }}
      >
        Trends are based on your logged transactions. The more you log, the
        sharper the picture gets.
      </p>
    </div>
  )
}

// ============================================================================
// Savings Balance Card
// ============================================================================

function SavingsBalanceCard({
  accounts,
  totalBalance,
  monthlyContributions,
}: {
  accounts: SavingsAccount[]
  totalBalance: number
  monthlyContributions: number
}) {
  return (
    <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🌱</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Savings growing
            </p>
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              {accounts.length} account{accounts.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "end" }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDollars(totalBalance)}
          </p>
          {monthlyContributions > 0 && (
            <p style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>
              +{formatDollars(monthlyContributions)}/mo
            </p>
          )}
        </div>
      </div>

      {/* Individual account rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {accounts.map((account) => {
          const { emoji, label } = getSavingsTypeLabel(account.type)
          return (
            <div
              key={account.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 0",
                borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }} aria-hidden="true">{emoji}</span>
                <span style={{ fontSize: 12, color: "var(--sub)" }}>
                  {account.name || label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text)",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatDollars(account.balance)}
              </span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ============================================================================
// Debt Progress Card
// ============================================================================

function DebtProgressCard({
  debts,
  totalDebt,
}: {
  debts: Debt[]
  totalDebt: number
}) {
  return (
    <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">📤</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Trending toward zero
            </p>
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              {debts.length} debt{debts.length > 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDollars(totalDebt)}
        </p>
      </div>

      {/* Individual debt rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {debts.map((debt) => {
          const emoji = getDebtTypeEmoji(debt.type)
          // Progress: show how much of minimum payment contributes to principal reduction
          const monthlyInterest = (debt.balance * (debt.apr / 100)) / 12
          const principalReduction = Math.max(0, debt.minimumPayment - monthlyInterest)
          const monthsToZero = principalReduction > 0 ? Math.ceil(debt.balance / principalReduction) : 999
          return (
            <div
              key={debt.id}
              style={{
                padding: "6px 0",
                borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }} aria-hidden="true">{emoji}</span>
                  <span style={{ fontSize: 12, color: "var(--sub)" }}>{debt.name}</span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDollars(debt.balance)}
                </span>
              </div>
              {/* Mini progress bar representing paydown momentum */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: progressBar.height,
                    borderRadius: progressBar.borderRadius,
                    background: progressBar.track,
                    overflow: "hidden",
                  }}
                  role="progressbar"
                  aria-label={`${debt.name} payoff progress`}
                  aria-valuenow={principalReduction > 0 ? Math.min(100, Math.round((principalReduction / debt.minimumPayment) * 100)) : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: progressBar.borderRadius,
                      background: progressBar.fill,
                      width: principalReduction > 0
                        ? `${Math.min(100, Math.round((principalReduction / debt.minimumPayment) * 100))}%`
                        : "0%",
                      transition: chartMotion.barGrow,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {monthsToZero < 999 ? `~${monthsToZero}mo` : "—"}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ============================================================================
// Set-Aside Card
// ============================================================================

function SetAsideCard({
  sinkingFunds,
  totalSetAside,
  totalMonthlySetAside,
}: {
  sinkingFunds: SinkingFund[]
  totalSetAside: number
  totalMonthlySetAside: number
}) {
  const totalSaved = sinkingFunds.reduce((s, f) => s + f.savedAmount, 0)

  return (
    <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🎒</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Set aside this month
            </p>
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              Protecting future-you from surprises
            </p>
          </div>
        </div>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDollars(totalMonthlySetAside)}
        </p>
      </div>

      {/* Breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sinkingFunds.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
              borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--sub)" }}>
              Sinking funds ({sinkingFunds.length})
            </span>
            <span style={{ fontSize: 12, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {formatDollars(totalSaved)} saved
            </span>
          </div>
        )}
        {totalSetAside > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
              borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--sub)" }}>
              Allocation reserves
            </span>
            <span style={{ fontSize: 12, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {formatDollars(totalSetAside)}
            </span>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ============================================================================
// Goals Progress Card
// ============================================================================

function GoalsProgressCard({ goals }: { goals: Goal[] }) {
  return (
    <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">🎯</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Goals in progress
          </p>
          <p style={{ fontSize: 12, color: "var(--sub)" }}>
            {goals.length} active goal{goals.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {goals.map((goal) => {
          const progress = goal.targetAmount > 0
            ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            : 0
          return (
            <div key={goal.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }} aria-hidden="true">{goal.emoji}</span>
                  <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
                    {goal.name}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
                  {formatDollars(goal.currentAmount)} / {formatDollars(goal.targetAmount)}
                </span>
              </div>
              {/* Progress bar */}
              <div
                style={{
                  height: progressBar.height + 2,
                  borderRadius: progressBar.borderRadius,
                  background: progressBar.track,
                  overflow: "hidden",
                }}
                role="progressbar"
                aria-label={`${goal.name} progress`}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: progressBar.borderRadius,
                    background: progress >= 75 ? progressBar.fill : progressBar.fillAccent,
                    width: `${progress}%`,
                    transition: chartMotion.barGrow,
                  }}
                />
              </div>
              <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {progress}% there
              </p>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ============================================================================
// Progress Curve Card — smooth SVG area chart showing unified progress
// ============================================================================

function ProgressCurveCard({ curve }: { curve: ProgressCurveData }) {
  const { dataPoints, projectedSavings, projectedDebt, startingSavings, startingDebt, hasSavingsSignal, hasDebtSignal } = curve

  // Chart dimensions — use shared tokens for consistency
  const chartWidth = 320
  const chartHeight = chartDimensions.heightCompact
  const padding = { top: 8, right: 12, bottom: 4, left: 12 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Compute SVG path for the progress curve
  const maxScore = Math.max(...dataPoints.map(p => p.score), 1)
  const points = dataPoints.map((p, i) => ({
    x: padding.left + (i / (dataPoints.length - 1)) * innerWidth,
    y: padding.top + innerHeight - (p.score / maxScore) * innerHeight,
  }))

  // Build smooth curve path using cardinal spline approximation
  const linePath = buildSmoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x},${chartHeight - padding.bottom} L ${points[0].x},${chartHeight - padding.bottom} Z`

  // Current score (month 0) and projected score (last month)
  const currentScore = dataPoints[0].score
  const projectedScore = dataPoints[dataPoints.length - 1].score
  const progressGain = Math.round(projectedScore - currentScore)

  // Month labels for x-axis
  const monthLabels = ["Now", "3mo", "6mo", "9mo", "12mo"]

  return (
    <ChartFrame
      type="line"
      state="loaded"
      height={chartHeight + 100}
      aria-label={`Progress curve showing your combined savings and debt progress trending upward from ${Math.round(currentScore)} to ${Math.round(projectedScore)} over 12 months`}
    >
      <div style={{ padding: "16px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }} aria-hidden="true">📈</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Progress Score
            </span>
          </div>
          {progressGain > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--success)",
                background: "rgba(74, 222, 128, 0.1)",
                padding: "3px 8px",
                borderRadius: 10,
              }}
            >
              +{progressGain} pts projected
            </span>
          )}
        </div>

        {/* SVG Area Chart */}
        <div
          style={{
            width: "100%",
            marginBottom: 6,
          }}
          role="img"
          aria-label={`Progress curve from ${Math.round(currentScore)} to ${Math.round(projectedScore)} over 12 months`}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width="100%"
            height={chartHeight}
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            {/* Gradient fill */}
            <defs>
              <linearGradient id={`${CHART_GRADIENT_PREFIX}-progress`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primary} stopOpacity="0.28" />
                <stop offset="100%" stopColor={chartColors.primary} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path
              d={areaPath}
              fill={`url(#${CHART_GRADIENT_PREFIX}-progress)`}
            />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke={chartColors.primary}
              strokeWidth={chartStrokes.lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 1px 3px rgba(74, 222, 128, 0.3))" }}
            />

            {/* Current position dot */}
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r={chartStrokes.dotRadius}
              fill={chartColors.dot}
              stroke={chartColors.dotStroke}
              strokeWidth={chartStrokes.dotStrokeWidth}
            />

            {/* Projected position dot */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={chartStrokes.dotRadius}
              fill={chartColors.primary}
              stroke={chartColors.dot}
              strokeWidth={chartStrokes.dotStrokeWidth * 0.75}
            />
          </svg>
        </div>

        {/* Month labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          {monthLabels.map((ml) => (
            <span
              key={ml}
              style={chartLabel}
            >
              {ml}
            </span>
          ))}
        </div>

        {/* Warm copy */}
        <p
          style={{
            fontSize: 12,
            color: "var(--sub)",
            lineHeight: 1.5,
            marginBottom: 10,
          }}
        >
          Your combined savings + debt progress over the next year
        </p>

        {/* Breakdown text */}
        <div
          style={{
            padding: "8px 0 0",
            borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {hasSavingsSignal && (
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              <span style={{ color: "var(--success)", fontWeight: 600 }}>Savings</span>{" "}
              projected to reach{" "}
              <span style={{ color: "var(--text)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                {formatDollars(projectedSavings)}
              </span>
            </p>
          )}
          {hasDebtSignal && (
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>Debt</span>{" "}
              projected to drop to{" "}
              <span style={{ color: "var(--text)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                {formatDollars(projectedDebt)}
              </span>
            </p>
          )}
        </div>
      </div>
    </ChartFrame>
  )
}

/**
 * Build a smooth SVG path string from an array of points using
 * monotone cubic interpolation for a natural-looking curve.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`
  }

  let path = `M ${points[0].x},${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    // Control points using Catmull-Rom to cubic Bezier conversion
    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  return path
}

// ============================================================================
// InsightCard (internal)
// ============================================================================

function InsightCard({
  insight,
  index,
}: {
  insight: TrajectoryInsight
  index: number
}) {
  const { color } = DIRECTION_DISPLAY[insight.direction]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: 0.05 * index }}
    >
      <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}
            aria-hidden="true"
          >
            {insight.emoji}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              {insight.headline}
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                lineHeight: 1.4,
              }}
            >
              {insight.detail}
            </p>
          </div>
          {/* Tiny direction dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
              marginTop: 6,
              opacity: 0.8,
            }}
            aria-hidden="true"
          />
        </div>
      </GlassCard>
    </motion.div>
  )
}
