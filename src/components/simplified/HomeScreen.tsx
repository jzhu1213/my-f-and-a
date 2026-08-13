"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Transaction, Budget, Goal, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { CelebrationEvent } from "@/types/folio"
import type { DailyAllowance } from "@/types/folio"
import type { HeroMeaning, HeroDisplay } from "@/types/folio"
import type { SavingsAccount } from "@/types/folio"
import type { TransactionRepeat } from "@/lib/transactionUtils"
import { getRecentRepeats } from "@/lib/transactionUtils"
import { computeCategoryBudgets } from "@/lib/budgetUtils"
import type { CategoryBudgetRow } from "@/lib/budgetUtils"
import { getRelativeDate } from "@/lib/dateUtils"
import { buildUserContext, selectContextualTip } from "@/lib/tipUtils"
import type { DetectedSubscription } from "@/lib/subscriptionDetector"
import type { FundingSource } from "@/lib/fundingSources"
import {
  shouldShowContextualContent,
  markSessionTipShown,
  recordTipShown,
  incrementAppOpenCount,
} from "@/lib/tipUtils"
import { recordEngagement } from "@/lib/engagementTracker"
import { checkAllCelebrations, getUnderBudgetStreak } from "@/lib/celebrationEngine"
import { CELEBRATION_COPY, CELEBRATION_EMOJI } from "@/lib/vocabulary"
import { CategoryIcon } from "@/components/ui/CategoryIcon"
import { EmptyState } from "@/components/ui/EmptyState"
import { recordLastActive } from "@/lib/reminderPreferences"
import { getInsightsEnabled, getSavingsRateBadgeEnabled, getHomeStyle } from "@/lib/uiPreferences"
import { getPaceIndicatorEnabled } from "@/lib/paceIndicatorPreferences"
import { SpendPaceIndicator } from "./SpendPaceIndicator"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, STAGGER_STEP, layoutTransition, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing } from "@/styles/typography"
import type { SpendingMode } from "@/lib/spendingModes"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  SECTION_SPACING,
  sectionHeader,
  linkButton,
  chipButton,
  borderRadius,
  progressTrack,
  getCategoryAccent,
  colorRamp,
  fills,
} from "@/styles/shared"
import { DailyAllowanceHero } from "./DailyAllowanceHero"
import { ContextualTipCard } from "./ContextualTipCard"
import { GlassCard } from "@/components/ui/GlassCard"
import { HomeScreenSkeleton, FadeInContent } from "@/components/ui/Skeleton"
import { CategoryDetailSheet } from "@/components/accounting/CategoryDetailSheet"
import { SwipeableTransactionRow } from "./SwipeableTransactionRow"
import { InlineTransactionEditor } from "./InlineTransactionEditor"
import { PullToRefresh } from "./PullToRefresh"
import { TimeHorizonPills } from "./TimeHorizonPills"
import type { TimeHorizonStats } from "@/lib/timeHorizonStats"
import type { PeriodContext } from "@/lib/budgetPeriod"
import type { PeriodTransitionMessage } from "@/lib/periodTransition"
import { AffordabilitySheet } from "./AffordabilitySheet"
import { WelcomeBackBadge } from "./WelcomeBackBadge"
import { SetupChecklistCard } from "./SetupChecklistCard"
import { PeriodContextIndicator } from "./PeriodContextIndicator"
import { PinnedHomeCards } from "./PinnedHomeCards"
import type { PinnedCardType } from "@/lib/homeWidgets"
import { getPinnedCards } from "@/lib/homeWidgets"
import type { PinnedCard } from "@/lib/homeWidgets"
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

