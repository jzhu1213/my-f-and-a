"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Transaction, Budget, Goal, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { CelebrationEvent } from "@/types/folio"
import type { DailyAllowance, QuickTransaction } from "@/types/folio"
import type { TransactionRepeat } from "@/lib/transactionUtils"
import { getRecentRepeats } from "@/lib/transactionUtils"
import { computeCategoryBudgets } from "@/lib/budgetUtils"
import type { CategoryBudgetRow } from "@/lib/budgetUtils"
import { selectContextualTip } from "@/lib/tipUtils"
import type { UserContext } from "@/lib/tipUtils"
import { checkAllCelebrations, getUnderBudgetStreak } from "@/lib/celebrationEngine"
import type { PaySchedule } from "@/lib/paySchedule"
import { getDaysUntilPayday, computeSafeToSpendUntilPayday, projectBalanceUntilPayday } from "@/lib/paySchedule"
import { getMinBalanceBuffer } from "@/lib/minBalanceBuffer"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeading,
  emptyStateContainer,
  emptyStateTitle,
  emptyStateSubtitle,
  linkButton,
  chipButton,
  pillButton,
} from "@/styles/shared"
import { DailyAllowanceHero } from "./DailyAllowanceHero"
import { ContextualTipCard } from "./ContextualTipCard"
import { InsightCard } from "./InsightCard"
import { InsightTrendCard } from "./InsightTrendCard"
import { NoSpendChallengeCard } from "./NoSpendChallengeCard"
import { InsightBreakdownCard } from "./InsightBreakdownCard"
import { GlassCard } from "@/components/ui/GlassCard"
import { HomeScreenSkeleton, FadeInContent } from "@/components/ui/Skeleton"
import { CategoryDetailSheet } from "@/components/accounting/CategoryDetailSheet"
import { SwipeableTransactionRow } from "./SwipeableTransactionRow"
import { PullToRefresh } from "./PullToRefresh"
import { AffordabilitySheet } from "./AffordabilitySheet"
import dynamic from "next/dynamic"

