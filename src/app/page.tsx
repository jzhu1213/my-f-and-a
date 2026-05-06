"use client"
import { useState, useEffect } from 'react'
import {
  Onboarding,
  TabNavigation,
  Toast,
  ProfileSheet,
} from '@/components'
import { AccountingTab } from '@/components/accounting/AccountingTab'
import { FinanceTab } from '@/components/finance/FinanceTab'
import { TransactionSheet } from '@/components/accounting/TransactionSheet'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  getTransactions,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  getBudgets,
  upsertBudget,
  updateBudgetSpent,
  carryForwardBudgetLimits,
  getGoals,
  createGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
  getLessonProgress,
  updateLessonProgress,
} from '@/lib/supabaseData'
import type {
  Transaction,
  Budget,
  Goal,
  UserLessonProgress,
  OnboardingData,
  TransactionCategory,
  TransactionType,
} from '@/types'

type Tab = 'accounting' | 'finance'

export default function FolioApp() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const [hasOnboarded,          setHasOnboarded]          = useState<boolean | null>(null)
  const [activeTab,             setActiveTab]             = useState<Tab>('accounting')
  const [showTransactionSheet,  setShowTransactionSheet]  = useState(false)
  const [editingTransaction,    setEditingTransaction]    = useState<Transaction | undefined>()
  const [prefilledCategory,     setPrefilledCategory]     = useState<TransactionCategory | undefined>()
  const [showProfile,           setShowProfile]           = useState(false)

  const [transactions,   setTransactions]   = useState<Transaction[]>([])
  const [budgets,        setBudgets]        = useState<Budget[]>([])
  const [goals,          setGoals]          = useState<Goal[]>([])
  const [lessonProgress, setLessonProgress] = useState<UserLessonProgress[]>([])
  const [dataLoading,    setDataLoading]    = useState(true)

  // ── Onboarding ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasOnboarded(localStorage.getItem('folio-onboarded') === 'true')
    }
  }, [])

  // ── Data loading ────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      if (!user) { setDataLoading(false); return }
      try {
        // Carry forward budget limits from previous month before fetching
        await carryForwardBudgetLimits(user.id)

        const [txData, budgetData, goalData, progressData] = await Promise.all([
          getTransactions(user.id),
          getBudgets(user.id),
          getGoals(user.id),
          getLessonProgress(user.id),
        ])
        setTransactions(txData)
        setBudgets(budgetData)
        setGoals(goalData)
        setLessonProgress(progressData)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setDataLoading(false)
      }
    }
    if (!authLoading) loadData()
  }, [user, authLoading])

  // ── Onboarding complete ─────────────────────────────────────────
  const handleOnboardingComplete = (_data: OnboardingData) => {
    localStorage.setItem('folio-onboarded', 'true')
    setHasOnboarded(true)
  }

  // ── Budget recalculation helper ─────────────────────────────────
  const recalculateBudgetSpent = async (updatedTxs: Transaction[], category?: TransactionCategory) => {
    const currentMonth  = new Date().toISOString().slice(0, 7)
    const monthExpenses = updatedTxs.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
    const cats = category
      ? [category]
      : Array.from(new Set(monthExpenses.map(t => t.category)))

    for (const cat of cats) {
      const spent = monthExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
      if (!user) {
        setBudgets(prev => {
          const existing = prev.find(b => b.category === cat && b.month === currentMonth)
          if (existing) return prev.map(b => b.category === cat && b.month === currentMonth ? { ...b, spent } : b)
          return [...prev, { id: Date.now().toString(), userId: 'local', category: cat as TransactionCategory, monthlyLimit: 0, spent, month: currentMonth }]
        })
      } else {
        const result = await updateBudgetSpent(user.id, cat as TransactionCategory, spent)
        if (result) setBudgets(prev => prev.some(b => b.id === result.id) ? prev.map(b => b.id === result.id ? result : b) : [...prev, result])
      }
    }
  }

  // ── Transaction sheet open ──────────────────────────────────────
  const handleOpenAddSheet = (category?: TransactionCategory) => {
    setEditingTransaction(undefined)
    setPrefilledCategory(category)
    setShowTransactionSheet(true)
  }

  const handleOpenEditSheet = (tx: Transaction) => {
    setEditingTransaction(tx)
    setPrefilledCategory(undefined)
    setShowTransactionSheet(true)
  }

  const handleCloseSheet = () => {
    setShowTransactionSheet(false)
    setEditingTransaction(undefined)
    setPrefilledCategory(undefined)
  }

  // ── Add transaction ─────────────────────────────────────────────
  const handleAddTransaction = async (data: {
    amount: number; category: TransactionCategory; type: TransactionType; date: string; note?: string
  }) => {
    if (!user) {
      const newTx: Transaction = {
        id: Date.now().toString(), userId: 'local',
        date: data.date, amount: data.amount, type: data.type,
        category: data.category, note: data.note,
        accountType: 'personal', createdAt: new Date().toISOString(),
      }
      const updated = [newTx, ...transactions]
      setTransactions(updated)
      if (data.type === 'expense') await recalculateBudgetSpent(updated, data.category)
      showToast('Transaction added')
      return
    }
    const result = await insertTransaction(user.id, data)
    if (result) {
      const updated = [result, ...transactions]
      setTransactions(updated)
      if (data.type === 'expense') await recalculateBudgetSpent(updated, data.category)
      showToast('Transaction added')
    } else {
      showToast('Failed to add transaction', 'error')
    }
  }

  // ── Edit transaction ────────────────────────────────────────────
  const handleEditTransaction = async (data: {
    amount: number; category: TransactionCategory; type: TransactionType; date: string; note?: string
  }) => {
    if (!editingTransaction) return
    const oldCategory = editingTransaction.category
    const oldType     = editingTransaction.type

    if (!user) {
      const updated = transactions.map(t =>
        t.id === editingTransaction.id
          ? { ...t, amount: data.amount, category: data.category, type: data.type, date: data.date, note: data.note }
          : t
      )
      setTransactions(updated)
      // Recalculate both old and new category if they differ
      const affectedCats = new Set<TransactionCategory>()
      if (oldType === 'expense') affectedCats.add(oldCategory)
      if (data.type === 'expense') affectedCats.add(data.category)
      for (const cat of affectedCats) await recalculateBudgetSpent(updated, cat)
      showToast('Transaction updated')
      return
    }

    const result = await updateTransaction(user.id, editingTransaction.id, data)
    if (result) {
      const updated = transactions.map(t => t.id === result.id ? result : t)
      setTransactions(updated)
      const affectedCats = new Set<TransactionCategory>()
      if (oldType === 'expense') affectedCats.add(oldCategory)
      if (data.type === 'expense') affectedCats.add(data.category)
      for (const cat of affectedCats) await recalculateBudgetSpent(updated, cat)
      showToast('Transaction updated')
    } else {
      showToast('Failed to update transaction', 'error')
    }
  }

  // ── Delete transaction (optimistic + 3.5 s undo window) ────────
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return

    // Optimistically remove from UI immediately
    const restored = [...transactions]
    const updated  = transactions.filter(t => t.id !== id)
    setTransactions(updated)
    if (tx.type === 'expense') recalculateBudgetSpent(updated, tx.category)

    let undone = false

    showToast('Transaction deleted', 'info', {
      label: 'Undo',
      onClick: () => {
        undone = true
        setTransactions(restored)
        if (tx.type === 'expense') recalculateBudgetSpent(restored, tx.category)
      },
    })

    // After toast duration: commit delete to backend (unless undone)
    setTimeout(async () => {
      if (undone || !user) return
      const ok = await deleteTransaction(user.id, id)
      if (!ok) {
        setTransactions(restored)
        if (tx.type === 'expense') recalculateBudgetSpent(restored, tx.category)
        showToast('Failed to delete transaction', 'error')
      }
    }, 3500)
  }

  // ── Budget ──────────────────────────────────────────────────────
  const handleUpdateBudget = async (category: TransactionCategory, limit: number) => {
    if (!user) {
      const currentMonth = new Date().toISOString().slice(0, 7)
      setBudgets(prev => {
        const existing = prev.find(b => b.category === category && b.month === currentMonth)
        if (existing) return prev.map(b => b.category === category && b.month === currentMonth ? { ...b, monthlyLimit: limit } : b)
        return [...prev, { id: Date.now().toString(), userId: 'local', category, monthlyLimit: limit, spent: 0, month: currentMonth }]
      })
      showToast('Budget updated')
      return
    }
    const result = await upsertBudget(user.id, category, limit)
    if (result) {
      setBudgets(prev => prev.some(b => b.category === category && b.month === result.month)
        ? prev.map(b => b.id === result.id ? result : b)
        : [...prev, result])
      showToast('Budget updated')
    } else {
      showToast('Failed to update budget', 'error')
    }
  }

  // ── Goals ───────────────────────────────────────────────────────
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string }) => {
    if (!user) {
      setGoals(prev => [{ id: Date.now().toString(), userId: 'local', currentAmount: 0, createdAt: new Date().toISOString(), ...data }, ...prev])
      showToast('Goal created')
      return
    }
    const result = await createGoal(user.id, data)
    if (result) { setGoals(prev => [result, ...prev]); showToast('Goal created') }
    else showToast('Failed to create goal', 'error')
  }

  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => {
    if (!user) {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...data } : g))
      showToast('Goal updated')
      return
    }
    const result = await updateGoal(user.id, goalId, data)
    if (result) { setGoals(prev => prev.map(g => g.id === goalId ? result : g)); showToast('Goal updated') }
    else showToast('Failed to update goal', 'error')
  }

  const handleContributeToGoal = async (goalId: string, amount: number) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const newAmount = goal.currentAmount + amount
    if (!user) {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentAmount: newAmount } : g))
      showToast(`$${amount} added to goal`)
      return
    }
    const result = await updateGoalProgress(user.id, goalId, newAmount)
    if (result) { setGoals(prev => prev.map(g => g.id === goalId ? result : g)); showToast(`$${amount} added`) }
    else showToast('Failed to update goal', 'error')
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) { setGoals(prev => prev.filter(g => g.id !== goalId)); showToast('Goal deleted'); return }
    const ok = await deleteGoal(user.id, goalId)
    if (ok) { setGoals(prev => prev.filter(g => g.id !== goalId)); showToast('Goal deleted') }
    else showToast('Failed to delete goal', 'error')
  }

  // ── Lessons ─────────────────────────────────────────────────────
  const handleLessonComplete = async (lessonId: string, score: number) => {
    if (!user) {
      setLessonProgress(prev => [
        ...prev.filter(p => p.lessonId !== lessonId),
        { id: Date.now().toString(), userId: 'local', lessonId, completed: true, quizScore: score, completedAt: new Date().toISOString() },
      ])
      return
    }
    const result = await updateLessonProgress(user.id, lessonId, score)
    if (result) setLessonProgress(prev => [...prev.filter(p => p.lessonId !== lessonId), result])
  }

  // ── Sign out ────────────────────────────────────────────────────
  const handleSignOut = () => {
    setTransactions([])
    setBudgets([])
    setGoals([])
    setLessonProgress([])
    localStorage.removeItem('folio-onboarded')
    setHasOnboarded(false)
  }

  // ── Loading state ───────────────────────────────────────────────
  if (authLoading || hasOnboarded === null) {
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

  if (!hasOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // Transaction sheet submit handler — route to add or edit
  const handleSheetSubmit = (data: {
    amount: number; category: TransactionCategory; type: TransactionType; date: string; note?: string
  }) => {
    if (editingTransaction) handleEditTransaction(data)
    else handleAddTransaction(data)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {activeTab === 'accounting' ? (
        <AccountingTab
          transactions={transactions}
          budgets={budgets}
          goals={goals}
          isLoading={dataLoading}
          onAddTransaction={handleOpenAddSheet}
          onEditTransaction={handleOpenEditSheet}
          onUpdateBudget={handleUpdateBudget}
          onDeleteTransaction={handleDeleteTransaction}
          onCreateGoal={handleCreateGoal}
          onUpdateGoal={handleUpdateGoal}
          onContributeToGoal={handleContributeToGoal}
          onDeleteGoal={handleDeleteGoal}
        />
      ) : (
        <FinanceTab
          lessonProgress={lessonProgress}
          onCompleteLesson={handleLessonComplete}
        />
      )}

      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onProfileOpen={() => setShowProfile(true)}
      />

      <TransactionSheet
        isOpen={showTransactionSheet}
        onClose={handleCloseSheet}
        onSubmit={handleSheetSubmit}
        prefilledCategory={prefilledCategory}
        editTransaction={editingTransaction}
      />

      <ProfileSheet
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userEmail={user?.email}
        onSignOut={handleSignOut}
      />

      <Toast />
    </div>
  )
}
