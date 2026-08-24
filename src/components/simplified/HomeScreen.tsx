"use client"

import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"
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
import { getInsightsEnabled, getSavingsRateBadgeEnabled } from "@/lib/uiPreferences"
import { getPaceIndicatorEnabled } from "@/lib/paceIndicatorPreferences"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, STAGGER_STEP, layoutTransition, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { formatMoney } from '@/lib/localeFormat'
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
  shadows,
} from "@/styles/shared"
import { DailyAllowanceHero } from "./DailyAllowanceHero"
import { useToast } from "@/contexts/ToastContext"
import { GlassCard } from "@/components/ui/GlassCard"
import { HomeScreenSkeleton, FadeInContent } from "@/components/ui/Skeleton"
import { CategoryDetailSheet } from "@/components/accounting/CategoryDetailSheet"
import { SwipeableTransactionRow } from "./SwipeableTransactionRow"
import { InlineTransactionEditor } from "./InlineTransactionEditor"
import { PullToRefresh } from "./PullToRefresh"
import type { TimeHorizonStats } from "@/lib/timeHorizonStats"
import type { PeriodContext } from "@/lib/budgetPeriod"
import type { PeriodTransitionMessage } from "@/lib/periodTransition"
import { AffordabilitySheet } from "./AffordabilitySheet"
import type { SuggestedEntry } from "@/lib/suggestedEntries"
import { ComingUpSection } from "./ComingUpSection"
import type { ComingUpItem } from "./ComingUpSection"
import { getComingUpEnabled } from "@/lib/comingUpPreferences"
import { computeStreakData, markZeroSpendDay, getStreakData, saveStreakData, getGraceDayMessage } from "@/lib/streaks"
import { isStreakCounterActive } from "@/lib/gamificationPreferences"
import { StreakDetailView } from "./StreakDetailView"
import { useRovingTabindex } from "@/hooks/useRovingTabindex"
import { SetupChecklistCard, ProgressiveChecklistCard } from "./SetupChecklistCard"
import type { ChecklistStep } from '@/lib/setupChecklist'
import { HeroContextRow } from "./HeroContextRow"
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
 *   - OverBudgetStrip removed — over-budget shown via hero color + HeroContextRow line (task 483.4)
 *   - Log Again repeats, insights, category cards are below the fold
 *   - Contextual tip is opt-in via Settings → Preferences → "Show daily insight"
 *   - No infinite scroll or feed patterns
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ============================================================================
// HomeScreen Props
// ============================================================================

/** Consolidated checklist configuration (task 493.1) */
export interface ChecklistConfig {
  /** All checklist steps with completion status (new progressive system) */
  steps?: (ChecklistStep & { completed: boolean })[]
  /** Number of completed checklist steps */
  completedCount?: number
  /** Total number of checklist steps */
  totalCount?: number
  /** Whether the new progressive checklist should be shown */
  showProgressive?: boolean
  /** Called when the user taps a checklist step action */
  onStepAction?: (stepId: string, action: string) => void
  /** Called when the user dismisses the progressive checklist */
  onDismiss?: () => void
  /** Skipped step IDs — used by the setup checklist card (task 223) */
  skippedSteps?: string[]
  /** Called when the user taps a specific step to deep-link resume (task 223.3) */
  onResumeStep?: (stepId: string) => void
}

/** Consolidated suggestions configuration (task 493.1) */
export interface SuggestionsConfig {
  /** Pending auto-suggested transaction entries from recurrence predictions */
  entries?: SuggestedEntry[]
  /** Total amount of pending suggestions */
  total?: number
  /** Whether suggestions are factored into the allowance */
  includedInAllowance?: boolean
  /** Called when user confirms a suggested entry */
  onConfirm?: (entry: SuggestedEntry) => void
  /** Called when user dismisses a suggested entry */
  onDismiss?: (entryId: string) => void
  /** Called when user wants to edit a suggested entry */
  onEdit?: (entry: SuggestedEntry) => void
}