// Code-split: celebration animations are heavy (canvas-confetti + framer-motion
// particle layers) and only needed when a milestone is hit. Lazy-loading keeps
// them out of the initial bundle entirely. (Requirement 13.6)
const CelebrationOverlay = dynamic(
  () =>
    import("./CelebrationOverlay").then((mod) => ({
      default: mod.CelebrationOverlay,
    })),
  { ssr: false },
)

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
  /** Total set aside (reserved) this month */
  totalSetAside?: number
  /** Savings rate percentage (0-100) */
  savingsRate?: number
  /**
   * The user's persisted pay schedule (or null when none is set). When absent,
   * HomeScreen falls back to a flexible default so the payday-aware stat still
   * shows something useful for variable-income students / young adults.
   */
  paySchedule?: PaySchedule | null
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

  // ── Celebrations ───────────────────────────────────────────────────────────
  /** Active celebration event passed from the parent (e.g. after expense logged) */
  celebrationEvent?: CelebrationEvent | null
  /** Called when the celebration overlay is dismissed (auto-timeout or user tap) */
  onCelebrationDismiss?: () => void

  // ── Bill reminders ─────────────────────────────────────────────────────────
  /** Bills due within the next 3 days — used for contextual bill-due tips */
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
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
  totalSetAside,
  savingsRate,
  paySchedule,
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
  celebrationEvent: externalCelebration,
  onCelebrationDismiss,
  upcomingBills,
}: HomeScreenProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<CategoryBudgetRow | null>(null)
  const [showMonthSummary, setShowMonthSummary] = useState(false)
  const [localCelebration, setLocalCelebration] = useState<CelebrationEvent | null>(null)
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationEvent[]>([])
  const [showAffordabilitySheet, setShowAffordabilitySheet] = useState(false)
  const prevTxCountRef = useRef<number>(transactions.length)
  const prevGoalsRef = useRef<string>("")

  // ── Minimum-balance buffer (user preference, persisted in localStorage) ────
  // Hydrated after mount to stay SSR-safe; the projection falls back to the
  // sensible default until then.
  const [minBalanceBuffer, setMinBalanceBufferState] = useState<number | undefined>(undefined)
  useEffect(() => {
    setMinBalanceBufferState(getMinBalanceBuffer())
  }, [])

  // ── Dismissed tips (persisted in localStorage) ────────────────────────────
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>()
    try {
      const stored = localStorage.getItem("folio-dismissed-tips")
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    } catch {
      return new Set<string>()
    }
  })

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

  // ── Safe-to-spend-until-payday (Theme F, task 51.2) ───────────────────────
  // Spread the remaining discretionary pool across the days until the next
  // paycheck for a warm, low-pressure per-day figure. Falls back to a flexible
  // `irregular` schedule (anchored today) when the user hasn't set one — its
  // rhythm is estimated from their income history, so it still adapts.
  const safeToSpendPerDay = useMemo<number | null>(() => {
    const dailyBudget = allowance?.dailyBudget ?? 0
    // Nothing meaningful to show until we have a daily budget to work from.
    if (dailyBudget <= 0) return null

    const now = new Date()
    const daysRemainingInMonth =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1

    // Remaining discretionary money for the rest of the period — consumes the
    // DailyAllowance output rather than recomputing budgeting logic here.
    const discretionaryAvailable = dailyBudget * daysRemainingInMonth

    const schedule: PaySchedule =
      paySchedule ?? { cadence: "irregular", anchorDate: now.toISOString().slice(0, 10) }

    const daysUntilPayday = getDaysUntilPayday(schedule, now, transactions)

    return computeSafeToSpendUntilPayday(discretionaryAvailable, daysUntilPayday)
  }, [allowance, paySchedule, transactions])

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

  // ── Streak calculation (memoized) ──────────────────────────────────────────
  const underBudgetStreak = useMemo(
    () => getUnderBudgetStreak(budgets, transactions),
    [budgets, transactions]
  )

  // ── Contextual tip selection ──────────────────────────────────────────────
  const userContext = useMemo((): UserContext => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayTxs = transactions.filter(
      (t) => t.date.startsWith(todayStr) && t.type === "expense"
    )

    // Derive top category from today's expenses, default to "food"
    const categorySpend: Partial<Record<TransactionCategory, number>> = {}
    for (const tx of todayTxs) {
      categorySpend[tx.category] = (categorySpend[tx.category] ?? 0) + tx.amount
    }
    const topCategory: TransactionCategory =
      (Object.entries(categorySpend).sort(
        ([, a], [, b]) => (b as number) - (a as number)
      )[0]?.[0] as TransactionCategory) ?? "food"

    const dailyBudget = allowance?.dailyBudget ?? 0
    const spentToday = allowance?.spentToday ?? 0
    const todaySpentPercent = dailyBudget > 0 ? (spentToday / dailyBudget) * 100 : 0

    // ── Burn-rate velocity fields ──────────────────────────────────────────
    const now = new Date()
    const daysRemainingInMonth =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()

    // Average daily discretionary spending over the last 7 days
    let recentBurnRate: number | undefined
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)
    const recentExpenses = transactions.filter(
      (t) => t.type === "expense" && t.date >= sevenDaysAgoStr && t.date <= todayStr
    )
    if (recentExpenses.length > 0) {
      const totalRecentSpend = recentExpenses.reduce((sum, t) => sum + t.amount, 0)
      // Use min(7, days since first expense in range) to avoid divide by too large a window
      const firstExpenseDate = recentExpenses.reduce(
        (min, t) => (t.date < min ? t.date : min),
        recentExpenses[0].date
      )
      const daysInRange = Math.max(
        1,
        Math.ceil(
          (new Date(todayStr).getTime() - new Date(firstExpenseDate).getTime()) /
            86_400_000
        ) + 1
      )
      recentBurnRate = totalRecentSpend / daysInRange
    }

    // Discretionary pool remaining = daily budget * days remaining (approximate)
    const discretionaryPoolRemaining =
      dailyBudget > 0 ? dailyBudget * daysRemainingInMonth : undefined

    // ── Low-balance / overdraft projection (task 51.3) ─────────────────────
    // Project the discretionary pool forward at the recent burn rate until the
    // next payday and flag if it would dip below the user's comfort buffer.
    // Reuses the figures above rather than recomputing budgeting logic.
    let willDipBelowBuffer: boolean | undefined
    let projectedLowBalance: number | undefined
    let daysUntilBalanceDip: number | undefined
    if (
      discretionaryPoolRemaining != null &&
      recentBurnRate != null &&
      recentBurnRate > 0 &&
      minBalanceBuffer != null
    ) {
      const schedule: PaySchedule =
        paySchedule ?? { cadence: "irregular", anchorDate: todayStr }
      const daysUntilPayday = getDaysUntilPayday(schedule, now, transactions)
      const projection = projectBalanceUntilPayday(
        discretionaryPoolRemaining,
        daysUntilPayday,
        recentBurnRate,
        minBalanceBuffer
      )
      willDipBelowBuffer = projection.willDipBelowBuffer
      projectedLowBalance = projection.projectedLowBalance
      daysUntilBalanceDip = projection.daysUntilDip
    }

    return {
      underBudgetStreak,
      todaySpentPercent,
      totalTransactions: transactions.length,
      topCategory,
      allowance: {
        amount: allowance?.amount ?? 0,
        dailyBudget,
      },
      recentBurnRate,
      discretionaryPoolRemaining,
      daysRemainingInMonth,
      upcomingBills,
      willDipBelowBuffer,
      projectedLowBalance,
      minBalanceBuffer,
      daysUntilBalanceDip,
    }
  }, [transactions, allowance, underBudgetStreak, upcomingBills, paySchedule, minBalanceBuffer])

  const activeTip = useMemo(
    () => selectContextualTip(userContext, dismissedTips),
    [userContext, dismissedTips]
  )

  const handleDismissTip = useCallback(() => {
    if (!activeTip) return
    setDismissedTips((prev) => {
      const next = new Set(prev)
      next.add(activeTip.id)
      try {
        localStorage.setItem("folio-dismissed-tips", JSON.stringify([...next]))
      } catch {
        // localStorage unavailable — dismiss is still in memory
      }
      return next
    })
  }, [activeTip])

  // ── Celebration: first_transaction trigger (Requirement 6.5) ──────────────
  useEffect(() => {
    if (transactions.length !== 1) return
    if (typeof window === "undefined") return
    try {
      if (localStorage.getItem("folio-celebrated-first-tx")) return
    } catch {
      // If localStorage is unavailable, skip to avoid showing repeatedly
      return
    }

    // Fire the first_transaction celebration
    const event: CelebrationEvent = {
      id: "first-transaction-" + Date.now(),
      type: "first_transaction",
      title: "First one logged!",
      message: "You're on your way — tracking is the first step.",
      emoji: "🎉",
      animation: "confetti",
      duration: 4000,
      sound: "cheerful",
    }
    setLocalCelebration(event)

    try {
      localStorage.setItem("folio-celebrated-first-tx", "true")
    } catch {
      // Best-effort persistence
    }
  }, [transactions.length])

  // ── Celebration Engine: check all celebrations on data change ──────────────
  // Fires when transactions or goals change (after initial load).
  // Requirements 6.1–6.6: trigger celebrations for streaks, goal progress, etc.
  useEffect(() => {
    // Skip if data hasn't loaded yet (no budgets means no daily budget to compute)
    if (budgets.length === 0 && transactions.length === 0) return

    // Build a fingerprint for goals to detect changes
    const goalsFingerprint = goals.map(g => `${g.id}:${g.currentAmount}`).join("|")

    // Only run checks when data actually changes (not on every render)
    const txCountChanged = transactions.length !== prevTxCountRef.current
    const goalsChanged = goalsFingerprint !== prevGoalsRef.current

    // Update refs
    prevTxCountRef.current = transactions.length
    prevGoalsRef.current = goalsFingerprint

    // On first meaningful load OR when data changes, run celebration checks
    if (!txCountChanged && !goalsChanged) return

    const events = checkAllCelebrations(budgets, transactions, goals)
    if (events.length > 0) {
      // If no celebration is currently showing, show the first one immediately
      if (!localCelebration) {
        setLocalCelebration(events[0])
        if (events.length > 1) {
          setCelebrationQueue(events.slice(1))
        }
      } else {
        // Queue all new events
        setCelebrationQueue(prev => [...prev, ...events])
      }
    }
  }, [transactions, goals, budgets, localCelebration])

  // ── Effective celebration: external prop takes priority over local ─────────
  const effectiveCelebration = externalCelebration ?? localCelebration

  const handleCelebrationDismiss = useCallback(() => {
    if (externalCelebration) {
      onCelebrationDismiss?.()
    } else {
      // Advance to next queued celebration, or clear
      if (celebrationQueue.length > 0) {
        setLocalCelebration(celebrationQueue[0])
        setCelebrationQueue(prev => prev.slice(1))
      } else {
        setLocalCelebration(null)
      }
    }
  }, [externalCelebration, onCelebrationDismiss, celebrationQueue])

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
          maxWidth: CONTENT_MAX_WIDTH,
          padding: `0 ${HORIZONTAL_PADDING}px`,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          paddingTop: 16,
          paddingBottom: DOCK_PADDING_BOTTOM,
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
          {!isLoading && allowance && allowance.isEstimated && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                fontSize: 12,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 10,
                opacity: 0.85,
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.04)",
                borderRadius: 8,
              }}
              aria-label="Estimated allowance — set budget limits for accuracy"
            >
              ✨ This is an estimate — set budget limits for a more accurate daily budget
            </motion.p>
          )}
          {!isLoading && allowance && !allowance.isEstimated && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontSize: 12,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 10,
                opacity: 0.75,
              }}
              aria-label={`Spent today: $${Math.round(allowance.spentToday)}`}
            >
              Spent today: ${Math.round(allowance.spentToday)}
            </p>
          )}
          {!isLoading && allowance && allowance.reservedForBills && allowance.reservedForBills > 0 && (
            <p
              style={{
                fontSize: 11,
                color: "var(--warning)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 6,
                opacity: 0.85,
              }}
              aria-label={`$${Math.round(allowance.reservedForBills)} reserved for ${allowance.upcomingBillCount} upcoming bill${(allowance.upcomingBillCount ?? 0) > 1 ? 's' : ''}`}
            >
              💡 ${Math.round(allowance.reservedForBills)} reserved for {allowance.upcomingBillCount} upcoming bill{(allowance.upcomingBillCount ?? 0) > 1 ? 's' : ''}
            </p>
          )}

          {/* Safe-to-spend-until-payday — compact, warm secondary stat (task 51.2) */}
          {!isLoading && safeToSpendPerDay !== null && safeToSpendPerDay > 0 && (
            <motion.p
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                fontSize: 13,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 10,
                opacity: 0.9,
                padding: "8px 14px",
                background: "rgba(167, 139, 250, 0.10)",
                borderRadius: 999,
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
                width: "fit-content",
                maxWidth: "100%",
              }}
              aria-label={`You've got room to spend about $${Math.round(safeToSpendPerDay)} a day until your next paycheck`}
            >
              🗓️ You&rsquo;ve got room for{" "}
              <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                ~${Math.round(safeToSpendPerDay).toLocaleString("en-US")}/day
              </strong>{" "}
              until payday
            </motion.p>
          )}

          {/* "Can I afford...?" quick check button (task 56.3) */}
          {!isLoading && allowance && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <motion.button
                type="button"
                onClick={() => setShowAffordabilitySheet(true)}
                whileTap={{ scale: 0.96 }}
                transition={springs.bouncy}
                aria-label="Can I afford this? Quick purchase check"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  color: "var(--sub)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  opacity: 0.85,
                }}
              >
                💭 Can I afford...?
              </motion.button>
            </div>
          )}
        </section>

        {/* ── 1.25. Set Aside Stat ────────────────────────────────── */}
        {(totalSetAside ?? 0) > 0 && (
          <section aria-label="Set aside this month">
            <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">🏦</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: "var(--sub)", fontFamily: FONT_FAMILY, marginBottom: 2 }}>
                    Set aside this month
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontFamily: FONT_FAMILY, fontVariantNumeric: "tabular-nums" }}>
                    ${Math.round(totalSetAside ?? 0).toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>
        )}

        {/* ── 1.3. Savings Rate Stat ──────────────────────────────── */}
        {(savingsRate ?? 0) > 0 && (
          <section aria-label="Savings rate">
            <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">💪</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: "var(--sub)", fontFamily: FONT_FAMILY, marginBottom: 2 }}>
                    Savings rate
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", fontFamily: FONT_FAMILY, fontVariantNumeric: "tabular-nums" }}>
                    {savingsRate}%
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>
        )}

        {/* ── 1.5. Contextual Tip ─────────────────────────────────── */}
        {/* TODO(task-38): Wire onLearnMore to Lessons tab once it exists; currently a no-op. */}
        <AnimatePresence>
          {activeTip && (
            <section aria-label="Contextual tip">
              <ContextualTipCard
                tip={activeTip}
                onDismiss={handleDismissTip}
                onLearnMore={() => {}}
                onActionComplete={() => {}}
              />
            </section>
          )}
        </AnimatePresence>

        {/* ── 1.6. End-of-Month Projection Insight ─────────────── */}
        <InsightCard
          transactions={transactions}
          budgets={budgets}
        />

        {/* ── 1.7. Month-over-Month Trend Insight ──────────────── */}
        <InsightTrendCard transactions={transactions} />

        {/* ── 1.8. No-Spend Challenge / Streak Card ───────────────── */}
        <NoSpendChallengeCard transactions={transactions} />

        {/* ── 1.9. Spending Breakdown Insight ──────────────────── */}
        <InsightBreakdownCard transactions={transactions} />

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
                fontFamily: FONT_FAMILY,
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
                fontFamily: FONT_FAMILY,
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
                    aria-label={`Log again: ${repeat.label}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
                    whileTap={{ scale: 0.95 }}
                    style={chipButton}
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
          <h2 style={{ ...sectionHeading, marginBottom: 12 }}>
            Categories
          </h2>
          {categoryRows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <GlassCard elevation="low" style={{ padding: "28px 20px", borderRadius: 14 }}>
                <div style={emptyStateContainer}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">🎯</span>
                  <p style={emptyStateTitle}>
                    Set limits for an accurate daily budget
                  </p>
                  <p style={emptyStateSubtitle}>
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

                const budgetLabel = row.hasLimit
                  ? row.overWeekly
                    ? `${row.label}: $${Math.abs(Math.round(row.weeklyLeft))} over budget`
                    : `${row.label}: $${Math.max(0, Math.round(row.weeklyLeft))} left this week`
                  : `${row.label}: no limit set${row.weeklySpent > 0 ? `, $${Math.round(row.weeklySpent)} spent` : ""}`

                return (
                  <motion.button
                    key={row.category}
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.bouncy}
                    aria-label={budgetLabel}
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
                          fontFamily: FONT_FAMILY,
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
                              fontFamily: FONT_FAMILY,
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
                              fontFamily: FONT_FAMILY,
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
                                fontFamily: FONT_FAMILY,
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
            <h2 style={sectionHeading}>
              Recent
            </h2>
            {recentTransactions.length > 0 && (
              <button
                type="button"
                onClick={onViewAllHistory}
                style={{
                  ...linkButton,
                  fontSize: 12,
                  opacity: 0.7,
                }}
                aria-label="See all transactions"
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
                <div style={emptyStateContainer}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">✨</span>
                  <p style={emptyStateTitle}>
                    Start by logging your first expense!
                  </p>
                  <p style={emptyStateSubtitle}>
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
                        fontFamily: FONT_FAMILY,
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
                                fontFamily: FONT_FAMILY,
                              }}
                            >
                              {emoji} {label}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                fontFamily: FONT_FAMILY,
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
                aria-label={`Monthly summary: ${monthIncome - monthExpenses < 0 ? "−" : "+"}$${Math.abs(monthIncome - monthExpenses).toLocaleString()} net. ${showMonthSummary ? "Collapse" : "Expand"} details.`}
              >
                <span style={sectionHeading}>
                  This month
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      fontFamily: FONT_FAMILY,
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
                              fontFamily: FONT_FAMILY,
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
                              ...pillButton,
                              padding: "10px 20px",
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
                                fontFamily: FONT_FAMILY,
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
                                fontFamily: FONT_FAMILY,
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
                                fontFamily: FONT_FAMILY,
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

      {/* ── Affordability Sheet (task 56.3) ────────────────────── */}
      <AffordabilitySheet
        isOpen={showAffordabilitySheet}
        onClose={() => setShowAffordabilitySheet(false)}
        budgets={budgets}
        transactions={transactions}
      />

      {/* ── Celebration Overlay (Requirements 6.1–6.7) ────────── */}
      {/* Suspense boundary ensures the lazy chunk is silently deferred — no
          loading indicator needed since celebrations appear post-interaction. */}
      <Suspense fallback={null}>
        <CelebrationOverlay
          event={effectiveCelebration ?? null}
          onDismiss={handleCelebrationDismiss}
        />
      </Suspense>
    </div>
    </PullToRefresh>
    </FadeInContent>
  )
}
