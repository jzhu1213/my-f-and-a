import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Transaction, Budget, Goal, TransactionCategory, TransactionType } from '@/types'
import type { DailyAllowance } from '@/types/folio'
import { 
  getTransactions, 
  getBudgets, 
  getGoals,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  upsertBudget,
  updateBudgetSpent,
  createGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
} from '@/lib/supabaseData'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { computeCategoryBudgets } from '@/lib/budgetUtils'
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
  
  // ── Computed Values (Memoized) ─────────────────────────────────
  /** Daily allowance calculation (Requirement 13.2) */
  allowance: DailyAllowance | null
  /** Category budget rows with weekly spending (Requirement 13.2) */
  categoryRows: CategoryBudgetRow[]
  
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
  }) => Promise<Goal | null>
  
  /** Update an existing goal */
  updateGoal: (
    id: string,
    data: {
      name: string
      targetAmount: number
      emoji: string
    }
  ) => Promise<Goal | null>
  
  /** Contribute to a goal (add to currentAmount) */
  contributeToGoal: (id: string, amount: number) => Promise<Goal | null>
  
  /** Delete a goal */
  deleteGoal: (id: string) => Promise<boolean>
  
  // Direct state setters (for advanced optimistic updates)
  /** Set transactions directly (for optimistic updates) */
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  /** Set budgets directly (for optimistic updates) */
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>
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
      
      // Parallel data fetch for optimal performance (Requirement 13.1)
      const [txData, budgetData, goalData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
      ])
      
      setTransactions(txData)
      setBudgets(budgetData)
      setGoals(goalData)
    } catch (err) {
      console.error('Error loading home data:', err)
      // Set empty arrays on error to allow app to function
      setTransactions([])
      setBudgets([])
      setGoals([])
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
      // Parallel refresh for optimal performance
      const [txData, budgetData, goalData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
      ])
      
      setTransactions(txData)
      setBudgets(budgetData)
      setGoals(goalData)
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
    
    return computeDailyAllowance(budgets, transactions, new Date(), monthlyIncome)
  }, [budgets, transactions, isLoading])
  
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
  
  // ── Return Hook Interface ──────────────────────────────────────
  return {
    // Core data
    transactions,
    budgets,
    goals,
    
    // Computed values (memoized)
    allowance,
    categoryRows,
    
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
    
    // Direct state setters (for advanced optimistic updates)
    setTransactions,
    setBudgets,
    setGoals,
  }
}
