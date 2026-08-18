import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useHomeData } from './useHomeData'
import type { Transaction, Budget, Goal } from '@/types'
import * as supabaseData from '@/lib/supabaseData'

// Mock the Supabase data functions
vi.mock('@/lib/supabaseData', () => ({
  getTransactions: vi.fn(),
  getTransactionsPaginated: vi.fn().mockResolvedValue({ transactions: [], hasMore: false }),
  getCurrentMonthTransactions: vi.fn().mockResolvedValue([]),
  getBudgets: vi.fn(),
  getGoals: vi.fn(),
  getLessonProgress: vi.fn().mockResolvedValue([]),
  getMonthAllocations: vi.fn().mockResolvedValue([]),
  getSavingsAccounts: vi.fn().mockResolvedValue([]),
  getDebts: vi.fn().mockResolvedValue([]),
  getPaySchedule: vi.fn().mockResolvedValue(null),
  getSinkingFunds: vi.fn().mockResolvedValue([]),
  getFundingSources: vi.fn().mockResolvedValue([]),
  updateLessonProgress: vi.fn(),
  insertTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  upsertBudget: vi.fn(),
  updateBudgetSpent: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  updateGoalProgress: vi.fn(),
  deleteGoal: vi.fn(),
  createSavingsAccount: vi.fn(),
  updateSavingsAccount: vi.fn(),
  deleteSavingsAccount: vi.fn(),
  updateSavingsAccountBalance: vi.fn(),
  createSinkingFund: vi.fn(),
  updateSinkingFund: vi.fn(),
  deleteSinkingFund: vi.fn(),
  createFundingSource: vi.fn(),
  updateFundingSource: vi.fn(),
  deleteFundingSource: vi.fn(),
  fetchHomeDataBatch: vi.fn(),
}))