/** Consolidated celebration configuration (task 493.1) */
export interface CelebrationConfig {
  /** Active celebration event passed from the parent (e.g. after expense logged) */
  event?: CelebrationEvent | null
  /** Called when the celebration overlay is dismissed (auto-timeout or user tap) */
  onDismiss?: () => void
}

export interface HomeScreenProps {
  /** Computed daily allowance data for the hero section */
  allowance: DailyAllowance | null
  /** All user transactions (used for recent list & budget calc) */
  transactions: Transaction[]
  /** User budget limits by category */
  budgets: Budget[]
  /** User savings goals */
  goals: Goal[]
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

  // ── Celebrations (consolidated) ────────────────────────────────────────────
  /** Celebration config: event and dismiss handler */
  celebrationConfig?: CelebrationConfig

  // ── Tip engine inputs ──────────────────────────────────────────────────────
  /** Bills due within the next 3 days — used for contextual bill-due tips */
  upcomingBills?: { label: string; amount: number; dueDay: number }[]
  /** Detected subscriptions — used for contextual tips */
  detectedSubscriptions?: DetectedSubscription[]
  /** When set, projected income is overdue — drives the income shortfall tip. */
  incomeOverdue?: { expectedAmount: number; daysPastDue: number }

  // ── Time horizon stats (task 128.1) ────────────────────────────────────────
  /** Unified time-horizon stats for secondary pills below the hero */
  timeHorizonStats?: TimeHorizonStats

  // ── Navigation helpers for empty states ────────────────────────────────────
  /** Called when user taps the CTA in the "no budgets" empty state */
  onOpenBudgetSettings?: () => void

  // ── Outstanding Splits ─────────────────────────────────────────────────────
  /** Outstanding split balances: positive = they owe you */
  outstandingSplits?: { name: string; amount: number }[]
  /** Called when user taps the outstanding splits summary to see full ledger */
  onOpenReimbursements?: () => void
  /** Set of transaction IDs that were split (for badge display) */
  splitTransactionIds?: Set<string>

  /** Current spending mode — controls hero framing and tip copy */
  spendingMode?: SpendingMode
  /** The user's chosen hero meaning (what the big number shows) */
  heroMeaning?: HeroMeaning
  /** Pre-computed display values for the chosen hero meaning */
  heroDisplay?: HeroDisplay
  /** Active spend-down plan result (for compact indicator below the hero) */
  activeSpendDown?: import('@/lib/spendDown').SpendDownResult | null
  /** Monthly savings rate (0-100) for the opt-in badge */
  savingsRate?: number

  // ── Savings contribution reminder (task 160.2) ─────────────────────────────
  /** Savings/investment accounts — used for contextual tip engine */
  savingsAccounts?: SavingsAccount[]

  // ── Credit education wiring (task 151.1) ───────────────────────────────────
  /** User's funding sources — needed to detect credit transactions for education tips. */
  fundingSources?: FundingSource[]
  /** Set of lesson IDs the user has completed (for credit education path tips). */
  completedLessonIds?: Set<string>

  // ── Minimal path nudge (task 218.3) ────────────────────────────────────────
  /** True when the user skipped setup steps during onboarding (minimal path). */
  hasSkippedSetupSteps?: boolean

  // ── Progressive Setup Checklist (consolidated — task 493.1) ────────────────
  /** Checklist configuration: steps, counts, and callbacks */
  checklistConfig?: ChecklistConfig

  // ── Budget period context (task 342.3) ─────────────────────────────────────
  /** Computed period context for the user's budget period preference */
  periodContext?: PeriodContext | null

  // ── Period transition message (task 343.1) ─────────────────────────────────
  /** Warm welcome-back message shown on first open after a period resets, with dismiss handler */
  periodTransition?: { message: PeriodTransitionMessage; onDismiss?: () => void } | null

