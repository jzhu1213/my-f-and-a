"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Transaction, Budget, Goal, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { CelebrationEvent } from "@/types/folio"
import type { DailyAllowance } from "@/types/folio"
import type { HeroMeaning, HeroDisplay } from "@/types/folio"
import type { TransactionRepeat } from "@/lib/transactionUtils"
import { getRecentRepeats } from "@/lib/transactionUtils"
import { computeCategoryBudgets } from "@/lib/budgetUtils"
import type { CategoryBudgetRow } from "@/lib/budgetUtils"
import { getRelativeDate } from "@/lib/dateUtils"
import { buildUserContext, selectContextualTip } from "@/lib/tipUtils"
import type { DetectedSubscription } from "@/lib/subscriptionDetector"
import {
  shouldShowContextualContent,
  markSessionTipShown,
  recordTipShown,
  incrementAppOpenCount,
} from "@/lib/tipUtils"
import { checkAllCelebrations, getUnderBudgetStreak } from "@/lib/celebrationEngine"
import { CELEBRATION_COPY, CELEBRATION_EMOJI, getCategoryEmoji } from "@/lib/vocabulary"
import { recordLastActive } from "@/lib/reminderPreferences"
import { getInsightsEnabled } from "@/lib/insightPreferences"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { springs, timings, STAGGER_STEP } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import type { SpendingMode } from "@/lib/spendingModes"
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
  borderRadius,
  progressTrack,
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
import { IncomeAnchorBanner } from "./IncomeAnchorBanner"
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
 *   - Hero + quick actions own the first screenful (above the fold)
 *   - OverBudgetStrip is contextual to hero, stays above fold when shown
 *   - Log Again repeats, insights, category cards are below the fold
 *   - Contextual tip is opt-in via Settings → Preferences → "Show daily insight"
 *   - No infinite scroll or feed patterns
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
  const prefersReducedMotion = useReducedMotion() ?? false

  const motionProps = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: timings.fast,
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: timings.slow,
      }

  return (
    <motion.div
      role="status"
      aria-label="Spending suggestion"
      {...motionProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'rgba(248, 113, 113, 0.06)',
        border: '1px solid rgba(248, 113, 113, 0.18)',
        borderRadius: borderRadius.md,
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
          borderRadius: borderRadius.full,
          padding: '7px 14px',
          color: 'var(--error)',
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

  // ── Subscription alerts ─────────────────────────────────────────────────────
  /**
   * Detected subscriptions (already filtered for dismissals) — used to surface
   * gentle "renewing soon" / "trial ending" heads-up tips.
   */
  detectedSubscriptions?: DetectedSubscription[]

  // ── Weekend allowance ──────────────────────────────────────────────────────
  /** Pre-computed weekend allowance data from useHomeData */
  weekendAllowance?: { weekendAmount: number; label: string; daysUntilWeekend: number } | null

  // ── Navigation helpers for empty states ────────────────────────────────────
  /** Called when user taps the CTA in the "no budgets" empty state */
  onOpenBudgetSettings?: () => void
  /** Called when user taps the "Split" quick action (task 5.3 — one-tap split) */
  onOpenSplitExpense?: () => void

  // ── Outstanding Splits (task 5.3 — who-owes-whom summary) ──────────────────
  /** Outstanding split balances: positive = they owe you */
  outstandingSplits?: { name: string; amount: number }[]
  /** Called when user taps the outstanding splits summary to see full ledger */
  onOpenReimbursements?: () => void
  /** Set of transaction IDs that were split (for badge display) */
  splitTransactionIds?: Set<string>

  // ── Income Anchor (task 95.1) ───────────────────────────────────────────────
  /** Whether to show the income-anchor first-run banner */
  showIncomeAnchorBanner?: boolean
  /** Called when the user taps "Set it now" on the income anchor banner */
  onIncomeAnchorSetItNow?: () => void
  /** Called when the user taps "Skip" on the income anchor banner */
  onIncomeAnchorSkip?: () => void
  /** Current spending mode — controls hero framing and tip copy */
  spendingMode?: SpendingMode
  /** The user's chosen hero meaning (what the big number shows) */
  heroMeaning?: HeroMeaning
  /** Pre-computed display values for the chosen hero meaning */
  heroDisplay?: HeroDisplay
  /**
   * Over-limit response — controls what the UI shows when the user exceeds
   * their daily allowance. Defaults to 'gentle' when not provided.
   * - quiet: color change only (no additional text)
   * - gentle: one calm line below the hero
   * - headsup: one calm line + a small actionable chip
   */
  overLimitResponse?: import('@/lib/spendingModes').OverLimitResponse
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
 *   ── ABOVE THE FOLD (first screenful) ──
 *   Hero (DailyAllowanceHero + contextual indicators)
 *   OverBudgetStrip (when applicable)
 *   Quick Actions (Log expense / Log income)
 *
 *   ── BELOW THE FOLD (scroll to see) ──
 *   Log Again Repeats
 *   WelcomeBackBadge
 *   Category Budget Cards
 *   Recent Transactions
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
  detectedSubscriptions,
  weekendAllowance,
  onOpenBudgetSettings,
  onOpenSplitExpense,
  outstandingSplits,
  onOpenReimbursements,
  splitTransactionIds,
  showIncomeAnchorBanner,
  onIncomeAnchorSetItNow,
  onIncomeAnchorSkip,
  spendingMode = 'guided',
  heroMeaning,
  heroDisplay,
  overLimitResponse = 'gentle',
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
  const prefersReducedMotion = useReducedMotion() ?? false
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

  // ── Insights opt-in preference ──────────────────────────────────────────
  const [insightsEnabled] = useState(() => getInsightsEnabled())

  // ── Derived data ──────────────────────────────────────────────────────────
  // Compute the current month + today's date once per mount rather than on
  // every render (these are stable for the duration of a session). Deriving
  // them here keeps the dependent memos from re-running on unrelated state
  // changes (opening a sheet, celebrations, inline edits, tip dismissals).
  const { currentMonth, todayStr } = useMemo(() => {
    const iso = new Date().toISOString()
    return { currentMonth: iso.slice(0, 7), todayStr: iso.slice(0, 10) }
  }, [])

  // Only the 5 most recent transactions are rendered; recompute this slice only
  // when the transactions array itself changes, not on every render.
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions])

  // ── Category budget rows (sorted) ────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const rows = computeCategoryBudgets(budgets, transactions, currentMonth, true)
    return rows.sort((a, b) => {
      // Over-budget first (only applies to categories with limits set)
      if (a.overWeekly && !b.overWeekly) return -1
      if (!a.overWeekly && b.overWeekly) return 1
      // Then by least remaining (for those with limits)
      if (a.hasLimit && b.hasLimit) return a.weeklyLeft - b.weeklyLeft
      // Limit holders before no-limit (no-limit categories are purely informational)
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
  // Heavy derivation lives in a pure lib function (buildUserContext); the memo
  // only re-runs when its inputs actually change.
  const userContext = useMemo(
    () =>
      buildUserContext({
        transactions,
        allowance,
        underBudgetStreak,
        upcomingBills,
        detectedSubscriptions,
        today: todayStr,
        spendingMode,
      }),
    [transactions, allowance, underBudgetStreak, upcomingBills, detectedSubscriptions, todayStr, spendingMode]
  )

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
          paddingTop: 24,
          paddingBottom: DOCK_PADDING_BOTTOM,
        }}
      >
        {/* ══════════════════════════════════════════════════════════════════
            AUDIT: Hero Secondary Elements (task 78.1)
            ─────────────────────────────────────────────────────────────────
            All conditional elements below <DailyAllowanceHero>:

            ┌─────────────────────────────────────────────────────────────────┐
            │ #  Element                     Condition             Position   │
            ├─────────────────────────────────────────────────────────────────┤
            │ 1  "New day" micro-celebration  showNewDayRefresh     marginTop │
            │    (task 74)                    (first open of new    10px,     │
            │                                 calendar day, auto-   centered  │
            │                                 dismiss after 2.5s)   12px font │
            │                                                                 │
            │ 2  Estimated-budget explainer   allowance.isEstimated marginTop │
            │    + "Want a more accurate      === true              10px,     │
            │    number?" CTA                 (!isLoading)          padding   │
            │                                                       12px 16px │
            │                                                       bg purple │
            │                                                       0.08      │
            │                                                                 │
            │ 3  "Spent today" stat           !allowance.isEstimated marginTop│
            │                                 (!isLoading)           10px,    │
            │                                                        12px,   │
            │                                                        opacity │
            │                                                        0.75    │
            │                                                                 │
            │ 4  OverBudgetStrip (task 70.3)  allowance.status ===  After    │
            │    "Tomorrow resets" + Log      'over' (!isLoading)   </section>│
            │    income CTA                                         own block │
            │                                                                 │
            │ 5a Log expense button           ALWAYS                Quick     │
            │ 5b Log income button            ALWAYS                Actions   │
            │ 5c "Can I afford this?" button  ALWAYS                section   │
            └─────────────────────────────────────────────────────────────────┘

            MUTUAL EXCLUSIVITY:
            • Elements 2 & 3 are mutually exclusive (isEstimated XOR !isEstimated)
            • Element 4 can only co-occur with 3 (estimated users can't go "over")

            CO-OCCURRENCE:
            • Element 1 (new day) can appear with either 2 or 3
            • Element 5 (quick actions) ALWAYS renders regardless of other state

            WORST-CASE VERTICAL STACK (max density):
            Hero → New day text → Spent today stat → OverBudgetStrip →
            Quick Actions (Log expense + Log income row + Can I afford pill)
            = GlassCard + 3 info elements + strip + 3 buttons

            PLANNED BUT NOT YET RENDERED:
            • safe-spend-per-day badge (task 51.2) — DailyAllowance type ready
            • income-smoothing stability badge (task 68.3) — config in Settings
            • reserved-for-bills notice — DailyAllowance.reservedForBills computed
              but never displayed on HomeScreen

            These planned elements would increase worst-case stacking further.
            Simplification (task 78+) aims to consolidate into a single
            contextual secondary line below the hero number.

            Validates: Requirements 2.1, 2.3

            ═══════════════════════════════════════════════════════════════════
            DESIGN DECISION: Cleaner Hero Layout (task 78.2)
            ─────────────────────────────────────────────────────────────────
            CHOSEN DIRECTION: Option (c) + (d) combined
            ─────────────────────────────────────────────────────────────────

            GOAL: Reduce vertical stacking below the hero so the above-the-fold
            content feels like "Hero → (1 contextual line) → Quick Actions"
            instead of the current "Hero → 3–4 distinct blocks → Quick Actions".

            CHANGES (to be implemented in task 78.3):

            1. REMOVE "Can I afford this?" from quick actions section.
               - It's a tertiary action adding a full-width pill with its own
                 border and color scheme — heavy visual weight for an infrequent
                 action.
               - RELOCATE: Move to a subtle text link BELOW the two primary
                 quick action buttons (same row, smaller size, no border/fill).
                 Format: "🤔 Can I afford this?" as a plain 12px link-style
                 button centered under the Log expense / Log income row.
               - This keeps it accessible and discoverable but visually quiet.

            2. REMOVE standalone "Spent today: $X" line.
               - This stat is already visible inside the hero breakdown (tap to
                 reveal). Showing it redundantly adds an extra visual block.
               - The hero ring + dollar amount already conveys spending progress.
               - CHANGE: Remove the standalone <p> element entirely. Users who
                 want the number can tap the hero for the full breakdown.

            3. KEEP estimated-budget explainer but COMPACT it.
               - Reduce padding from 12px 16px → 8px 14px
               - Reduce font size from 13px → 12px
               - Remove the separate <button> element; make the entire block
                 tappable (onClick={onLogIncome} on the container) with an
                 inline "→" affordance instead of a separate underlined link.
               - Net: same info, ~40% less vertical space.

            4. KEEP OverBudgetStrip but REDUCE gap between hero and strip.
               - Remove the extra section gap (currently 28px from flex gap).
               - Move OverBudgetStrip INSIDE the hero <section> so it shares
                 the hero's visual group with only 10px margin-top.
               - This makes it feel like a "status extension" of the hero rather
                 than a separate distinct block.

            5. "New day" text UNCHANGED (already ephemeral — auto-dismisses
               after 2.5s, so it contributes no permanent clutter).

            RESULTING VISUAL HIERARCHY (above the fold):

            ┌──────────────────────────────────────────────────────────────┐
            │  DailyAllowanceHero (glass card, ring, big number)          │
            │    └─ [optional, 2.5s] "☀️ Fresh start" (12px, centered)   │
            │    └─ [if estimated] Compact explainer (12px, tappable)     │
            │    └─ [if over] OverBudgetStrip (tight to hero, no gap)     │
            ├──────────────────────────────────────────────────────────────┤
            │  Quick Actions                                               │
            │    [══ Log expense ══]  [Log income]   ← 2 primary buttons  │
            │         🤔 Can I afford this?          ← 12px text link     │
            └──────────────────────────────────────────────────────────────┘

            NET RESULT:
            • Worst-case above-fold: Hero + 1 contextual element + 2 buttons
              + 1 subtle text link (vs. current 3 blocks + 3 buttons)
            • Removed visual elements: 1 full-width bordered pill, 1 standalone
              stat line
            • Visual weight reduction: ~35% less secondary chrome above fold
            • Zero functionality removed — everything is still reachable

            CONSTRAINTS RESPECTED:
            ✓ Hero number stays dominant (largest element, untouched)
            ✓ No functionality removed (affordability moved, not deleted)
            ✓ Warm design language maintained (glass surfaces, Inter, purple)
            ✓ Mobile-first / thumb-friendly (primary buttons stay large)
            ✓ "Radical simplicity" + "clean uncluttered home canvas"

            Validates: Requirements 8.1, 8.4
            ══════════════════════════════════════════════════════════════════ */}
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
            deferredSpending={allowance?.deferredSpending}
            reservedForBills={allowance?.reservedForBills}
            upcomingBillCount={allowance?.upcomingBillCount}
            reservedForScheduled={allowance?.reservedForScheduled}
            scheduledCount={allowance?.scheduledCount}
            onTapForDetails={onHeroTapDetails}
            spendingMode={spendingMode}
            heroMeaning={heroMeaning}
            heroDisplay={heroDisplay}
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
                transition={timings.slow}
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
            <motion.button
              type="button"
              onClick={onLogIncome}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={timings.slow}
              style={{
                fontSize: 12,
                color: "var(--sub)",
                textAlign: "center",
                fontFamily: FONT_FAMILY,
                marginTop: 10,
                padding: "8px 14px",
                background: "rgba(167, 139, 250, 0.08)",
                borderRadius: borderRadius.md,
                lineHeight: 1.5,
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
              aria-label="Estimated budget — tap to log income for a more accurate daily budget"
            >
              ✨ Estimated — tap to log income for accuracy →
            </motion.button>
          )}
          {/* ── Over-budget strip (task 70.3) — inside hero section ───── */}
          {/* In tracker mode, there is no "over budget" concept — suppress this entirely */}
          <AnimatePresence>
            {!isLoading && spendingMode !== 'tracker' && allowance?.status === 'over' && (
              <div style={{ marginTop: 10 }}>
                {/* quiet: color change only — no strip */}
                {overLimitResponse === 'gentle' && (
                  <motion.p
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={timings.slow}
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--sub)',
                      fontFamily: FONT_FAMILY,
                      textAlign: 'center',
                      padding: '8px 4px',
                    }}
                    aria-label="Over-limit gentle note"
                  >
                    Spent a bit more today — tomorrow resets ✨
                  </motion.p>
                )}
                {overLimitResponse === 'headsup' && (
                  <OverBudgetStrip onLogIncome={onLogIncome} />
                )}
              </div>
            )}
          </AnimatePresence>

          {/* ── Weekend allowance pill (task 5.1) — only Fri/Sat/Sun ───── */}
          {weekendAllowance && weekendAllowance.daysUntilWeekend === 0 && (
            <motion.div
              role="status"
              aria-label={`${weekendAllowance.label}: $${weekendAllowance.weekendAmount} safe to spend`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={timings.normal}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 10,
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-full)',
                alignSelf: 'center',
                width: 'fit-content',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <span style={{ fontSize: 13 }} aria-hidden="true">🎉</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--sub)',
                  fontFamily: FONT_FAMILY,
                  opacity: 0.85,
                }}
              >
                ${weekendAllowance.weekendAmount} {weekendAllowance.label.toLowerCase()}
              </span>
            </motion.div>
          )}
        </section>

        {/* ── Income Anchor Banner (task 95.1) — first-run only ──── */}
        {/* Shows once after the hero. Parent gates visibility via
            folio-income-anchor-offered localStorage key. Tapping
            "Set it now" opens BackfillSheet; "Skip" dismisses. */}
        <AnimatePresence>
          {showIncomeAnchorBanner && onIncomeAnchorSetItNow && onIncomeAnchorSkip && (
            <IncomeAnchorBanner
              onSetItNow={onIncomeAnchorSetItNow}
              onSkip={onIncomeAnchorSkip}
            />
          )}
        </AnimatePresence>

        {/* ── 2. Quick Actions (thumb zone — immediately after hero) ── */}        <section aria-label="Quick actions">
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
                borderRadius: borderRadius.full,
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
                borderRadius: borderRadius.full,
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

          {/* Tertiary: Can I afford this? — subtle text link below primary buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 8 }}>
            {onOpenSplitExpense && (
              <button
                type="button"
                onClick={onOpenSplitExpense}
                aria-label="Split an expense with a friend"
                style={{
                  fontSize: 13,
                  color: 'var(--sub)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  opacity: 0.7,
                }}
              >
                ✂️ Split
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAffordabilitySheet(true)}
              aria-label="Check if you can afford something"
              style={{
                fontSize: 13,
                color: 'var(--sub)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                opacity: 0.7,
              }}
            >
              🤔 Can I afford this?
            </button>
          </div>
        </section>

        {/* ── Outstanding Splits Summary (task 5.3 — who-owes-whom) ── */}
        {outstandingSplits && outstandingSplits.length > 0 && (
          <button
            type="button"
            onClick={onOpenReimbursements}
            aria-label="View outstanding splits"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 16px',
              marginTop: 4,
              background: 'rgba(129, 140, 248, 0.05)',
              border: '1px solid rgba(129, 140, 248, 0.15)',
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <span style={{ fontSize: 14 }} aria-hidden="true">💸</span>
            <span
              style={{
                flex: 1,
                fontFamily: FONT_FAMILY,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--sub)',
                textAlign: 'left',
              }}
            >
              {outstandingSplits.length === 1
                ? `${outstandingSplits[0].name} owes you $${outstandingSplits[0].amount.toFixed(2)}`
                : `Friends owe you $${outstandingSplits.reduce((s, p) => s + p.amount, 0).toFixed(2)}`}
            </span>
            {outstandingSplits.length > 1 && (
              <span
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 11,
                  color: 'var(--sub)',
                  opacity: 0.6,
                }}
              >
                {outstandingSplits.length} people
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--sub)', opacity: 0.5 }}>→</span>
          </button>
        )}

        {/* ══════════════════════════════════════════════════════════
            ── BELOW THE FOLD ──────────────────────────────────────────
            Everything below this spacer requires scrolling on typical
            mobile viewports (667–812px). The hero + quick actions fill
            the first screenful comfortably.
            ══════════════════════════════════════════════════════════ */}
        <div
          aria-hidden="true"
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Subtle scroll affordance — a soft divider line */}
          <div
            style={{
              width: 40,
              height: 3,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.08)',
            }}
          />
        </div>

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
                    transition={{ delay: index * STAGGER_STEP, ...timings.normal }}
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

        {/* ── 2.6. Welcome-back badge (task 77) — below fold ───── */}
        <WelcomeBackBadge />

        {/* ── 2.7. Contextual Insight (opt-in, at most one) ─────── */}
        <AnimatePresence>
          {insightsEnabled && activeTip && (
            <ContextualTipCard
              tip={activeTip}
              onDismiss={handleDismissTip}
              onLearnMore={() => {}}
              onActionComplete={() => {}}
            />
          )}
        </AnimatePresence>

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
                onClick={() => onOpenBudgetSettings?.()}
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
              transition={timings.slow}
            >
              <GlassCard elevation="low" style={{ padding: "28px 20px", borderRadius: borderRadius.lg }}>
                <div style={emptyStateContainer}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">🎯</span>
                  <p style={emptyStateTitle}>
                    You&rsquo;re all set to start — limits are optional
                  </p>
                  <p style={emptyStateSubtitle}>
                    Add category limits anytime for a more accurate daily number
                  </p>
                  {onOpenBudgetSettings && (
                    <motion.button
                      type="button"
                      onClick={onOpenBudgetSettings}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        marginTop: 8,
                        background: "rgba(167, 139, 250, 0.12)",
                        border: "1px solid rgba(167, 139, 250, 0.25)",
                        borderRadius: borderRadius.full,
                        padding: "10px 20px",
                        color: "var(--accent, #a78bfa)",
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: FONT_FAMILY,
                        cursor: "pointer",
                      }}
                      aria-label="Set up category limits"
                    >
                      Set up limits →
                    </motion.button>
                  )}
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
                        borderRadius: borderRadius.lg,
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
                              ...progressTrack,
                              marginTop: 2,
                            }}
                          >
                            <motion.div
                              animate={{ width: `${Math.min(row.weekPct, 100)}%` }}
                              transition={springs.gentle}
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
              transition={timings.slow}
            >
              <GlassCard elevation="low" style={{ padding: "28px 20px", borderRadius: borderRadius.lg }}>
                <div style={emptyStateContainer}>
                  <span style={{ fontSize: 32 }} aria-hidden="true">✨</span>
                  <p style={emptyStateTitle}>
                    Ready when you are
                  </p>
                  <p style={emptyStateSubtitle}>
                    Log your first expense and Folio starts learning your habits
                  </p>
                  <motion.button
                    type="button"
                    onClick={() => onLogExpense()}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      marginTop: 8,
                      background: "rgba(74, 222, 128, 0.12)",
                      border: "1px solid rgba(74, 222, 128, 0.3)",
                      borderRadius: borderRadius.full,
                      padding: "10px 20px",
                      color: "var(--success, #4ade80)",
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: FONT_FAMILY,
                      cursor: "pointer",
                    }}
                    aria-label="Log your first expense"
                  >
                    Log expense →
                  </motion.button>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <GlassCard elevation="low" style={{ padding: "12px 0", borderRadius: borderRadius.lg }}>
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
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {emoji} {label}
                                {splitTransactionIds?.has(tx.id) && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      opacity: 0.6,
                                      marginLeft: 2,
                                    }}
                                    aria-label="Split expense"
                                    title="Split"
                                  >
                                    ✂️
                                  </span>
                                )}
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