describe('useHomeData', () => {
  const mockUserId = 'test-user-123'
  
  // Use local date string to match how useHomeData computes "today" (local timezone)
  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      userId: mockUserId,
      date: todayLocal,
      amount: 15,
      type: 'expense',
      category: 'food',
      note: 'Lunch',
      accountType: 'personal',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      userId: mockUserId,
      date: todayLocal,
      amount: 50,
      type: 'expense',
      category: 'transport',
      accountType: 'personal',
      createdAt: new Date().toISOString(),
    },
  ]
  
  const mockBudgets: Budget[] = [
    {
      id: '1',
      userId: mockUserId,
      category: 'food',
      monthlyLimit: 400,
      spent: 150,
      month: new Date().toISOString().slice(0, 7),
    },
    {
      id: '2',
      userId: mockUserId,
      category: 'transport',
      monthlyLimit: 200,
      spent: 80,
      month: new Date().toISOString().slice(0, 7),
    },
  ]
  
  const mockGoals: Goal[] = [
    {
      id: '1',
      userId: mockUserId,
      name: 'Emergency Fund',
      targetAmount: 1000,
      currentAmount: 250,
      emoji: '🛡️',
      createdAt: new Date().toISOString(),
    },
  ]
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage to prevent cache hydration from bleeding across tests
    localStorage.clear()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  it('should load data on mount when userId is provided', async () => {
    // Setup mocks - fetchHomeDataBatch is the new batched fetch (Task 471.1)
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    // Render hook
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    // Initially should be loading
    expect(result.current.isLoading).toBe(true)
    expect(result.current.transactions).toEqual([])
    expect(result.current.budgets).toEqual([])
    expect(result.current.goals).toEqual([])
    
    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Verify data was loaded
    expect(result.current.transactions).toEqual(mockTransactions)
    expect(result.current.budgets).toEqual(mockBudgets)
    expect(result.current.goals).toEqual(mockGoals)
    
    // Verify batched API call was made
    expect(supabaseData.fetchHomeDataBatch).toHaveBeenCalledWith(mockUserId, 75)
  })
  
  it('should not load data when userId is null', async () => {
    const { result } = renderHook(() => useHomeData(null))
    
    // Should not be loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Should not have called any API functions
    expect(supabaseData.fetchHomeDataBatch).not.toHaveBeenCalled()
    
    // Data should be empty
    expect(result.current.transactions).toEqual([])
    expect(result.current.budgets).toEqual([])
    expect(result.current.goals).toEqual([])
  })
  
  it('should compute daily allowance when data is loaded', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Allowance should be computed
    expect(result.current.allowance).not.toBeNull()
    expect(result.current.allowance?.dailyBudget).toBeGreaterThan(0)
    expect(result.current.allowance?.spentToday).toBe(65) // 15 + 50
    expect(result.current.allowance?.status).toBeDefined()
    expect(result.current.allowance?.message).toBeDefined()
  })
  
  it('should compute category budget rows when data is loaded', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Category rows should be computed
    expect(result.current.categoryRows).toBeDefined()
    expect(result.current.categoryRows.length).toBeGreaterThan(0)
    
    // Should include our mock categories
    const foodRow = result.current.categoryRows.find((r) => r.category === 'food')
    const transportRow = result.current.categoryRows.find((r) => r.category === 'transport')
    
    expect(foodRow).toBeDefined()
    expect(transportRow).toBeDefined()
  })
  
  it('should refresh data when refresh function is called', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Clear mock call history
    vi.clearAllMocks()
    
    // Setup new mock data for refresh
    const newTransactions: Transaction[] = [...mockTransactions, {
      id: '3',
      userId: mockUserId,
      date: todayLocal,
      amount: 10,
      type: 'expense' as const,
      category: 'fun',
      accountType: 'personal',
      createdAt: new Date().toISOString(),
    }]
    
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: newTransactions,
      paginatedTransactions: { transactions: newTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    // Call refresh
    await result.current.refresh()
    
    // Wait for refresh to complete
    await waitFor(() => {
      expect(result.current.transactions.length).toBe(3)
    })
    
    // Verify batched API call was made
    expect(supabaseData.fetchHomeDataBatch).toHaveBeenCalledWith(mockUserId, 75)
  })
  
  it('should handle errors gracefully during data load', async () => {
    // Setup mock to throw error
    vi.mocked(supabaseData.fetchHomeDataBatch).mockRejectedValue(new Error('Network error'))
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Should set empty arrays on error
    expect(result.current.transactions).toEqual([])
    expect(result.current.budgets).toEqual([])
    expect(result.current.goals).toEqual([])
    
    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    consoleErrorSpy.mockRestore()
  })
  
  it('should provide setter functions for optimistic updates', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Verify setter functions are provided
    expect(typeof result.current.setTransactions).toBe('function')
    expect(typeof result.current.setBudgets).toBe('function')
    expect(typeof result.current.setGoals).toBe('function')
    
    // Test optimistic update — wrap in act() so React flushes the state update synchronously
    const newTransaction: Transaction = {
      id: '999',
      userId: mockUserId,
      date: todayLocal,
      amount: 25,
      type: 'expense',
      category: 'food',
      accountType: 'personal',
      createdAt: new Date().toISOString(),
    }
    
    act(() => {
      result.current.setTransactions((prev: Transaction[]) => [newTransaction, ...prev])
    })
    
    // Should have new transaction
    expect(result.current.transactions[0]).toEqual(newTransaction)
    expect(result.current.transactions.length).toBe(mockTransactions.length + 1)
  })
  
  it('should recalculate allowance when transactions change via setter', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    const initialSpent = result.current.allowance?.spentToday
    expect(initialSpent).toBe(65)
    
    // Add a new transaction via setter
    const newTransaction: Transaction = {
      id: '999',
      userId: mockUserId,
      date: todayLocal,
      amount: 20,
      type: 'expense',
      category: 'food',
      accountType: 'personal',
      createdAt: new Date().toISOString(),
    }
    
    result.current.setTransactions((prev: Transaction[]) => [newTransaction, ...prev])
    
    // Allowance should recalculate with new transaction
    await waitFor(() => {
      expect(result.current.allowance?.spentToday).toBe(85) // 65 + 20
    })
  })
  
  it('should recalculate category rows when budgets change via setter', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    vi.mocked(supabaseData.getBudgets).mockResolvedValue(mockBudgets)
    vi.mocked(supabaseData.getGoals).mockResolvedValue(mockGoals)
    
    const { result } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    const initialRowCount = result.current.categoryRows.length
    
    // Add a new budget via setter
    const newBudget: Budget = {
      id: '999',
      userId: mockUserId,
      category: 'fun',
      monthlyLimit: 150,
      spent: 50,
      month: new Date().toISOString().slice(0, 7),
    }
    
    result.current.setBudgets((prev: Budget[]) => [...prev, newBudget])
    
    // Category rows should include new category
    await waitFor(() => {
      const funRow = result.current.categoryRows.find((r) => r.category === 'fun')
      expect(funRow).toBeDefined()
    })
  })
  
  it('should memoize allowance calculation - not recalculate on unrelated changes', async () => {
    vi.mocked(supabaseData.fetchHomeDataBatch).mockResolvedValue({
      currentMonthTransactions: mockTransactions,
      paginatedTransactions: { transactions: mockTransactions, hasMore: false },
      budgets: mockBudgets,
      goals: mockGoals,
      lessonProgress: [],
      allocations: [],
      savingsAccounts: [],
      debts: [],
      paySchedule: null,
      sinkingFunds: [],
      fundingSources: [],
      failedSources: [],
    })
    
    const { result, rerender } = renderHook(() => useHomeData(mockUserId))
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    const allowance1 = result.current.allowance
    
    // Update goals (shouldn't affect allowance)
    result.current.setGoals((prev: Goal[]) => [...prev, {
      id: '999',
      userId: mockUserId,
      name: 'New Goal',
      targetAmount: 500,
      currentAmount: 0,
      emoji: '🎯',
      createdAt: new Date().toISOString(),
    }])
    
    // Rerender the hook
    rerender()
    
    // Allowance should be the same object (memoized)
    expect(result.current.allowance).toBe(allowance1)
  })
})
