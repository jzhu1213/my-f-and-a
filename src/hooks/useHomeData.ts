import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Transaction, Budget, Goal, TransactionCategory, TransactionType, UserLessonProgress } from '@/types'
import type { DailyAllowance, Debt, SavingsAccount, SavingsAccountType } from '@/types/folio'
import { 
  getTransactions, 
  getBudgets, 
  getGoals,
  getLessonProgress,
  updateLessonProgress,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  upsertBudget,
  updateBudgetSpent,
  createGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
  getMonthAllocations,
  getSavingsAccounts,
  createSavingsAccount as createSavingsAccountApi,
  updateSavingsAccount as updateSavingsAccountApi,
  deleteSavingsAccount as deleteSavingsAccountApi,
  updateSavingsAccountBalance,
  getDebts,
  getPaySchedule,
  getSinkingFunds,
  createSinkingFund as createSinkingFundApi,
  updateSinkingFund as updateSinkingFundApi,
  deleteSinkingFund as deleteSinkingFundApi,
} from '@/lib/supabaseData'
import type { AppAllocation } from '@/lib/supabaseData'
import type { PaySchedule } from '@/lib/paySchedule'
import type { SinkingFund } from '@/lib/sinkingFunds'
import { getTotalMonthlyReserve } from '@/lib/sinkingFunds'
import { computeTotalSetAside, computeSavingsRate } from '@/lib/allocationUtils'
import type { IncomeAllocation } from '@/types/folio'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { computeCategoryBudgets } from '@/lib/budgetUtils'
import { computeTotalSavingsBalance, computeMonthlyContributions } from '@/lib/savingsAccountUtils'
import { debtsToFixedExpenses } from '@/lib/debtUtils'
import type { FixedExpense } from '@/lib/fixedExpenses'
import type { CategoryBudgetRow } from '@/lib/budgetUtils'

/**
 * useHomeData - Consolidated data layer for the Home Screen
 * 
 * This hook encapsulates all data loading, computed values, and mutations
 * needed for the home screen experience. It provides:
 * 
 * 1. **Data Loading**: Parallelized fetch of transactions, budgets, and goals
 * 2. **Memoized Computations**: Daily allowance and category budgets only recalculate when dependencies change
 * 3. **Mutation Functions**: Complete CRUD operations for all entities
 * 4. **Offline Support**: Works with the existing offline queue infrastructure
 * 
 * @example Basic Usage
 * ```tsx
 * function HomeScreen() {
 *   const { user } = useAuth()
 *   const { 
 *     transactions, 
 *     budgets, 
 *     goals, 
 *     allowance, 
 *     isLoading,
 *     addTransaction,
 *     refresh
 *   } = useHomeData(user?.id)
 * 
 *   if (isLoading) return <Loading />
 * 
 *   return (
 *     <div>
 *       <DailyAllowanceHero allowance={allowance} />
 *       <QuickLogArea onLogExpense={addTransaction} />
 *       <RecentTransactions transactions={transactions} />
 *     </div>
 *   )
 * }
 * ```
 * 
 * @example Adding a Transaction
 * ```tsx
 * const { addTransaction } = useHomeData(userId)
 * 
 * const handleQuickLog = async () => {
 *   const result = await addTransaction({
 *     amount: 15.50,
 *     category: 'food',
 *     type: 'expense',
 *     date: '2024-01-15',
 *     note: 'Coffee'
 *   })
 *   
 *   if (result) {
 *     showToast('Expense logged!')
 *   }
 * }
 * ```
 * 
 * @example Optimistic Updates
 * ```tsx
 * const { setTransactions, addTransaction } = useHomeData(userId)
 * 
 * const handleOptimisticLog = async (data) => {
 *   // Optimistic update
 *   const optimisticTx = { id: 'temp', ...data, createdAt: new Date().toISOString() }
 *   setTransactions(prev => [optimisticTx, ...prev])
 *   
 *   // Server sync
 *   const result = await addTransaction(data)
 *   
 *   if (!result) {
 *     // Rollback on failure
 *     setTransactions(prev => prev.filter(t => t.id !== 'temp'))
 *   } else {
 *     // Replace with server result
 *     setTransactions(prev => prev.map(t => t.id === 'temp' ? result : t))
 *   }
 * }
 * ```
 * 
 * **Validates: Requirements 13.1, 13.2, 13.7**
 */

