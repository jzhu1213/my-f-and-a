"use client"

import { useMemo, useState } from "react"
import type { Transaction, Budget, Goal, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { DailyAllowance, QuickTransaction } from "@/types/folio"
import type { TransactionRepeat } from "@/lib/transactionUtils"
import { getRecentRepeats } from "@/lib/transactionUtils"
import { computeCategoryBudgets } from "@/lib/budgetUtils"
import type { CategoryBudgetRow } from "@/lib/budgetUtils"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { DailyAllowanceHero } from "./DailyAllowanceHero"
import { GlassCard } from "@/components/ui/GlassCard"
import { HomeScreenSkeleton, FadeInContent } from "@/components/ui/Skeleton"
import { CategoryDetailSheet } from "@/components/accounting/CategoryDetailSheet"
import { SwipeableTransactionRow } from "./SwipeableTransactionRow"
import { PullToRefresh } from "./PullToRefresh"

// ============================================================================
// Helpers
// ============================================================================

/** Returns "Today", "Yesterday", or a short formatted date like "Jun 15" */
function getRelativeDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ============================================================================
// HomeScreen Props
// ============================================================================

export interface HomeScreenProps {
  /** Computed daily allowance data for the hero section */
  allowance: DailyAllowance | null
  /** All user transactions (used for recent list & budget calc) */
  transactions: Transaction[]
  /** User budget limits by category */
  budgets: Budget[]
  /** User savings goals */
  goals: Goal[]
  /** User display name (for greeting) */
  userName?: string
  /** Whether data is still loading */
  isLoading: boolean

  // ── Callbacks ──────────────────────────────────────────────────────────────
  /** Called when the hero is tapped for breakdown details */
  onHeroTapDetails: () => void
  /** Called when user taps a quick action (e.g. log expense) */
  onLogExpense: (category?: TransactionCategory) => void
  /** Called when user taps log income */
  onLogIncome: () => void
  /** Called when user taps a repeat transaction chip */
  onRepeatLog: (repeat: TransactionRepeat) => void
  /** Called when user taps a transaction in the recent list */
  onViewTransaction: (tx: Transaction) => void
  /** Called when user wants to see full history */
  onViewAllHistory: () => void
  /** Called when user swipes to delete a transaction (optimistic delete with undo) */
  onDeleteTransaction?: (id: string) => void
  /** Called when user pulls to refresh — refetches transactions and budgets */
  onRefresh?: () => Promise<void>
}

// ============================================================================
// HomeScreen Component
// ============================================================================

/**
 * HomeScreen — the new simplified front page for Folio.
 *
 * Rendered as the content inside `AppShell` (which provides the mesh
 * background, glass top bar, and floating dock). This component is a single
 * scrollable column with comfortable spacing:
 *
 *   Hero → Quick Actions → Category Budget Cards → Recent Transactions → Monthly Summary
 *
 * Each section is scaffolded here and will be enhanced in tasks 10.2–10.7.
 *
 * Requirements: 9.1, 8.1, 8.4
 */
export function HomeScreen({
  allowance,
  transactions,
  budgets,
  goals,
  userName,
  isLoading,
  onHeroTapDetails,
  onLogExpense,
  onLogIncome,
  onRepeatLog,
  onViewTransaction,
  onViewAllHistory,
  onDeleteTransaction,
  onRefresh,
}: HomeScreenProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<CategoryBudgetRow | null>(null)
  const [showMonthSummary, setShowMonthSummary] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const monthTxs = transactions.filter((t) => t.date.startsWith(currentMonth))
  const monthIncome = monthTxs
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
  const monthExpenses = monthTxs
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)

  const recentTransactions = transactions.slice(0, 5)

  // ── Category budget rows (sorted) ────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const rows = computeCategoryBudgets(budgets, transactions, currentMonth, true)
    return rows.sort((a, b) => {
      // Over-budget first
      if (a.overWeekly && !b.overWeekly) return -1
      if (!a.overWeekly && b.overWeekly) return 1
      // Then by least remaining (for those with limits)
      if (a.hasLimit && b.hasLimit) return a.weeklyLeft - b.weeklyLeft
      // Limit holders before no-limit
      if (a.hasLimit && !b.hasLimit) return -1
      if (!a.hasLimit && b.hasLimit) return 1
      // Then by most spent
      return b.weeklySpent - a.weeklySpent
    })
  }, [budgets, transactions, currentMonth])

  // Memoize recent repeats for "Log Again" section
  const repeats = useMemo(
    () => getRecentRepeats(transactions, 3),
    [transactions]
  )

  // ── Loading state: show full-page skeleton ────────────────────────────────
  if (isLoading) {
    return <HomeScreenSkeleton />
  }

  // ── Default no-op refresh handler ──────────────────────────────────────────
  const handleRefresh = onRefresh ?? (() => Promise.resolve())

  return (
    <FadeInContent>
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
    <div className="home-screen" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        className="home-screen__content"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: "0 20px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          paddingTop: 16,
          paddingBottom: 120, // room for dock
        }}
      >
        {/* ── 1. Hero: Daily Allowance ────────────────────────────── */}
        <section aria-label="Daily allowance">
          <DailyAllowanceHero
            allowanceLeft={allowance?.amount ?? 0}
            dailyBudget={allowance?.dailyBudget ?? 0}
            spentToday={allowance?.spentToday ?? 0}
            rollover={allowance?.rollover ?? 0}
            isOverBudget={allowance?.status === "over"}
            isLoading={isLoading}
            onTapForDetails={onHeroTapDetails}
          />
          {!isLoading && allowance && (
            <p
              style={{
                fontSize: 12,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: "Inter, sans-serif",
                marginTop: 10,
                opacity: 0.75,
              }}
              aria-label={`Spent today: $${Math.round(allowance.spentToday)}`}
            >
              Spent today: ${Math.round(allowance.spentToday)}
            </p>
          )}
        </section>

        {/* ── 2. Quick Actions ────────────────────────────────────── */}
        <section aria-label="Quick actions">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {/* Primary: Log expense — larger pill with warm gradient */}
            <motion.button
              type="button"
              onClick={() => onLogExpense()}
              whileTap={{ scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1.6,
                background: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)",
                border: "none",
                borderRadius: 99,
                padding: "18px 24px",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                textAlign: "center",
                boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
              }}
            >
              Log expense
            </motion.button>

            {/* Secondary: Log income — ghost pill with green border */}
            <motion.button
              type="button"
              onClick={onLogIncome}
              whileTap={{ scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1,
                background: "transparent",
                border: "1.5px solid rgba(74, 222, 128, 0.4)",
                borderRadius: 99,
                padding: "16px 20px",
                color: "var(--success)",
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Log income
            </motion.button>
          </div>
        </section>

        {/* ── 2.5. Log Again — Quick Repeat ────────────────────── */}
        {repeats.length > 0 && (
          <section aria-label="Log again">
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                flexWrap: "nowrap",
                paddingBottom: 4,
                scrollbarWidth: "none",
              }}
            >
              {repeats.map((repeat, index) => {
                const emoji =
                  BUDGET_CATEGORIES.find((c) => c.category === repeat.category)?.emoji ?? "💰"
                return (
                  <motion.button
                    key={`${repeat.category}-${repeat.amount}-${repeat.note ?? ""}`}
                    type="button"
                    onClick={() => onRepeatLog(repeat)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 16px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 99,
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: "Inter, sans-serif",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{repeat.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 3. Category Budget Cards ────────────────────────────── */}
        <section aria-label="Budget categories">
          <h2
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--sub)",
              marginBottom: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Categories
          </h2>
          {categoryRows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <GlassCard elevation="low" style={{ padding: "28px 20px", borderRadius: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">🎯</span>
                  <p style={{
                    fontSize: 14,
                    color: "var(--text)",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                  }}>
                    Set limits for an accurate daily budget
                  </p>
                  <p style={{
                    fontSize: 12,
                    color: "var(--sub)",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    opacity: 0.8,
                  }}>
                    Category limits help Folio calculate what you can spend each day
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {categoryRows.map((row) => {
                const barColor = row.overWeekly
                  ? "var(--error)"
                  : row.nearLimit
                  ? "var(--warning)"
                  : "var(--success)"

                return (
                  <motion.button
                    key={row.category}
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.bouncy}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    <GlassCard
                      elevation="low"
                      style={{
                        padding: "14px",
                        borderRadius: 14,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {/* Emoji */}
                      <span style={{ fontSize: 24, lineHeight: 1 }}>{row.emoji}</span>

                      {/* Category name */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--text)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {row.label}
                      </span>

                      {/* Progress bar or "no limit" */}
                      {row.hasLimit ? (
                        <>
                          <div
                            style={{
                              width: "100%",
                              height: 4,
                              borderRadius: 2,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                              marginTop: 2,
                            }}
                          >
                            <motion.div
                              animate={{ width: `${Math.min(row.weekPct, 100)}%` }}
                              transition={{ type: "spring", stiffness: 100, damping: 20 }}
                              style={{
                                height: "100%",
                                borderRadius: 2,
                                background: barColor,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: barColor,
                              fontFamily: "Inter, sans-serif",
                              fontWeight: 500,
                            }}
                          >
                            {row.overWeekly
                              ? `$${Math.abs(Math.round(row.weeklyLeft))} over`
                              : `$${Math.max(0, Math.round(row.weeklyLeft))} left`}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--sub)",
                              opacity: 0.6,
                              fontFamily: "Inter, sans-serif",
                              marginTop: 2,
                            }}
                          >
                            no limit
                          </span>
                          {row.weeklySpent > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--sub)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              ${Math.round(row.weeklySpent)} spent
                            </span>
                          )}
                        </>
                      )}
                    </GlassCard>
                  </motion.button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 4. Recent Transactions ──────────────────────────────── */}
        <section aria-label="Recent transactions">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--sub)",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Recent
            </h2>
            {recentTransactions.length > 0 && (
              <button
                type="button"
                onClick={onViewAllHistory}
                style={{
                  fontSize: 12,
                  color: "var(--sub)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  opacity: 0.7,
                }}
              >
                See all →
              </button>
            )}
          </div>

          {recentTransactions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <GlassCard elevation="low" style={{ padding: "28px 20px", borderRadius: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">✨</span>
                  <p style={{
                    fontSize: 14,
                    color: "var(--text)",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                  }}>
                    Start by logging your first expense!
                  </p>
                  <p style={{
                    fontSize: 12,
                    color: "var(--sub)",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    opacity: 0.8,
                  }}>
                    Tap "Log expense" above — it only takes a second
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <GlassCard elevation="low" style={{ padding: "12px 0", borderRadius: 14 }}>
              {(() => {
                // Group transactions by date
                const grouped: { date: string; txs: Transaction[] }[] = []
                for (const tx of recentTransactions) {
                  const dateKey = tx.date.slice(0, 10)
                  const existing = grouped.find((g) => g.date === dateKey)
                  if (existing) {
                    existing.txs.push(tx)
                  } else {
                    grouped.push({ date: dateKey, txs: [tx] })
                  }
                }

                return grouped.map((group, groupIdx) => (
                  <div key={group.date}>
                    {/* Date group header */}
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--sub)",
                        fontFamily: "Inter, sans-serif",
                        padding: "8px 16px 4px",
                        marginTop: groupIdx > 0 ? 4 : 0,
                        opacity: 0.7,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {getRelativeDate(group.date)}
                    </p>

                    {/* Transaction rows */}
                    {group.txs.map((tx, txIdx) => {
                      const catInfo = BUDGET_CATEGORIES.find(
                        (c) => c.category === tx.category
                      )
                      const emoji = catInfo?.emoji ?? "💰"
                      const label = tx.note || catInfo?.label || tx.category
                      const isLast =
                        groupIdx === grouped.length - 1 &&
                        txIdx === group.txs.length - 1

                      return (
                        <SwipeableTransactionRow
                          key={tx.id}
                          id={tx.id}
                          onDelete={(id) => onDeleteTransaction?.(id)}
                          onTap={() => onViewTransaction(tx)}
                          showBorder={!isLast}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "10px 16px",
                              textAlign: "left",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                color: "var(--text)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {emoji} {label}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                fontFamily: "Inter, sans-serif",
                                color:
                                  tx.type === "income"
                                    ? "var(--success)"
                                    : "var(--text)",
                              }}
                            >
                              {tx.type === "income" ? "+" : "−"}$
                              {tx.amount.toFixed(2)}
                            </span>
                          </div>
                        </SwipeableTransactionRow>
                      )
                    })}
                  </div>
                ))
              })()}
            </GlassCard>
          )}
        </section>

        {/* ── 5. Monthly Summary ──────────────────────────────────── */}
        <section aria-label="Monthly summary">
          <GlassCard elevation="low" style={{ padding: 0, borderRadius: 14, overflow: "hidden" }}>
              {/* Header — always visible, acts as toggle */}
              <motion.button
                type="button"
                onClick={() => setShowMonthSummary((prev) => !prev)}
                whileTap={{ scale: 0.98 }}
                transition={springs.bouncy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                aria-expanded={showMonthSummary}
                aria-controls="month-summary-details"
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--sub)",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  This month
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      fontFamily: "Inter, sans-serif",
                      color:
                        monthIncome - monthExpenses < 0 ? "var(--error)" : "var(--text)",
                    }}
                  >
                    {monthIncome - monthExpenses < 0 ? "−" : "+"}$
                    {Math.abs(monthIncome - monthExpenses).toLocaleString()}
                  </span>
                  <motion.span
                    animate={{ rotate: showMonthSummary ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      display: "inline-flex",
                      fontSize: 14,
                      color: "var(--sub)",
                      opacity: 0.6,
                    }}
                  >
                    ▾
                  </motion.span>
                </div>
              </motion.button>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {showMonthSummary && (
                  <motion.div
                    id="month-summary-details"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: "0 20px 16px" }}>
                      {/* Show "Log income" prompt if no income recorded but has expenses */}
                      {monthIncome === 0 && monthExpenses > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 0",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--sub)",
                              fontFamily: "Inter, sans-serif",
                              textAlign: "center",
                            }}
                          >
                            Log income to see your balance
                          </p>
                          <motion.button
                            type="button"
                            onClick={onLogIncome}
                            whileTap={{ scale: 0.96 }}
                            transition={springs.bouncy}
                            style={{
                              background: "transparent",
                              border: "1.5px solid rgba(74, 222, 128, 0.4)",
                              borderRadius: 99,
                              padding: "10px 20px",
                              color: "var(--success)",
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: "Inter, sans-serif",
                              cursor: "pointer",
                            }}
                          >
                            Log income
                          </motion.button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 24 }}>
                          <div>
                            <p
                              style={{
                                fontSize: 18,
                                fontWeight: 600,
                                color: "var(--success)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              +${monthIncome.toLocaleString()}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>
                              income
                            </p>
                          </div>
                          <div>
                            <p
                              style={{
                                fontSize: 18,
                                fontWeight: 600,
                                color: "var(--error)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              −${monthExpenses.toLocaleString()}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>
                              spent
                            </p>
                          </div>
                          <div>
                            <p
                              style={{
                                fontSize: 18,
                                fontWeight: 600,
                                color:
                                  monthIncome - monthExpenses < 0
                                    ? "var(--error)"
                                    : "var(--text)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              ${Math.abs(monthIncome - monthExpenses).toLocaleString()}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>
                              net
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
        </section>
      </div>

      {/* ── Category Detail Sheet ───────────────────────────────── */}
      <CategoryDetailSheet
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        row={selectedRow}
        transactions={transactions}
        onLogHere={(cat) => { setSelectedRow(null); onLogExpense(cat) }}
      />
    </div>
    </PullToRefresh>
    </FadeInContent>
  )
}