  // ── First-run state (task 391.2) ───────────────────────────────────────────
  /** True when the user just completed onboarding this session — shows first-run home layout */
  isFirstRun?: boolean

  // ── Suggested entries (consolidated — task 493.1) ──────────────────────────
  /** Suggestions configuration: entries, totals, and callbacks */
  suggestionsConfig?: SuggestionsConfig

  // ── Coming up items (task 413) ─────────────────────────────────────────────
  /** Upcoming predicted expenses for the "Coming up" section (max 3, next 7 days) */
  comingUpItems?: ComingUpItem[]
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
 *   HeroContextRow (consolidated info + over-budget message)
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
export const HomeScreen = memo(function HomeScreen({
  allowance,
  transactions,
  budgets,
  goals,
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
  celebrationConfig,
  upcomingBills,
  detectedSubscriptions,
  timeHorizonStats,
  onOpenBudgetSettings,
  outstandingSplits,
  onOpenReimbursements,
  splitTransactionIds,
  spendingMode = 'guided',
  heroMeaning,
  heroDisplay,
  activeSpendDown,
  savingsRate,
  savingsAccounts,
  fundingSources,
  completedLessonIds,
  hasSkippedSetupSteps,
  checklistConfig,
  incomeOverdue,
  periodContext,
  periodTransition,
  isFirstRun,
  suggestionsConfig,
  comingUpItems,
}: HomeScreenProps) {
  // ── Destructure consolidated config objects ────────────────────────────────
  const externalCelebration = celebrationConfig?.event ?? null
  const onCelebrationDismiss = celebrationConfig?.onDismiss

  const suggestedEntries = suggestionsConfig?.entries
  const suggestedEntriesTotal = suggestionsConfig?.total
  const suggestionsIncludedInAllowance = suggestionsConfig?.includedInAllowance
  const onConfirmSuggestion = suggestionsConfig?.onConfirm
  const onDismissSuggestion = suggestionsConfig?.onDismiss
  const onEditSuggestion = suggestionsConfig?.onEdit

  const checklistSteps = checklistConfig?.steps
  const checklistCompletedCount = checklistConfig?.completedCount
  const checklistTotalCount = checklistConfig?.totalCount
  const showProgressiveChecklist = checklistConfig?.showProgressive
  const onChecklistStepAction = checklistConfig?.onStepAction
  const onDismissChecklist = checklistConfig?.onDismiss
  const skippedSetupSteps = checklistConfig?.skippedSteps
  const onResumeSetupStep = checklistConfig?.onResumeStep

  // ── i18n ───────────────────────────────────────────────────────────────────
  const t = useTranslation()
  const { showToast } = useToast()

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<CategoryBudgetRow | null>(null)
  const [localCelebration, setLocalCelebration] = useState<CelebrationEvent | null>(null)
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationEvent[]>([])
  const [showAffordabilitySheet, setShowAffordabilitySheet] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)

  // ── Streak: "$0 day" marker state (task 429.2) ────────────────────────────
  const [zeroSpendMarked, setZeroSpendMarked] = useState(false)
  const [graceDayMessage, setGraceDayMessage] = useState<string | null>(null)
  // ── Streak detail view (task 430.1/430.2) ─────────────────────────────────
  const [showStreakDetail, setShowStreakDetail] = useState(false)
  const [streaksEnabled] = useState(() => isStreakCounterActive())

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

  // ── Setup checklist bottom sheet (task 485.7) ─────────────────────────────
  // Shows on 2nd and 3rd app open only — not on the first (let user explore first)
  const [showChecklistSheet, setShowChecklistSheet] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const openCount = parseInt(localStorage.getItem('folio-app-open-count') ?? '0', 10)
      const dismissed = localStorage.getItem('folio-checklist-sheet-dismissed') === 'true'
      // Show on 2nd and 3rd opens only, and not if already dismissed
      return !dismissed && openCount >= 2 && openCount <= 3
    } catch {
      return false
    }
  })
  const handleDismissChecklistSheet = useCallback(() => {
    setShowChecklistSheet(false)
    try {
      localStorage.setItem('folio-checklist-sheet-dismissed', 'true')
    } catch {
      // localStorage unavailable
    }
    // Also call parent dismiss if available
    onDismissChecklist?.()
  }, [onDismissChecklist])

  // Escape key dismissal for checklist sheet (task 511.3)
  useEffect(() => {
    if (!showChecklistSheet) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        handleDismissChecklistSheet()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showChecklistSheet, handleDismissChecklistSheet])

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

  // ── Coming up preference (task 413.3) ─────────────────────────────────────
  // On by default; controlled via Settings → Home screen.
  const [comingUpEnabled] = useState(() => getComingUpEnabled())

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

  // Arrow key navigation for category budget grid (task 511.4)
  const categoryGridRoving = useRovingTabindex({
    itemCount: Math.min(categoryRows.length, 4),
    orientation: "both",
    columns: 2,
  })

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

  // ── Logging streak (task 429) — computed from transactions + $0 days ──────
  const streakData = useMemo(() => {
    const stored = getStreakData()
    const zeroSpendDays = stored?.zeroSpendDays ?? []
    return computeStreakData(transactions, zeroSpendDays)
  }, [transactions])

  // Check if today has any transactions (for "$0 day" marker visibility)
  const hasTodayTransactions = useMemo(
    () => transactions.some(t => t.date === todayStr),
    [transactions, todayStr]
  )

  // Check if today is already marked as a $0 day
  const isTodayZeroSpend = useMemo(
    () => streakData.zeroSpendDays.includes(todayStr) || zeroSpendMarked,
    [streakData.zeroSpendDays, todayStr, zeroSpendMarked]
  )

  // Compute grace day message on mount
  useEffect(() => {
    const msg = getGraceDayMessage(streakData)
    setGraceDayMessage(msg)
  }, [streakData])

  // Handler for marking today as $0 day
  const handleMarkZeroSpendDay = useCallback(() => {
    markZeroSpendDay(todayStr)
    setZeroSpendMarked(true)
  }, [todayStr])

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

  // ── Contextual tip → toast delivery (task 487.2) ──────────────────────────
  // Instead of rendering an inline card in the scroll area, surface the tip as
  // a brief auto-dismissing toast after the user logs a transaction.
  const tipToastFiredRef = useRef<string | null>(null)
  useEffect(() => {
    if (!insightsEnabled || !activeTip || !lastLoggedTransaction) return
    // Only fire once per tip (don't re-fire if same tip is still active)
    if (tipToastFiredRef.current === activeTip.id) return
    tipToastFiredRef.current = activeTip.id
    showToast(activeTip.message, 'info')
  }, [insightsEnabled, activeTip, lastLoggedTransaction, showToast])

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
      {/* Visually-hidden h1 for screen reader heading hierarchy (Req 27.1) */}
      <h1 style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
      }}>{t('nav.home')}</h1>
      {/* Live region for screen readers: announces allowance changes after logging (Req 31.1) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        {allowance && !isLoading
          ? `Daily allowance: $${Math.round(allowance.amount)}. Spent today: $${Math.round(allowance.spentToday)}.`
          : ""}
      </div>
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
                gap: spacing.xxs,
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
                  fontSize: typography.caption.fontSize,
                  color: "var(--sub)",
                  opacity: 0.7,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t('home.syncing')}
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
            isNewDay={showNewDayRefresh}
            periodTransitionText={periodTransition?.message?.text}
            onDismissPeriodTransition={periodTransition?.onDismiss}
            isEstimated={!!(allowance?.isEstimated && !hasSkippedSetupSteps)}
            onLogIncome={onLogIncome}
            onLongPress={() => setShowAffordabilitySheet(true)}
          />

          {/* ── Consolidated context row (task 482) — all sub-hero indicators ── */}
          <HeroContextRow
            isLoading={isLoading}
            streakDays={streakData.currentStreak}
            streaksEnabled={streaksEnabled}
            onOpenStreakDetail={() => setShowStreakDetail(true)}
            periodContext={periodContext}
            savingsRate={savingsRate}
            savingsRateBadgeEnabled={savingsRateBadgeEnabled}
            paceIndicatorEnabled={paceIndicatorEnabled}
            transactions={transactions}
            todayStr={todayStr}
            timeHorizonStats={timeHorizonStats}
            activeSpendDown={activeSpendDown}
            allowanceAmount={allowance?.amount ?? 0}
            suggestedEntriesTotal={suggestedEntriesTotal}
            suggestionsIncludedInAllowance={suggestionsIncludedInAllowance}
            suggestedEntriesCount={suggestedEntries?.length ?? 0}
            comingUpEnabled={comingUpEnabled}
            comingUpItems={comingUpItems}
            overBudgetMessage={
              !isLoading && spendingMode !== 'tracker' && allowance?.status === 'over'
                ? t('home.overBudgetShort')
                : undefined
            }
            noTransactionsToday={!hasTodayTransactions}
            isTodayZeroSpend={isTodayZeroSpend}
            graceDayMessage={graceDayMessage}
            outstandingSplits={outstandingSplits}
            onOpenReimbursements={onOpenReimbursements}
          />

          {/* Period transition — MOVED into DailyAllowanceHero subtitle (task 483.2) */}

          {/* Suggestion allowance impact — MOVED into HeroContextRow (task 482.8) */}

          {/* Coming-up awareness — MOVED into HeroContextRow (task 482.9) */}

          {/* Savings-rate badge — MOVED into HeroContextRow (task 482.4) */}

          {/* Spending-pace indicator — MOVED into HeroContextRow (task 482.5) */}

          {/* "New day" celebration — MOVED to hero ring glow (task 483.1) */}

          {/* Estimation indicator — MOVED into hero label (task 483.3) */}

          {/* Over-budget messaging — simplified to hero color + HeroContextRow line (task 483.4) */}

          {/* Time horizon pills — MOVED into HeroContextRow (task 482.6) */}

          {/* Spend-down plan indicator — MOVED into HeroContextRow (task 482.7) */}
        </motion.section>

        {/* ── 2. Quick Actions (thumb zone — immediately after hero) ── */}        <motion.section variants={homeSection} aria-label="Quick actions">
          {isFirstRun ? (
            /* First-run: single prominent CTA (task 391.2) */
            <motion.button
              type="button"
              onClick={() => onLogExpense()}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                width: "100%",
                background: "var(--gradient-action)",
                border: "none",
                borderRadius: borderRadius.full,
                padding: "20px 28px",
                color: "var(--text)",
                fontSize: 17,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
                textAlign: "center",
                boxShadow: shadows.glowAccentStrong,
              }}
              aria-label="Log your first expense"
            >
              {t('home.logFirstExpense')}
            </motion.button>
          ) : (
          <>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
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
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
                textAlign: "center",
                boxShadow: shadows.glowAccent,
              }}
            >
              {t('home.logExpense')}
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
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {t('home.logIncome')}
            </motion.button>
          </div>

          {/* Task 484: Secondary action row removed — Split accessible in ExpenseSheet,
              affordability via hero long-press, Wish via Tools screen */}
          </>
          )}
        </motion.section>

        {/* ── "$0 Day" marker MOVED to StreakDetailView (task 485.1) ── */}
        {/* ── "$0 Day" confirmation feedback MOVED to StreakDetailView (task 485.1) ── */}

        {/* ── Grace day notification MOVED to StreakDetailView + HeroContextRow (task 485.2) ── */}

        {/* ── Outstanding Splits — MOVED to HeroContextRow expanded section (task 487.2) ── */}

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
              background: 'var(--fill-08)',
            }}
          />
        </div>

        {/* ── 2.5. Log Again — Quick Repeat (max 3 items for cleanliness) ────────────────────── */}
        {repeats.length > 0 && (
          <motion.section variants={homeSection} aria-label="Log again">
            <div
              style={{
                display: "flex",
                gap: spacing.sm,
                overflowX: "auto",
                flexWrap: "nowrap",
                paddingBottom: spacing.xxs,
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

        {/* ── 2.5b. Coming Up section (task 413.1 + 485.4 merged) — upcoming + suggested ── */}
        {comingUpEnabled && comingUpItems && comingUpItems.length > 0 && (
          <ComingUpSection
            items={comingUpItems}
            onPreLog={(item) => onLogExpense(item.category)}
            suggestedEntries={suggestedEntries}
            onConfirmSuggestion={onConfirmSuggestion}
            onDismissSuggestion={onDismissSuggestion}
            onEditSuggestion={onEditSuggestion}
            suggestedEntriesTotal={suggestedEntriesTotal}
            suggestionsIncludedInAllowance={suggestionsIncludedInAllowance}
          />
        )}
        {/* Show suggestions alone if no coming up items but suggestions exist (task 485.4) */}
        {(!comingUpEnabled || !comingUpItems || comingUpItems.length === 0) && suggestedEntries && suggestedEntries.length > 0 && onConfirmSuggestion && onDismissSuggestion && onEditSuggestion && (
          <ComingUpSection
            items={[]}
            onPreLog={(item) => onLogExpense(item.category)}
            suggestedEntries={suggestedEntries}
            onConfirmSuggestion={onConfirmSuggestion}
            onDismissSuggestion={onDismissSuggestion}
            onEditSuggestion={onEditSuggestion}
            suggestedEntriesTotal={suggestedEntriesTotal}
            suggestionsIncludedInAllowance={suggestionsIncludedInAllowance}
          />
        )}

        {/* ── WelcomeBackBadge MOVED to auto-sheet + Settings (task 485.6) ── */}

        {/* ── WhatsNewCard MOVED to Settings (task 485.5) ── */}

        {/* ── Setup Checklist MOVED to bottom sheet on 2nd/3rd open + Settings (task 485.7) ── */}
        {/* Rendered as SetupChecklistSheet below, not inline */}

        {/* ── Contextual Tip — surfaced as toast after user action, not inline (task 487.2) ── */}
        {/* Tips now fire via the toast system (see useEffect below the render tree).
            No inline ContextualTipCard renders in the home scroll area. */}

        {/* ── 3. Category Budget Cards (top 4 only for cleanliness) ────────────────────────────── */}
        <motion.section variants={homeSection} aria-label="Budget categories">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.sm,
            }}
          >
            <h2 style={sectionHeader}>
              {t('home.sectionCategories')}
            </h2>
            {categoryRows.length > 4 && (
              <button
                type="button"
                onClick={() => onOpenBudgetSettings?.()}
                style={{
                  ...linkButton,
                  fontSize: typography['body-sm'].fontSize,
                  opacity: 0.7,
                }}
                aria-label="See all categories"
              >
                {t('home.seeAll')}
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
                  title={t('home.categoryEmptyTitle')}
                  subtitle={t('home.categoryEmptySubtitle')}
                  actionLabel={onOpenBudgetSettings ? t('home.categoryEmptyAction') : undefined}
                  onAction={onOpenBudgetSettings ?? undefined}
                  actionAriaLabel="Set up category limits"
                />
              </GlassCard>
            </motion.div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm }} role="grid" aria-label="Category budgets">
              {categoryRows.slice(0, 4).map((row, gridIdx) => {
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

                const rovingProps = categoryGridRoving.getItemProps(gridIdx)

                return (
                  <motion.button
                    key={row.category}
                    ref={rovingProps.ref as React.Ref<HTMLButtonElement>}
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    onKeyDown={rovingProps.onKeyDown as unknown as React.KeyboardEventHandler<HTMLButtonElement>}
                    tabIndex={rovingProps.tabIndex}
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
                        gap: spacing.xxs,
                      }}
                    >
                      {/* Category icon chip */}
                      <CategoryIcon category={row.category} size={44} />

                      {/* Category name */}
                      <span
                        style={{
                          fontSize: typography['body-sm'].fontSize,
                          fontWeight: fontWeights.medium,
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
                            role="progressbar"
                            aria-valuenow={Math.min(row.weekPct, 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${row.label} budget usage: ${Math.round(Math.min(row.weekPct, 100))}%`}
                          >
                            <motion.div
                              animate={{ scaleX: Math.min(row.weekPct, 100) / 100 }}
                              transition={springs.gentle}
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: 2,
                                background: barColor,
                                transformOrigin: "left center",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: typography.caption.fontSize,
                              color: barColor,
                              fontFamily: FONT_FAMILY,
                              fontWeight: fontWeights.medium,
                            }}
                          >
                            {row.overWeekly
                              ? t('home.overThisWeek', { amount: Math.abs(Math.round(row.weeklyLeft)) })
                              : t('home.leftThisWeek', { amount: Math.max(0, Math.round(row.weeklyLeft)) })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              fontSize: typography.caption.fontSize,
                              color: "var(--sub)",
                              opacity: 0.6,
                              fontFamily: FONT_FAMILY,
                              marginTop: 2,
                            }}
                          >
                            {t('home.noLimit')}
                          </span>
                          {row.weeklySpent > 0 && (
                            <span
                              style={{
                                fontSize: typography.caption.fontSize,
                                color: "var(--sub)",
                                fontFamily: FONT_FAMILY,
                              }}
                            >
                              {t('home.spentAmount', { amount: Math.round(row.weeklySpent) })}
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

          {/* Suggested entries merged into Coming Up section (task 485.4) */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.sm,
            }}
          >
            <h2 style={sectionHeader}>
              {t('home.sectionRecent')}
            </h2>
            {recentTransactions.length > 0 && (
              <button
                type="button"
                onClick={onViewAllHistory}
                style={{
                  ...linkButton,
                  fontSize: typography['body-sm'].fontSize,
                  opacity: 0.7,
                }}
                aria-label="See all transactions"
              >
                {t('home.seeAll')}
              </button>
            )}
          </div>

          {recentTransactions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={timings.slow}
            >
              {isFirstRun ? (
                /* First-run warm message (task 391.2): no empty list, just encouragement */
                <GlassCard elevation="low" style={{ padding: "20px 16px", borderRadius: borderRadius.lg }}>
                  <div className="flex flex-col items-center text-center gap-2">
                    <span style={{ fontSize: 28 }} aria-hidden="true">✨</span>
                    <p
                      style={{
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.medium,
                        color: 'var(--text)',
                        fontFamily: FONT_FAMILY,
                        margin: 0,
                      }}
                    >
                      {t('home.emptyFirstRunTitle')}
                    </p>
                    <p
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        color: 'var(--sub)',
                        fontFamily: FONT_FAMILY,
                        margin: 0,
                        maxWidth: 240,
                        lineHeight: 1.5,
                      }}
                    >
                      {t('home.emptyFirstRunSubtitle')}
                    </p>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard elevation="low" style={{ padding: "4px 0", borderRadius: borderRadius.lg }}>
                  <EmptyState
                    illustration="transactions"
                    title={t('home.emptyTitle')}
                    subtitle={t('home.emptySubtitle')}
                    actionLabel={t('home.emptyAction')}
                    onAction={() => onLogExpense()}
                    actionAriaLabel="Log your first expense"
                    actionColor="success"
                  />
                </GlassCard>
              )}
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
                          fontSize: typography.caption.fontSize,
                          fontWeight: fontWeights.medium,
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
                            fontSize: typography.caption.fontSize,
                            fontWeight: fontWeights.medium,
                            color: "var(--muted)",
                            fontFamily: FONT_FAMILY,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {t('home.daySpent', { amount: dayExpenseTotal.toFixed(2) })}
                        </p>
                      )}
                    </div>

                    {/* Transaction rows with vertical timeline (255.1) */}
                    <div
                      style={{
                        position: "relative",
                        paddingInlineStart: spacing.md,
                      }}
                    >
                      {/* Vertical timeline accent line */}
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          insetInlineStart: 28,
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

                        // Build descriptive aria-label: category, amount, note, date + actions (Task 449.3)
                        const categoryLabel = catInfo?.label || tx.category
                        const amountLabel = `${tx.type === "income" ? "+" : ""}${formatMoney(tx.amount)}`
                        const noteLabel = tx.note ? `, ${tx.note}` : ""
                        const dateLabel = tx.date
                        const actionsLabel = onEditTransaction
                          ? "Swipe left to delete, swipe right to edit, or press Enter to view."
                          : "Swipe left to delete, or press Enter to view."
                        const txAriaLabel = `${categoryLabel}, ${amountLabel}${noteLabel}, ${dateLabel}. ${actionsLabel}`

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
                              ariaLabel={txAriaLabel}
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
                                  minHeight: 44,
                                  textAlign: "start",
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
                                    // Dynamic per-category glow — color varies at runtime, no static token available
                                    boxShadow: `0 0 4px ${accent}40`,
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    color: "var(--text)",
                                    fontFamily: FONT_FAMILY,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: spacing.xs,
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
                                        fontSize: typography.caption.fontSize,
                                        opacity: 0.6,
                                        marginInlineStart: 2,
                                        flexShrink: 0,
                                      }}
                                      aria-hidden="true"
                                      title="Split"
                                    >
                                      ✂️
                                    </span>
                                  )}
                                </span>
                                <span
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    fontWeight: fontWeights.medium,
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

      {/* ── Streak Detail View (Task 430.2) ────────── */}
      {streaksEnabled && (
        <StreakDetailView
          streakData={streakData}
          transactions={transactions}
          isOpen={showStreakDetail}
          onClose={() => setShowStreakDetail(false)}
          onMarkZeroSpend={handleMarkZeroSpendDay}
          canMarkZeroSpend={!hasTodayTransactions && !isTodayZeroSpend}
          graceDayMessage={graceDayMessage}
        />
      )}

      {/* ── Setup Checklist Bottom Sheet (task 485.7) ────────── */}
      {/* Shows on 2nd and 3rd app open as a bottom sheet, not inline on home */}
      <AnimatePresence>
        {showChecklistSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={timings.fast}
              onClick={handleDismissChecklistSheet}
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--color-canvas)",
                zIndex: 999,
              }}
              aria-hidden
            />
            {/* Sheet */}
            <motion.div
              role="dialog"
              aria-label="Setup checklist"
              aria-modal="true"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 60 }}
              transition={springs.gentle}
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: "70vh",
                background: "var(--surface)",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: "24px 20px 32px",
                zIndex: 1000,
                overflowY: "auto",
              }}
            >
              {/* Drag handle */}
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: "var(--fill-15)",
                  margin: "0 auto 20px",
                }}
                aria-hidden
              />
              {showProgressiveChecklist && checklistSteps && onChecklistStepAction && onDismissChecklist ? (
                <ProgressiveChecklistCard
                  steps={checklistSteps}
                  completedCount={checklistCompletedCount ?? 0}
                  totalCount={checklistTotalCount ?? 0}
                  onStepAction={onChecklistStepAction}
                  onDismiss={handleDismissChecklistSheet}
                />
              ) : skippedSetupSteps && skippedSetupSteps.length > 0 && onResumeSetupStep ? (
                <SetupChecklistCard
                  skippedSteps={skippedSetupSteps}
                  onResumeStep={onResumeSetupStep}
                  onDismiss={handleDismissChecklistSheet}
                  variant="home"
                />
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
    </FadeInContent>
    </AnimatePresence>
  )
})