/**
 * Hook return type exposing all home screen data
 * 
 * **Validates: Requirements 13.1, 13.2, 13.7**
 */
export interface UseHomeDataReturn {
  // ── Core Data ──────────────────────────────────────────────────
  /** All user transactions */
  transactions: Transaction[]
  /** User budget limits by category */
  budgets: Budget[]
  /** User savings goals */
  goals: Goal[]
  /** User lesson progress records */
  lessonProgress: UserLessonProgress[]
  /** Tracked savings/investment accounts */
  savingsAccounts: SavingsAccount[]
  /**
   * The user's persisted pay schedule, or `null` when none is set. Callers fall
   * back to a flexible default so payday-aware features still work out of the box.
   */
  paySchedule: PaySchedule | null
  /** User sinking funds for periodic large costs */
  sinkingFunds: SinkingFund[]
  
  // ── Computed Values (Memoized) ─────────────────────────────────
  /** Daily allowance calculation (Requirement 13.2) */
  allowance: DailyAllowance | null
  /** Category budget rows with weekly spending (Requirement 13.2) */
  categoryRows: CategoryBudgetRow[]
  /** Total reserved (non-spendable) money set aside this month */
  totalSetAside: number
  /** Total balance across all savings/investment accounts */
  totalSavingsBalance: number
  /** Savings rate as a percentage (0-100) — percent of income saved */
  savingsRate: number
  
  // ── Loading State ──────────────────────────────────────────────
  /** Whether initial data is still loading */
  isLoading: boolean
  
  // ── Mutation Functions ─────────────────────────────────────────
  /** Refresh all data from Supabase (Requirement 13.7) */
  refresh: () => Promise<void>
  
  // Transaction mutations
  /** Add a new transaction (handles optimistic updates) */
  addTransaction: (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    date: string
    note?: string
  }) => Promise<Transaction | null>
  
  /** Update an existing transaction */
  updateTransaction: (
    id: string,
    data: {
      amount: number
      category: TransactionCategory
      type: TransactionType
      date: string
      note?: string
    }
  ) => Promise<Transaction | null>
  
  /** Delete a transaction */
  deleteTransaction: (id: string) => Promise<boolean>
  
  // Budget mutations
  /** Update or create a budget limit */
  updateBudget: (category: TransactionCategory, limit: number) => Promise<Budget | null>
  
  /** Recalculate budget spent for a category */
  recalculateBudgetSpent: (category: TransactionCategory) => Promise<void>
  
  // Goal mutations
  /** Create a new savings goal */
  createGoal: (data: {
    name: string
    targetAmount: number
    emoji: string
    targetDate?: string
  }) => Promise<Goal | null>
  
  /** Update an existing goal */
  updateGoal: (
    id: string,
    data: {
      name: string
      targetAmount: number
      emoji: string
      targetDate?: string
    }
  ) => Promise<Goal | null>
  
  /** Contribute to a goal (add to currentAmount) */
  contributeToGoal: (id: string, amount: number) => Promise<Goal | null>
  
  /** Delete a goal */
  deleteGoal: (id: string) => Promise<boolean>
  
  /** Complete a lesson (persist quiz score) */
  completeLesson: (lessonId: string, score: number) => Promise<void>
  
  // Savings account mutations
  /** Create a new savings/investment account */
  createSavingsAccount: (data: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }) => Promise<SavingsAccount | null>
  
  /** Update an existing savings account */
  updateSavingsAccount: (
    id: string,
    data: {
      type?: SavingsAccountType
      name?: string
      balance?: number
      monthlyContribution?: number
      expectedAnnualReturn?: number
    }
  ) => Promise<SavingsAccount | null>
  
  /** Delete a savings account */
  deleteSavingsAccount: (id: string) => Promise<boolean>
  
  /** Contribute to a savings account (add to balance) */
  contributeToSavingsAccount: (id: string, amount: number) => Promise<SavingsAccount | null>
  
  // Sinking fund mutations
  /** Add a new sinking fund */
  addSinkingFund: (data: Omit<SinkingFund, 'id' | 'userId' | 'createdAt'>) => Promise<SinkingFund | null>
  /** Update an existing sinking fund */
  updateSinkingFund: (id: string, updates: Partial<SinkingFund>) => Promise<SinkingFund | null>
  /** Delete a sinking fund */
  deleteSinkingFund: (id: string) => Promise<boolean>
  
  // Direct state setters (for advanced optimistic updates)
  /** Set transactions directly (for optimistic updates) */
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  /** Set budgets directly (for optimistic updates) */
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>
  /** Set disbursement bonus (monthly income boost from lump-sum aid/refunds) */
  setDisbursementBonus: React.Dispatch<React.SetStateAction<number>>
  /** Set goals directly (for optimistic updates) */
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>
}

