"use client"
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Toast,
  AppShell,
} from '@/components'
import type { AppNavKey } from '@/components/ui/AppShell'
import { HomeScreen } from '@/components/simplified/HomeScreen'
import { HistoryScreen } from '@/components/simplified/HistoryScreen'
import { SettingsScreen } from '@/components/simplified/SettingsScreen'
import { BudgetSettings } from '@/components/simplified/BudgetSettings'
import { GoalsScreen } from '@/components/simplified/GoalsScreen'
import { SinkingFundsScreen } from '@/components/simplified/SinkingFundsScreen'
import { ExpenseSheet } from '@/components/simplified/ExpenseSheet'
import { IncomeSheet } from '@/components/simplified/IncomeSheet'
import { PaycheckSheet } from '@/components/simplified/PaycheckSheet'
import { OnboardingTutorial } from '@/components/simplified/OnboardingTutorial'
import { ProfileSheet } from '@/components/ui/ProfileSheet'
import { TutorialSetupStepRenderer, TUTORIAL_FEATURE_STEPS, TUTORIAL_SETUP_STEPS, TutorialSetupState, buildOnboardingResult, computeDailyAllowance } from '@/components/simplified/TutorialSteps'
import { LessonsScreen } from '@/components/finance/LessonsScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useHomeData } from '@/hooks/useHomeData'
import { carryForwardBudgetLimits, insertAllocation } from '@/lib/supabaseData'
import { exportUserData, deleteUserAccount } from '@/lib/accountUtils'
import type { TransactionCategory, Transaction } from '@/types'
import type { CelebrationEvent, OnboardingResult, BudgetPreset, IncomeAllocation } from '@/types/folio'
import type { TransactionRepeat } from '@/lib/transactionUtils'

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
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)

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
  const [defaultExpenseCategory, setDefaultExpenseCategory] = useState<TransactionCategory | undefined>(undefined)

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
    totalSetAside,
    savingsRate,
    paySchedule,
    isLoading: dataLoading,
    refresh,
    addTransaction,
    deleteTransaction,
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
  } = useHomeData(user?.id)

  // ── Onboarding Check ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnboardingStep(localStorage.getItem('folio-onboarded') === 'true' ? 'done' : 'tutorial')
    }
  }, [])

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
    setExpenseSheetOpen(true)
  }, [])

  const handleExpenseSubmit = useCallback(async (data: {
    amount: number
    category: TransactionCategory
    note?: string
  }) => {
    if (!user?.id) return

    const today = new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      amount: data.amount,
      category: data.category,
      type: 'expense',
      date: today,
      note: data.note,
    })

    if (result) {
      setLastLoggedId(result.id)
    } else {
      showToast('Saved offline — will sync when connected', 'success')
    }
  }, [user?.id, addTransaction, showToast])

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
  }) => {
    if (!user?.id) return

    const today = new Date().toISOString().slice(0, 10)
    const result = await addTransaction({
      amount: data.amount,
      category: 'other',
      type: 'income',
      date: today,
      note: data.note,
    })

    if (!result) {
      showToast('Saved offline — will sync when connected', 'success')
    }
  }, [user?.id, addTransaction, showToast])

  // ── Paycheck Sheet (show after income logged, only if active goals) ──
  const handleShowPaycheck = useCallback((amount: number) => {
    setPaycheckAmount(amount)
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
      showToast(`Logged ${repeat.label} ✓`, 'success')
      setLastLoggedId(result.id)
    } else {
      showToast('Saved offline — will sync when connected', 'success')
    }
  }, [user?.id, addTransaction, showToast])

  // ── Transaction Delete ─────────────────────────────────────────
  const handleDeleteTransaction = useCallback(async (id: string) => {
    await deleteTransaction(id)
  }, [deleteTransaction])

  // ── Goal Handlers (delegated to useHomeData) ───────────────────
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string }) => {
    const result = await createGoal(data)
    if (result) showToast('Goal created')
    else showToast('Failed to create goal', 'error')
    return result
  }

  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => {
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
    localStorage.removeItem('folio-onboarding')
    setOnboardingStep('tutorial')
    showToast('Tutorial reset - starting fresh')
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
        />
      </div>
    )
  }

  // ── Goals (full-screen overlay) ───────────────────────────────
  if (showGoals) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 60 }}>
        <GoalsScreen
          goals={goals}
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
  if (showSinkingFunds) {
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
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNav}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {activeNav === 'home' && (
              <HomeScreen
                allowance={allowance}
                transactions={transactions}
                budgets={budgets}
                goals={goals}
                totalSetAside={totalSetAside}
                savingsRate={savingsRate}
                paySchedule={paySchedule}
                userName={user?.email?.split('@')[0]}
                isLoading={dataLoading}
                onHeroTapDetails={() => setActiveNav('history')}
                onLogExpense={handleOpenExpenseSheet}
                onLogIncome={() => setIncomeSheetOpen(true)}
                onRepeatLog={handleRepeatLog}
                onViewTransaction={(_tx: Transaction) => setActiveNav('history')}
                onViewAllHistory={() => setActiveNav('history')}
                onDeleteTransaction={handleDeleteTransaction}
                onRefresh={refresh}
                celebrationEvent={celebrationEvent}
                onCelebrationDismiss={() => setCelebrationEvent(null)}
              />
            )}
            {activeNav === 'history' && (
              <HistoryScreen
                transactions={transactions}
                isLoading={dataLoading}
                onEditTransaction={(_tx: Transaction) => {}}
                onDeleteTransaction={handleDeleteTransaction}
                onLogExpense={() => handleOpenExpenseSheet()}
              />
            )}
            {activeNav === 'learn' && (
              <LessonsScreen
                lessonProgress={lessonProgress}
                onCompleteLesson={completeLesson}
              />
            )}
            {activeNav === 'settings' && (
              <SettingsScreen
                budgets={budgets}
                goals={goals}
                totalSetAside={totalSetAside}
                savingsRate={savingsRate}
                userEmail={user?.email}
                onOpenBudgetSettings={() => setShowBudgetSettings(true)}
                onOpenSinkingFunds={() => setShowSinkingFunds(true)}
                onOpenGoals={() => setShowGoals(true)}
                onOpenLearn={() => setActiveNav('learn')}
                onOpenProfile={handleOpenProfile}
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
        onClose={() => setExpenseSheetOpen(false)}
        onSubmit={handleExpenseSubmit}
        onUndo={lastLoggedId ? handleExpenseUndo : undefined}
        defaultCategory={defaultExpenseCategory}
        transactions={transactions}
      />

      {/* ── Income Sheet ───────────────────────────────────────── */}
      <IncomeSheet
        isOpen={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSubmit={handleIncomeSubmit}
        onShowPaycheck={handleShowPaycheck}
      />

      {/* ── Paycheck Sheet ─────────────────────────────────────── */}
      <PaycheckSheet
        isOpen={paycheckSheetOpen}
        amount={paycheckAmount}
        goals={goals}
        onContribute={handleContributeToGoal}
        onAllocate={handleAllocateIncome}
        onClose={() => setPaycheckSheetOpen(false)}
      />

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
