"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import {
  computeTrajectory,
  type TrajectoryDirection,
  type TrajectoryInsight,
} from "@/lib/trajectoryUtils"
import {
  computeFinancialHealthTimelines,
  type FinancialHealthSnapshot,
} from "@/lib/trajectoryDataContract"
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
  declining: { arrow: "↘", color: "var(--warning, #f59e0b)", label: "Needs attention" },
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
  const projection = useMemo<FinancialHealthSnapshot | null>(() => {
    if ((!savingsAccounts || savingsAccounts.length === 0) && (!debts || debts.length === 0)) {
      return null
    }
    return computeFinancialHealthTimelines(
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
  const showProjection = projection !== null
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

      {/* ── Growth Projection Section ──────────────────────────────── */}
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
            Where you&apos;re heading (12-month projection)
          </p>

          <GrowthProjectionCard projection={projection!} />
        </motion.div>
      )}

      {/* ── Insight cards ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trajectory.insights.length === 0 && !showProgressSection && (
          <GlassCard elevation="low" style={{ padding: "20px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">
              📊
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text)",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Not enough data yet
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
              Log a few weeks of expenses and income — this view will light up
              with trends and insights.
            </p>
          </GlassCard>
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
          <GlassCard elevation="low" style={{ padding: "16px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 22, marginBottom: 6 }} aria-hidden="true">
              🌱
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text)",
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Track your savings too
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
              Add savings accounts to see your full financial picture here — every
              little bit you set aside counts.
            </p>
          </GlassCard>
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
        <div style={{ textAlign: "right" }}>
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
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.06)",
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
                      borderRadius: 2,
                      background: "var(--success)",
                      width: principalReduction > 0
                        ? `${Math.min(100, Math.round((principalReduction / debt.minimumPayment) * 100))}%`
                        : "0%",
                      transition: "width 0.3s ease",
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
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.06)",
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
                    borderRadius: 3,
                    background: progress >= 75 ? "var(--success)" : "var(--accent, #818cf8)",
                    width: `${progress}%`,
                    transition: "width 0.3s ease",
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
// Growth Projection Card — simple inline bar chart using styled divs
// ============================================================================

function GrowthProjectionCard({ projection }: { projection: FinancialHealthSnapshot }) {
  // Show every other month for 12-month projection (0, 2, 4, 6, 8, 10, 12)
  const savingsPoints = projection.savingsTimeline.dataPoints.filter((_, i) => i % 2 === 0)
  const debtPoints = projection.debtTimeline.dataPoints.filter((_, i) => i % 2 === 0)

  // Determine max balance for scaling bars
  const allBalances = [
    ...savingsPoints.map(p => p.balance),
    ...debtPoints.map(p => p.balance),
  ]
  const maxBalance = Math.max(...allBalances, 1)

  const hasSavingsData = savingsPoints.some(p => p.balance > 0)
  const hasDebtData = debtPoints.some(p => p.balance > 0)

  const monthLabels = ["Now", "2mo", "4mo", "6mo", "8mo", "10mo", "12mo"]

  return (
    <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        {hasSavingsData && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--success)" }} />
            <span style={{ fontSize: 11, color: "var(--sub)" }}>Savings growth</span>
          </div>
        )}
        {hasDebtData && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent, #818cf8)" }} />
            <span style={{ fontSize: 11, color: "var(--sub)" }}>Debt declining</span>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height: 100,
          marginBottom: 8,
        }}
        role="img"
        aria-label="12-month financial projection chart showing savings growth and debt decline"
      >
        {savingsPoints.map((sp, idx) => {
          const dp = debtPoints[idx]
          const savingsHeight = maxBalance > 0 ? (sp.balance / maxBalance) * 100 : 0
          const debtHeight = dp && maxBalance > 0 ? (dp.balance / maxBalance) * 100 : 0

          return (
            <div
              key={sp.month}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              {/* Stacked bars */}
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
                {hasSavingsData && (
                  <div
                    style={{
                      width: hasDebtData ? 8 : 14,
                      height: `${Math.max(2, savingsHeight)}%`,
                      borderRadius: 2,
                      background: "var(--success)",
                      opacity: 0.85,
                      transition: "height 0.3s ease",
                    }}
                  />
                )}
                {hasDebtData && (
                  <div
                    style={{
                      width: hasSavingsData ? 8 : 14,
                      height: `${Math.max(2, debtHeight)}%`,
                      borderRadius: 2,
                      background: "var(--accent, #818cf8)",
                      opacity: 0.7,
                      transition: "height 0.3s ease",
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Month labels */}
      <div style={{ display: "flex", gap: 4 }}>
        {monthLabels.map((ml) => (
          <div
            key={ml}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9,
              color: "var(--muted)",
            }}
          >
            {ml}
          </div>
        ))}
      </div>

      {/* Summary text */}
      <div
        style={{
          marginTop: 12,
          padding: "8px 0 0",
          borderTop: "1px solid var(--border, rgba(255,255,255,0.04))",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {hasSavingsData && (
          <p style={{ fontSize: 12, color: "var(--sub)" }}>
            <span style={{ color: "var(--success)", fontWeight: 600 }}>Savings</span>{" "}
            projected to reach{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {formatDollars(savingsPoints[savingsPoints.length - 1]?.balance ?? 0)}
            </span>{" "}
            in 12 months
          </p>
        )}
        {hasDebtData && (
          <p style={{ fontSize: 12, color: "var(--sub)" }}>
            <span style={{ color: "var(--accent, #818cf8)", fontWeight: 600 }}>Debt</span>{" "}
            projected to drop to{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {formatDollars(debtPoints[debtPoints.length - 1]?.balance ?? 0)}
            </span>{" "}
            in 12 months
          </p>
        )}
      </div>
    </GlassCard>
  )
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
