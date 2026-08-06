"use client"
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { timings, NAV_ORDER, navScreenVariants, navScreenVariantsReduced, useReducedMotion } from '@/lib/animations'
import {
  Toast,
  AppShell,
} from '@/components'
import type { AppNavKey } from '@/components/ui/AppShell'
import { HomeScreen } from '@/components/simplified/HomeScreen'
import { HistoryScreen } from '@/components/simplified/HistoryScreen'
import { SettingsScreen } from '@/components/simplified/SettingsScreen'
import { ToolsScreen } from '@/components/simplified/ToolsScreen'
import { ExpenseSheet } from '@/components/simplified/ExpenseSheet'
import { IncomeSheet } from '@/components/simplified/IncomeSheet'
import { PaycheckSheet } from '@/components/simplified/PaycheckSheet'
import { EditTransactionSheet } from '@/components/simplified/EditTransactionSheet'
import { RefundSheet } from '@/components/simplified/RefundSheet'
import { QuickLogConfirmSheet } from '@/components/simplified/QuickLogConfirmSheet'
import { AppLockScreen } from '@/components/simplified/AppLockScreen'
import { readQuickCaptureIntent } from '@/lib/quickCapture'
import { TutorialSetupStepRenderer, TutorialSetupState, SetupFixedExpense, buildOnboardingResult, BUDGET_PRESETS, buildStepsForPath, buildDemoOnlySteps } from '@/components/simplified/TutorialSteps'
import type { PayCadence } from '@/lib/paySchedule'
import { detectSubscriptions, toRecurringBillDraft } from '@/lib/subscriptionDetector'
import { mapGoalToPriority } from '@/lib/goalMapping'
import { getGoalDefaults } from '@/lib/goalDefaults'
import { getCategorizationRules, saveCategorizationRule, updateCategorizationRule, deleteCategorizationRule } from '@/lib/categorizationRules'
import { getActiveShareLinks } from '@/lib/sharingUtils'
import type { CategorizationRule, CategorizationRuleUpdate } from '@/lib/categorizationRules'
import { shadows } from '@/styles/shared'

// ── Code-split: heavy/advanced features loaded on demand ─────────────────────
// These screens are behind progressive disclosure (Tools tab, settings overlays)
// and should not bloat the initial bundle. (Improvement 4.4)

const BudgetSettings = dynamic(
  () => import('@/components/simplified/BudgetSettings').then(m => ({ default: m.BudgetSettings })),
  { ssr: false }
)
const GoalsScreen = dynamic(
  () => import('@/components/simplified/GoalsScreen').then(m => ({ default: m.GoalsScreen })),
  { ssr: false }
)
const SinkingFundsScreen = dynamic(
  () => import('@/components/simplified/SinkingFundsScreen').then(m => ({ default: m.SinkingFundsScreen })),
  { ssr: false }
)
const SubscriptionAuditScreen = dynamic(
  () => import('@/components/simplified/SubscriptionAuditScreen').then(m => ({ default: m.SubscriptionAuditScreen })),
  { ssr: false }
)
const CategorizationRulesScreen = dynamic(
  () => import('@/components/simplified/CategorizationRulesScreen').then(m => ({ default: m.CategorizationRulesScreen })),
  { ssr: false }
)
const RecurringBillsScreen = dynamic(
  () => import('@/components/simplified/RecurringBillsScreen').then(m => ({ default: m.RecurringBillsScreen })),
  { ssr: false }
)
const CancelNegotiateHelper = dynamic(
  () => import('@/components/simplified/CancelNegotiateHelper').then(m => ({ default: m.CancelNegotiateHelper })),
  { ssr: false }
)
const ReimbursementLedger = dynamic(
  () => import('@/components/simplified/ReimbursementLedger').then(m => ({ default: m.ReimbursementLedger })),
  { ssr: false }
)
const DebtScreen = dynamic(
  () => import('@/components/simplified/DebtScreen').then(m => ({ default: m.DebtScreen })),
  { ssr: false }
)
const OnboardingTutorial = dynamic(
  () => import('@/components/simplified/OnboardingTutorial').then(m => ({ default: m.OnboardingTutorial })),
  { ssr: false }
)
const ProfileSheet = dynamic(
  () => import('@/components/ui/ProfileSheet').then(m => ({ default: m.ProfileSheet })),
  { ssr: false }
)
const LessonsScreen = dynamic(
  () => import('@/components/finance/LessonsScreen').then(m => ({ default: m.LessonsScreen })),
  { ssr: false }
)
const CompoundGrowthCalculator = dynamic(
  () => import('@/components/finance/CompoundGrowthCalculator').then(m => ({ default: m.CompoundGrowthCalculator })),
  { ssr: false }
)
const CreditPayoffCalculator = dynamic(
  () => import('@/components/finance/CreditPayoffCalculator').then(m => ({ default: m.CreditPayoffCalculator })),
  { ssr: false }
)
const FundingSourcesScreen = dynamic(
  () => import('@/components/simplified/FundingSourcesScreen').then(m => ({ default: m.FundingSourcesScreen })),
  { ssr: false }
)
const LinkedAccountsScreen = dynamic(
  () => import('@/components/simplified/LinkedAccountsScreen').then(m => ({ default: m.LinkedAccountsScreen })),
  { ssr: false }
)
const BackfillSheet = dynamic(
  () => import('@/components/simplified/BackfillSheet').then(m => ({ default: m.BackfillSheet })),
  { ssr: false }
)
const BulkRepeatSheet = dynamic(
  () => import('@/components/simplified/BulkRepeatSheet').then(m => ({ default: m.BulkRepeatSheet })),
  { ssr: false }
)
const TermReviewScreen = dynamic(
  () => import('@/components/simplified/TermReviewScreen').then(m => ({ default: m.TermReviewScreen })),
  { ssr: false }
)
const YearInReviewScreen = dynamic(
  () => import('@/components/simplified/YearInReviewScreen').then(m => ({ default: m.YearInReviewScreen })),
  { ssr: false }
)
const ReportsScreen = dynamic(
  () => import('@/components/simplified/ReportsScreen').then(m => ({ default: m.ReportsScreen })),
  { ssr: false }
)
const PeerContextScreen = dynamic(
  () => import('@/components/simplified/PeerContextScreen').then(m => ({ default: m.PeerContextScreen })),
  { ssr: false }
)
const TrajectoryScreen = dynamic(
  () => import('@/components/simplified/TrajectoryScreen').then(m => ({ default: m.TrajectoryScreen })),
  { ssr: false }
)
const RoommateInviteScreen = dynamic(
  () => import('@/components/simplified/RoommateInviteScreen').then(m => ({ default: m.RoommateInviteScreen })),
  { ssr: false }
)
const SharingScreen = dynamic(
  () => import('@/components/simplified/SharingScreen').then(m => ({ default: m.SharingScreen })),
  { ssr: false }
)
const CategoryHubScreen = dynamic(
  () => import('@/components/simplified/CategoryHubScreen').then(m => ({ default: m.CategoryHubScreen })),
  { ssr: false }
)
const SavingsProjectionsScreen = dynamic(
  () => import('@/components/simplified/SavingsProjectionsScreen').then(m => ({ default: m.SavingsProjectionsScreen })),
  { ssr: false }
)
const ManageSavingsAccountsScreen = dynamic(
  () => import('@/components/simplified/ManageSavingsAccountsScreen').then(m => ({ default: m.ManageSavingsAccountsScreen })),
  { ssr: false }
)
const CashFlowForecastScreen = dynamic(
  () => import('@/components/simplified/CashFlowForecastScreen').then(m => ({ default: m.CashFlowForecastScreen })),
  { ssr: false }
)
const PortfolioAllocationScreen = dynamic(
  () => import('@/components/simplified/PortfolioAllocationScreen').then(m => ({ default: m.PortfolioAllocationScreen })),
  { ssr: false }
)
const InvestmentExplorerScreen = dynamic(
  () => import('@/components/simplified/InvestmentExplorerScreen').then(m => ({ default: m.InvestmentExplorerScreen })),
  { ssr: false }
)
const PrivacyDataScreen = dynamic(
  () => import('@/components/simplified/PrivacyDataScreen').then(m => ({ default: m.PrivacyDataScreen })),
  { ssr: false }
)
import type { DetectedSubscription } from '@/lib/subscriptionDetector'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useHomeData } from '@/hooks/useHomeData'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { carryForwardBudgetLimits, insertAllocation, createDebt, updateDebt, deleteDebt, getDebts, getReimbursements, updateProfilePreferences, createReimbursement, settleReimbursement, upsertPaySchedule, upsertBudget, deleteAllUserData } from '@/lib/supabaseData'
import type { StoredDataCategory } from '@/components/simplified/PrivacyDataScreen'
import { exportUserData, exportTransactionsCSV, deleteUserAccount } from '@/lib/accountUtils'
import { getOnboardingProgress, setOnboardingProgress, clearOnboardingProgress, setOnboardingPath, markOnboardingStepCompleted } from '@/lib/storage'
import type { TransactionCategory, Transaction, OnboardingPath, UserGoal } from '@/types'
import type { CelebrationEvent, OnboardingResult, BudgetPreset, IncomeAllocation, Debt } from '@/types/folio'
import { heroMeaningStatus } from '@/lib/dailyAllowanceUtils'
import type { Reimbursement } from '@/lib/reimbursements'
import type { TransactionRepeat } from '@/lib/transactionUtils'
import { applyRoundUp, getRoundUpTargetGoal } from '@/lib/roundUpSavings'
import { createRefundTransaction } from '@/lib/refundUtils'
import { saveTagsForTransaction } from '@/lib/tagUtils'
import { useUndo } from '@/hooks/useUndo'
import { useRecurringBills } from '@/hooks/useRecurringBills'
import { useSmartNotifications } from '@/hooks/useSmartNotifications'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useAppLock } from '@/hooks/useAppLock'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useOverlayRouter } from '@/hooks/useOverlayRouter'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { SyncIndicator } from '@/components/simplified/SyncIndicator'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

type OnboardingStep = 'loading' | 'tutorial' | 'demo_replay' | 'done'

