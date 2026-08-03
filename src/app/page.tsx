"use client"
import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { timings } from '@/lib/animations'
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
import { TutorialSetupStepRenderer, TUTORIAL_FEATURE_STEPS, TUTORIAL_SETUP_STEPS, TutorialSetupState, buildOnboardingResult } from '@/components/simplified/TutorialSteps'
import { detectSubscriptions } from '@/lib/subscriptionDetector'
import { getCategorizationRules, saveCategorizationRule, deleteCategorizationRule } from '@/lib/categorizationRules'
import { getActiveShareLinks } from '@/lib/sharingUtils'
import type { CategorizationRule } from '@/lib/categorizationRules'

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
const TrajectoryScreen = dynamic(
  () => import('@/components/simplified/TrajectoryScreen').then(m => ({ default: m.TrajectoryScreen })),
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
import type { DetectedSubscription } from '@/lib/subscriptionDetector'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useHomeData } from '@/hooks/useHomeData'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { carryForwardBudgetLimits, insertAllocation, createDebt, updateDebt, deleteDebt, getDebts, getReimbursements, updateProfilePreferences, createReimbursement, settleReimbursement } from '@/lib/supabaseData'
import { exportUserData, exportTransactionsCSV, deleteUserAccount } from '@/lib/accountUtils'
import type { TransactionCategory, Transaction } from '@/types'
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
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useOverlayRouter } from '@/hooks/useOverlayRouter'
import { SyncIndicator } from '@/components/simplified/SyncIndicator'

type OnboardingStep = 'loading' | 'tutorial' | 'done'

