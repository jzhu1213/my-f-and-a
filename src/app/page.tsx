"use client"
import { useState, useEffect } from 'react'
import { 
  Onboarding, 
  TabNavigation, 
  AccountingTab, 
  FinanceTab, 
  TransactionSheet,
  Toast 
} from '@/components'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { 
  getTransactions, 
  insertTransaction, 
  deleteTransaction,
  getBudgets,
  upsertBudget,
  updateBudgetSpent,
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
  
  // Onboarding state
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null)
  
  // App state
  const [activeTab, setActiveTab] = useState<Tab>('accounting')
  const [showTransactionSheet, setShowTransactionSheet] = useState(false)
  const [prefilledCategory, setPrefilledCategory] = useState<TransactionCategory | undefined>()
  
  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [lessonProgress, setLessonProgress] = useState<UserLessonProgress[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  
  // Check onboarding status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const onboarded = localStorage.getItem('folio-onboarded')
      setHasOnboarded(onboarded === 'true')
    }
  }, [])
  
  // Load user data
  useEffect(() => {
    async function loadData() {
      if (!user) {
        setDataLoading(false)
        return
      }
      
      try {
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
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setDataLoading(false)
      }
    }
    
    if (!authLoading) {
      loadData()
    }
  }, [user, authLoading])
  
  // Handle onboarding complete
  const handleOnboardingComplete = (data: OnboardingData) => {
    localStorage.setItem('folio-onboarded', 'true')
    localStorage.setItem('folio-user-type', data.userType || 'student')
    localStorage.setItem('folio-user-priority', data.priority || 'save')
    setHasOnboarded(true)
  }
  
  // Recalculate budget spent amounts for a category
  const recalculateBudgetSpent = async (updatedTransactions: Transaction[], category?: TransactionCategory) => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthTxs = updatedTransactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
    
    // If category specified, only update that category
    const categoriesToUpdate = category ? [category] : Array.from(new Set(monthTxs.map(t => t.category)))
    
    for (const cat of categoriesToUpdate) {
      const spent = monthTxs
        .filter(t => t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0)
      
      if (!user) {
        // Local update
        setBudgets(prev => {
          const existing = prev.find(b => b.category === cat && b.month === currentMonth)
          if (existing) {
            return prev.map(b => 
              b.category === cat && b.month === currentMonth 
                ? { ...b, spent }
                : b
            )
          } else {
            const newBudget: Budget = {
              id: Date.now().toString(),
              userId: 'local',
              category: cat as TransactionCategory,
              monthlyLimit: 0,
              spent,
              month: currentMonth,
            }
            return [...prev, newBudget]
          }
        })
      } else {
        // Database update
        const result = await updateBudgetSpent(user.id, cat as TransactionCategory, spent)
        if (result) {
          setBudgets(prev => {
            const existing = prev.find(b => b.id === result.id)
            if (existing) {
              return prev.map(b => b.id === result.id ? result : b)
            }
            return [...prev, result]
          })
        }
      }
    }
  }
  
  // Handle open transaction sheet
  const handleOpenTransactionSheet = (category?: TransactionCategory) => {
    setPrefilledCategory(category)
    setShowTransactionSheet(true)
  }
  
  // Handle add transaction
  const handleAddTransaction = async (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    date: string
    note?: string
    isRecurring?: boolean
  }) => {
    if (!user) {
      // For demo/non-logged in users, add locally
      const newTx: Transaction = {
        id: Date.now().toString(),
        userId: 'local',
        date: data.date,
        amount: data.amount,
        type: data.type,
        category: data.category,
        note: data.note,
        isRecurring: data.isRecurring,
        accountType: 'personal',
        createdAt: new Date().toISOString(),
      }
      const updatedTxs = [newTx, ...transactions]
      setTransactions(updatedTxs)
      
      // Update budget if expense
      if (data.type === 'expense') {
        await recalculateBudgetSpent(updatedTxs, data.category)
      }
      
      showToast('Transaction added successfully')
      return
    }
    
    const result = await insertTransaction(user.id, {
      date: data.date,
      amount: data.amount,
      type: data.type,
      category: data.category,
      note: data.note,
      isRecurring: data.isRecurring,
    })
    
    if (result) {
      const updatedTxs = [result, ...transactions]
      setTransactions(updatedTxs)
      
      // Update budget if expense
      if (data.type === 'expense') {
        await recalculateBudgetSpent(updatedTxs, data.category)
      }
      
      showToast('Transaction added successfully')
    } else {
      showToast('Failed to add transaction', 'error')
    }
  }
  
  // Handle delete transaction
  const handleDeleteTransaction = async (id: string) => {
    // Find the transaction to get its category
    const txToDelete = transactions.find(t => t.id === id)
    
    if (!user) {
      const updatedTxs = transactions.filter(t => t.id !== id)
      setTransactions(updatedTxs)
      
      // Update budget if it was an expense
      if (txToDelete && txToDelete.type === 'expense') {
        await recalculateBudgetSpent(updatedTxs, txToDelete.category)
      }
      
      showToast('Transaction deleted')
      return
    }
    
    const success = await deleteTransaction(user.id, id)
    if (success) {
      const updatedTxs = transactions.filter(t => t.id !== id)
      setTransactions(updatedTxs)
      
      // Update budget if it was an expense
      if (txToDelete && txToDelete.type === 'expense') {
        await recalculateBudgetSpent(updatedTxs, txToDelete.category)
      }
      
      showToast('Transaction deleted')
    } else {
      showToast('Failed to delete transaction', 'error')
    }
  }
  
  // Handle update budget
  const handleUpdateBudget = async (category: TransactionCategory, limit: number) => {
    if (!user) {
      // For demo/non-logged in users, update locally
      setBudgets(prev => {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const existing = prev.find(b => b.category === category && b.month === currentMonth)
        
        if (existing) {
          return prev.map(b => 
            b.category === category && b.month === currentMonth 
              ? { ...b, monthlyLimit: limit }
              : b
          )
        } else {
          const newBudget: Budget = {
            id: Date.now().toString(),
            userId: 'local',
            category,
            monthlyLimit: limit,
            spent: 0,
            month: currentMonth,
          }
          return [...prev, newBudget]
        }
      })
      
      showToast('Budget limit updated')
      return
    }
    
    const result = await upsertBudget(user.id, category, limit)
    
    if (result) {
      setBudgets(prev => {
        const existing = prev.find(b => b.category === category && b.month === result.month)
        if (existing) {
          return prev.map(b => b.id === result.id ? result : b)
        }
        return [...prev, result]
      })
      
      showToast('Budget limit updated')
    } else {
      showToast('Failed to update budget', 'error')
    }
  }
  
  // Handle create goal
  const handleCreateGoal = async (data: { name: string; targetAmount: number; emoji: string }) => {
    if (!user) {
      // Local storage for demo users
      const newGoal: Goal = {
        id: Date.now().toString(),
        userId: 'local',
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: 0,
        emoji: data.emoji,
        createdAt: new Date().toISOString(),
      }
      setGoals(prev => [newGoal, ...prev])
      showToast('Goal created successfully')
      return
    }
    
    const result = await createGoal(user.id, data)
    if (result) {
      setGoals(prev => [result, ...prev])
      showToast('Goal created successfully')
    } else {
      showToast('Failed to create goal', 'error')
    }
  }
  
  // Handle update goal
  const handleUpdateGoal = async (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => {
    if (!user) {
      // Local update for demo users
      setGoals(prev => prev.map(g => 
        g.id === goalId 
          ? { ...g, name: data.name, targetAmount: data.targetAmount, emoji: data.emoji }
          : g
      ))
      showToast('Goal updated successfully')
      return
    }
    
    const result = await updateGoal(user.id, goalId, data)
    if (result) {
      setGoals(prev => prev.map(g => g.id === goalId ? result : g))
      showToast('Goal updated successfully')
    } else {
      showToast('Failed to update goal', 'error')
    }
  }
  
  // Handle contribute to goal
  const handleContributeToGoal = async (goalId: string, amount: number) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    
    const newAmount = goal.currentAmount + amount
    
    if (!user) {
      // Local update for demo users
      setGoals(prev => prev.map(g => 
        g.id === goalId 
          ? { ...g, currentAmount: newAmount }
          : g
      ))
      showToast(`$${amount} added to goal`)
      return
    }
    
    const result = await updateGoalProgress(user.id, goalId, newAmount)
    if (result) {
      setGoals(prev => prev.map(g => g.id === goalId ? result : g))
      showToast(`$${amount} added to goal`)
    } else {
      showToast('Failed to update goal', 'error')
    }
  }
  
  // Handle delete goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!user) {
      // Local delete for demo users
      setGoals(prev => prev.filter(g => g.id !== goalId))
      showToast('Goal deleted')
      return
    }
    
    const success = await deleteGoal(user.id, goalId)
    if (success) {
      setGoals(prev => prev.filter(g => g.id !== goalId))
      showToast('Goal deleted')
    } else {
      showToast('Failed to delete goal', 'error')
    }
  }
  
  // Handle lesson complete
  const handleLessonComplete = async (lessonId: string, score: number) => {
    if (!user) {
      // Local storage for non-logged in users
      const newProgress: UserLessonProgress = {
        id: Date.now().toString(),
        userId: 'local',
        lessonId,
        completed: true,
        quizScore: score,
        completedAt: new Date().toISOString(),
      }
      setLessonProgress(prev => [...prev.filter(p => p.lessonId !== lessonId), newProgress])
      return
    }
    
    const result = await updateLessonProgress(user.id, lessonId, score)
    if (result) {
      setLessonProgress(prev => [...prev.filter(p => p.lessonId !== lessonId), result])
    }
  }
  
  if (authLoading || hasOnboarded === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg">
        <div className="text-center">
          <div
            className="w-8 h-8 mx-auto mb-4 border-t border-t-text animate-spin"
            style={{ borderColor: 'transparent', borderTopColor: 'var(--muted)' }}
          />
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase">folio</p>
        </div>
      </div>
    )
  }
  
  // Show onboarding
  if (!hasOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }
  
  return (
    <div className="min-h-screen bg-t-bg">
      {/* Main Content */}
      {activeTab === 'accounting' ? (
        <AccountingTab 
          transactions={transactions}
          budgets={budgets}
          goals={goals}
          onAddTransaction={handleOpenTransactionSheet}
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
      
      {/* Bottom Tab Navigation */}
      <TabNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      {/* Transaction Entry Sheet */}
      <TransactionSheet 
        isOpen={showTransactionSheet}
        onClose={() => {
          setShowTransactionSheet(false)
          setPrefilledCategory(undefined)
        }}
        onSubmit={handleAddTransaction}
        prefilledCategory={prefilledCategory}
        recentTransactions={transactions}
      />
      
      {/* Toast Notifications */}
      <Toast />
    </div>
  )
}