export default function FolioApp() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const { showToast } = useToast()
  const { performWithUndo } = useUndo()

  // ── Routing & UI State ─────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('loading')
  const [activeNav, setActiveNav] = useState<AppNavKey>('home')
  const prevNavRef = useRef<AppNavKey>('home')
  const [navDirection, setNavDirection] = useState(0)

  // Wrap setActiveNav to compute directional transition
  const handleNavChange = useCallback((next: AppNavKey) => {
    const prev = prevNavRef.current
    const dir = (NAV_ORDER[next] ?? 0) > (NAV_ORDER[prev] ?? 0) ? 1 : -1
    setNavDirection(dir)
    prevNavRef.current = next
    setActiveNav(next)
  }, [])

  const { prefersReducedMotion } = useReducedMotion()

  // Single overlay/sheet state machine (replaces ~20 individual boolean flags)
  const overlay = useOverlayRouter()

  // ── Tutorial Setup State ───────────────────────────────────────
  const [tutorialSetupState, setTutorialSetupState] = useState<TutorialSetupState>({
    monthlyIncome: 2000,
    budgetPreset: 'student_moderate' as BudgetPreset,
    categoryLimits: {},
    fixedExpenses: [],
    categoryPeriods: {},
  })

  // ── Active onboarding path (task 212.1) ────────────────────────
  const [activeOnboardingPath, setActiveOnboardingPath] = useState<OnboardingPath>(
    () => {
      if (typeof window === 'undefined') return null
      return getOnboardingProgress().path
    }
  )

  // ── Per-transaction alert state (task 102.2) ───────────────────
  const [perTxAlertMessage, setPerTxAlertMessage] = useState<string | null>(null)

  // ── User goal state (task 222.3) ────────────────────────────────
  // Persisted to localStorage (for tip tone) and Supabase profile (for durability).
  const [userGoal, setUserGoalState] = useState<UserGoal | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    try {
      const stored = localStorage.getItem('folio-user-goal')
      return (stored as UserGoal) || undefined
    } catch {
      return undefined
    }
  })

  const handleGoalChange = useCallback(async (goal: UserGoal) => {
    setUserGoalState(goal)
    // Persist to localStorage for tip tone
    if (typeof window !== 'undefined') {
      localStorage.setItem('folio-user-goal', goal)
      const goalDefaults = getGoalDefaults(goal)
      localStorage.setItem('folio-tip-tone', goalDefaults.tipTone)
    }
    // Persist to Supabase profile
    if (user) {
      const mappedPriority = mapGoalToPriority(goal)
      await updateProfilePreferences(user.id, { priority: mappedPriority })
    }
  }, [user])

  // ── Categorization rules state (task 113.3) ────────────────────
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([])
  useEffect(() => {
    setCategorizationRules(getCategorizationRules())
  }, [])

  // ── Income Anchor Banner (task 95.1) ───────────────────────────
  // ── Derived: any bottom sheet open (hides FAB + dock to prevent z-index overlap) ──
  const anySheetOpen = overlay.anySheetOpen

  // ── Celebration State ──────────────────────────────────────────
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null)

  // ── Last logged expense for undo ───────────────────────────────
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null)

  // ── Data Layer (consolidated in useHomeData hook) ─────────────
  const {
    transactions,
    budgets,
    goals,
    lessonProgress,
    allowance,
    weekendAllowance,
    totalSetAside,
    savingsRate,
    paySchedule,
    termSchedule,
    isLoading: dataLoading,
    isSyncing,
    isStale,
    refresh,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    updateBudget,
    createGoal,
    updateGoal,
    contributeToGoal,
    deleteGoal,
    completeLesson,
    sinkingFunds,
    addSinkingFund,
    updateSinkingFund,
    deleteSinkingFund,
    setDisbursementBonus,
    disbursements,
    addDisbursement,
    removeDisbursement,
    incomeSmoothing,
    setIncomeSmoothing,
    spendingMode,
    setSpendingMode,
    heroMeaning,
    setHeroMeaning,
    overLimitResponse,
    setOverLimitResponse,
    fundingSources,
    addFundingSource,
    updateFundingSource,
    deleteFundingSource,
    activeSpendDown,
    spendDownPlans,
    addSpendDownPlan,
    removeSpendDownPlan,
    updateSpendDownPlan,
    timeHorizonStats,
    savingsAccounts,
    createSavingsAccount,
    updateSavingsAccount,
    deleteSavingsAccount,
    contributeToSavingsAccount,
    totalSavingsBalance,
  } = useHomeData(user?.id, user)

  // ── Custom Categories ──────────────────────────────────────────
  const { customCategories, addCustomCategory, removeCustomCategory, renameCustomCategory } = useCustomCategories(user?.id)

  // ── Offline Sync (background retry of queued expenses) ─────────
  const {
    pendingCount: offlinePendingCount,
    hasFailed: offlineHasFailed,
    recentlySyncedIds: offlineRecentlySyncedIds,
    retryAll: retryOfflineSync,
    dismissFailed: dismissOfflineFailed,
    refresh: refreshOfflineSync,
  } = useOfflineSync(user?.id ?? undefined)

  // ── Network Status (Phase 6, task 265.1 — offline detection) ───
  const { isOnline } = useNetworkStatus()

  // ── Recurring Bills (task 65 — set-and-forget bills) ───────────
  const { bills: recurringBills, addBill, updateBill, deleteBill } = useRecurringBills(user?.id)

  // ── Hero Display (task 100) — computed from heroMeaning + allowance ────────
  // Pure derivation so the hero component stays agnostic about which metric
  // is active. Falls back gracefully when allowance hasn't loaded yet.
  const heroDisplay = useMemo(() => {
    if (!allowance) return undefined
    return heroMeaningStatus(heroMeaning, allowance, transactions, new Date())
  }, [heroMeaning, allowance, transactions])

  // ── Feature Flags (improvement 4.6 — toggle advanced features) ──
  const { flags } = useFeatureFlags()

  // ── Completed lesson IDs (task 151.1 — credit education path wiring) ──
  const completedLessonIds = useMemo(
    () => new Set(lessonProgress.filter(lp => lp.completed).map(lp => lp.lessonId)),
    [lessonProgress]
  )

  // ── Debts (loaded on demand when DebtScreen opens) ─────────────
  const [debts, setDebts] = useState<Debt[]>([])
  const [debtsLoaded, setDebtsLoaded] = useState(false)

  // ── Reimbursements (loaded on demand for obligations summary) ──
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [reimbursementsLoaded, setReimbursementsLoaded] = useState(false)

  const handleOpenDebt = useCallback(async () => {
    if (!debtsLoaded && user?.id) {
      const data = await getDebts(user.id).catch(() => [] as Debt[])
      setDebts(data)
      setDebtsLoaded(true)
    }
    overlay.openOverlay('debt')
  }, [debtsLoaded, user?.id, overlay])

  // Load debts and reimbursements when tools tab is active (for obligations summary)
  // Also load reimbursements on home tab for split partner suggestions (task 5.3)
  useEffect(() => {
    if (!user?.id) return
    if (activeNav === 'tools') {
      if (!debtsLoaded) {
        getDebts(user.id).then(data => {
          setDebts(data)
          setDebtsLoaded(true)
        }).catch(() => {})
      }
    }
    if (!reimbursementsLoaded && (activeNav === 'tools' || activeNav === 'home')) {
      getReimbursements(user.id).then(data => {
        setReimbursements(data)
        setReimbursementsLoaded(true)
      }).catch(() => {})
    }
  }, [activeNav, user?.id, debtsLoaded, reimbursementsLoaded])

  const handleAddDebt = useCallback(async (debt: Omit<Debt, "id" | "userId" | "createdAt">) => {
    if (!user?.id) return
    await createDebt(user.id, debt)
    const data = await getDebts(user.id).catch(() => [] as Debt[])
    setDebts(data)
  }, [user?.id])

  const handleUpdateDebt = useCallback(async (id: string, updates: Partial<Debt>) => {
    if (!user?.id) return
    await updateDebt(user.id, id, updates)
    const data = await getDebts(user.id).catch(() => [] as Debt[])
    setDebts(data)
  }, [user?.id])

  const handleDeleteDebt = useCallback(async (id: string) => {
    if (!user?.id) return
    await deleteDebt(user.id, id)
    setDebts(prev => prev.filter(d => d.id !== id))
  }, [user?.id])

  // ── Service Worker registration (task 77 — PWA notifications) ──
  useServiceWorker()

  // ── Optional cold-open app lock (task 182.1 — biometric/PIN gate) ──
  // Device-local privacy convenience, OFF by default. Gates a fresh cold open
  // behind the lock screen when enabled; in-app navigation never re-prompts.
  const appLock = useAppLock()

  // ── Smart Notifications (task 114.2 — low balance & bill-due alerts;
  //    task 160.1 — payday-triggered savings contribution reminder;
  //    task 189.1 — if-this-then-that trigger suggestions) ──
  useSmartNotifications(allowance, recurringBills, savingsAccounts, paySchedule, transactions, sinkingFunds)

  // ── Subscription Detection ─────────────────────────────────────
  const [dismissedSubscriptions, setDismissedSubscriptions] = useState<Set<string>>(new Set())
  const detectedSubscriptions = useMemo(
    () => detectSubscriptions(transactions).filter(s => !dismissedSubscriptions.has(s.id)),
    [transactions, dismissedSubscriptions]
  )

  // ── Monthly income (for goal deadline feasibility) ─────────────
  const monthlyIncome = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    return transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  // ── Recent split partners (derived from reimbursements, task 5.3 + 123.1 — sorted by frequency) ──
  const recentSplitPartners = useMemo(() => {
    if (reimbursements.length === 0) return []
    // Count frequency per person (how often they appear in splits)
    const freq = new Map<string, number>()
    const canonical = new Map<string, string>() // lowercase → display name
    for (const r of reimbursements) {
      const name = r.personName.trim()
      if (!name) continue
      const key = name.toLowerCase()
      freq.set(key, (freq.get(key) ?? 0) + 1)
      if (!canonical.has(key)) canonical.set(key, name)
    }
    // Sort by frequency descending, take top 5
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => canonical.get(key)!)
  }, [reimbursements])

  // ── Outstanding splits: who owes the user (task 5.3 — who-owes-whom surface) ──
  const outstandingSplits = useMemo(() => {
    if (reimbursements.length === 0) return []
    // Compute net positive balances (people who owe you)
    const balances = new Map<string, number>()
    for (const r of reimbursements) {
      if (r.settled) continue
      const name = r.personName.trim()
      if (!name) continue
      const current = balances.get(name) ?? 0
      const delta = r.direction === 'owed_to_me' ? r.amount : -r.amount
      balances.set(name, current + delta)
    }
    // Only show people who net owe you (positive balance), sorted by amount desc
    return [...balances.entries()]
      .filter(([, amt]) => amt > 0.01)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }))
  }, [reimbursements])

  // ── Split transaction IDs (task 5.3 — badge on recent transactions) ──
  const splitTransactionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of reimbursements) {
      if (r.linkedTransactionId) {
        ids.add(r.linkedTransactionId)
      }
    }
    return ids
  }, [reimbursements])

  const handleDismissSubscription = useCallback((id: string) => {
    setDismissedSubscriptions(prev => new Set([...prev, id]))
  }, [])

  // One-tap confirm: promote a detected subscription into a tracked recurring
  // bill, then dismiss it from the audit list so it isn't proposed again.
  const handleConfirmSubscription = useCallback(async (sub: DetectedSubscription) => {
    try {
      await addBill(toRecurringBillDraft(sub))
      setDismissedSubscriptions(prev => new Set([...prev, sub.id]))
      showToast(`${sub.label} added to recurring bills ✓`, 'success')
    } catch {
      showToast("Couldn't add that bill — please try again", 'error')
    }
  }, [addBill, showToast])

  // ── Onboarding Check ───────────────────────────────────────────
  // Task 66: Skip the onboarding gate — new users go straight to the Home Screen.
  // The tutorial remains accessible from settings but never blocks value.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Read structured progress (handles one-way migration from legacy flag)
      const progress = getOnboardingProgress()
      // Always resolve to 'done' so new users land on the Home Screen immediately.
      if (!progress.isComplete) {
        // Mark as onboarded so subsequent loads skip any legacy gate check.
        setOnboardingProgress({ ...progress, isComplete: true })
      }
      setOnboardingStep('done')
    }
  }, [])

  // ── First-run backfill prompt (task 88.2) ──────────────────────
  // When user has zero transactions and hasn't dismissed the backfill offer,
  // auto-open the backfill sheet once as a gentle prompt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dataLoading) return
    if (transactions.length > 0) return
    if (localStorage.getItem('folio-backfill-offered') === 'true') return

    // Mark as offered so it only shows once
    localStorage.setItem('folio-backfill-offered', 'true')
    // Small delay so the home screen renders first
    const timer = setTimeout(() => overlay.openSheet('backfill'), 600)
    return () => clearTimeout(timer)
  }, [dataLoading, transactions.length, overlay])

  // ── Capture from anywhere (task 180.1 — share sheet & assistant quick log) ──
  // The OS share sheet (Web Share Target) and PWA/assistant shortcuts both land
  // on "/" with query params (see public/manifest.json + lib/quickCapture.ts).
  // We detect that launch here, route any shared/dictated text through the SAME
  // naturalLogParser the in-app quick log uses (task 166.1), and open a
  // confirm-before-save sheet. Nothing is ever persisted automatically.
  // Runs once on mount; we strip the params so a refresh/back never re-triggers.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const intent = readQuickCaptureIntent(window.location.search)
    if (!intent) return

    // Clean the URL immediately so this capture fires exactly once.
    window.history.replaceState({}, document.title, window.location.pathname)

    // No text to parse (e.g. a bare "Log expense" shortcut) or an income
    // capture — the natural-language parser is expense/category oriented, so we
    // just open the appropriate sheet directly rather than guess.
    if (!intent.rawText.trim() || intent.type === 'income') {
      if (intent.type === 'income') {
        overlay.openSheet('income')
      } else {
        overlay.openSheet('expense', { defaultCategory: undefined, splitPreEnabled: false })
      }
      return
    }

    // Text present → confirm-before-save flow. The sheet parses internally so a
    // late-loading funding-source list still gets a chance to match.
    overlay.openSheet('quickLog', { rawText: intent.rawText, source: intent.source })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Income anchor banner (task 95.1) ──────────────────────────
  // ── Budget limit carry-forward on mount ────────────────────────
  useEffect(() => {
    if (user?.id && !authLoading) {
      carryForwardBudgetLimits(user.id).catch(err =>
        console.error('Error carrying forward budget limits:', err)
      )
    }
  }, [user?.id, authLoading])

  // ── Onboarding Handlers ────────────────────────────────────────
  const handleTutorialComplete = async () => {
    // Build the onboarding result from tutorial setup state
    const result: OnboardingResult = buildOnboardingResult(tutorialSetupState)
    
    // Apply initial limits/income via updateBudget
    if (result.customLimits) {
      const entries = Object.entries(result.customLimits) as [TransactionCategory, number][]
      for (const [cat, limit] of entries) {
        if (limit > 0) await updateBudget(cat, limit)
      }
    }

    // ── Persist fixed expenses as recurring bills (task 214.2) ──────
    // Express path users may have added fixed monthly bills (rent, subscriptions).
    // Write each one through addBill so they participate in allowance calculation.
    if (tutorialSetupState.fixedExpenses && tutorialSetupState.fixedExpenses.length > 0) {
      for (const expense of tutorialSetupState.fixedExpenses) {
        await addBill({
          category: expense.category,
          label: expense.label,
          amount: expense.amount,
          dueDay: expense.dueDay,
          recurringId: '',
          isActive: true,
        })
      }
    }

    // ── Persist monthly income so the first render uses a real number (task 210.1) ──
    // STORAGE DECISION: seed an actual income *transaction* for the current month
    // rather than writing a standalone "monthly income" profile field.
    //
    // Why a transaction (and not a profile field):
    //   • `computeDailyAllowance` resolves its income source by priority
    //     (budget limits → actual income transactions → $50 estimate fallback).
    //     `useHomeData` feeds it a `monthlyIncome` derived *only* from the current
    //     month's income transactions — a profile field would be invisible to it,
    //     so the source would stay on 'estimate' and the hero would still show ~$50.
    //   • Variable-income smoothing (Phase 1 task 68 — `computeSmoothedIncome`)
    //     reads income *transactions* and only engages when the source is
    //     'transactions'. Seeding a transaction is therefore the only target that
    //     composes with smoothing; a profile field would not.
    //   • It flows through the same `getTransactions` path `useHomeData` already
    //     reads, so the daily number is correct on first render with no new plumbing.
    //
    // Idempotency: skip seeding if the user already logged income this month (e.g.
    // re-running the tutorial from settings) so we never double-count income.
    if (result.monthlyIncome > 0) {
      const currentMonthPrefix = new Date().toISOString().slice(0, 7)
      const hasIncomeThisMonth = transactions.some(
        t => t.type === 'income' && t.date.startsWith(currentMonthPrefix)
      )
      if (!hasIncomeThisMonth) {
        // Task 210.2: Apply savings % from the chosen budget preset so the
        // seeded income transaction represents the *discretionary* pool, not
        // the raw gross income. computeDailyAllowance divides this amount by
        // days — using the reduced number means the daily figure naturally
        // reflects the user's intended savings rate without extra plumbing.
        const preset = BUDGET_PRESETS.find(p => p.value === result.budgetPreset)
        const savingsPercent = preset?.savingsPercent ?? 0
        const discretionaryIncome = Math.round(result.monthlyIncome * (1 - savingsPercent / 100))

        await addTransaction({
          amount: discretionaryIncome,
          category: 'other',
          type: 'income',
          date: new Date().toISOString().slice(0, 10),
          note: 'Monthly spending budget (from setup)',
        })
      }
    }

    // ── Paycheck path persistence (task 216 + task 217) ────────────────────────
    // When the user chose the paycheck path, persist the pay schedule, write
    // budgets with payday_aligned period, and seed income from the spend bucket.
    // Task 217: Simple mode skips schedule modeling but still seeds a real daily number.
    if (activeOnboardingPath === 'paycheck' && tutorialSetupState.paySchedule && user) {
      const schedule = tutorialSetupState.paySchedule
      const allocation = tutorialSetupState.allocationSplit ?? { spend: 80, save: 10, invest: 5, setAside: 5 }
      const isSimpleMode = tutorialSetupState.paycheckMode === 'simple'

      if (isSimpleMode) {
        // ── Simple mode persistence (task 217.2) ─────────────────────────────
        // No pay schedule to persist — just derive monthly income from the
        // paycheck amount × cadence multiplier and seed an income transaction
        // so computeDailyAllowance produces a real number, not the $50 fallback.
        const simpleCadence = tutorialSetupState.simpleCadence ?? 'biweekly'
        const spendPool = Math.round(schedule.amount * allocation.spend / 100)

        if (spendPool > 0) {
          // Convert per-paycheck spend pool to monthly equivalent
          let monthlySpend: number
          switch (simpleCadence) {
            case 'weekly': monthlySpend = Math.round(spendPool * 4.33); break
            case 'biweekly': monthlySpend = Math.round(spendPool * 2.17); break
            case 'monthly': monthlySpend = spendPool; break
            default: monthlySpend = Math.round(spendPool * 2.17)
          }

          // Write a budget so the allowance calculation has a real pool
          await upsertBudget(user.id, 'other', monthlySpend, undefined, { period: 'monthly' })

          // Seed income transaction so the first daily number is real
          const currentMonthPrefix = new Date().toISOString().slice(0, 7)
          const hasIncomeThisMonth = transactions.some(
            t => t.type === 'income' && t.date.startsWith(currentMonthPrefix)
          )
          if (!hasIncomeThisMonth) {
            await addTransaction({
              amount: monthlySpend,
              category: 'other',
              type: 'income',
              date: new Date().toISOString().slice(0, 10),
              note: 'Paycheck spending budget (simple split)',
            })
          }
        }
      } else {
        // ── Full mode persistence (task 216) ──────────────────────────────────

        // 216.1: Persist the pay schedule
        const anchorDate = schedule.anchorDate || new Date().toISOString().slice(0, 10)
        await upsertPaySchedule(user.id, {
          cadence: schedule.cadence,
          anchorDate,
          amount: schedule.amount,
        })

        // 216.2: Write a budget with period: 'payday_aligned' so computeDailyAllowance
        // uses getLastPayday/getNextPayday and divides the pool by days in the pay cycle.
        // We write a catch-all "other" category budget representing the full spend pool.
        const spendPool = Math.round(schedule.amount * allocation.spend / 100)
        if (spendPool > 0) {
          await upsertBudget(user.id, 'other', spendPool, undefined, { period: 'payday_aligned' })
        }

        // 216.3: Seed the income transaction using paycheck amount × spend%
        // so the first daily number is correct immediately.
        const currentMonthPrefix = new Date().toISOString().slice(0, 7)
        const hasIncomeThisMonth = transactions.some(
          t => t.type === 'income' && t.date.startsWith(currentMonthPrefix)
        )
        if (!hasIncomeThisMonth && spendPool > 0) {
          // Convert the per-paycheck spend pool to a monthly equivalent for income seeding.
          // computeDailyAllowance will then divide by the pay cycle days (not 30).
          let monthlySpend: number
          switch (schedule.cadence) {
            case 'weekly': monthlySpend = Math.round(spendPool * 4.33); break
            case 'biweekly': monthlySpend = Math.round(spendPool * 2.17); break
            case 'semimonthly': monthlySpend = Math.round(spendPool * 2); break
            case 'monthly': monthlySpend = spendPool; break
            case 'irregular': monthlySpend = Math.round(spendPool * 2.17); break
            default: monthlySpend = spendPool
          }

          await addTransaction({
            amount: monthlySpend,
            category: 'other',
            type: 'income',
            date: new Date().toISOString().slice(0, 10),
            note: 'Paycheck spending budget (from setup)',
          })
        }

        // 216.4: For irregular cadence, enable income smoothing (trailing_average)
        if (schedule.cadence === 'irregular') {
          setIncomeSmoothing({ strategy: 'trailing_average', windowMonths: 3 })
        }
      }
    }
    
    // ── Persist optional recent income (task 219) ───────────────────────────
    // If the user logged a recent deposit in the cascade tail, persist it as
    // a real income transaction so it contributes to smoothing accuracy.
    if (tutorialSetupState.recentIncome && tutorialSetupState.recentIncome.amount > 0) {
      const incomeDate = tutorialSetupState.recentIncome.date || new Date().toISOString().slice(0, 10)
      await addTransaction({
        amount: tutorialSetupState.recentIncome.amount,
        category: 'other',
        type: 'income',
        date: incomeDate,
        note: tutorialSetupState.recentIncome.note || 'Recent deposit (from setup)',
      })
    }

    // ── Persist optional recent expense (task 220) ──────────────────────────
    // If the user logged a recent purchase in the cascade tail, persist it as
    // a real expense transaction so it seeds their history.
    if (tutorialSetupState.recentExpense && tutorialSetupState.recentExpense.amount > 0) {
      const expenseDate = tutorialSetupState.recentExpense.date || new Date().toISOString().slice(0, 10)
      await addTransaction({
        amount: tutorialSetupState.recentExpense.amount,
        category: tutorialSetupState.recentExpense.category,
        type: 'expense',
        date: expenseDate,
        note: tutorialSetupState.recentExpense.note || 'Recent purchase (from setup)',
      })
    }

    // ── Persist optional goal selection (task 221) ──────────────────────────
    // If the user picked a primary goal in the cascade tail, map it to a
    // UserPriority and persist it on the profile so tip tone adapts.
    // Task 222.2: Also apply goal-driven defaults (budget preset override,
    // tip tone) so the daily number and tip selection work around that goal.
    // Task 231: If goal was skipped, silently default to 'track_spending'.
    const effectiveGoal = tutorialSetupState.primaryGoal || 'track_spending'
    if (user) {
      const mappedPriority = mapGoalToPriority(effectiveGoal)
      const goalDefaults = getGoalDefaults(effectiveGoal)

      // Persist priority + tip tone on the profile
      await updateProfilePreferences(user.id, { priority: mappedPriority })

      // Store the tip tone in localStorage so tipUtils can read it
      if (typeof window !== 'undefined') {
        localStorage.setItem('folio-tip-tone', goalDefaults.tipTone)
        localStorage.setItem('folio-user-goal', effectiveGoal)
      }
    }

    // Persist tutorial completion flag (structured state + Supabase sync)
    const completionProgress = getOnboardingProgress()
    completionProgress.isComplete = true
    setOnboardingProgress(completionProgress)
    setOnboardingStep('done')

    // Task 210.3: Persist setupDate on the profile so mid-month daily allowance
    // math divides by remaining days instead of the whole month.
    // Also sync onboarding progress to Supabase for durability (task 211.2).
    if (user) {
      await updateProfilePreferences(user.id, {
        setupDate: new Date().toISOString().slice(0, 10),
        hasCompletedOnboarding: true,
        onboardingPath: completionProgress.path,
        onboardingCompletedSteps: completionProgress.completedSteps,
        onboardingSkippedSteps: completionProgress.skippedSteps,
      })
    }
    
    if (result.monthlyIncome > 0 || (result.customLimits && Object.keys(result.customLimits).length > 0)) {
      showToast("Tutorial complete — check today's budget")
    }
  }

  const handleTutorialSkip = () => {
    const progress = getOnboardingProgress()
    // Task 218.2: When minimal path user skips the estimate step,
    // record it so home can show the "make this yours" nudge.
    if (activeOnboardingPath === 'minimal' && tutorialSetupState.monthlyIncome === 0) {
      if (!progress.skippedSteps.includes('minimal-estimate')) {
        progress.skippedSteps.push('minimal-estimate')
      }
    }
    progress.isComplete = true
    setOnboardingProgress(progress)
    setOnboardingStep('done')

    // Task 231: If no goal was selected before skipping, silently default to 'track_spending'
    if (!tutorialSetupState.primaryGoal && typeof window !== 'undefined') {
      const goalDefaults = getGoalDefaults('track_spending')
      localStorage.setItem('folio-tip-tone', goalDefaults.tipTone)
      localStorage.setItem('folio-user-goal', 'track_spending')
    }
  }

  // ── Categorization Rules Handlers (task 113.3, 187.1) ───────────
  const handleAddCategorizationRule = useCallback(
    (keyword: string, category: TransactionCategory, fundingSourceId?: string | null) => {
      const rule = saveCategorizationRule(keyword, category, fundingSourceId)
      setCategorizationRules(prev => [...prev, rule])
    },
    []
  )

  const handleUpdateCategorizationRule = useCallback(
    (id: string, updates: CategorizationRuleUpdate) => {
      const updated = updateCategorizationRule(id, updates)
      if (updated) {
        setCategorizationRules(prev => prev.map(r => (r.id === id ? updated : r)))
      }
    },
    []
  )

  const handleDeleteCategorizationRule = useCallback((id: string) => {
    deleteCategorizationRule(id)
    setCategorizationRules(prev => prev.filter(r => r.id !== id))
  }, [])

  // ── Expense Logging ────────────────────────────────────────────
  const handleOpenExpenseSheet = useCallback((category?: TransactionCategory) => {
    overlay.openSheet('expense', { defaultCategory: category, splitPreEnabled: false })
  }, [overlay])

  // Opens expense sheet with split toggle pre-enabled (task 65 — one-tap split)
  const handleOpenSplitExpense = useCallback(() => {
    overlay.openSheet('expense', { defaultCategory: undefined, splitPreEnabled: true })
  }, [overlay])

  // Settle all unsettled IOUs for a given person (task 123.1 — one-tap settle from HomeScreen)
  const handleSettleSplit = useCallback(async (personName: string) => {
    if (!user?.id) return
    const unsettled = reimbursements.filter(
      (r) => !r.settled && r.personName.trim().toLowerCase() === personName.trim().toLowerCase() && r.direction === 'owed_to_me'
    )
    if (unsettled.length === 0) return
    // Optimistic update
    setReimbursements((prev) =>
      prev.map((r) =>
        unsettled.some((u) => u.id === r.id) ? { ...r, settled: true, settledAt: new Date().toISOString() } : r
      )
    )
    // Persist each settlement
    for (const r of unsettled) {
      await settleReimbursement(user.id, r.id)
    }
  }, [user?.id, reimbursements])

  const handleExpenseSubmit = useCallback(async (data: {
    amount: number
    category: TransactionCategory
    note?: string
    date?: string
    fundingSourceId?: string
    trackAsIOU?: boolean
    splitWith?: string
    splitOwedAmount?: number
    tags?: string[]
  }) => {
    if (!user?.id) return

    const today = data.date ?? new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      amount: data.amount,
      category: data.category,
      type: 'expense',
      date: today,
      note: data.note,
      fundingSourceId: data.fundingSourceId,
    })

    if (result) {
      setLastLoggedId(result.id)

      // Persist tags to localStorage (task 113.2)
      if (data.tags && data.tags.length > 0) {
        saveTagsForTransaction(result.id, data.tags)
      }

      // Auto-create IOU reimbursement when tracking as borrowed (task 84.1)
      if (data.trackAsIOU && data.fundingSourceId) {
        const source = fundingSources.find(s => s.id === data.fundingSourceId)
        if (source && source.kind === 'borrowed') {
          // Derive person name from the funding source label (e.g., "Parents' Card" → "Parents")
          const personName = source.label.replace(/'s?\s*(Card|Wallet|Account)$/i, '').trim() || source.label
          const iouResult = await createReimbursement(user.id, {
            personName,
            direction: 'owed_by_me',
            amount: data.amount,
            note: data.note || `${data.category} expense`,
            linkedTransactionId: result.id,
          })
          if (iouResult) {
            showToast(`IOU tracked — you owe ${personName} $${data.amount.toFixed(2)}`, 'success')
          }
        }
      }

      // Auto-create IOU when splitting with a named friend (task 5.3 polish)
      if (data.splitWith && data.splitOwedAmount && data.splitOwedAmount > 0) {
        const iouResult = await createReimbursement(user.id, {
          personName: data.splitWith,
          direction: 'owed_to_me',
          amount: data.splitOwedAmount,
          note: data.note || `Split ${data.category} expense`,
          linkedTransactionId: result.id,
        })
        if (iouResult) {
          showToast(`${data.splitWith} owes you $${data.splitOwedAmount.toFixed(2)}`, 'success')
        }
      }

      // Round-up savings contribution (task 112.2)
      const { savingsAmount } = applyRoundUp(data.amount)
      if (savingsAmount > 0) {
        const targetGoalId = getRoundUpTargetGoal()
        if (targetGoalId) {
          const goalResult = await contributeToGoal(targetGoalId, savingsAmount)
          if (goalResult) {
            const goalName = goals.find(g => g.id === targetGoalId)?.name ?? 'goal'
            showToast(`$${savingsAmount.toFixed(2)} rounded up → ${goalName}`, 'success')
          }
        }
      }
    } else {
      // addTransaction queued the expense locally on failure; reflect it in the
      // sync indicator so the user can see it is pending background retry.
      refreshOfflineSync()
      showToast('Saved offline — will sync when connected', 'success')
    }
  }, [user?.id, addTransaction, showToast, refreshOfflineSync, fundingSources, contributeToGoal, goals])

  const handleExpenseUndo = useCallback(async () => {
    if (!lastLoggedId) return
    await deleteTransaction(lastLoggedId)
    setLastLoggedId(null)
    showToast('Expense removed')
  }, [lastLoggedId, deleteTransaction, showToast])

  // ── Quick-log capture handlers (task 180.1) ────────────────────
  // Confirm reuses handleExpenseSubmit so a captured expense flows through the
  // exact same persistence path (optimistic write, offline queue, round-up,
  // IOU/split hooks) as any other logged expense — no duplicate mutation logic.
  const handleQuickLogConfirm = useCallback(async (data: {
    amount: number
    category: TransactionCategory
    note?: string
    fundingSourceId?: string
  }) => {
    overlay.closeSheet('quickLog')
    await handleExpenseSubmit(data)
    showToast('Logged it ✓')
  }, [overlay, handleExpenseSubmit, showToast])

  // Ambiguous parse or user tapped "Edit details" → fall back to the normal
  // ExpenseSheet. ExpenseSheet takes a default category; any extracted amount/
  // note can't be pre-filled there, so we surface them as a gentle hint instead.
  const handleQuickLogEdit = useCallback((partial?: { amount?: number; note?: string }) => {
    overlay.closeSheet('quickLog')
    overlay.openSheet('expense', { defaultCategory: undefined, splitPreEnabled: false })
    if (partial?.amount || partial?.note) {
      const bits = [
        partial.amount ? `$${partial.amount}` : null,
        partial.note || null,
      ].filter(Boolean).join(' · ')
      setPerTxAlertMessage(`From your capture: ${bits}`)
    }
  }, [overlay])

  // ── Income Logging ─────────────────────────────────────────────
  const handleIncomeSubmit = useCallback(async (data: {
    amount: number
    note?: string
    fundingSourceId?: string
    date?: string
    isGigIncome?: boolean
  }) => {
    if (!user?.id) return

    const today = data.date ?? new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      // Persist gig income under the 'gig' category so surfaces like the
      // Financial Trajectory can compute the tax set-aside (task 154.1).
      category: data.isGigIncome ? 'gig' : 'other',
      amount: data.amount,
      type: 'income',
      date: today,
      note: data.note,
      fundingSourceId: data.fundingSourceId,
    })

    if (result) {
      setLastLoggedId(result.id)
    } else {
      // Income is not replayed by the offline queue, so don't claim it was saved.
      showToast("Couldn't save income — check your connection and try again", 'error')
    }
  }, [user?.id, addTransaction, showToast])

  const handleIncomeUndo = useCallback(async () => {
    if (!lastLoggedId) return
    await deleteTransaction(lastLoggedId)
    setLastLoggedId(null)
    showToast('Income removed')
  }, [lastLoggedId, deleteTransaction, showToast])

  // ── Paycheck Sheet (show after income logged, only if active goals) ──
  const handleShowPaycheck = useCallback((amount: number, isGigIncome?: boolean) => {
    overlay.openSheet('paycheck', { amount, isGigIncome: !!isGigIncome })
  }, [overlay])

  // ── Income Allocation (optimistic, reversible on persistence failure) ──
  const handleAllocateIncome = useCallback(async (allocation: IncomeAllocation) => {
    if (!user?.id) return

    // Persist to Supabase
    const result = await insertAllocation(user.id, allocation)

    if (result) {
      // Trigger a refresh to pick up the new allocation and recalculate totalSetAside
      await refresh()
    } else {
      showToast('Allocation saved locally — will sync when connected', 'success')
    }
  }, [user?.id, refresh, showToast])

  // ── Repeat Log ─────────────────────────────────────────────────
  const handleRepeatLog = useCallback(async (repeat: TransactionRepeat) => {
    if (!user?.id) return

    const today = new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      amount: repeat.amount,
      category: repeat.category,
      type: repeat.type,
      date: today,
      note: repeat.note,
    })

    if (result) {
      setLastLoggedId(result.id)
      showToast(`Logged ${repeat.label} ✓`, 'success', {
        label: 'Undo',
        onClick: async () => {
          await deleteTransaction(result.id)
          showToast('Removed')
        },
      })
    } else if (repeat.type === 'expense') {
      // Expense was queued locally for background retry.
      refreshOfflineSync()
      showToast('Saved offline — will sync when connected', 'success')
    } else {
      showToast("Couldn't save — check your connection and try again", 'error')
    }
  }, [user?.id, addTransaction, deleteTransaction, showToast, refreshOfflineSync])

  // ── Transaction Delete ─────────────────────────────────────────
  const handleDeleteTransaction = useCallback(async (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) { await deleteTransaction(id); return }

    await performWithUndo(
      'delete_transaction',
      () => deleteTransaction(id),
      () => addTransaction({
        amount: tx.amount,
        category: tx.category,
        type: tx.type,
        date: tx.date,
        note: tx.note,
      }),
      tx.type === 'expense' ? 'Expense deleted' : 'Transaction deleted',
    )
  }, [transactions, deleteTransaction, addTransaction, performWithUndo])

  // ── Bulk Delete (Task 131) ─────────────────────────────────────
  const handleBulkDelete = useCallback(async (ids: string[]) => {
    const snapshot = transactions.filter(t => ids.includes(t.id))

    await performWithUndo(
      'bulk_delete',
      async () => { for (const id of ids) { await deleteTransaction(id) } },
      async () => {
        for (const tx of snapshot) {
          await addTransaction({
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            date: tx.date,
            note: tx.note,
          })
        }
      },
      `${ids.length} transaction${ids.length > 1 ? 's' : ''} deleted`,
    )
  }, [transactions, deleteTransaction, addTransaction, performWithUndo])

  // ── Bulk Recategorize (Task 131) ───────────────────────────────
  const handleBulkRecategorize = useCallback(async (ids: string[], category: TransactionCategory) => {
    const targets = transactions.filter(t => ids.includes(t.id))
    const originals = targets.map(t => ({ id: t.id, category: t.category, amount: t.amount, type: t.type, date: t.date, note: t.note }))

    await performWithUndo(
      'bulk_recategorize',
      async () => {
        for (const tx of targets) {
          await updateTransaction(tx.id, {
            amount: tx.amount,
            category,
            type: tx.type,
            date: tx.date,
            note: tx.note,
          })
        }
      },
      async () => {
        for (const orig of originals) {
          await updateTransaction(orig.id, {
            amount: orig.amount,
            category: orig.category,
            type: orig.type,
            date: orig.date,
            note: orig.note,
          })
        }
      },
      `${ids.length} transaction${ids.length > 1 ? 's' : ''} recategorized`,
    )
  }, [transactions, updateTransaction, performWithUndo])

  // ── Bulk Tag (Task 131) ────────────────────────────────────────
  const handleBulkTag = useCallback(async (ids: string[], tags: string[]) => {
    // Snapshot original tags for undo
    const originals = ids.map(id => {
      const tx = transactions.find(t => t.id === id)
      return { id, tags: tx?.tags ? [...tx.tags] : undefined }
    })
    // Apply tags
    for (const id of ids) {
      saveTagsForTransaction(id, tags)
    }
    // Refresh to pick up new tags
    await refresh()
    showToast(`Tags added to ${ids.length} transaction${ids.length > 1 ? 's' : ''}`, 'success', {
      label: 'Undo',
      onClick: async () => {
        for (const { id, tags: orig } of originals) {
          saveTagsForTransaction(id, orig ?? [])
        }
        await refresh()
        showToast('Tags removed')
      },
    })
  }, [transactions, showToast, refresh])

  // ── Transaction Edit ───────────────────────────────────────────
  const handleEditTransaction = useCallback((tx: Transaction) => {
    overlay.openSheet('edit', { transaction: tx })
  }, [overlay])
  
  // ── Transaction Bulk Repeat (Task 93.1) ───────────────────────
  const handleRepeatTransaction = useCallback((tx: Transaction) => {
    overlay.openSheet('bulkRepeat', { transaction: { amount: tx.amount, category: tx.category, note: tx.note } })
  }, [overlay])
  
  const handleBulkRepeatSubmit = useCallback(async (
    transactions: Array<{
      amount: number
      category: TransactionCategory
      note?: string
      date: string
    }>
  ) => {
    if (!user?.id) return
    
    // Import the bulk transaction util
    const { logBulkRepeatTransactions } = await import('@/lib/transactionUtils')
    
    const results = await logBulkRepeatTransactions(user.id, transactions)
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount
    
    if (failCount === 0) {
      showToast(`${successCount} ${successCount === 1 ? 'transaction' : 'transactions'} logged`, 'success')
    } else if (successCount > 0) {
      showToast(`${successCount} logged, ${failCount} failed`, 'error')
    } else {
      showToast('Failed to log transactions', 'error')
    }
    
    // Refresh data to show new transactions
    await refresh()
  }, [user?.id, refresh, showToast])

  const handleSaveTransaction = useCallback(async (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string; date?: string }
  ) => {
    const editPayload = overlay.getSheetPayload('edit')
    const editTx = editPayload?.transaction ?? null
    if (!editTx) return null
    return updateTransaction(id, {
      amount: data.amount,
      category: data.category,
      type: editTx.type,
      date: data.date ?? editTx.date, // Use provided date or keep original
      note: data.note,
    })
  }, [overlay, updateTransaction])

  /** Inline edit handler — looks up the transaction from the list (no sheet state needed) */
  const handleInlineSaveTransaction = useCallback(async (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string }
  ) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return null

    const originalData = { amount: tx.amount, category: tx.category, type: tx.type, date: tx.date, note: tx.note }

    await performWithUndo(
      'edit_transaction',
      async () => {
        await updateTransaction(id, {
          amount: data.amount,
          category: data.category,
          type: tx.type,
          date: tx.date,
          note: data.note,
        })
      },
      async () => {
        await updateTransaction(id, originalData)
      },
      'Transaction updated',
    )

    return transactions.find(t => t.id === id) ?? null
  }, [transactions, updateTransaction, performWithUndo])

  // ── Refund Handling ────────────────────────────────────────────
  const handleOpenRefund = useCallback((tx: Transaction) => {
    overlay.openSheet('refund', { transaction: tx })
  }, [overlay])

  const handleLogRefund = useCallback(async (originalTx: Transaction, refundAmount: number) => {
    if (!user?.id) return
    const refundData = createRefundTransaction(originalTx, refundAmount)

    await performWithUndo(
      'refund',
      async () => {
        await addTransaction({
          amount: refundData.amount,
          category: refundData.category,
          type: refundData.type,
          date: refundData.date,
          note: refundData.note,
        })
      },
      async () => {
        // Find the refund transaction we just added and delete it
        // It will be the most recent transaction matching the refund data
        const refundTx = transactions.find(t =>
          t.type === 'income' &&
          t.amount === refundData.amount &&
          t.category === refundData.category &&
          (t.note === refundData.note || t.note?.startsWith('Refund'))
        )
        if (refundTx) {
          await deleteTransaction(refundTx.id)
        }
      },
      'Refund logged',
    )
  }, [user?.id, addTransaction, deleteTransaction, transactions, performWithUndo])

  // ── Goal Handlers (delegated to useHomeData) ───────────────────
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string; targetDate?: string; linkedAccountId?: string }) => {
    const result = await createGoal(data)
    if (result) showToast('Goal created')
    else showToast('Failed to create goal', 'error')
    return result
  }

  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string; targetDate?: string; linkedAccountId?: string }) => {
    const result = await updateGoal(goalId, data)
    if (result) showToast('Goal updated')
    else showToast('Failed to update goal', 'error')
    return result
  }

  const handleContributeToGoal = async (goalId: string, amount: number) => {
    const result = await contributeToGoal(goalId, amount)
    if (result) showToast(`$${amount} added`)
    else showToast('Failed to update goal', 'error')
    return result
  }

  const handleDeleteGoal = async (goalId: string) => {
    const success = await deleteGoal(goalId)
    if (success) showToast('Goal deleted')
    else showToast('Failed to delete goal', 'error')
    return success
  }

  // ── Budget Handlers (delegated to useHomeData) ─────────────────
  const handleUpdateBudget = async (category: TransactionCategory, limit: number) => {
    const result = await updateBudget(category, limit)
    if (result) showToast('Budget updated')
    else showToast('Failed to update budget', 'error')
  }

  // ── Sign Out ───────────────────────────────────────────────────
  const handleSignOut = () => {
    clearOnboardingProgress()
    setOnboardingStep('tutorial')
  }

  // ── Reset Onboarding ───────────────────────────────────────────
  const handleResetOnboarding = () => {
    clearOnboardingProgress()
    setOnboardingStep('tutorial')
    showToast('Tutorial reset - starting fresh')
  }

  // ── Replay Feature Demos (task 224.2) ──────────────────────────
  const handleReplayDemos = () => {
    setOnboardingStep('demo_replay')
  }

  // ── Setup Checklist: deep-link resume (task 223.3) ─────────────
  // Maps a skipped step ID to the relevant sheet/overlay action, completes
  // the step on return, and optionally celebrates when all steps are done.
  const handleResumeSetupStep = useCallback((stepId: string) => {
    // Map step IDs to their appropriate sheet/overlay targets
    const incomeSteps = ['setup-income', 'express-income', 'optional-recent-income']
    const budgetSteps = ['setup-budget-style']
    const paycheckSteps = ['paycheck-mode', 'paycheck-schedule', 'paycheck-allocation', 'paycheck-confirmation']
    const goalSteps = ['optional-goal']

    if (stepId === 'income-anchor') {
      // Income anchor: open BackfillSheet to set last payday
      // Mark as offered so it won't reappear in the checklist
      localStorage.setItem('folio-income-anchor-offered', 'true')
      overlay.openSheet('backfill')
    } else if (incomeSteps.includes(stepId)) {
      overlay.openSheet('income')
    } else if (budgetSteps.includes(stepId)) {
      overlay.openOverlay('budgetSettings')
    } else if (paycheckSteps.includes(stepId)) {
      // Paycheck setup: open income sheet (paycheck sheet requires amount context)
      overlay.openSheet('income')
    } else if (goalSteps.includes(stepId)) {
      overlay.openOverlay('goals')
    } else {
      // Fallback: open income sheet for unknown step IDs
      overlay.openSheet('income')
    }

    // Mark this step as completed and remove from skipped
    markOnboardingStepCompleted(stepId)
    const progress = getOnboardingProgress()
    const updatedSkipped = progress.skippedSteps.filter(s => s !== stepId)
    setOnboardingProgress({ ...progress, skippedSteps: updatedSkipped })

    // Check if all steps are now complete → celebrate (task 223.4)
    if (updatedSkipped.length === 0) {
      setOnboardingProgress({ ...progress, skippedSteps: [], isComplete: true })
      // Persist to Supabase
      if (user?.id) {
        updateProfilePreferences(user.id, {
          hasCompletedOnboarding: true,
          onboardingSkippedSteps: [],
        }).catch(() => {})
      }
      // Fire a small celebration (reusing celebration engine pattern)
      setCelebrationEvent({
        id: `setup-complete-${Date.now()}`,
        type: 'first_transaction',
        title: 'All set!',
        message: "Nice — you're all set 🎉",
        emoji: '🎉',
        animation: 'confetti',
        duration: 3500,
        sound: 'cheerful',
      })
    } else {
      // Persist updated skipped steps to Supabase
      if (user?.id) {
        updateProfilePreferences(user.id, {
          onboardingSkippedSteps: updatedSkipped,
        }).catch(() => {})
      }
    }

    // Return to home after opening the relevant step
    handleNavChange('home')
  }, [overlay, user?.id, setCelebrationEvent, handleNavChange])

  // ── Update Count Credit Immediately ────────────────────────────
  const handleUpdateCountCreditImmediately = async (value: boolean) => {
    if (!user?.id) return
    
    try {
      const result = await updateProfilePreferences(user.id, { countCreditImmediately: value })
      if (result) {
        showToast(value ? 'All spending now counts against today' : 'Credit spending won\'t reduce your daily allowance')
        // Refresh user profile to update the local state
        await refreshUser()
      } else {
        showToast('Failed to update preference', 'error')
      }
    } catch (error) {
      console.error('Error updating countCreditImmediately:', error)
      showToast('Failed to update preference', 'error')
    }
  }

  // ── Export Data ────────────────────────────────────────────────
  const handleExportData = async () => {
    if (!user?.id) return
    
    try {
      await exportUserData(user.id, transactions, budgets, goals, user.email)
      showToast('Data exported successfully', 'success')
    } catch (error) {
      console.error('Error exporting data:', error)
      showToast('Failed to export data', 'error')
    }
  }

  // ── Export Transactions CSV ────────────────────────────────────
  const handleExportCSV = () => {
    try {
      exportTransactionsCSV(transactions)
      showToast('Transactions exported as CSV', 'success')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      showToast('Failed to export CSV', 'error')
    }
  }

  // ── Delete Account ─────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!user?.id) return
    
    const result = await deleteUserAccount(user.id)
    
    if (result.success) {
      showToast('Account deleted', 'success')
      // Sign out and reset
      clearOnboardingProgress()
      setOnboardingStep('tutorial')
    } else {
      showToast(result.error || 'Failed to delete account', 'error')
    }
  }

  // ── Privacy & Data dashboard (task 191.1) ──────────────────────
  // Summarize what Folio stores about the user (counts by category) for the
  // "What's stored" section. Only always-loaded collections are included so
  // the counts are honest (debts/reimbursements load on demand elsewhere).
  const privacyCategories = useMemo<StoredDataCategory[]>(() => [
    { key: 'transactions', emoji: '🧾', label: 'Transactions', count: transactions.length, note: 'Every expense and income you\u2019ve logged' },
    { key: 'budgets', emoji: '🎯', label: 'Budget limits', count: budgets.length, note: 'Category limits you\u2019ve set' },
    { key: 'goals', emoji: '⭐', label: 'Goals', count: goals.length, note: 'Things you\u2019re saving toward' },
    { key: 'savings', emoji: '🏦', label: 'Savings accounts', count: savingsAccounts.length, note: 'Balances you track by hand — no bank link' },
    { key: 'sources', emoji: '💳', label: 'Money sources', count: fundingSources.length, note: 'Cards, cash, and accounts you pay from' },
    { key: 'sinkingFunds', emoji: '💰', label: 'Sinking funds', count: sinkingFunds.length, note: 'Money set aside for known future costs' },
    { key: 'recurringBills', emoji: '🔁', label: 'Recurring bills', count: recurringBills.length, note: 'Bills you\u2019ve asked Folio to remember' },
  ], [transactions.length, budgets.length, goals.length, savingsAccounts.length, fundingSources.length, sinkingFunds.length, recurringBills.length])

  // GDPR/CCPA-style "delete everything": clear all data across every table,
  // best-effort remove the auth user, then reset the local app to a clean state.
  const handleDeleteEverything = useCallback(async () => {
    if (!user?.id) throw new Error('Not signed in')

    const result = await deleteAllUserData(user.id)
    if (!result.success) {
      showToast(result.error || 'Failed to delete your data', 'error')
      throw new Error(result.error || 'Delete failed')
    }

    // Best-effort removal of the auth account itself (needs elevated privileges;
    // data is already gone regardless of the outcome here).
    await deleteUserAccount(user.id).catch(() => {})

    showToast('Everything\u2019s been deleted. Take care of yourself.', 'success')
    overlay.closeOverlay()
    // handleSignOut clears local onboarding state and returns to the tutorial.
    handleSignOut()
  }, [user?.id, showToast, overlay])

  // ── Profile Handlers ───────────────────────────────────────────
  const handleOpenProfile = () => {
    overlay.openSheet('profile')
  }

  const handleProfileUpdate = async () => {
    await refreshUser()
    showToast('Profile updated')
  }

  // ── App lock gate (task 182.1) ─────────────────────────────────
  // A cold open with the lock enabled shows the unlock screen before anything
  // else. Unlocking marks the session unlocked so the rest of the session (and
  // in-app navigation) never re-prompts.
  if (appLock.locked) {
    return <AppLockScreen onUnlock={appLock.unlock} />
  }

  // ── Auth & Onboarding Gating ───────────────────────────────────
  if (authLoading || onboardingStep === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div
            className="w-6 h-6 mx-auto mb-5 animate-spin"
            style={{ border: '1px solid var(--line)', borderTopColor: 'var(--sub)', borderRadius: '50%' }}
          />
          <p className="label">folio</p>
        </div>
      </div>
    )
  }

  if (onboardingStep === 'tutorial') {
    const allSteps = buildStepsForPath(activeOnboardingPath, tutorialSetupState.budgetPreset, tutorialSetupState.paycheckMode)

    return (
      <OnboardingTutorial
        steps={allSteps}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
        onPathSelect={(path) => {
          setActiveOnboardingPath(path)
          setOnboardingPath(path)
          // Task 218: Minimal path asks "how much do you spend" (post-savings),
          // so use 'custom' preset (0% savings) to avoid double-deducting savings.
          if (path === 'minimal') {
            setTutorialSetupState(prev => ({ ...prev, budgetPreset: 'custom' as BudgetPreset, monthlyIncome: 0 }))
          }
        }}
        renderStep={(step, completeInteraction) => (
          <TutorialSetupStepRenderer
            step={step}
            completeInteraction={completeInteraction}
            setupState={tutorialSetupState}
            onIncomeChange={(value) =>
              setTutorialSetupState(prev => ({ ...prev, monthlyIncome: value }))
            }
            onPresetChange={(preset) =>
              setTutorialSetupState(prev => ({ ...prev, budgetPreset: preset }))
            }
            onLimitChange={(key, value) =>
              setTutorialSetupState(prev => ({
                ...prev,
                categoryLimits: { ...prev.categoryLimits, [key]: value },
              }))
            }
            onAddFixedExpense={(expense: SetupFixedExpense) =>
              setTutorialSetupState(prev => ({
                ...prev,
                fixedExpenses: [...prev.fixedExpenses, expense],
              }))
            }
            onRemoveFixedExpense={(id: string) =>
              setTutorialSetupState(prev => ({
                ...prev,
                fixedExpenses: prev.fixedExpenses.filter(e => e.id !== id),
              }))
            }
            onPeriodChange={(key: string, period: 'weekly' | 'monthly') =>
              setTutorialSetupState(prev => ({
                ...prev,
                categoryPeriods: { ...prev.categoryPeriods, [key]: period },
              }))
            }
            onPayScheduleChange={(schedule: { cadence: PayCadence; anchorDate: string; amount: number }) =>
              setTutorialSetupState(prev => ({ ...prev, paySchedule: schedule }))
            }
            onAllocationSplitChange={(split: { spend: number; save: number; invest: number; setAside: number }) =>
              setTutorialSetupState(prev => ({ ...prev, allocationSplit: split }))
            }
            onPaycheckModeChange={(mode: 'full' | 'simple') =>
              setTutorialSetupState(prev => ({ ...prev, paycheckMode: mode }))
            }
            onSimpleCadenceChange={(cadence: 'weekly' | 'biweekly' | 'monthly') =>
              setTutorialSetupState(prev => ({ ...prev, simpleCadence: cadence }))
            }
            onRecentIncomeChange={(data: { amount: number; note?: string; date?: string }) =>
              setTutorialSetupState(prev => ({ ...prev, recentIncome: data }))
            }
            onRecentExpenseChange={(data: { amount: number; category: TransactionCategory; note?: string; date?: string }) =>
              setTutorialSetupState(prev => ({ ...prev, recentExpense: data }))
            }
            onGoalChange={(goal: UserGoal) =>
              setTutorialSetupState(prev => ({ ...prev, primaryGoal: goal }))
            }
          />
        )}
      />
    )
  }

  // ── Demo Replay Mode (task 224.2) ─────────────────────────────
  if (onboardingStep === 'demo_replay') {
    const demoSteps = buildDemoOnlySteps()

    return (
      <OnboardingTutorial
        steps={demoSteps}
        onComplete={() => setOnboardingStep('done')}
        onSkip={() => setOnboardingStep('done')}
        renderStep={(step, completeInteraction) => (
          <TutorialSetupStepRenderer
            step={step}
            completeInteraction={completeInteraction}
            setupState={tutorialSetupState}
            onIncomeChange={() => {}}
            onPresetChange={() => {}}
            onLimitChange={() => {}}
            onAddFixedExpense={() => {}}
            onRemoveFixedExpense={() => {}}
            onPeriodChange={() => {}}
            onPayScheduleChange={() => {}}
            onAllocationSplitChange={() => {}}
            onPaycheckModeChange={() => {}}
            onSimpleCadenceChange={() => {}}
            onRecentIncomeChange={() => {}}
            onRecentExpenseChange={() => {}}
            onGoalChange={() => {}}
          />
        )}
      />
    )
  }

  // ── Budget Settings (full-screen overlay) ─────────────────────
  if (overlay.activeOverlay === 'budgetSettings') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <BudgetSettings
          budgets={budgets}
          onUpdateBudget={handleUpdateBudget}
          onBack={() => overlay.closeOverlay()}
          paySchedule={paySchedule}
        />
      </div>
    )
  }

  // ── Goals (full-screen overlay) ───────────────────────────────
  if (flags.goals && overlay.activeOverlay === 'goals') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <GoalsScreen
          goals={goals}
          monthlyIncome={monthlyIncome}
          savingsAccounts={savingsAccounts}
          onCreateGoal={handleCreateGoal}
          onUpdateGoal={handleUpdateGoal}
          onContributeToGoal={handleContributeToGoal}
          onDeleteGoal={handleDeleteGoal}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Sinking Funds (full-screen overlay) ────────────────────────
  if (flags.sinkingFunds && overlay.activeOverlay === 'sinkingFunds') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SinkingFundsScreen
          funds={sinkingFunds}
          onAddFund={async (data) => { await addSinkingFund(data) }}
          onUpdateFund={async (id, updates) => { await updateSinkingFund(id, updates) }}
          onDeleteFund={async (id) => { await deleteSinkingFund(id) }}
          onClose={() => overlay.closeOverlay()}
          onSetDisbursement={(monthly) => setDisbursementBonus(monthly)}
          disbursements={disbursements}
          onAddDisbursement={(data) => addDisbursement(data)}
          onRemoveDisbursement={(id) => removeDisbursement(id)}
        />
      </div>
    )
  }

  // ── Subscription Audit (full-screen overlay) ───────────────────
  if (flags.subscriptionAudit && overlay.activeOverlay === 'subscriptionAudit') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SubscriptionAuditScreen
          subscriptions={detectedSubscriptions}
          onDismiss={handleDismissSubscription}
          onConfirm={handleConfirmSubscription}
          onClose={() => overlay.closeOverlay()}
          onOpenCancelNegotiate={(sub) => {
            overlay.openOverlay('cancelNegotiate', { target: sub })
          }}
        />
      </div>
    )
  }

  // ── Cancel / Negotiate Helper (full-screen overlay, DIY) ───────
  if (overlay.activeOverlay === 'cancelNegotiate') {
    const cancelPayload = overlay.getOverlayPayload('cancelNegotiate')
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CancelNegotiateHelper
          subscription={cancelPayload?.target ?? null}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Recurring Bills (full-screen overlay, task 65) ─────────────
  if (flags.recurringBills && overlay.activeOverlay === 'recurringBills') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <RecurringBillsScreen
          bills={recurringBills}
          onAddBill={addBill}
          onUpdateBill={updateBill}
          onDeleteBill={deleteBill}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Categorization & Routing Rules (full-screen overlay, task 187.1) ──
  if (overlay.activeOverlay === 'categorizationRules') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CategorizationRulesScreen
          rules={categorizationRules}
          fundingSources={fundingSources}
          onAddRule={handleAddCategorizationRule}
          onUpdateRule={handleUpdateCategorizationRule}
          onDeleteRule={handleDeleteCategorizationRule}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Funding Sources (full-screen overlay) ────────────────────────
  if (overlay.activeOverlay === 'fundingSources') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <FundingSourcesScreen
          fundingSources={fundingSources}
          onAdd={addFundingSource}
          onEdit={updateFundingSource}
          onRemove={deleteFundingSource}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Linked Accounts (optional bank/card linking — full-screen overlay) ──
  if (overlay.activeOverlay === 'linkedAccounts') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <LinkedAccountsScreen
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Term / Month in Review (full-screen overlay, task 184.1) ───
  if (overlay.activeOverlay === 'termReview') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <TermReviewScreen
          transactions={transactions}
          budgets={budgets}
          termSchedule={termSchedule}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Year in Review (full-screen overlay, task 183.1) ───────────
  if (overlay.activeOverlay === 'yearInReview') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <YearInReviewScreen
          transactions={transactions}
          budgets={budgets}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Peer Context — "typical for a student" (full-screen, task 186.1) ───
  // Opt-in, OFF by default. Only reachable when the user enabled it in
  // Settings; never surfaced on the home screen.
  if (overlay.activeOverlay === 'peerContext') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <PeerContextScreen
          transactions={transactions}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Exportable Reports (full-screen overlay, task 185.1) ───────
  if (overlay.activeOverlay === 'reports') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <ReportsScreen
          transactions={transactions}
          onBack={() => overlay.closeOverlay()}
          onNotify={showToast}
        />
      </div>
    )
  }

  // ── Privacy & Data dashboard (full-screen overlay, task 191.1) ──
  if (overlay.activeOverlay === 'privacyData') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <PrivacyDataScreen
          userEmail={user?.email}
          categories={privacyCategories}
          onBack={() => overlay.closeOverlay()}
          onExportAll={handleExportData}
          onOpenReports={() => overlay.openOverlay('reports')}
          onExportCSV={handleExportCSV}
          onDeleteEverything={handleDeleteEverything}
          onNotify={showToast}
        />
      </div>
    )
  }

  // ── Financial Trajectory (full-screen overlay, task 111.1) ─────
  if (flags.financialTrajectory && overlay.activeOverlay === 'trajectory') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <TrajectoryScreen
          transactions={transactions}
          goals={goals}
          debts={debts}
          savingsRate={savingsRate}
          savingsAccounts={savingsAccounts}
          totalSetAside={totalSetAside}
          sinkingFunds={sinkingFunds}
          fundingSources={fundingSources}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Cash Flow Forecast (full-screen overlay, task 148.1) ────────
  if (flags.cashFlowForecast && overlay.activeOverlay === 'cashFlowForecast') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CashFlowForecastScreen
          currentBalance={allowance?.amount ?? 0}
          paySchedule={paySchedule}
          bills={recurringBills}
          sinkingFunds={sinkingFunds}
          transactions={transactions}
          disbursements={disbursements}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Sharing (full-screen overlay, task 115.1) ──────────────────
  if (overlay.activeOverlay === 'sharing' && user?.id) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SharingScreen
          userId={user.id}
          transactions={transactions}
          budgets={budgets}
          allowance={allowance}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Invite a Roommate (full-screen overlay, task 201.1) ────────
  if (overlay.activeOverlay === 'inviteRoommate') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <RoommateInviteScreen
          inviterName={user?.name}
          goals={goals}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Category Hub (full-screen overlay, task 138.1) ─────────────
  if (overlay.activeOverlay === 'categoryHub') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CategoryHubScreen
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
          onRemoveCustomCategory={removeCustomCategory}
          onRenameCustomCategory={renameCustomCategory}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Debt Tracking (full-screen overlay) ────────────────────────
  if (flags.debtTracking && overlay.activeOverlay === 'debt') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <DebtScreen
          debts={debts}
          onAddDebt={handleAddDebt}
          onUpdateDebt={handleUpdateDebt}
          onDeleteDebt={handleDeleteDebt}
          onClose={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── IOUs & Reimbursements (full-screen overlay) ────────────────
  if (flags.reimbursements && overlay.activeOverlay === 'reimbursements' && user?.id) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <ReimbursementLedger
          userId={user.id}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Learn / Lessons (full-screen overlay) ──────────────────────
  if (flags.lessons && overlay.activeOverlay === 'learn') {
    const learnPayload = overlay.getOverlayPayload('learn')
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => overlay.closeOverlay()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--sub)',
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 16,
              padding: '8px 0',
            }}
            aria-label="Go back"
          >
            ← Back
          </button>
        </div>
        <LessonsScreen
          lessonProgress={lessonProgress}
          onCompleteLesson={completeLesson}
          initialLessonId={learnPayload?.initialLessonId ?? undefined}
          savingsAccounts={savingsAccounts}
        />
      </div>
    )
  }

  // ── Compound Growth Calculator (full-screen overlay, Tools tab) ─
  if (flags.compoundGrowthCalculator && overlay.activeOverlay === 'compoundGrowth') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CompoundGrowthCalculator onBack={() => overlay.closeOverlay()} savingsAccounts={savingsAccounts} />
      </div>
    )
  }

  // ── Credit Payoff Calculator (full-screen overlay, Tools tab) ──
  if (flags.creditPayoffCalculator && overlay.activeOverlay === 'creditPayoff') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CreditPayoffCalculator onBack={() => overlay.closeOverlay()} />
      </div>
    )
  }

  // ── Savings Projections (full-screen overlay, task 156) ────────
  if (flags.savingsProjections && overlay.activeOverlay === 'savingsProjections') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SavingsProjectionsScreen
          savingsAccounts={savingsAccounts}
          totalBalance={totalSavingsBalance}
          onCreateAccount={createSavingsAccount}
          onUpdateAccount={updateSavingsAccount}
          onDeleteAccount={deleteSavingsAccount}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Manage Savings Accounts (full CRUD overlay, task 158.1) ────
  if (flags.savingsProjections && overlay.activeOverlay === 'manageSavings') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <ManageSavingsAccountsScreen
          savingsAccounts={savingsAccounts}
          onCreateAccount={createSavingsAccount}
          onUpdateAccount={updateSavingsAccount}
          onDeleteAccount={deleteSavingsAccount}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Portfolio Allocation (full-screen overlay, task 172.1) ─────
  if (flags.savingsProjections && overlay.activeOverlay === 'portfolioAllocation') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <PortfolioAllocationScreen
          savingsAccounts={savingsAccounts}
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Investment Explorer (full-screen overlay, task 173.1) ──────
  if (flags.savingsProjections && overlay.activeOverlay === 'investmentExplorer') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <InvestmentExplorerScreen
          onBack={() => overlay.closeOverlay()}
        />
      </div>
    )
  }

  // ── Main App Shell ─────────────────────────────────────────────
  return (
    <>
      <AppShell
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onOpenSettings={() => handleNavChange('settings')}
        avatarUrl={undefined}
        avatarInitial={user?.email?.charAt(0)}
        meshVariant="home"
        onQuickLog={anySheetOpen ? undefined : () => overlay.openSheet('expense', { defaultCategory: undefined, splitPreEnabled: false, originFromFab: true })}
        hideDock={anySheetOpen}
      >
        {/* Offline banner — shown when network is down */}
        <OfflineBanner visible={!isOnline} />
        {(offlinePendingCount > 0 || offlineRecentlySyncedIds.size > 0) && (
          <div style={{ marginBottom: 12 }}>
            <SyncIndicator
              pendingCount={offlinePendingCount}
              hasFailed={offlineHasFailed}
              recentlySyncedCount={offlineRecentlySyncedIds.size}
              isOnline={isOnline}
              onRetry={retryOfflineSync}
              onDismiss={dismissOfflineFailed}
            />
          </div>
        )}
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={activeNav}
            custom={navDirection}
            variants={prefersReducedMotion ? navScreenVariantsReduced : navScreenVariants}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            {activeNav === 'home' && (
              <HomeScreen
                allowance={allowance}
                transactions={transactions}
                budgets={budgets}
                goals={goals}
                userName={user?.email?.split('@')[0]}
                isLoading={dataLoading}
                isStale={isStale}
                weekendAllowance={weekendAllowance}
                activeSpendDown={activeSpendDown}
                timeHorizonStats={timeHorizonStats}
                spendingMode={spendingMode}
                heroMeaning={heroMeaning}
                heroDisplay={heroDisplay}
                overLimitResponse={overLimitResponse}
                savingsRate={savingsRate}
                savingsAccounts={savingsAccounts}
                fundingSources={fundingSources}
                completedLessonIds={completedLessonIds}
                hasSkippedSetupSteps={getOnboardingProgress().skippedSteps.length > 0 || localStorage.getItem('folio-income-anchor-offered') !== 'true'}
                skippedSetupSteps={[
                  ...getOnboardingProgress().skippedSteps,
                  ...(typeof window !== 'undefined' && localStorage.getItem('folio-income-anchor-offered') !== 'true' ? ['income-anchor'] : []),
                ]}
                onResumeSetupStep={handleResumeSetupStep}
                onHeroTapDetails={() => handleNavChange('history')}
                onLogExpense={handleOpenExpenseSheet}
                onLogIncome={() => overlay.openSheet('income')}
                onRepeatLog={handleRepeatLog}
                onViewTransaction={handleEditTransaction}
                onViewAllHistory={() => handleNavChange('history')}
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={handleInlineSaveTransaction}
                onRefresh={refresh}
                celebrationEvent={celebrationEvent}
                onCelebrationDismiss={() => setCelebrationEvent(null)}
                detectedSubscriptions={detectedSubscriptions}
                onOpenBudgetSettings={() => overlay.openOverlay('budgetSettings')}
                onOpenSplitExpense={handleOpenSplitExpense}
                outstandingSplits={outstandingSplits}
                onOpenReimbursements={() => overlay.openOverlay('reimbursements')}
                onSettleSplit={handleSettleSplit}
                splitTransactionIds={splitTransactionIds}
                onOpenLesson={(lessonId) => {
                  overlay.openOverlay('learn', { initialLessonId: lessonId })
                }}
              />
            )}
            {activeNav === 'history' && (
              <HistoryScreen
                transactions={transactions}
                isLoading={dataLoading}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onLogExpense={() => handleOpenExpenseSheet()}
                onRepeatTransaction={handleRepeatTransaction}
                allowance={allowance}
                fundingSources={fundingSources}
                onBulkDelete={handleBulkDelete}
                onBulkRecategorize={handleBulkRecategorize}
                onBulkTag={handleBulkTag}
              />
            )}
            {activeNav === 'tools' && (
              <ToolsScreen
                onOpenCompoundGrowth={() => overlay.openOverlay('compoundGrowth')}
                onOpenCreditPayoff={() => overlay.openOverlay('creditPayoff')}
                onOpenSubscriptions={() => overlay.openOverlay('subscriptionAudit')}
                onOpenCancelNegotiate={() => {
                  overlay.openOverlay('cancelNegotiate', { target: null })
                }}
                onOpenSinkingFunds={() => overlay.openOverlay('sinkingFunds')}
                onOpenLearn={() => overlay.openOverlay('learn', { initialLessonId: null })}
                onOpenSavingsProjections={() => overlay.openOverlay('savingsProjections')}
                onOpenManageSavings={() => overlay.openOverlay('manageSavings')}
                onOpenDebt={handleOpenDebt}
                onOpenRecurringBills={() => overlay.openOverlay('recurringBills')}
                onOpenReimbursements={() => overlay.openOverlay('reimbursements')}
                onOpenTrajectory={() => overlay.openOverlay('trajectory')}
                onOpenCashFlowForecast={() => overlay.openOverlay('cashFlowForecast')}
                onOpenPortfolioAllocation={() => overlay.openOverlay('portfolioAllocation')}
                onOpenInvestmentExplorer={() => overlay.openOverlay('investmentExplorer')}
                onOpenYearInReview={() => overlay.openOverlay('yearInReview')}
                onOpenTermReview={() => overlay.openOverlay('termReview')}
                onOpenPeerContext={() => overlay.openOverlay('peerContext')}
                onOpenInviteRoommate={() => overlay.openOverlay('inviteRoommate')}
                totalSetAside={totalSetAside}
                savingsRate={savingsRate}
                fundingSources={fundingSources}
                transactions={transactions}
                debts={debts}
                reimbursements={reimbursements}
                goals={goals}
                budgets={budgets}
                contributeToGoal={contributeToGoal}
              />
            )}
            {activeNav === 'settings' && (
              <SettingsScreen
                budgets={budgets}
                goals={goals}
                userEmail={user?.email}
                incomeSmoothing={incomeSmoothing}
                spendingMode={spendingMode}
                onSetSpendingMode={setSpendingMode}
                heroMeaning={heroMeaning}
                onSetHeroMeaning={setHeroMeaning}
                overLimitResponse={overLimitResponse}
                onSetOverLimitResponse={setOverLimitResponse}
                countCreditImmediately={user?.countCreditImmediately}
                onSetIncomeSmoothing={setIncomeSmoothing}
                onUpdateCountCreditImmediately={handleUpdateCountCreditImmediately}
                onOpenBudgetSettings={() => overlay.openOverlay('budgetSettings')}
                onOpenGoals={() => overlay.openOverlay('goals')}
                onOpenTools={() => handleNavChange('tools')}
                onOpenProfile={handleOpenProfile}
                onOpenFundingSources={() => overlay.openOverlay('fundingSources')}
                onOpenLinkedAccounts={() => overlay.openOverlay('linkedAccounts')}
                onOpenBackfill={() => overlay.openSheet('backfill')}
                onSignOut={handleSignOut}
                onResetOnboarding={handleResetOnboarding}
                onReplayDemos={handleReplayDemos}
                onExportData={handleExportData}
                onExportCSV={handleExportCSV}
                onOpenReports={() => overlay.openOverlay('reports')}
                onOpenPrivacyDashboard={() => overlay.openOverlay('privacyData')}
                onDeleteAccount={handleDeleteAccount}
                categorizationRules={categorizationRules}
                onAddCategorizationRule={handleAddCategorizationRule}
                onDeleteCategorizationRule={handleDeleteCategorizationRule}
                onOpenCategorizationRules={() => overlay.openOverlay('categorizationRules')}
                onOpenSharing={() => overlay.openOverlay('sharing')}
                onOpenCategoryHub={() => overlay.openOverlay('categoryHub')}
                activeShareCount={getActiveShareLinks().length}
                spendDownPlans={spendDownPlans}
                onAddSpendDownPlan={addSpendDownPlan}
                onRemoveSpendDownPlan={removeSpendDownPlan}
                disbursements={disbursements}
                userGoal={userGoal}
                onGoalChange={handleGoalChange}
                skippedSetupSteps={getOnboardingProgress().skippedSteps}
                onResumeSetupStep={handleResumeSetupStep}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </AppShell>

      {/* ── Expense Sheet ──────────────────────────────────────── */}
      <ExpenseSheet
        isOpen={overlay.isSheetOpen('expense')}
        onClose={() => overlay.closeSheet('expense')}
        onSubmit={handleExpenseSubmit}
        onUndo={lastLoggedId ? handleExpenseUndo : undefined}
        defaultCategory={overlay.getSheetPayload('expense')?.defaultCategory}
        transactions={transactions}
        customCategories={customCategories}
        onAddCustomCategory={addCustomCategory}
        splitPreEnabled={overlay.getSheetPayload('expense')?.splitPreEnabled ?? false}
        fundingSources={fundingSources}
        recentSplitPartners={recentSplitPartners}
        budgets={budgets}
        onAlertMessage={(msg) => setPerTxAlertMessage(msg)}
        spendingMode={spendingMode}
        categorizationRules={categorizationRules}
        onAddCategorizationRule={handleAddCategorizationRule}
        dailyAllowanceAmount={allowance?.amount}
        originFromFab={overlay.getSheetPayload('expense')?.originFromFab ?? false}
      />

      {/* ── Quick-log confirm sheet (task 180.1 — share sheet & assistant) ── */}
      <QuickLogConfirmSheet
        isOpen={overlay.isSheetOpen('quickLog')}
        rawText={overlay.getSheetPayload('quickLog')?.rawText ?? ''}
        source={overlay.getSheetPayload('quickLog')?.source ?? 'share'}
        fundingSources={fundingSources}
        categorizationRules={categorizationRules}
        onConfirm={handleQuickLogConfirm}
        onEditInSheet={handleQuickLogEdit}
        onClose={() => overlay.closeSheet('quickLog')}
      />

      {/* ── Per-transaction alert notice (task 102.2) ──────────── */}
      {perTxAlertMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9000,
            maxWidth: 360,
            width: 'calc(100% - 40px)',
            padding: '12px 16px',
            background: 'rgba(26, 26, 46, 0.96)',
            border: '1px solid rgba(129, 140, 248, 0.25)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: shadows.lg,
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
            {perTxAlertMessage}
          </span>
          <button
            onClick={() => setPerTxAlertMessage(null)}
            aria-label="Dismiss alert"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 2px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Income Sheet ───────────────────────────────────────── */}
      <IncomeSheet
        isOpen={overlay.isSheetOpen('income')}
        onClose={() => overlay.closeSheet('income')}
        onSubmit={handleIncomeSubmit}
        onShowPaycheck={handleShowPaycheck}
        onUndo={lastLoggedId ? handleIncomeUndo : undefined}
        fundingSources={fundingSources}
        transactions={transactions}
        onCreateDisbursement={({ amount, coverMonths, label }) => {
          addDisbursement({
            label,
            amount,
            coverMonths,
            startDate: new Date().toISOString().slice(0, 10),
            type: 'financial_aid',
            emoji: '🎓',
          })
        }}
        savingsAccounts={savingsAccounts}
        onContributeToSavings={(id, amt) => contributeToSavingsAccount(id, amt)}
      />

      {/* ── Paycheck Sheet ─────────────────────────────────────── */}
      <PaycheckSheet
        isOpen={overlay.isSheetOpen('paycheck')}
        amount={overlay.getSheetPayload('paycheck')?.amount ?? 0}
        goals={goals}
        onContribute={handleContributeToGoal}
        onAllocate={handleAllocateIncome}
        onClose={() => overlay.closeSheet('paycheck')}
        isGigIncome={overlay.getSheetPayload('paycheck')?.isGigIncome ?? false}
        savingsAccounts={savingsAccounts}
        onContributeToSavings={(id, amt) => contributeToSavingsAccount(id, amt)}
      />

      {/* ── Edit Transaction Sheet ─────────────────────────────── */}
      <EditTransactionSheet
        isOpen={overlay.isSheetOpen('edit')}
        onClose={() => overlay.closeSheet('edit')}
        transaction={overlay.getSheetPayload('edit')?.transaction ?? null}
        onSave={handleSaveTransaction}
        onRefund={handleOpenRefund}
      />

      {/* ── Refund Sheet ───────────────────────────────────────── */}
      <RefundSheet
        isOpen={overlay.isSheetOpen('refund')}
        onClose={() => overlay.closeSheet('refund')}
        transaction={overlay.getSheetPayload('refund')?.transaction ?? null}
        onLogRefund={handleLogRefund}
      />

      {/* ── Backfill Sheet (task 88) ──────────────────────────── */}
      <BackfillSheet
        isOpen={overlay.isSheetOpen('backfill')}
        onClose={() => overlay.closeSheet('backfill')}
        onLogExpense={async (data) => {
          await addTransaction({
            amount: data.amount,
            category: data.category,
            type: 'expense',
            date: data.date,
            note: data.note,
          })
        }}
        onLogIncome={async (data) => {
          await addTransaction({
            amount: data.amount,
            category: 'income',
            type: 'income',
            date: data.date,
            note: data.note,
          })
        }}
      />

      {/* ── Bulk Repeat Sheet (task 93.1) ─────────────────────── */}
      {overlay.getSheetPayload('bulkRepeat')?.transaction && (
        <BulkRepeatSheet
          isOpen={overlay.isSheetOpen('bulkRepeat')}
          onClose={() => overlay.closeSheet('bulkRepeat')}
          transaction={overlay.getSheetPayload('bulkRepeat')!.transaction}
          onSubmit={handleBulkRepeatSubmit}
        />
      )}

      {/* ── Profile Sheet ──────────────────────────────────────── */}
      <ProfileSheet
        isOpen={overlay.isSheetOpen('profile')}
        onClose={() => overlay.closeSheet('profile')}
        userEmail={user?.email}
        displayName={user?.displayName}
        avatarUrl={user?.avatarUrl}
        userId={user?.id}
        onSignOut={handleSignOut}
        onProfileUpdate={handleProfileUpdate}
      />

      <Toast />
    </>
  )
}