export default function FolioApp() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const { showToast } = useToast()
  const { performWithUndo } = useUndo()

  // ── Routing & UI State ─────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('loading')
  const [activeNav, setActiveNav] = useState<AppNavKey>('home')

  // Single overlay/sheet state machine (replaces ~20 individual boolean flags)
  const overlay = useOverlayRouter()

  // ── Tutorial Setup State ───────────────────────────────────────
  const [tutorialSetupState, setTutorialSetupState] = useState<TutorialSetupState>({
    monthlyIncome: 2000,
    budgetPreset: 'student_moderate' as BudgetPreset,
    categoryLimits: {},
  })

  // ── Per-transaction alert state (task 102.2) ───────────────────
  const [perTxAlertMessage, setPerTxAlertMessage] = useState<string | null>(null)

  // ── Categorization rules state (task 113.3) ────────────────────
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([])
  useEffect(() => {
    setCategorizationRules(getCategorizationRules())
  }, [])

  // ── Income Anchor Banner (task 95.1) ───────────────────────────
  // A first-run nudge shown once after onboarding to encourage the user to
  // anchor their timeline by setting their last payday. Gated by
  // folio-income-anchor-offered so it only ever shows once.
  const [incomeAnchorBannerVisible, setIncomeAnchorBannerVisible] = useState(false)

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
    refresh: refreshOfflineSync,
  } = useOfflineSync(user?.id ?? undefined)

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

  // ── Smart Notifications (task 114.2 — low balance & bill-due alerts;
  //    task 160.1 — payday-triggered savings contribution reminder) ──
  useSmartNotifications(allowance, recurringBills, savingsAccounts, paySchedule, transactions)

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

  // ── Onboarding Check ───────────────────────────────────────────
  // Task 66: Skip the onboarding gate — new users go straight to the Home Screen.
  // The tutorial remains accessible from settings but never blocks value.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Always resolve to 'done' so new users land on the Home Screen immediately.
      // Mark as onboarded so subsequent loads skip any legacy gate check.
      if (localStorage.getItem('folio-onboarded') !== 'true') {
        localStorage.setItem('folio-onboarded', 'true')
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

  // ── Income anchor banner (task 95.1) ──────────────────────────
  // After the user has their daily number and the backfill sheet hasn't
  // auto-opened, show the income anchor banner as a gentler prompt.
  // Delayed ~1.2s so the hero renders and settles first.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dataLoading) return
    if (localStorage.getItem('folio-income-anchor-offered') === 'true') return
    // Don't show the banner if the full BackfillSheet is already open
    if (overlay.isSheetOpen('backfill')) return

    localStorage.setItem('folio-income-anchor-offered', 'true')
    const timer = setTimeout(() => setIncomeAnchorBannerVisible(true), 1200)
    return () => clearTimeout(timer)
  }, [dataLoading, overlay])

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
    
    // Persist tutorial completion flag
    localStorage.setItem('folio-onboarded', 'true')
    setOnboardingStep('done')
    
    if (result.customLimits && Object.keys(result.customLimits).length > 0) {
      showToast("Tutorial complete — check today's budget")
    }
  }

  const handleTutorialSkip = () => {
    localStorage.setItem('folio-onboarded', 'true')
    setOnboardingStep('done')
  }

  // ── Categorization Rules Handlers (task 113.3) ──────────────────
  const handleAddCategorizationRule = useCallback((keyword: string, category: TransactionCategory) => {
    const rule = saveCategorizationRule(keyword, category)
    setCategorizationRules(prev => [...prev, rule])
  }, [])

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
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string; targetDate?: string }) => {
    const result = await createGoal(data)
    if (result) showToast('Goal created')
    else showToast('Failed to create goal', 'error')
    return result
  }

  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string; targetDate?: string }) => {
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
    localStorage.removeItem('folio-onboarded')
    setOnboardingStep('tutorial')
  }

  // ── Reset Onboarding ───────────────────────────────────────────
  const handleResetOnboarding = () => {
    localStorage.removeItem('folio-onboarded')
    setOnboardingStep('tutorial')
    showToast('Tutorial reset - starting fresh')
  }

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
      localStorage.removeItem('folio-onboarded')
      setOnboardingStep('tutorial')
    } else {
      showToast(result.error || 'Failed to delete account', 'error')
    }
  }

  // ── Profile Handlers ───────────────────────────────────────────
  const handleOpenProfile = () => {
    overlay.openSheet('profile')
  }

  const handleProfileUpdate = async () => {
    await refreshUser()
    showToast('Profile updated')
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
    const allSteps = [...TUTORIAL_FEATURE_STEPS, ...TUTORIAL_SETUP_STEPS]

    return (
      <OnboardingTutorial
        steps={allSteps}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
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
        />
      </div>
    )
  }

  // ── Compound Growth Calculator (full-screen overlay, Tools tab) ─
  if (flags.compoundGrowthCalculator && overlay.activeOverlay === 'compoundGrowth') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CompoundGrowthCalculator onBack={() => overlay.closeOverlay()} />
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

  // ── Main App Shell ─────────────────────────────────────────────
  return (
    <>
      <AppShell
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onOpenSettings={() => setActiveNav('settings')}
        avatarUrl={undefined}
        avatarInitial={user?.email?.charAt(0)}
        meshVariant="home"
        onQuickLog={anySheetOpen ? undefined : () => overlay.openSheet('expense', { defaultCategory: undefined, splitPreEnabled: false })}
        hideDock={anySheetOpen}
      >
        {(offlinePendingCount > 0 || offlineRecentlySyncedIds.size > 0) && (
          <div style={{ marginBottom: 12 }}>
            <SyncIndicator
              pendingCount={offlinePendingCount}
              hasFailed={offlineHasFailed}
              recentlySyncedCount={offlineRecentlySyncedIds.size}
              onRetry={retryOfflineSync}
            />
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNav}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={timings.normal}
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
                onHeroTapDetails={() => setActiveNav('history')}
                onLogExpense={handleOpenExpenseSheet}
                onLogIncome={() => overlay.openSheet('income')}
                onRepeatLog={handleRepeatLog}
                onViewTransaction={handleEditTransaction}
                onViewAllHistory={() => setActiveNav('history')}
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
                showIncomeAnchorBanner={incomeAnchorBannerVisible}
                onIncomeAnchorSetItNow={() => {
                  setIncomeAnchorBannerVisible(false)
                  overlay.openSheet('backfill')
                }}
                onIncomeAnchorSkip={() => setIncomeAnchorBannerVisible(false)}
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
                onOpenTools={() => setActiveNav('tools')}
                onOpenProfile={handleOpenProfile}
                onOpenFundingSources={() => overlay.openOverlay('fundingSources')}
                onOpenLinkedAccounts={() => overlay.openOverlay('linkedAccounts')}
                onOpenBackfill={() => overlay.openSheet('backfill')}
                onSignOut={handleSignOut}
                onResetOnboarding={handleResetOnboarding}
                onExportData={handleExportData}
                onExportCSV={handleExportCSV}
                onDeleteAccount={handleDeleteAccount}
                categorizationRules={categorizationRules}
                onAddCategorizationRule={handleAddCategorizationRule}
                onDeleteCategorizationRule={handleDeleteCategorizationRule}
                onOpenSharing={() => overlay.openOverlay('sharing')}
                onOpenCategoryHub={() => overlay.openOverlay('categoryHub')}
                activeShareCount={getActiveShareLinks().length}
                spendDownPlans={spendDownPlans}
                onAddSpendDownPlan={addSpendDownPlan}
                onRemoveSpendDownPlan={removeSpendDownPlan}
                disbursements={disbursements}
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
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
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