// Code-split: milestone share sheet (Task 363.2) — only loaded when a
// shareable milestone is hit (goal_complete, streak_30_days, wish_complete).
const ShareMilestoneSheet = dynamic(
  () =>
    import("./ShareMilestoneSheet").then((mod) => ({
      default: mod.ShareMilestoneSheet,
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
  const { prefersReducedMotion } = useAppReducedMotion()

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
        background: colorRamp.error[100],
        border: `1px solid ${colorRamp.error[200]}`,
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
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
        transition={springs.bouncy}
        aria-label="Log income to top up your budget"
        style={{
          flexShrink: 0,
          background: colorRamp.error[200],
          border: `1px solid ${colorRamp.error[300]}`,
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

  // ── Time horizon stats (task 128.1) ────────────────────────────────────────
  /** Unified time-horizon stats for secondary pills below the hero */
  timeHorizonStats?: TimeHorizonStats

  // ── Navigation helpers for empty states ────────────────────────────────────
  /** Called when user taps the CTA in the "no budgets" empty state */
  onOpenBudgetSettings?: () => void
  /** Called when user taps the "Split" quick action (task 5.3 — one-tap split) */
  onOpenSplitExpense?: () => void
  /** Called when user taps "+ Wish" quick-add (task 352.2 — wish list quick-add from home) */
  onAddWish?: () => void

  // ── Lessons navigation (task 118.1) ────────────────────────────────────────
  /** Called when a contextual tip links to a lesson — navigates to the Learn overlay */
  onOpenLesson?: (lessonId: string) => void

  // ── Outstanding Splits (task 5.3 — who-owes-whom summary) ──────────────────
  /** Outstanding split balances: positive = they owe you */
  outstandingSplits?: { name: string; amount: number }[]
  /** Called when user taps the outstanding splits summary to see full ledger */
  onOpenReimbursements?: () => void
  /** Called when user taps "Settled?" on a split — settles all IOUs for that person (task 123.1) */
  onSettleSplit?: (personName: string) => void
  /** Set of transaction IDs that were split (for badge display) */
  splitTransactionIds?: Set<string>

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
  /** Active spend-down plan result (for compact indicator below the hero) */
  activeSpendDown?: import('@/lib/spendDown').SpendDownResult | null
  /**
   * Monthly savings rate (0-100). Used by the opt-in savings-rate badge shown
   * below the hero. Only rendered when the user has enabled the badge in
   * Settings → Hero & display (off by default).
   */
  savingsRate?: number

  // ── Savings contribution reminder (task 160.2) ─────────────────────────────
  /**
   * Savings/investment accounts — used for the end-of-month contribution gap
   * reminder that surfaces in the contextual tip slot when a monthly
   * contribution target hasn't been met near month-end.
   */
  savingsAccounts?: SavingsAccount[]

  // ── Credit education wiring (task 151.1) ───────────────────────────────────
  /** User's funding sources — needed to detect credit transactions for education tips. */
  fundingSources?: FundingSource[]
  /** Set of lesson IDs the user has completed (for credit education path tips). */
  completedLessonIds?: Set<string>

  // ── Minimal path nudge (task 218.3) ────────────────────────────────────────
  /** True when the user skipped setup steps during onboarding (minimal path). */
  hasSkippedSetupSteps?: boolean
  /** Skipped step IDs — used by the setup checklist card (task 223) */
  skippedSetupSteps?: string[]
  /** Called when the user taps a specific step to deep-link resume (task 223.3) */
  onResumeSetupStep?: (stepId: string) => void

  // ── Income overdue signal (task 336.2) ─────────────────────────────────────
  /** When set, projected income is overdue — drives the income shortfall tip. */
  incomeOverdue?: { expectedAmount: number; daysPastDue: number }

  // ── Budget period context (task 342.3) ─────────────────────────────────────
  /** Computed period context for the user's budget period preference */
  periodContext?: PeriodContext | null

  // ── Period transition message (task 343.1) ─────────────────────────────────
  /** Warm welcome-back message shown on first open after a period resets */
  periodTransitionMessage?: PeriodTransitionMessage | null
  /** Dismiss the period transition message */
  onDismissPeriodTransition?: () => void
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
  timeHorizonStats,
  onOpenBudgetSettings,
  onOpenSplitExpense,
  onAddWish,
  onOpenLesson,
  outstandingSplits,
  onOpenReimbursements,
  onSettleSplit,
  splitTransactionIds,
  spendingMode = 'guided',
  heroMeaning,
  heroDisplay,
  overLimitResponse = 'gentle',
  activeSpendDown,
  savingsRate,
  savingsAccounts,
  fundingSources,
  completedLessonIds,
  hasSkippedSetupSteps,
  skippedSetupSteps,
  onResumeSetupStep,
  incomeOverdue,
  periodContext,
  periodTransitionMessage,
  onDismissPeriodTransition,
}: HomeScreenProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<CategoryBudgetRow | null>(null)
  const [localCelebration, setLocalCelebration] = useState<CelebrationEvent | null>(null)
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationEvent[]>([])
  const [showAffordabilitySheet, setShowAffordabilitySheet] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)

  // ── Milestone share sheet state (Task 363.2) ──────────────────────────────
  const [milestoneShareData, setMilestoneShareData] = useState<{
    type: 'goal_complete' | 'streak_30_days' | 'wish_complete'
    title: string
    subtitle?: string
  } | null>(null)
  const prevTxCountRef = useRef<number>(transactions.length)
  const prevGoalsRef = useRef<string>("")

  // ── Last-logged transaction for anomaly detection (Task 165.1) ─────────────
  // Tracks the most recently logged expense in the current session. Set when
  // the transactions array grows (a new expense was added). Transient — never
  // persists across page reloads. Cleared after the tip system has a chance to
  // evaluate it (via the userContext memo).
  const [lastLoggedTransaction, setLastLoggedTransaction] = useState<{ amount: number; category: TransactionCategory } | null>(null)
  const lastTxSnapshotRef = useRef<string | null>(null)

  // ── "New day" micro-celebration (task 74) ────────────────────────────────
  // Shows a brief warm indicator when the user opens the app on a new calendar day.
  const [showNewDayRefresh, setShowNewDayRefresh] = useState(false)

  // ── Setup checklist dismissal (consolidated nudge surface — task 232) ────
  const [estimateNudgeDismissed, setEstimateNudgeDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('folio-estimate-nudge-dismissed') === 'true'
  })
  const handleDismissEstimateNudge = useCallback(() => {
    setEstimateNudgeDismissed(true)
    localStorage.setItem('folio-estimate-nudge-dismissed', 'true')
  }, [])
  const { prefersReducedMotion, homeContainer, homeSection } = useAppReducedMotion()
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

  // ── Savings-rate badge opt-in preference (task 159.2) ─────────────────────
  // Off by default to keep the home screen minimal; opt in via
  // Settings → Hero & display.
  const [savingsRateBadgeEnabled] = useState(() => getSavingsRateBadgeEnabled())

  // ── Spending-pace indicator preference (task 250) ─────────────────────────
  // On by default (subtle, informative); dismissible via Settings → Hero & display.
  const [paceIndicatorEnabled] = useState(() => getPaceIndicatorEnabled())

  // ── Pinned home cards (task 344) ──────────────────────────────────────────
  // Empty by default — home screen stays minimal until user opts in.
  const [pinnedCards] = useState<PinnedCard[]>(() => getPinnedCards())

  // ── Home style preference (task 345.1) ────────────────────────────────────
  // 'minimal' = today's layout (no pinned cards); 'dashboard' = show pinned cards.
  const [homeStyle] = useState(() => getHomeStyle())

  // ── User goal (task 222.3) ─────────────────────────────────────────────────
  // Read the persisted goal so tip selection can boost relevant content.
  const [userGoal] = useState<import('@/types').UserGoal | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    try {
      const stored = localStorage.getItem('folio-user-goal')
      return (stored as import('@/types').UserGoal) || undefined
    } catch {
      return undefined
    }
  })

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

  // ── Anomaly detection: track last-logged expense (Task 165.1) ─────────────
  // When the transactions array grows with a new expense, capture it for
  // anomaly detection. Clears automatically after the tip is dismissed or on
  // the next render cycle after being consumed by buildUserContext.
  useEffect(() => {
    if (transactions.length === 0) return
    const newest = transactions[0] // transactions are newest-first
    if (!newest || newest.type !== 'expense') return

    // Build a snapshot key to detect genuinely new transactions
    const snapshotKey = `${newest.id}-${newest.amount}-${newest.category}`
    if (snapshotKey === lastTxSnapshotRef.current) return

    // Only trigger when the count grew (new transaction added, not edited)
    if (transactions.length > prevTxCountRef.current) {
      setLastLoggedTransaction({ amount: newest.amount, category: newest.category })
      lastTxSnapshotRef.current = snapshotKey
    }
  }, [transactions])

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
        goals,
        savingsAccounts,
        fundingSources,
        completedLessonIds,
        lastLoggedTransaction,
        userGoal,
        incomeOverdue,
      }),
    [transactions, allowance, underBudgetStreak, upcomingBills, detectedSubscriptions, todayStr, spendingMode, goals, savingsAccounts, fundingSources, completedLessonIds, lastLoggedTransaction, userGoal, incomeOverdue]
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
    // Record engagement: tip was shown (Task 167.1)
    recordEngagement(activeTip.id, activeTip.type, 'shown')
  }, [activeTip])

  const handleDismissTip = useCallback(() => {
    if (!activeTip) return
    // Record engagement: tip was dismissed (Task 167.1)
    recordEngagement(activeTip.id, activeTip.type, 'dismissed')
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
    // Clear anomaly state after dismissal so it doesn't re-fire (Task 165.1)
    if (activeTip.id.startsWith('spend-anomaly-')) {
      setLastLoggedTransaction(null)
    }
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
    // Check if the dismissed celebration is a shareable milestone (Task 363.2)
    const shareableTypes = ['goal_complete', 'streak_30_days', 'wish_complete'] as const
    const dismissed = externalCelebration ?? localCelebration
    if (dismissed && (shareableTypes as readonly string[]).includes(dismissed.type)) {
      const milestoneType = dismissed.type as 'goal_complete' | 'streak_30_days' | 'wish_complete'
      const subtitleMap: Record<string, string> = {
        goal_complete: 'Another goal crossed off the list',
        streak_30_days: '30 days of staying on track',
        wish_complete: 'Patience paid off',
      }
      setMilestoneShareData({
        type: milestoneType,
        title: dismissed.message || dismissed.title,
        subtitle: subtitleMap[milestoneType],
      })
    }

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
  }, [externalCelebration, onCelebrationDismiss, celebrationQueue, localCelebration])

  // ── Loading state: skeleton ↔ content crossfade via AnimatePresence ────────
  // AnimatePresence mode="wait" ensures the skeleton is fully unmounted before
  // content mounts. The 250ms opacity tween keeps CLS ≤ 0.02 with no layout
  // shift. Cache-hydrated path skips the skeleton entirely (isLoading = false
  // on mount), so no brief flash occurs.
  // Validates: Requirements 17.2, 17.3
  if (isLoading) {
    return (
      <AnimatePresence mode="wait">
        <HomeScreenSkeleton key="home-skeleton" />
      </AnimatePresence>
    )
  }

  // ── Default no-op refresh handler ──────────────────────────────────────────
  const handleRefresh = onRefresh ?? (() => Promise.resolve())

  return (
    <AnimatePresence mode="wait">
    <FadeInContent key="home-content">
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
    <div className="home-screen" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <motion.div
        className="home-screen__content"
        variants={homeContainer}
        initial="hidden"
        animate="visible"
        style={{
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          padding: `0 ${HORIZONTAL_PADDING}px`,
          display: "flex",
          flexDirection: "column",
          // Phase 6 (task 237.1): generous, consistent major-section rhythm
          // (hero → quick actions → recent → tip) via the shared token.
          gap: SECTION_SPACING,
          paddingTop: spacing.lg,
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
        <motion.section variants={homeSection} aria-label="Daily allowance" style={{ position: "relative" }}>
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
            confidenceBand={allowance?.confidenceBand}
            onTapForDetails={onHeroTapDetails}
            spendingMode={spendingMode}
            heroMeaning={heroMeaning}
            heroDisplay={heroDisplay}
          />

          {/* ── Period context indicator (task 342.3) — subtle, below hero ── */}
          {periodContext && !isLoading && (
            <PeriodContextIndicator periodContext={periodContext} />
          )}

          {/* ── Period transition message (task 343.1) — warm welcome-back ── */}
          <AnimatePresence>
            {periodTransitionMessage && !isLoading && (
              <motion.div
                role="status"
                aria-live="polite"
                aria-label={periodTransitionMessage.text}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={timings.normal}
                onClick={onDismissPeriodTransition}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 10,
                  padding: "8px 16px",
                  background: "rgba(139, 92, 246, 0.08)",
                  border: "1px solid rgba(139, 92, 246, 0.15)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 14 }}>✨</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    opacity: 0.9,
                  }}
                >
                  {periodTransitionMessage.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Savings-rate badge (task 159.2) — opt-in, off by default ──
              A small, unobtrusive indicator of the monthly savings rate.
              Only rendered when enabled in Settings → Hero & display AND when
              there's a positive rate to show (avoids a discouraging "0%"). */}
          {savingsRateBadgeEnabled && !isLoading && typeof savingsRate === "number" && savingsRate > 0 && (
            <motion.div
              role="status"
              aria-label={`You're saving ${savingsRate}% of your income this month`}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={timings.normal}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 10,
                padding: "6px 14px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-full)",
                width: "fit-content",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <span style={{ fontSize: 13 }} aria-hidden="true">💪</span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--sub)",
                  fontFamily: FONT_FAMILY,
                  opacity: 0.85,
                }}
              >
                Saving{" "}
                <span style={{ color: "var(--success)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {savingsRate}%
                </span>{" "}
                this month
              </span>
            </motion.div>
          )}

          {/* ── Spending-pace indicator (task 250) — subtle sparkline ────── */}
          {paceIndicatorEnabled && !isLoading && transactions.length > 0 && (
            <SpendPaceIndicator
              transactions={transactions}
              todayStr={todayStr}
            />
          )}

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
                  color: "var(--accent)",
                  opacity: 0.9,
                }}
              >
                ☀️ Fresh start — new day, new budget
              </motion.div>
            )}
          </AnimatePresence>
          {!isLoading && allowance && allowance.isEstimated && !hasSkippedSetupSteps && (
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

          {/* ── Time horizon pills (task 128.1) — weekend, payday, term ── */}
          {timeHorizonStats && <TimeHorizonPills stats={timeHorizonStats} />}

          {/* ── Spend-down plan indicator (task 122.1) ────────────────── */}
          {activeSpendDown && (
            <motion.div
              role="status"
              aria-label={`${activeSpendDown.label}: $${activeSpendDown.dailyAmount} per day, $${activeSpendDown.remaining} left`}
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
              <span style={{ fontSize: 13 }} aria-hidden="true">💰</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--sub)',
                  fontFamily: FONT_FAMILY,
                  opacity: 0.85,
                }}
              >
                ${activeSpendDown.dailyAmount}/day • ${activeSpendDown.remaining} left
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: activeSpendDown.onTrack ? 'var(--success)' : 'var(--warning)',
                  fontFamily: FONT_FAMILY,
                  marginLeft: 2,
                }}
              >
                {activeSpendDown.onTrack ? 'On track ✓' : 'A bit ahead of pace'}
              </span>
            </motion.div>
          )}
        </motion.section>

        {/* ── 1.5. Pinned Home Cards (task 344) ───────────────────────── */}
        {homeStyle === 'dashboard' && (
          <PinnedHomeCards
            pinnedCards={pinnedCards}
            goals={goals}
            transactions={transactions}
            upcomingBills={upcomingBills}
          />
        )}

        {/* ── 2. Quick Actions (thumb zone — immediately after hero) ── */}        <motion.section variants={homeSection} aria-label="Quick actions">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {/* Primary: Log expense — larger pill with warm gradient */}
            <motion.button
              type="button"
              onClick={() => onLogExpense()}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1.6,
                background: "var(--gradient-action)",
                border: "none",
                borderRadius: borderRadius.full,
                padding: "18px 24px",
                color: "var(--text)",
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
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1,
                background: "transparent",
                border: `1.5px solid ${colorRamp.success[400]}`,
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {onOpenSplitExpense && (
              <button
                type="button"
                onClick={onOpenSplitExpense}
                aria-label="Split an expense with a friend"
                style={{
                  fontSize: 13,
                  color: 'var(--sub)',
                  background: colorRamp.accent[100],
                  border: `1px solid ${colorRamp.accent[200]}`,
                  borderRadius: borderRadius.full,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                }}
              >
                🤝 Split
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAffordabilitySheet(true)}
              aria-label="Check if you can afford something"
              style={{
                fontSize: 13,
                color: 'var(--sub)',
                background: fills[3],
                border: `1px solid ${fills[8]}`,
                borderRadius: borderRadius.full,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
              }}
            >
              🤔 Can I afford this?
            </button>
            {onAddWish && (
              <button
                type="button"
                onClick={onAddWish}
                aria-label="Add a wish list item"
                style={{
                  fontSize: 13,
                  color: 'var(--sub)',
                  background: fills[3],
                  border: `1px solid ${fills[8]}`,
                  borderRadius: borderRadius.full,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                }}
              >
                ⭐ + Wish
              </button>
            )}
          </div>
        </motion.section>

        {/* ── Outstanding Splits Summary (task 5.3 + 123.1 — one-tap settle) ── */}
        {outstandingSplits && outstandingSplits.length > 0 && (
          <motion.div
            variants={homeSection}
            style={{
              width: '100%',
              marginTop: 4,
              background: colorRamp.accent[50],
              border: `1px solid ${colorRamp.accent[200]}`,
              borderRadius: borderRadius.md,
              overflow: 'hidden',
            }}
          >
            {outstandingSplits.slice(0, 3).map((split, idx) => (
              <div
                key={split.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderTop: idx > 0 ? `1px solid ${fills[4]}` : undefined,
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
                  {split.name} · ${split.amount % 1 === 0 ? split.amount : split.amount.toFixed(2)} to settle
                </span>
                {onSettleSplit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSettleSplit(split.name)
                    }}
                    aria-label={`Mark ${split.name}'s split as settled`}
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--success)',
                      background: colorRamp.success[100],
                      border: `1px solid ${colorRamp.success[200]}`,
                      borderRadius: borderRadius.full,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Settled? ✓
                  </button>
                )}
              </div>
            ))}
            {outstandingSplits.length > 3 && (
              <button
                type="button"
                onClick={onOpenReimbursements}
                aria-label="View all open splits"
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                  background: 'transparent',
                  border: 'none',
                  borderTopStyle: 'solid',
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  fontSize: 12,
                  color: 'var(--sub)',
                  opacity: 0.7,
                  textAlign: 'center',
                }}
              >
                View all ({outstandingSplits.length}) →
              </button>
            )}
          </motion.div>
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
          <motion.section variants={homeSection} aria-label="Log again">
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
                return (
                  <motion.button
                    key={`${repeat.category}-${repeat.amount}-${repeat.note ?? ""}`}
                    type="button"
                    onClick={() => onRepeatLog(repeat)}
                    aria-label={`Log again: ${repeat.label}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * STAGGER_STEP, ...timings.normal }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                    style={chipButton}
                  >
                    <CategoryIcon category={repeat.category} size={26} />
                    <span>{repeat.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* ── 2.6. Welcome-back badge (task 77) — below fold ───── */}
        <WelcomeBackBadge />

        {/* ── 2.7. Setup Checklist (task 223 — lives in tip slot) ──── */}
        {skippedSetupSteps && skippedSetupSteps.length > 0 && !estimateNudgeDismissed && onResumeSetupStep && (
          <SetupChecklistCard
            skippedSteps={skippedSetupSteps}
            onResumeStep={onResumeSetupStep}
            onDismiss={handleDismissEstimateNudge}
            variant="home"
          />
        )}

        {/* ── 2.8. Contextual Insight (opt-in, at most one) ─────── */}
        {/* Tip deprioritization (task 345.1): suppress tips in dashboard mode
            when pinned cards are present to avoid overcrowding. */}
        <AnimatePresence>
          {insightsEnabled && activeTip && !(homeStyle === 'dashboard' && pinnedCards.length > 0) && (
            <ContextualTipCard
              tip={activeTip}
              onDismiss={handleDismissTip}
              onLearnMore={() => {
                if (activeTip.relatedLessonId && onOpenLesson) {
                  onOpenLesson(activeTip.relatedLessonId)
                }
              }}
              onActionComplete={() => {
                // Record engagement: user acted on the tip (Task 167.1)
                recordEngagement(activeTip.id, activeTip.type, 'acted')
                if (activeTip.actionType === 'learn_more' && activeTip.relatedLessonId && onOpenLesson) {
                  onOpenLesson(activeTip.relatedLessonId)
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* ── 3. Category Budget Cards (top 4 only for cleanliness) ────────────────────────────── */}
        <motion.section variants={homeSection} aria-label="Budget categories">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={sectionHeader}>
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
              <GlassCard elevation="low" style={{ padding: "4px 0", borderRadius: borderRadius.lg }}>
                <EmptyState
                  illustration="budget"
                  title="You're all set to start — limits are optional"
                  subtitle="Add category limits anytime for a more accurate daily number"
                  actionLabel={onOpenBudgetSettings ? "Set up limits →" : undefined}
                  onAction={onOpenBudgetSettings ?? undefined}
                  actionAriaLabel="Set up category limits"
                />
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
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
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
                      {/* Category icon chip */}
                      <CategoryIcon category={row.category} size={44} />

                      {/* Category name */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--text)",
                          fontFamily: FONT_FAMILY,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
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
        </motion.section>

        {/* ── 4. Recent Transactions ──────────────────────────────── */}
        <motion.section variants={homeSection} aria-label="Recent transactions">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={sectionHeader}>
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
              <GlassCard elevation="low" style={{ padding: "4px 0", borderRadius: borderRadius.lg }}>
                <EmptyState
                  illustration="transactions"
                  title="Ready when you are"
                  subtitle="Log your first expense and Folio starts learning your habits"
                  actionLabel="Log expense →"
                  onAction={() => onLogExpense()}
                  actionAriaLabel="Log your first expense"
                  actionColor="success"
                />
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

                return grouped.map((group, groupIdx) => {
                  // 255.3: compute day subtotal for expenses
                  const dayExpenseTotal = group.txs.reduce(
                    (sum, tx) => sum + (tx.type === "expense" ? tx.amount : 0),
                    0
                  )

                  return (
                  <div key={group.date}>
                    {/* Date group header — sticky overline style (255.1) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        padding: "8px 16px 4px",
                        marginTop: groupIdx > 0 ? 4 : 0,
                        background: "inherit",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                          opacity: 0.7,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {getRelativeDate(group.date)}
                      </p>
                      {/* 255.3: Day subtotal */}
                      {dayExpenseTotal > 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "var(--muted)",
                            fontFamily: FONT_FAMILY,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ${dayExpenseTotal.toFixed(2)} spent
                        </p>
                      )}
                    </div>

                    {/* Transaction rows with vertical timeline (255.1) */}
                    <div
                      style={{
                        position: "relative",
                        paddingLeft: 16,
                      }}
                    >
                      {/* Vertical timeline accent line */}
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 28,
                          top: 8,
                          bottom: 8,
                          width: 1.5,
                          background: colorRamp.accent[200],
                          borderRadius: 1,
                        }}
                      />

                      <AnimatePresence initial={false}>
                      {group.txs.map((tx, txIdx) => {
                        const catInfo = BUDGET_CATEGORIES.find(
                          (c) => c.category === tx.category
                        )
                        const label = tx.note || catInfo?.label || tx.category
                        const isLast =
                          groupIdx === grouped.length - 1 &&
                          txIdx === group.txs.length - 1
                        const accent = getCategoryAccent(tx.category)

                        return (
                          <motion.div
                            key={tx.id}
                            layout={!prefersReducedMotion ? "position" : false}
                            transition={layoutTransition}
                          >
                            <SwipeableTransactionRow
                              id={tx.id}
                              onDelete={(id) => onDeleteTransaction?.(id)}
                              onTap={() => onViewTransaction(tx)}
                              onEdit={onEditTransaction ? (id) => setInlineEditId(id) : undefined}
                              showBorder={!isLast && inlineEditId !== tx.id}
                            >
                              <motion.div
                                layoutId={!prefersReducedMotion ? `tx-row-${tx.id}` : undefined}
                                transition={layoutTransition}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  width: "100%",
                                  padding: "10px 16px 10px 20px",
                                  textAlign: "left",
                                  position: "relative",
                                }}
                              >
                                {/* Timeline node */}
                                <span
                                  aria-hidden
                                  style={{
                                    position: "absolute",
                                    left: 9,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: accent,
                                    boxShadow: `0 0 4px ${accent}40`,
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: "var(--text)",
                                    fontFamily: FONT_FAMILY,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: "hidden",
                                  }}
                                >
                                  <CategoryIcon category={tx.category} size={32} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {label}
                                  </span>
                                  {splitTransactionIds?.has(tx.id) && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        opacity: 0.6,
                                        marginLeft: 2,
                                        flexShrink: 0,
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
                                    fontVariantNumeric: "tabular-nums",
                                    flexShrink: 0,
                                    color:
                                      tx.type === "income"
                                        ? "var(--success)"
                                        : "var(--text)",
                                  }}
                                >
                                  {tx.type === "income" ? "+" : "−"}$
                                  {tx.amount.toFixed(2)}
                                </span>
                              </motion.div>
                            </SwipeableTransactionRow>
                            {inlineEditId === tx.id && onEditTransaction && (
                              <InlineTransactionEditor
                                transaction={tx}
                                onSave={onEditTransaction}
                                onClose={() => setInlineEditId(null)}
                              />
                            )}
                          </motion.div>
                        )
                      })}
                      </AnimatePresence>
                    </div>
                  </div>
                  )
                })
              })()}
            </GlassCard>
          )}
        </motion.section>
      </motion.div>

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

      {/* ── Milestone Share Sheet (Task 363.2) ────────── */}
      {/* Offered after a shareable milestone celebration is dismissed. */}
      <Suspense fallback={null}>
        <ShareMilestoneSheet
          open={milestoneShareData !== null}
          milestone={milestoneShareData ?? { type: 'goal_complete', title: '' }}
          onDismiss={() => setMilestoneShareData(null)}
        />
      </Suspense>
    </div>
    </PullToRefresh>
    </FadeInContent>
    </AnimatePresence>
  )
}
