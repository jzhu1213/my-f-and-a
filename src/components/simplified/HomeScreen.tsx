"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Transaction, Budget, Goal, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { CelebrationEvent } from "@/types/folio"
import type { DailyAllowance, IncomeSmoothing, QuickTransaction } from "@/types/folio"
import type { TransactionRepeat } from "@/lib/transactionUtils"
import { getRecentRepeats } from "@/lib/transactionUtils"
import { computeCategoryBudgets } from "@/lib/budgetUtils"
import type { CategoryBudgetRow } from "@/lib/budgetUtils"
import { selectContextualTip } from "@/lib/tipUtils"
import type { UserContext } from "@/lib/tipUtils"
import {
  shouldShowContextualContent,
  markSessionTipShown,
  recordTipShown,
  incrementAppOpenCount,
} from "@/lib/tipUtils"
import { checkAllCelebrations, getUnderBudgetStreak } from "@/lib/celebrationEngine"
import { CELEBRATION_COPY, CELEBRATION_EMOJI, getCategoryEmoji } from "@/lib/vocabulary"
import { recordLastActive } from "@/lib/reminderPreferences"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
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
import { GlassCard } from "@/components/ui/GlassCard"
import { HomeScreenSkeleton, FadeInContent } from "@/components/ui/Skeleton"
import { CategoryDetailSheet } from "@/components/accounting/CategoryDetailSheet"
import { SwipeableTransactionRow } from "./SwipeableTransactionRow"
import { InlineTransactionEditor } from "./InlineTransactionEditor"
import { PullToRefresh } from "./PullToRefresh"
import { AffordabilitySheet } from "./AffordabilitySheet"
import { WelcomeBackBadge } from "./WelcomeBackBadge"
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

/**
 * ─── 10-SECOND SESSION: TAP-TO-DONE AUDIT (Task 71) ─────────────────────────
 *
 * Core flow #1: CHECK DAILY ALLOWANCE
 *   Open app → see hero number.
 *   Taps: 0 (instant — the hero is the first thing visible)
 *   Time: <1 second for a returning user (cached data, FadeInContent)
 *
 * Core flow #2: LOG AN EXPENSE (returning user with history)
 *   1. Tap "Log expense" button (or repeat chip = 1 tap total)
 *   2. Type amount (keyboard auto-focused, category pre-filled from habit engine)
 *   3. Tap "Log" to submit
 *   Taps: 2–3 (amount entry + submit; category auto-selected)
 *   Time: ~5–8 seconds (well under 10s target)
 *   With repeat chip: 1 tap to log a recent transaction instantly.
 *
 * AUTO-DISMISS BEHAVIOR:
 *   Both ExpenseSheet and IncomeSheet call `onClose()` synchronously after
 *   `onSubmit()`. The sheet exit animation is 250ms (timings.normal) for slide
 *   or 150ms (timings.fast) for reduced-motion — no lingering state or delay.
 *   The user returns to the hero immediately.
 *
 * HOME SCREEN AS LAUNCHPAD:
 *   - Hero + quick actions + repeat chips are above the fold
 *   - Insight cards are collapsed by default (expandable toggle)
 *   - Contextual tip and no-spend challenge are disabled (commented out)
 *   - Monthly summary is collapsed by default
 *   - No infinite scroll or feed patterns
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
// OverBudgetStrip sub-component (task 70.3)
// ============================================================================

/**
 * A compact, warm inline suggestion strip shown directly below the hero when
 * the user's allowance status is 'over'. Offers one practical next step and a
 * one-tap shortcut to log income.
 *
 * - Dismissed automatically when the user logs income (status leaves 'over')
 * - No persistent dismiss button — auto-hides when no longer needed
 * - Entrance animation: fade-in only (respects prefers-reduced-motion)
 */
