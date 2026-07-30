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
const BackfillSheet = dynamic(
  () => import('@/components/simplified/BackfillSheet').then(m => ({ default: m.BackfillSheet })),
  { ssr: false }
)
const BulkRepeatSheet = dynamic(
  () => import('@/components/simplified/BulkRepeatSheet').then(m => ({ default: m.BulkRepeatSheet })),
  { ssr: false }
)
import type { DetectedSubscription } from '@/lib/subscriptionDetector'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useHomeData } from '@/hooks/useHomeData'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { carryForwardBudgetLimits, insertAllocation, createDebt, updateDebt, deleteDebt, getDebts, getReimbursements, updateProfilePreferences, createReimbursement } from '@/lib/supabaseData'
import { exportUserData, deleteUserAccount } from '@/lib/accountUtils'
import type { TransactionCategory, Transaction } from '@/types'
import type { CelebrationEvent, OnboardingResult, BudgetPreset, IncomeAllocation, Debt } from '@/types/folio'
import { heroMeaningStatus } from '@/lib/dailyAllowanceUtils'
import type { Reimbursement } from '@/lib/reimbursements'
import type { TransactionRepeat } from '@/lib/transactionUtils'
import { createRefundTransaction } from '@/lib/refundUtils'
import { useRecurringBills } from '@/hooks/useRecurringBills'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { SyncIndicator } from '@/components/simplified/SyncIndicator'

type OnboardingStep = 'loading' | 'tutorial' | 'done'