/**
 * Custom hook that encapsulates all data loading for the home screen
 * 
 * Consolidates:
 * - Transaction data loading
 * - Budget data loading
 * - Goal data loading
 * - Daily allowance computation (memoized)
 * - Category budget computation (memoized)
 * - Offline queue handling via existing infrastructure
 * 
 * **Validates: Requirements 13.1, 13.2, 13.7**
 * 
 * @param userId - Current authenticated user ID (null if not authenticated)
 * @returns Object containing all home screen data and mutation functions
 */
export function useHomeData(userId: string | null | undefined): UseHomeDataReturn {
  // ── Local State ────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [lessonProgress, setLessonProgress] = useState<UserLessonProgress[]>([])
  const [allocations, setAllocations] = useState<AppAllocation[]>([])
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [paySchedule, setPaySchedule] = useState<PaySchedule | null>(null)
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([])
  const [disbursementBonus, setDisbursementBonus] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  // ── Data Loading ───────────────────────────────────────────────
  /**
   * Loads all data from Supabase
   * Requirement 13.1: Load in under 1 second by parallelizing requests
   */
  const loadData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      
      const currentMonth = new Date().toISOString().slice(0, 7)
      
      // Parallel data fetch for optimal performance (Requirement 13.1)
      const [txData, budgetData, goalData, lessonData, allocationData, savingsData, debtData, payScheduleData, sinkingFundsData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
        getLessonProgress(userId).catch(() => [] as UserLessonProgress[]),
        getMonthAllocations(userId, currentMonth).catch(() => [] as AppAllocation[]),
        getSavingsAccounts(userId).catch(() => [] as SavingsAccount[]),
        getDebts(userId).catch(() => [] as Debt[]),
        getPaySchedule(userId).catch(() => null),
        getSinkingFunds(userId).catch(() => [] as SinkingFund[]),
      ])
      
      setTransactions(txData)
      setBudgets(budgetData)
      setGoals(goalData)
      setLessonProgress(lessonData)
      setAllocations(allocationData)
      setSavingsAccounts(savingsData)
      setDebts(debtData)
      setPaySchedule(payScheduleData)
      setSinkingFunds(sinkingFundsData)
    } catch (err) {
      console.error('Error loading home data:', err)
      // Set empty arrays on error to allow app to function
      setTransactions([])
      setBudgets([])
      setGoals([])
      setAllocations([])
    } finally {
      setIsLoading(false)
    }
  }, [userId])
  
  // ── Initial Load ───────────────────────────────────────────────
  useEffect(() => {
    loadData()
  }, [loadData])
  
  // ── Refresh Function ───────────────────────────────────────────
  /**
   * Refresh handler for pull-to-refresh
   * Requirement 13.7: Support offline usage with queue
   */
  const refresh = useCallback(async () => {
    if (!userId) return
    
    try {
      const currentMonth = new Date().toISOString().slice(0, 7)
      
      // Parallel refresh for optimal performance
      const [txData, budgetData, goalData, lessonData, allocationData, savingsData, payScheduleData, sinkingFundsData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
        getLessonProgress(userId).catch(() => [] as UserLessonProgress[]),
        getMonthAllocations(userId, currentMonth).catch(() => [] as AppAllocation[]),
        getSavingsAccounts(userId).catch(() => [] as SavingsAccount[]),
        getPaySchedule(userId).catch(() => null),
        getSinkingFunds(userId).catch(() => [] as SinkingFund[]),
      ])
      
      setTransactions(txData)
      setBudgets(budgetData)
      setGoals(goalData)
      setLessonProgress(lessonData)
      setAllocations(allocationData)
      setSavingsAccounts(savingsData)
      setPaySchedule(payScheduleData)
      setSinkingFunds(sinkingFundsData)
    } catch (err) {
      console.error('Error refreshing home data:', err)
      // Don't clear existing data on refresh failure
    }
  }, [userId])
  
  // ── Transaction Mutations ──────────────────────────────────────
  /**
   * Add a new transaction with optimistic updates
   */
  const addTransaction = useCallback(async (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    date: string
    note?: string
  }) => {
    if (!userId) return null
    
    try {
      const result = await insertTransaction(userId, {
        ...data,
        accountType: 'personal',
      })
      
      if (result) {
        // Update local state with new transaction
        setTransactions(prev => [result, ...prev])
        
        // Recalculate budget spent if it's an expense
        if (data.type === 'expense') {
          await recalculateBudgetSpentForCategory(data.category)
        }
      }
      
      return result
    } catch (err) {
      console.error('Error adding transaction:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing transaction
   */
  const updateTransactionFn = useCallback(async (
    id: string,
    data: {
      amount: number
      category: TransactionCategory
      type: TransactionType
      date: string
      note?: string
    }
  ) => {
    if (!userId) return null
    
    try {
      // Find the old transaction to know what category to recalculate
      const oldTx = transactions.find(t => t.id === id)
      
      const result = await updateTransaction(userId, id, data)
      
      if (result) {
        // Update local state
        setTransactions(prev => prev.map(t => t.id === id ? result : t))
        
        // Recalculate budgets for affected categories
        if (oldTx?.type === 'expense') {
          await recalculateBudgetSpentForCategory(oldTx.category)
        }
        if (data.type === 'expense' && data.category !== oldTx?.category) {
          await recalculateBudgetSpentForCategory(data.category)
        }
      }
      
      return result
    } catch (err) {
      console.error('Error updating transaction:', err)
      return null
    }
  }, [userId, transactions])
  
  /**
   * Delete a transaction
   */
  const deleteTransactionFn = useCallback(async (id: string) => {
    if (!userId) return false
    
    try {
      const tx = transactions.find(t => t.id === id)
      const success = await deleteTransaction(userId, id)
      
      if (success) {
        // Update local state
        setTransactions(prev => prev.filter(t => t.id !== id))
        
        // Recalculate budget spent if it was an expense
        if (tx?.type === 'expense') {
          await recalculateBudgetSpentForCategory(tx.category)
        }
      }
      
      return success
    } catch (err) {
      console.error('Error deleting transaction:', err)
      return false
    }
  }, [userId, transactions])
  
  // ── Budget Mutations ───────────────────────────────────────────
  /**
   * Update or create a budget limit
   */
  const updateBudgetFn = useCallback(async (
    category: TransactionCategory,
    limit: number
  ) => {
    if (!userId) return null
    
    try {
      const result = await upsertBudget(userId, category, limit)
      
      if (result) {
        // Update local state
        setBudgets(prev => {
          const existing = prev.find(
            b => b.category === category && b.month === result.month
          )
          if (existing) {
            return prev.map(b => b.id === result.id ? result : b)
          }
          return [...prev, result]
        })
      }
      
      return result
    } catch (err) {
      console.error('Error updating budget:', err)
      return null
    }
  }, [userId])
  
  /**
   * Helper to recalculate budget spent for a specific category
   */
  const recalculateBudgetSpentForCategory = useCallback(async (
    category: TransactionCategory
  ) => {
    if (!userId) return
    
    try {
      // Calculate spent for current month
      const currentMonth = new Date().toISOString().slice(0, 7)
      const monthExpenses = transactions.filter(
        t => t.date.startsWith(currentMonth) && 
        t.type === 'expense' && 
        t.category === category
      )
      const spent = monthExpenses.reduce((sum, t) => sum + t.amount, 0)
      
      const result = await updateBudgetSpent(userId, category, spent)
      
      if (result) {
        setBudgets(prev => {
          const exists = prev.some(b => b.id === result.id)
          if (exists) {
            return prev.map(b => b.id === result.id ? result : b)
          }
          return [...prev, result]
        })
      }
    } catch (err) {
      console.error('Error recalculating budget spent:', err)
    }
  }, [userId, transactions])
  
  /**
   * Public API for recalculating budget spent
   */
  const recalculateBudgetSpent = useCallback(async (
    category: TransactionCategory
  ) => {
    await recalculateBudgetSpentForCategory(category)
  }, [recalculateBudgetSpentForCategory])
  
  // ── Goal Mutations ─────────────────────────────────────────────
  /**
   * Create a new savings goal
   */
  const createGoalFn = useCallback(async (data: {
    name: string
    targetAmount: number
    emoji: string
    targetDate?: string
  }) => {
    if (!userId) return null
    
    try {
      const result = await createGoal(userId, data)
      
      if (result) {
        setGoals(prev => [result, ...prev])
      }
      
      return result
    } catch (err) {
      console.error('Error creating goal:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing goal
   */
  const updateGoalFn = useCallback(async (
    id: string,
    data: {
      name: string
      targetAmount: number
      emoji: string
      targetDate?: string
    }
  ) => {
    if (!userId) return null
    
    try {
      const result = await updateGoal(userId, id, data)
      
      if (result) {
        setGoals(prev => prev.map(g => g.id === id ? result : g))
      }
      
      return result
    } catch (err) {
      console.error('Error updating goal:', err)
      return null
    }
  }, [userId])
  
  /**
   * Contribute to a goal (add to currentAmount)
   */
  const contributeToGoal = useCallback(async (
    id: string,
    amount: number
  ) => {
    if (!userId) return null
    
    try {
      const goal = goals.find(g => g.id === id)
      if (!goal) return null
      
      const newAmount = goal.currentAmount + amount
      const result = await updateGoalProgress(userId, id, newAmount)
      
      if (result) {
        setGoals(prev => prev.map(g => g.id === id ? result : g))
      }
      
      return result
    } catch (err) {
      console.error('Error contributing to goal:', err)
      return null
    }
  }, [userId, goals])
  
  /**
   * Delete a goal
   */
  const deleteGoalFn = useCallback(async (id: string) => {
    if (!userId) return false
    
    try {
      const success = await deleteGoal(userId, id)
      
      if (success) {
        setGoals(prev => prev.filter(g => g.id !== id))
      }
      
      return success
    } catch (err) {
      console.error('Error deleting goal:', err)
      return false
    }
  }, [userId])
  
  // ── Lesson Progress Mutations ──────────────────────────────────
  /**
   * Complete a lesson and persist quiz score
   */
  const completeLesson = useCallback(async (lessonId: string, score: number) => {
    if (!userId) return
    
    try {
      const result = await updateLessonProgress(userId, lessonId, score)
      
      if (result) {
        setLessonProgress(prev => {
          const existing = prev.find(p => p.lessonId === lessonId)
          if (existing) {
            return prev.map(p => p.lessonId === lessonId ? result : p)
          }
          return [...prev, result]
        })
      }
    } catch (err) {
      console.error('Error completing lesson:', err)
    }
  }, [userId])
  
  // ── Savings Account Mutations ──────────────────────────────────
  /**
   * Create a new savings/investment account
   */
  const createSavingsAccountFn = useCallback(async (data: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }) => {
    if (!userId) return null
    
    try {
      const result = await createSavingsAccountApi(userId, data)
      
      if (result) {
        setSavingsAccounts(prev => [result, ...prev])
      }
      
      return result
    } catch (err) {
      console.error('Error creating savings account:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing savings account
   */
  const updateSavingsAccountFn = useCallback(async (
    id: string,
    data: {
      type?: SavingsAccountType
      name?: string
      balance?: number
      monthlyContribution?: number
      expectedAnnualReturn?: number
    }
  ) => {
    if (!userId) return null
    
    try {
      const result = await updateSavingsAccountApi(userId, id, data)
      
      if (result) {
        setSavingsAccounts(prev => prev.map(a => a.id === id ? result : a))
      }
      
      return result
    } catch (err) {
      console.error('Error updating savings account:', err)
      return null
    }
  }, [userId])
  
  /**
   * Delete a savings account
   */
  const deleteSavingsAccountFn = useCallback(async (id: string) => {
    if (!userId) return false
    
    try {
      const success = await deleteSavingsAccountApi(userId, id)
      
      if (success) {
        setSavingsAccounts(prev => prev.filter(a => a.id !== id))
      }
      
      return success
    } catch (err) {
      console.error('Error deleting savings account:', err)
      return false
    }
  }, [userId])
  
  /**
   * Contribute to a savings account (add to balance)
   */
  const contributeToSavingsAccount = useCallback(async (
    id: string,
    amount: number
  ) => {
    if (!userId) return null
    
    try {
      const result = await updateSavingsAccountBalance(userId, id, amount)
      
      if (result) {
        setSavingsAccounts(prev => prev.map(a => a.id === id ? result : a))
      }
      
      return result
    } catch (err) {
      console.error('Error contributing to savings account:', err)
      return null
    }
  }, [userId])
  
  // ── Sinking Fund Mutations ─────────────────────────────────────
  /**
   * Add a new sinking fund
   */
  const addSinkingFund = useCallback(async (
    data: Omit<SinkingFund, 'id' | 'userId' | 'createdAt'>
  ): Promise<SinkingFund | null> => {
    if (!userId) return null
    
    try {
      const result = await createSinkingFundApi(userId, data)
      
      if (result) {
        setSinkingFunds(prev => [...prev, result])
      }
      
      return result
    } catch (err) {
      console.error('Error creating sinking fund:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing sinking fund
   */
  const updateSinkingFundFn = useCallback(async (
    id: string,
    updates: Partial<SinkingFund>
  ): Promise<SinkingFund | null> => {
    if (!userId) return null
    
    try {
      const result = await updateSinkingFundApi(userId, id, updates)
      
      if (result) {
        setSinkingFunds(prev => prev.map(f => f.id === id ? result : f))
      }
      
      return result
    } catch (err) {
      console.error('Error updating sinking fund:', err)
      return null
    }
  }, [userId])
  
  /**
   * Delete a sinking fund
   */
  const deleteSinkingFundFn = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false
    
    try {
      const success = await deleteSinkingFundApi(userId, id)
      
      if (success) {
        setSinkingFunds(prev => prev.filter(f => f.id !== id))
      }
      
      return success
    } catch (err) {
      console.error('Error deleting sinking fund:', err)
      return false
    }
  }, [userId])
  
  // ── Memoized Computations ──────────────────────────────────────
  /**
   * Daily allowance calculation (memoized)
   * Requirement 13.2: Only recalculate when budgets or transactions change
   * Requirement 14.2: Use income-based estimation when no budgets are configured
   */
  const allowance = useMemo<DailyAllowance | null>(() => {
    if (budgets.length === 0 && transactions.length === 0 && !isLoading) {
      // No data yet - return null to indicate uninitialized state
      return null
    }
    
    // Calculate monthly income from this month's income transactions
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthlyIncome = transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    
    // Convert debt minimum payments into fixed expenses so they are
    // sunk before computing the daily discretionary allowance.
    const debtFixedExpenses = debtsToFixedExpenses(debts)

    // Include sinking-fund monthly reserves as a fixed expense
    const reserveAmount = getTotalMonthlyReserve(sinkingFunds)
    const sinkingFundFixedExpense: FixedExpense = {
      id: 'sinking-funds-reserve',
      userId: '',
      category: 'other',
      label: 'Sinking Funds',
      amount: reserveAmount,
      dueDay: 1,
      recurringId: 'sinking-funds-reserve',
      isActive: true,
    }
    const allFixedExpenses = reserveAmount > 0
      ? [...debtFixedExpenses, sinkingFundFixedExpense]
      : debtFixedExpenses
    
    return computeDailyAllowance(budgets, transactions, new Date(), (monthlyIncome ?? 0) + disbursementBonus, allFixedExpenses)
  }, [budgets, transactions, debts, sinkingFunds, disbursementBonus, isLoading])
  
  /**
   * Category budget rows (memoized)
   * Requirement 13.2: Only recalculate when budgets or transactions change
   */
  const categoryRows = useMemo<CategoryBudgetRow[]>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const rows = computeCategoryBudgets(budgets, transactions, currentMonth, true)
    
    // Sort by priority: over-budget first, then by least remaining
    return rows.sort((a, b) => {
      // Over-budget categories first
      if (a.overWeekly && !b.overWeekly) return -1
      if (!a.overWeekly && b.overWeekly) return 1
      
      // Then by least remaining (for those with limits)
      if (a.hasLimit && b.hasLimit) return a.weeklyLeft - b.weeklyLeft
      
      // Limit holders before no-limit
      if (a.hasLimit && !b.hasLimit) return -1
      if (!a.hasLimit && b.hasLimit) return 1
      
      // Finally by most spent
      return b.weeklySpent - a.weeklySpent
    })
  }, [budgets, transactions])
  
  /**
   * Total set-aside (reserved, non-spendable) money this month.
   * Sums save + invest + setAside from all allocations in the current month.
   */
  const totalSetAside = useMemo<number>(() => {
    const asIncomeAllocations: IncomeAllocation[] = allocations.map(a => ({
      spend: a.spend,
      save: a.save,
      invest: a.invest,
      setAside: a.setAside,
    }))
    return computeTotalSetAside(asIncomeAllocations)
  }, [allocations])
  
  /**
   * Total savings balance (memoized)
   * Sum of all savings/investment account balances
   */
  const totalSavingsBalance = useMemo<number>(() => {
    return computeTotalSavingsBalance(savingsAccounts)
  }, [savingsAccounts])
  
  /**
   * Savings rate (memoized)
   * Percent of income saved = (totalSetAside + monthly contributions) / total monthly income * 100
   */
  const savingsRate = useMemo<number>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const totalMonthlyIncome = transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const monthlyContributions = computeMonthlyContributions(savingsAccounts)
    return computeSavingsRate(totalSetAside, monthlyContributions, totalMonthlyIncome)
  }, [transactions, savingsAccounts, totalSetAside])
  
  // ── Return Hook Interface ──────────────────────────────────────
  return {
    // Core data
    transactions,
    budgets,
    goals,
    lessonProgress,
    savingsAccounts,
    paySchedule,
    
    // Computed values (memoized)
    allowance,
    categoryRows,
    totalSetAside,
    totalSavingsBalance,
    savingsRate,
    
    // Loading state
    isLoading,
    
    // Mutation functions
    refresh,
    
    // Transaction mutations
    addTransaction,
    updateTransaction: updateTransactionFn,
    deleteTransaction: deleteTransactionFn,
    
    // Budget mutations
    updateBudget: updateBudgetFn,
    recalculateBudgetSpent,
    
    // Goal mutations
    createGoal: createGoalFn,
    updateGoal: updateGoalFn,
    contributeToGoal,
    deleteGoal: deleteGoalFn,
    
    // Lesson progress mutations
    completeLesson,
    
    // Savings account mutations
    createSavingsAccount: createSavingsAccountFn,
    updateSavingsAccount: updateSavingsAccountFn,
    deleteSavingsAccount: deleteSavingsAccountFn,
    contributeToSavingsAccount,
    
    // Sinking fund mutations
    sinkingFunds,
    addSinkingFund,
    updateSinkingFund: updateSinkingFundFn,
    deleteSinkingFund: deleteSinkingFundFn,
    
    // Direct state setters (for advanced optimistic updates)
    setTransactions,
    setBudgets,
    setGoals,
    setDisbursementBonus,
  }
}