function OverBudgetStrip({ onLogIncome }: { onLogIncome: () => void }) {
  const prefersReducedMotion = useReducedMotion()

  const motionProps = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.35, ease: 'easeOut' as const },
      }

  return (
    <motion.div
      role="status"
      aria-label="Over budget suggestion"
      {...motionProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'rgba(248, 113, 113, 0.06)',
        border: '1px solid rgba(248, 113, 113, 0.18)',
        borderRadius: 12,
        padding: '12px 16px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--sub)',
          fontFamily: FONT_FAMILY,
          flex: 1,
        }}
      >
        Tomorrow&rsquo;s budget resets — or log income to top up today.
      </p>

      <motion.button
        type="button"
        onClick={onLogIncome}
        whileTap={{ scale: 0.95 }}
        transition={springs.bouncy}
        aria-label="Log income to top up your budget"
        style={{
          flexShrink: 0,
          background: 'rgba(248, 113, 113, 0.12)',
          border: '1px solid rgba(248, 113, 113, 0.30)',
          borderRadius: 999,
          padding: '7px 14px',
          color: '#f87171',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: FONT_FAMILY,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Log income →
      </motion.button>
    </motion.div>
  )
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
  /** Whether cached data is stale and background fetch hasn't completed */
  isStale?: boolean

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
  /** Called when user wants to inline-edit a transaction (swipe-right) — saves edits */
  onEditTransaction?: (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string }
  ) => Promise<Transaction | null>
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
  userName,
  isLoading,
  isStale,
  onHeroTapDetails,
  onLogExpense,
  onLogIncome,
  onRepeatLog,
  onViewTransaction,
  onViewAllHistory,
  onDeleteTransaction,
  onEditTransaction,
  onRefresh,
  celebrationEvent: externalCelebration,
  onCelebrationDismiss,
  upcomingBills,
}: HomeScreenProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<CategoryBudgetRow | null>(null)
  const [localCelebration, setLocalCelebration] = useState<CelebrationEvent | null>(null)
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationEvent[]>([])
  const [showAffordabilitySheet, setShowAffordabilitySheet] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const prevTxCountRef = useRef<number>(transactions.length)
  const prevGoalsRef = useRef<string>("")

  // ── "New day" micro-celebration (task 74) ────────────────────────────────
  // Shows a brief warm indicator when the user opens the app on a new calendar day.
  const [showNewDayRefresh, setShowNewDayRefresh] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const lastOpenDate = localStorage.getItem("folio-last-open-date")
      if (lastOpenDate !== todayStr) {
        // It's a new day — show the refresh indicator
        setShowNewDayRefresh(true)
        localStorage.setItem("folio-last-open-date", todayStr)
        // Auto-dismiss after 2.5 seconds
        const timer = setTimeout(() => setShowNewDayRefresh(false), 2500)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable — skip gracefully
    }
  }, [])

  // ── App-open counter for tip throttling (task 75) ──────────────────────────
  useEffect(() => {
    incrementAppOpenCount()
    recordLastActive()
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

  // ── Streak calculation (memoized) ──────────────────────────────────────────
  const underBudgetStreak = useMemo(
    () => getUnderBudgetStreak(budgets, transactions),
    [budgets, transactions]
  )

  // ── Contextual tip selection (simplified — many advanced features removed) ──────────────────────────────────────────────
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

    return {
      underBudgetStreak,
      todaySpentPercent,
      totalTransactions: transactions.length,
      topCategory,
      allowance: {
        amount: allowance?.amount ?? 0,
        dailyBudget,
      },
      upcomingBills,
    }
  }, [transactions, allowance, underBudgetStreak, upcomingBills])

  const activeTip = useMemo(
    () => {
      const candidate = selectContextualTip(userContext, dismissedTips)
      // Gate: only show if cooldown has elapsed, session hasn't shown one yet,
      // and it's a genuinely new tip (not the same one shown last time).
      if (!shouldShowContextualContent(candidate?.id ?? null)) return null
      return candidate
    },
    [userContext, dismissedTips]
  )

  // When a tip is rendered, mark it in the session and persist metadata so
  // the cooldown/novelty checks work across app opens.
  useEffect(() => {
    if (!activeTip) return
    markSessionTipShown()
    recordTipShown(activeTip.id)
  }, [activeTip])

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
      title: CELEBRATION_COPY.first_transaction.title,
      message: CELEBRATION_COPY.first_transaction.message,
      emoji: CELEBRATION_EMOJI.first_transaction,
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
        <section aria-label="Daily allowance" style={{ position: "relative" }}>
          {/* Stale data indicator — only shown when cache is outdated */}
          {isStale && (
            <div
              aria-label="Syncing latest data"
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                display: "flex",
                alignItems: "center",
                gap: 4,
                zIndex: 2,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--sub)",
                  opacity: 0.7,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--sub)",
                  opacity: 0.7,
                  fontFamily: FONT_FAMILY,
                }}
              >
                syncing…
              </span>
            </div>
          )}
          <DailyAllowanceHero
            allowanceLeft={allowance?.amount ?? 0}
            dailyBudget={allowance?.dailyBudget ?? 0}
            spentToday={allowance?.spentToday ?? 0}
            rollover={allowance?.rollover ?? 0}
            isOverBudget={allowance?.status === "over"}
            isLoading={isLoading}
            onTapForDetails={onHeroTapDetails}
          />

          {/* "New day" micro-celebration (task 74) — warm, brief indicator */}
          <AnimatePresence>
            {showNewDayRefresh && (
              <motion.div
                role="status"
                aria-live="polite"
                aria-label="New day — your budget has refreshed"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                  textAlign: "center",
                  marginTop: 10,
                  fontFamily: FONT_FAMILY,
                  fontSize: 12,
                  color: "var(--accent, #a78bfa)",
                  opacity: 0.9,
                }}
              >
                ☀️ Fresh start — new day, new budget
              </motion.div>
            )}
          </AnimatePresence>
          {!isLoading && allowance && allowance.isEstimated && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                fontSize: 13,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 10,
                padding: "12px 16px",
                background: "rgba(167, 139, 250, 0.08)",
                borderRadius: 12,
                lineHeight: 1.5,
              }}
              aria-label="This is an estimated daily budget. Tap to personalize it."
            >
              <p style={{ margin: 0, fontSize: 13, opacity: 0.95 }}>
                ✨ This is a starting estimate — no setup needed
              </p>
              <button
                type="button"
                onClick={onLogIncome}
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                  fontFamily: FONT_FAMILY,
                }}
                aria-label="Set your income for a more accurate daily budget"
              >
                Want a more accurate number? Log your income →
              </button>
            </motion.div>
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
        </section>

        {/* ── 1.4. Welcome-back badge (task 77) ────────────────── */}
        <WelcomeBackBadge />

        {/* ── 1.5. Over-budget "what's next" strip (task 70.3) ───── */}
        <AnimatePresence>
          {!isLoading && allowance?.status === 'over' && (
            <OverBudgetStrip onLogIncome={onLogIncome} />
          )}
        </AnimatePresence>

        {/* ── 2. Quick Actions (thumb zone — immediately after hero) ── */}
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

        {/* ── 2.5. Log Again — Quick Repeat (max 3 items for cleanliness) ────────────────────── */}
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
                const emoji = getCategoryEmoji(repeat.category)
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

        {/* ── 3. Category Budget Cards (top 4 only for cleanliness) ────────────────────────────── */}
        <section aria-label="Budget categories">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={sectionHeading}>
              Categories
            </h2>
            {categoryRows.length > 4 && (
              <button
                type="button"
                onClick={() => {/* TODO: navigate to Settings > Budget Limits */}}
                style={{
                  ...linkButton,
                  fontSize: 12,
                  opacity: 0.7,
                }}
                aria-label="See all categories"
              >
                See all →
              </button>
            )}
          </div>
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
              {categoryRows.slice(0, 4).map((row) => {
                const barColor = row.overWeekly
                  ? "var(--error)"
                  : row.nearLimit
                  ? "var(--warning)"
                  : "var(--success)"

                const budgetLabel = row.hasLimit
                  ? row.overWeekly
                    ? `${row.label}: $${Math.abs(Math.round(row.weeklyLeft))} over this week`
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
                              ? `$${Math.abs(Math.round(row.weeklyLeft))} over this week`
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
                      const emoji = getCategoryEmoji(tx.category)
                      const label = tx.note || catInfo?.label || tx.category
                      const isLast =
                        groupIdx === grouped.length - 1 &&
                        txIdx === group.txs.length - 1

                      return (
                        <div key={tx.id}>
                          <SwipeableTransactionRow
                            id={tx.id}
                            onDelete={(id) => onDeleteTransaction?.(id)}
                            onTap={() => onViewTransaction(tx)}
                            onEdit={onEditTransaction ? (id) => setInlineEditId(id) : undefined}
                            showBorder={!isLast && inlineEditId !== tx.id}
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
                          {inlineEditId === tx.id && onEditTransaction && (
                            <InlineTransactionEditor
                              transaction={tx}
                              onSave={onEditTransaction}
                              onClose={() => setInlineEditId(null)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </GlassCard>
          )}
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
