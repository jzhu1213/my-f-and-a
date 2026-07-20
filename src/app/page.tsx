"use client"
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Onboarding,
  Toast,
  ProfileSheet,
  LimitSetupWizard,
  AppShell,
  HistoryScreen,
  SettingsScreen,
} from '@/components'
import type { AppNavKey } from '@/components/ui/AppShell'
import type { LimitSetupResult } from '@/components/ui/LimitSetupWizard'
import { TodayView } from '@/components/accounting/TodayView'
import { LimitsView } from '@/components/accounting/LimitsView'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useHomeData } from '@/hooks/useHomeData'
import { carryForwardBudgetLimits } from '@/lib/supabaseData'
import type { TransactionCategory } from '@/types'

type OnboardingStep = 'loading' | 'welcome' | 'limits' | 'done'

export default function FolioApp() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  // ── Routing & UI State ─────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('loading')
  const [activeNav, setActiveNav] = useState<AppNavKey>('home')
  const [showLimits, setShowLimits] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // ── Data Layer (consolidated in useHomeData hook) ─────────────
  const {
    transactions,
    budgets,
    goals,
    isLoading: dataLoading,
    updateBudget,
    createGoal,
    updateGoal,
    contributeToGoal,
    deleteGoal,
  } = useHomeData(user?.id)

  // ── Onboarding Check ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnboardingStep(localStorage.getItem('folio-onboarded') === 'true' ? 'done' : 'welcome')
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
  const finishOnboarding = () => {
    localStorage.setItem('folio-onboarded', 'true')
    setOnboardingStep('done')
  }

  const applyInitialLimits = async (limits: LimitSetupResult) => {
    const entries = Object.entries(limits) as [TransactionCategory, number][]
    for (const [cat, limit] of entries) {
      if (limit > 0) await updateBudget(cat, limit)
    }
    if (entries.length > 0) showToast('Limits set — check Today to see what\'s left')
    finishOnboarding()
  }

  const handleLimitSetupSkip = () => finishOnboarding()

  // ── Goal Handlers (delegated to useHomeData) ───────────────────
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string }) => {
    const result = await createGoal(data)
    if (result) showToast('Goal created')
    else showToast('Failed to create goal', 'error')
  }

  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => {
    const result = await updateGoal(goalId, data)
    if (result) showToast('Goal updated')
    else showToast('Failed to update goal', 'error')
  }

  const handleContributeToGoal = async (goalId: string, amount: number) => {
    const result = await contributeToGoal(goalId, amount)
    if (result) showToast(`$${amount} added`)
    else showToast('Failed to update goal', 'error')
  }

  const handleDeleteGoal = async (goalId: string) => {
    const success = await deleteGoal(goalId)
    if (success) showToast('Goal deleted')
    else showToast('Failed to delete goal', 'error')
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
    setOnboardingStep('welcome')
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

  if (onboardingStep === 'welcome') {
    return <Onboarding onComplete={() => setOnboardingStep('limits')} />
  }

  if (onboardingStep === 'limits') {
    return (
      <LimitSetupWizard
        onComplete={applyInitialLimits}
        onSkip={handleLimitSetupSkip}
      />
    )
  }

  // ── Main App Shell ─────────────────────────────────────────────
  return (
    <>
      {showLimits ? (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
          <LimitsView
            budgets={budgets}
            goals={goals}
            onBack={() => setShowLimits(false)}
            onUpdateBudget={handleUpdateBudget}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
            onContributeToGoal={handleContributeToGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        </div>
      ) : (
        <AppShell
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onOpenSettings={() => setActiveNav('settings')}
          onOpenProfile={() => setShowProfile(true)}
          avatarUrl={undefined}
          avatarInitial={user?.email?.charAt(0)}
          meshVariant={activeNav === 'home' ? 'home' : 'home'}
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
                <TodayView
                  transactions={transactions}
                  budgets={budgets}
                  isLoading={dataLoading}
                  onLogExpense={() => {}}
                  onLogIncome={() => {}}
                  onRepeatLog={() => {}}
                  onOpenLimits={() => setShowLimits(true)}
                  onViewHistory={() => setActiveNav('history')}
                  onEditTransaction={() => {}}
                />
              )}
              {activeNav === 'history' && (
                <HistoryScreen
                  transactions={transactions}
                  isLoading={dataLoading}
                  onEditTransaction={() => {}}
                  onDeleteTransaction={() => {}}
                  onLogExpense={() => {}}
                />
              )}
              {activeNav === 'settings' && (
                <SettingsScreen
                  budgets={budgets}
                  goals={goals}
                  userEmail={user?.email}
                  onOpenBudgetSettings={() => setShowLimits(true)}
                  onOpenGoals={() => setShowLimits(true)}
                  onOpenLearn={() => setActiveNav('home')}
                  onSignOut={handleSignOut}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </AppShell>
      )}

      <ProfileSheet
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userEmail={user?.email}
        onSignOut={handleSignOut}
      />

      <Toast />
    </>
  )
}