export default function FolioApp() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const { showToast } = useToast()

  // ── Routing & UI State ─────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('loading')
  const [activeNav, setActiveNav] = useState<AppNavKey>('home')
  const [showBudgetSettings, setShowBudgetSettings] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showSinkingFunds, setShowSinkingFunds] = useState(false)
  const [showSubscriptionAudit, setShowSubscriptionAudit] = useState(false)
  const [showRecurringBills, setShowRecurringBills] = useState(false)
  const [showDebt, setShowDebt] = useState(false)
  const [showReimbursements, setShowReimbursements] = useState(false)
  const [showLearn, setShowLearn] = useState(false)
  const [showCompoundGrowth, setShowCompoundGrowth] = useState(false)
  const [showCreditPayoff, setShowCreditPayoff] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [showFundingSources, setShowFundingSources] = useState(false)

  // ── Tutorial Setup State ───────────────────────────────────────
  const [tutorialSetupState, setTutorialSetupState] = useState<TutorialSetupState>({
    monthlyIncome: 2000,
    budgetPreset: 'student_moderate' as BudgetPreset,
    categoryLimits: {},
  })

  // ── Sheet State ────────────────────────────────────────────────
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false)
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false)
  const [paycheckSheetOpen, setPaycheckSheetOpen] = useState(false)
  const [paycheckAmount, setPaycheckAmount] = useState(0)
  const [paycheckIsGigIncome, setPaycheckIsGigIncome] = useState(false)
  const [defaultExpenseCategory, setDefaultExpenseCategory] = useState<TransactionCategory | undefined>(undefined)
  const [splitPreEnabled, setSplitPreEnabled] = useState(false)
  const [backfillSheetOpen, setBackfillSheetOpen] = useState(false)

  // ── Per-transaction alert state (task 102.2) ───────────────────
  const [perTxAlertMessage, setPerTxAlertMessage] = useState<string | null>(null)

  // ── Income Anchor Banner (task 95.1) ───────────────────────────
  // A first-run nudge shown once after onboarding to encourage the user to
  // anchor their timeline by setting their last payday. Gated by
  // folio-income-anchor-offered so it only ever shows once.
  const [incomeAnchorBannerVisible, setIncomeAnchorBannerVisible] = useState(false)

  // ── Edit/Refund Sheet State ────────────────────────────────────
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  const [refundSheetOpen, setRefundSheetOpen] = useState(false)
  const [refundTransaction, setRefundTransaction] = useState<Transaction | null>(null)
  
  // ── Bulk Repeat Sheet State (Task 93.1) ────────────────────────
  const [bulkRepeatSheetOpen, setBulkRepeatSheetOpen] = useState(false)
  const [bulkRepeatTransaction, setBulkRepeatTransaction] = useState<{ amount: number; category: TransactionCategory; note?: string } | null>(null)

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
  } = useHomeData(user?.id, user)

  // ── Custom Categories ──────────────────────────────────────────
  const { customCategories, addCustomCategory } = useCustomCategories(user?.id)

  // ── Offline Sync (background retry of queued expenses) ─────────
  const {
    pendingCount: offlinePendingCount,
    hasFailed: offlineHasFailed,
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
    setShowDebt(true)
  }, [debtsLoaded, user?.id])

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

  // ── Recent split partners (derived from reimbursements, task 5.3 polish) ──
  const recentSplitPartners = useMemo(() => {
    if (reimbursements.length === 0) return []
    const seen = new Set<string>()
    const names: string[] = []
    // Walk most recent first (assuming sorted by createdAt desc from DB)
    const sorted = [...reimbursements].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    )
    for (const r of sorted) {
      const name = r.personName.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      names.push(name)
      if (names.length >= 5) break
    }
    return names
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
    const timer = setTimeout(() => setBackfillSheetOpen(true), 600)
    return () => clearTimeout(timer)
  }, [dataLoading, transactions.length])

  // ── Income anchor banner (task 95.1) ──────────────────────────
  // After the user has their daily number and the backfill sheet hasn't
  // auto-opened, show the income anchor banner as a gentler prompt.
  // Delayed ~1.2s so the hero renders and settles first.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dataLoading) return
    if (localStorage.getItem('folio-income-anchor-offered') === 'true') return
    // Don't show the banner if the full BackfillSheet is already open
    if (backfillSheetOpen) return

    localStorage.setItem('folio-income-anchor-offered', 'true')
    const timer = setTimeout(() => setIncomeAnchorBannerVisible(true), 1200)
    return () => clearTimeout(timer)
  }, [dataLoading, backfillSheetOpen])

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

  // ── Expense Logging ────────────────────────────────────────────
  const handleOpenExpenseSheet = useCallback((category?: TransactionCategory) => {
    setDefaultExpenseCategory(category)
    setSplitPreEnabled(false)
    setExpenseSheetOpen(true)
  }, [])

  // Opens expense sheet with split toggle pre-enabled (task 65 — one-tap split)
  const handleOpenSplitExpense = useCallback(() => {
    setDefaultExpenseCategory(undefined)
    setSplitPreEnabled(true)
    setExpenseSheetOpen(true)
  }, [])

  const handleExpenseSubmit = useCallback(async (data: {
    amount: number
    category: TransactionCategory
    note?: string
    date?: string
    fundingSourceId?: string
    trackAsIOU?: boolean
    splitWith?: string
    splitOwedAmount?: number
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
    } else {
      // addTransaction queued the expense locally on failure; reflect it in the
      // sync indicator so the user can see it is pending background retry.
      refreshOfflineSync()
      showToast('Saved offline — will sync when connected', 'success')
    }
  }, [user?.id, addTransaction, showToast, refreshOfflineSync, fundingSources])

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
  }) => {
    if (!user?.id) return

    const today = data.date ?? new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      amount: data.amount,
      category: 'other',
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
    setPaycheckAmount(amount)
    setPaycheckIsGigIncome(!!isGigIncome)
    setPaycheckSheetOpen(true)
  }, [])

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
    await deleteTransaction(id)
  }, [deleteTransaction])

  // ── Transaction Edit ───────────────────────────────────────────
  const handleEditTransaction = useCallback((tx: Transaction) => {
    setEditTransaction(tx)
    setEditSheetOpen(true)
  }, [])
  
  // ── Transaction Bulk Repeat (Task 93.1) ───────────────────────
  const handleRepeatTransaction = useCallback((tx: Transaction) => {
    setBulkRepeatTransaction({
      amount: tx.amount,
      category: tx.category,
      note: tx.note,
    })
    setBulkRepeatSheetOpen(true)
  }, [])
  
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
    if (!editTransaction) return null
    return updateTransaction(id, {
      amount: data.amount,
      category: data.category,
      type: editTransaction.type,
      date: data.date ?? editTransaction.date, // Use provided date or keep original
      note: data.note,
    })
  }, [editTransaction, updateTransaction])

  /** Inline edit handler — looks up the transaction from the list (no sheet state needed) */
  const handleInlineSaveTransaction = useCallback(async (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string }
  ) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return null
    return updateTransaction(id, {
      amount: data.amount,
      category: data.category,
      type: tx.type,
      date: tx.date,
      note: data.note,
    })
  }, [transactions, updateTransaction])

  // ── Refund Handling ────────────────────────────────────────────
  const handleOpenRefund = useCallback((tx: Transaction) => {
    setRefundTransaction(tx)
    setRefundSheetOpen(true)
  }, [])

  const handleLogRefund = useCallback(async (originalTx: Transaction, refundAmount: number) => {
    if (!user?.id) return
    const refundData = createRefundTransaction(originalTx, refundAmount)
    await addTransaction({
      amount: refundData.amount,
      category: refundData.category,
      type: refundData.type,
      date: refundData.date,
      note: refundData.note,
    })
  }, [user?.id, addTransaction])

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
    setProfileSheetOpen(true)
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
  if (showBudgetSettings) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <BudgetSettings
          budgets={budgets}
          onUpdateBudget={handleUpdateBudget}
          onBack={() => setShowBudgetSettings(false)}
          paySchedule={paySchedule}
        />
      </div>
    )
  }

  // ── Goals (full-screen overlay) ───────────────────────────────
  if (flags.goals && showGoals) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <GoalsScreen
          goals={goals}
          monthlyIncome={monthlyIncome}
          onCreateGoal={handleCreateGoal}
          onUpdateGoal={handleUpdateGoal}
          onContributeToGoal={handleContributeToGoal}
          onDeleteGoal={handleDeleteGoal}
          onBack={() => setShowGoals(false)}
        />
      </div>
    )
  }

  // ── Sinking Funds (full-screen overlay) ────────────────────────
  if (flags.sinkingFunds && showSinkingFunds) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SinkingFundsScreen
          funds={sinkingFunds}
          onAddFund={async (data) => { await addSinkingFund(data) }}
          onUpdateFund={async (id, updates) => { await updateSinkingFund(id, updates) }}
          onDeleteFund={async (id) => { await deleteSinkingFund(id) }}
          onClose={() => setShowSinkingFunds(false)}
          onSetDisbursement={(monthly) => setDisbursementBonus(monthly)}
        />
      </div>
    )
  }

  // ── Subscription Audit (full-screen overlay) ───────────────────
  if (flags.subscriptionAudit && showSubscriptionAudit) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <SubscriptionAuditScreen
          subscriptions={detectedSubscriptions}
          onDismiss={handleDismissSubscription}
          onClose={() => setShowSubscriptionAudit(false)}
        />
      </div>
    )
  }

  // ── Recurring Bills (full-screen overlay, task 65) ─────────────
  if (flags.recurringBills && showRecurringBills) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <RecurringBillsScreen
          bills={recurringBills}
          onAddBill={addBill}
          onUpdateBill={updateBill}
          onDeleteBill={deleteBill}
          onClose={() => setShowRecurringBills(false)}
        />
      </div>
    )
  }

  // ── Funding Sources (full-screen overlay) ────────────────────────
  if (showFundingSources) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <FundingSourcesScreen
          fundingSources={fundingSources}
          onAdd={addFundingSource}
          onEdit={updateFundingSource}
          onRemove={deleteFundingSource}
          onBack={() => setShowFundingSources(false)}
        />
      </div>
    )
  }

  // ── Debt Tracking (full-screen overlay) ────────────────────────
  if (flags.debtTracking && showDebt) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <DebtScreen
          debts={debts}
          onAddDebt={handleAddDebt}
          onUpdateDebt={handleUpdateDebt}
          onDeleteDebt={handleDeleteDebt}
          onClose={() => setShowDebt(false)}
        />
      </div>
    )
  }

  // ── IOUs & Reimbursements (full-screen overlay) ────────────────
  if (flags.reimbursements && showReimbursements && user?.id) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <ReimbursementLedger
          userId={user.id}
          onBack={() => setShowReimbursements(false)}
        />
      </div>
    )
  }

  // ── Learn / Lessons (full-screen overlay) ──────────────────────
  if (flags.lessons && showLearn) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => setShowLearn(false)}
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
        />
      </div>
    )
  }

  // ── Compound Growth Calculator (full-screen overlay, Tools tab) ─
  if (flags.compoundGrowthCalculator && showCompoundGrowth) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CompoundGrowthCalculator onBack={() => setShowCompoundGrowth(false)} />
      </div>
    )
  }

  // ── Credit Payoff Calculator (full-screen overlay, Tools tab) ──
  if (flags.creditPayoffCalculator && showCreditPayoff) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <CreditPayoffCalculator onBack={() => setShowCreditPayoff(false)} />
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
        onQuickLog={() => setExpenseSheetOpen(true)}
      >
        {offlinePendingCount > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SyncIndicator
              pendingCount={offlinePendingCount}
              hasFailed={offlineHasFailed}
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
                spendingMode={spendingMode}
                heroMeaning={heroMeaning}
                heroDisplay={heroDisplay}
                overLimitResponse={overLimitResponse}
                onHeroTapDetails={() => setActiveNav('history')}
                onLogExpense={handleOpenExpenseSheet}
                onLogIncome={() => setIncomeSheetOpen(true)}
                onRepeatLog={handleRepeatLog}
                onViewTransaction={handleEditTransaction}
                onViewAllHistory={() => setActiveNav('history')}
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={handleInlineSaveTransaction}
                onRefresh={refresh}
                celebrationEvent={celebrationEvent}
                onCelebrationDismiss={() => setCelebrationEvent(null)}
                onOpenBudgetSettings={() => setShowBudgetSettings(true)}
                onOpenSplitExpense={handleOpenSplitExpense}
                outstandingSplits={outstandingSplits}
                onOpenReimbursements={() => setShowReimbursements(true)}
                splitTransactionIds={splitTransactionIds}
                showIncomeAnchorBanner={incomeAnchorBannerVisible}
                onIncomeAnchorSetItNow={() => {
                  setIncomeAnchorBannerVisible(false)
                  setBackfillSheetOpen(true)
                }}
                onIncomeAnchorSkip={() => setIncomeAnchorBannerVisible(false)}
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
              />
            )}
            {activeNav === 'tools' && (
              <ToolsScreen
                onOpenCompoundGrowth={() => setShowCompoundGrowth(true)}
                onOpenCreditPayoff={() => setShowCreditPayoff(true)}
                onOpenSubscriptions={() => setShowSubscriptionAudit(true)}
                onOpenSinkingFunds={() => setShowSinkingFunds(true)}
                onOpenLearn={() => setShowLearn(true)}
                onOpenSavingsProjections={undefined}
                onOpenDebt={handleOpenDebt}
                onOpenRecurringBills={() => setShowRecurringBills(true)}
                onOpenReimbursements={() => setShowReimbursements(true)}
                totalSetAside={totalSetAside}
                savingsRate={savingsRate}
                fundingSources={fundingSources}
                transactions={transactions}
                debts={debts}
                reimbursements={reimbursements}
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
                onOpenBudgetSettings={() => setShowBudgetSettings(true)}
                onOpenGoals={() => setShowGoals(true)}
                onOpenTools={() => setActiveNav('tools')}
                onOpenProfile={handleOpenProfile}
                onOpenFundingSources={() => setShowFundingSources(true)}
                onOpenBackfill={() => setBackfillSheetOpen(true)}
                onSignOut={handleSignOut}
                onResetOnboarding={handleResetOnboarding}
                onExportData={handleExportData}
                onDeleteAccount={handleDeleteAccount}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </AppShell>

      {/* ── Expense Sheet ──────────────────────────────────────── */}
      <ExpenseSheet
        isOpen={expenseSheetOpen}
        onClose={() => { setExpenseSheetOpen(false); setSplitPreEnabled(false) }}
        onSubmit={handleExpenseSubmit}
        onUndo={lastLoggedId ? handleExpenseUndo : undefined}
        defaultCategory={defaultExpenseCategory}
        transactions={transactions}
        customCategories={customCategories}
        onAddCustomCategory={addCustomCategory}
        splitPreEnabled={splitPreEnabled}
        fundingSources={fundingSources}
        recentSplitPartners={recentSplitPartners}
        budgets={budgets}
        onAlertMessage={(msg) => setPerTxAlertMessage(msg)}
        spendingMode={spendingMode}
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
        isOpen={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSubmit={handleIncomeSubmit}
        onShowPaycheck={handleShowPaycheck}
        onUndo={lastLoggedId ? handleIncomeUndo : undefined}
        fundingSources={fundingSources}
        transactions={transactions}
      />

      {/* ── Paycheck Sheet ─────────────────────────────────────── */}
      <PaycheckSheet
        isOpen={paycheckSheetOpen}
        amount={paycheckAmount}
        goals={goals}
        onContribute={handleContributeToGoal}
        onAllocate={handleAllocateIncome}
        onClose={() => setPaycheckSheetOpen(false)}
        isGigIncome={paycheckIsGigIncome}
      />

      {/* ── Edit Transaction Sheet ─────────────────────────────── */}
      <EditTransactionSheet
        isOpen={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        transaction={editTransaction}
        onSave={handleSaveTransaction}
        onRefund={handleOpenRefund}
      />

      {/* ── Refund Sheet ───────────────────────────────────────── */}
      <RefundSheet
        isOpen={refundSheetOpen}
        onClose={() => setRefundSheetOpen(false)}
        transaction={refundTransaction}
        onLogRefund={handleLogRefund}
      />

      {/* ── Backfill Sheet (task 88) ──────────────────────────── */}
      <BackfillSheet
        isOpen={backfillSheetOpen}
        onClose={() => setBackfillSheetOpen(false)}
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
      {bulkRepeatTransaction && (
        <BulkRepeatSheet
          isOpen={bulkRepeatSheetOpen}
          onClose={() => setBulkRepeatSheetOpen(false)}
          transaction={bulkRepeatTransaction}
          onSubmit={handleBulkRepeatSubmit}
        />
      )}

      {/* ── Profile Sheet ──────────────────────────────────────── */}
      <ProfileSheet
        isOpen={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
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
