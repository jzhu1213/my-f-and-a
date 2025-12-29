"use client"
import { useState, useEffect } from 'react'
import { 
  Onboarding, 
  TabNavigation, 
  AccountingTab, 
  FinanceTab, 
  TransactionSheet 
} from '@/components'
import { useAuth } from '@/contexts/AuthContext'
import { 
  getTransactions, 
  insertTransaction, 
  deleteTransaction,
  getBudgets,
  upsertBudget,
  getGoals,
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
  
  // Onboarding state
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null)
  
  // App state
  const [activeTab, setActiveTab] = useState<Tab>('accounting')
  const [showTransactionSheet, setShowTransactionSheet] = useState(false)
  
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
  
  // Handle add transaction
  const handleAddTransaction = async (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    note?: string
    isRecurring?: boolean
  }) => {
    if (!user) {
      // For demo/non-logged in users, add locally
      const newTx: Transaction = {
        id: Date.now().toString(),
        userId: 'local',
        date: new Date().toISOString().split('T')[0],
        amount: data.amount,
        type: data.type,
        category: data.category,
        note: data.note,
        isRecurring: data.isRecurring,
        accountType: 'personal',
        createdAt: new Date().toISOString(),
      }
      setTransactions(prev => [newTx, ...prev])
      return
    }
    
    const result = await insertTransaction(user.id, {
      date: new Date().toISOString().split('T')[0],
      ...data,
    })
    
    if (result) {
      setTransactions(prev => [result, ...prev])
    }
  }
  
  // Handle delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!user) {
      setTransactions(prev => prev.filter(t => t.id !== id))
      return
    }
    
    const success = await deleteTransaction(user.id, id)
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id))
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
  
  // Show loading state
  if (authLoading || hasOnboarded === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-folio-bg-light dark:bg-folio-bg-dark">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sage border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-folio-text-secondary-light dark:text-folio-text-secondary-dark">Loading Folio...</p>
        </div>
      </div>
    )
  }
  
  // Show onboarding
  if (!hasOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }
  
  // Main app
  return (
    <div className="min-h-screen bg-folio-bg-light dark:bg-folio-bg-dark">
      {/* Main Content */}
      {activeTab === 'accounting' ? (
        <AccountingTab 
          transactions={transactions}
          budgets={budgets}
          goals={goals}
          onAddTransaction={() => setShowTransactionSheet(true)}
          onUpdateBudget={handleUpdateBudget}
          onDeleteTransaction={handleDeleteTransaction}
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
        onClose={() => setShowTransactionSheet(false)}
        onSubmit={handleAddTransaction}
      />
    </div>
  )
}
