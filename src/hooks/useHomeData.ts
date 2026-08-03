import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Transaction, Budget, Goal, TransactionCategory, TransactionType, UserLessonProgress, UserProfile } from '@/types'
import type { DailyAllowance, Debt, SavingsAccount, SavingsAccountType, IncomeSmoothing } from '@/types/folio'
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
  getFundingSources,
  createFundingSource as createFundingSourceApi,
  updateFundingSource as updateFundingSourceApi,
  updateFundingSourceBalance as updateFundingSourceBalanceApi,
  deleteFundingSource as deleteFundingSourceApi,
} from '@/lib/supabaseData'
import { getHomeCache, setHomeCache, isCacheStale } from '@/lib/homeCache'
import { addToOfflineQueue } from '@/lib/offlineQueue'
import type { AppAllocation } from '@/lib/supabaseData'
import type { PaySchedule } from '@/lib/paySchedule'
import type { SinkingFund } from '@/lib/sinkingFunds'
import type { FundingSource } from '@/lib/fundingSources'
import { getTotalMonthlyReserve } from '@/lib/sinkingFunds'
import type { Disbursement } from '@/lib/disbursements'
import { loadDisbursements, saveDisbursements, computeActiveDisbursementBonus, generateDisbursementId } from '@/lib/disbursements'
import { computeSavingsRate } from '@/lib/allocationUtils'
import { computeSetAside } from '@/lib/setAside'
import type { SetAsideBreakdown } from '@/lib/setAside'
import type { IncomeAllocation } from '@/types/folio'
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { computeWeekendAllowance } from '@/lib/weekendAllowance'
import type { WeekendAllowanceResult } from '@/lib/weekendAllowance'
import { computeTermAllowance } from '@/lib/termAllowance'
import type { TermAllowanceResult } from '@/lib/termAllowance'
import { loadSpendDownPlans, saveSpendDownPlans, computeSpendDown, isSpendDownActive, generateSpendDownId } from '@/lib/spendDown'
import type { SpendDownPlan, SpendDownResult } from '@/lib/spendDown'
import { computeTimeHorizonStats } from '@/lib/timeHorizonStats'
import type { TimeHorizonStats } from '@/lib/timeHorizonStats'
import type { TermSchedule } from '@/lib/termSchedule'
import { loadTermSchedule, saveTermSchedule } from '@/lib/termSchedule'
import type { SpendingMode } from '@/lib/spendingModes'
import type { OverLimitResponse } from '@/lib/spendingModes'
import { getOverLimitResponse, setOverLimitResponsePref } from '@/lib/spendingModes'
import type { HeroMeaning } from '@/types/folio'
import { syncWidgetData } from '@/lib/widgetSync'
import { recordContribution, clearContributionHistory } from '@/lib/savingsContributionHistory'
import { computeRhythmWeights } from '@/lib/rhythmModel'

// ── Income Smoothing Preference Persistence ────────────────────────────────
// Stored in localStorage as a fallback (no dedicated Supabase table yet).
// Pattern mirrors other simple preference keys (roundUpSavings, minBalanceBuffer, etc.)
const INCOME_SMOOTHING_KEY = 'folio-income-smoothing'

function loadIncomeSmoothingPreference(): IncomeSmoothing | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(INCOME_SMOOTHING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as IncomeSmoothing
  } catch {
    return null
  }
}

function saveIncomeSmoothingPreference(preference: IncomeSmoothing): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INCOME_SMOOTHING_KEY, JSON.stringify(preference))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ── Spending Mode Preference Persistence ──────────────────────────────────
// Stored in localStorage (no dedicated Supabase table).
// The mode never blocks logging — it is a display preference only.
const SPENDING_MODE_KEY = 'folio-spending-mode'

function loadSpendingModePreference(): SpendingMode {
  if (typeof window === 'undefined') return 'guided'
  try {
    const raw = localStorage.getItem(SPENDING_MODE_KEY)
    if (raw === 'tracker' || raw === 'guided' || raw === 'structured') return raw
    return 'guided'
  } catch {
    return 'guided'
  }
}

function saveSpendingModePreference(mode: SpendingMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SPENDING_MODE_KEY, mode)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ── Hero Meaning Preference Persistence ───────────────────────────────────
// Stored in localStorage. Pattern mirrors spending mode and income smoothing.
// The choice is purely a display preference — no data is affected.
const HERO_MEANING_KEY = 'folio-hero-meaning'

function loadHeroMeaningPreference(): HeroMeaning | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(HERO_MEANING_KEY)
    if (raw === 'allowance' || raw === 'spent_today' || raw === 'spent_week' || raw === 'balance') {
      return raw
    }
    return null
  } catch {
    return null
  }
}

function saveHeroMeaningPreference(meaning: HeroMeaning): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HERO_MEANING_KEY, meaning)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

import { computeCategoryBudgets } from '@/lib/budgetUtils'
import { computeTotalSavingsBalance, computeMonthlyContributions } from '@/lib/savingsAccountUtils'
import { debtsToFixedExpenses } from '@/lib/debtUtils'
import type { FixedExpense } from '@/lib/fixedExpenses'
import type { CategoryBudgetRow } from '@/lib/budgetUtils'

/**
 * Returns a stable local Date representing "today" that only changes when the
 * calendar date actually changes. Prevents the daily allowance from re-computing
 * (or "jumping") on mid-day re-renders or if the user opens the app at 11:59 PM
 * vs 12:01 AM within the same render cycle.
 *
 * The returned Date is always midnight local time of the current day.
 */
function useCurrentDay(): Date {
  const [today, setToday] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  useEffect(() => {
    // Check if the calendar day has changed (e.g., app left open overnight)
    const interval = setInterval(() => {
      const now = new Date()
      const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      setToday(prev => {
        if (prev.getTime() !== currentDay.getTime()) {
          return currentDay
        }
        return prev
      })
    }, 60_000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  return today
}

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
  /** User funding sources (payment methods) */
  fundingSources: FundingSource[]
  /**
   * The user's income smoothing preference, or `null` when none is set.
   * `null` means `current_month` behaviour (no change to existing logic).
   */
  incomeSmoothing: IncomeSmoothing | null
  /**
   * The user's spending mode preference.
   * Controls how budget signals are communicated — never blocks logging.
   * Defaults to `'guided'`.
   */
  spendingMode: SpendingMode
  /**
   * The user's hero-meaning preference — which metric is shown as the big number.
   * Defaults to `'allowance'` for guided/structured modes, or `'spent_today'` for tracker.
   * Persisted to localStorage.
   */
  heroMeaning: HeroMeaning
  /**
   * The user's over-limit response preference — controls how the app reacts when
   * the user goes over their daily allowance.
   * - `'quiet'`: color change only (existing OverBudgetStrip is hidden)
   * - `'gentle'`: one calm line below the hero
   * - `'headsup'`: one calm line + a small actionable chip
   * Defaults to a mode-appropriate value when not explicitly set.
   * Persisted to localStorage.
   */
  overLimitResponse: OverLimitResponse
  
  // ── Computed Values (Memoized) ─────────────────────────────────
  /** Daily allowance calculation (Requirement 13.2) */
  allowance: DailyAllowance | null
  /** Category budget rows with weekly spending (Requirement 13.2) */
  categoryRows: CategoryBudgetRow[]
  /**
   * Headline "set aside this month" number (reserved, non-spendable flow):
   * allocation buckets + sinking-fund monthly reserves. Equivalent to
   * `setAside.reservedThisMonth`. Computed once here and reused across surfaces.
   */
  totalSetAside: number
  /**
   * Full reconciled set-aside breakdown (single source of truth for the four
   * "money set aside" features). Computed once here; pass down rather than
   * re-deriving per surface. See `src/lib/setAside.ts` for the mental model.
   */
  setAside: SetAsideBreakdown
  /** Total balance across all savings/investment accounts */
  totalSavingsBalance: number
  /** Savings rate as a percentage (0-100) — percent of income saved */
  savingsRate: number
  /** Weekend allowance quick-view data (safe to spend this weekend) */
  weekendAllowance: WeekendAllowanceResult | null
  /** Term allowance — "make this last until end of term" daily number */
  termAllowance: TermAllowanceResult | null
  /** Unified time-horizon stats: weekend, payday, term (each nullable) */
  timeHorizonStats: TimeHorizonStats
  /** The user's active term schedule, or null when not set */
  termSchedule: TermSchedule | null
  /** Active spend-down plan result (first active plan), or null when none active */
  activeSpendDown: SpendDownResult | null
  /** All persisted spend-down plans */
  spendDownPlans: SpendDownPlan[]
  /** Add a new spend-down plan (persisted to localStorage) */
  addSpendDownPlan: (data: Omit<SpendDownPlan, 'id'>) => SpendDownPlan
  /** Remove a spend-down plan by ID (persisted to localStorage) */
  removeSpendDownPlan: (id: string) => void
  /** Update an existing spend-down plan (persisted to localStorage) */
  updateSpendDownPlan: (id: string, updates: Partial<SpendDownPlan>) => void
  
  // ── Loading State ──────────────────────────────────────────────
  /** Whether initial data is still loading */
  isLoading: boolean
  /** Whether background sync is in progress (after cache hydration) */
  isSyncing: boolean
  /** Whether cached data is stale beyond the configured threshold */
  isStale: boolean
  
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
    fundingSourceId?: string
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
      fundingSourceId?: string
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
  
  // Funding source mutations
  /** Add a new funding source */
  addFundingSource: (data: {
    label: string
    emoji: string
    kind: FundingSource['kind']
    reducesBalanceNow: boolean
  }) => Promise<FundingSource | null>
  /** Update an existing funding source */
  updateFundingSource: (id: string, updates: {
    label?: string
    emoji?: string
    kind?: FundingSource['kind']
    reducesBalanceNow?: boolean
    snapshotBalance?: number
  }) => Promise<FundingSource | null>
  /** Update just the snapshot balance for a funding source */
  updateFundingSourceBalance: (id: string, snapshotBalance: number) => Promise<FundingSource | null>
  /** Delete a funding source */
  deleteFundingSource: (id: string) => Promise<boolean>
  
  // Direct state setters (for advanced optimistic updates)
  /** Set transactions directly (for optimistic updates) */
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  /** Set budgets directly (for optimistic updates) */
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>
  /** Set disbursement bonus (monthly income boost from lump-sum aid/refunds) */
  setDisbursementBonus: React.Dispatch<React.SetStateAction<number>>
  /** Persisted disbursement entries (financial aid, scholarships, refunds) */
  disbursements: Disbursement[]
  /** Add a new disbursement (persisted to localStorage) */
  addDisbursement: (data: Omit<Disbursement, 'id'>) => Disbursement
  /** Remove a disbursement by ID (persisted to localStorage) */
  removeDisbursement: (id: string) => void
  /** Set goals directly (for optimistic updates) */
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>
  /**
   * Persist a new income-smoothing preference and update state.
   * Pass `null` to clear the preference and revert to `current_month` behaviour.
   */
  setIncomeSmoothing: (preference: IncomeSmoothing | null) => void
  /**
   * Persist a new spending mode preference and update state.
   * The mode never blocks logging — it is a display preference only.
   */
  setSpendingMode: (mode: SpendingMode) => void
  /**
   * Persist a new hero-meaning preference and update state.
   * Controls which metric is shown as the large hero number.
   */
  setHeroMeaning: (meaning: HeroMeaning) => void
  /**
   * Persist a new over-limit response preference and update state.
   * Controls what happens in the UI when the user goes over their daily allowance.
   */
  setOverLimitResponse: (response: OverLimitResponse) => void
  /**
   * Persist a new term schedule and update state.
   * Pass `null` to clear the term schedule.
   */
  setTermSchedule: (schedule: TermSchedule | null) => void
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
 * @param userProfile - Full user profile with preferences (optional)
 * @returns Object containing all home screen data and mutation functions
 */
export function useHomeData(userId: string | null | undefined, userProfile?: UserProfile | null): UseHomeDataReturn {
  // ── Stable "today" date (only changes on calendar day boundary) ──
  const currentDay = useCurrentDay()

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
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>(() => loadDisbursements())
  const [spendDownPlans, setSpendDownPlans] = useState<SpendDownPlan[]>(() => loadSpendDownPlans())
  const [termSchedule, setTermScheduleState] = useState<TermSchedule | null>(() => loadTermSchedule())
  const [disbursementBonus, setDisbursementBonus] = useState(0)
  const [incomeSmoothing, setIncomeSmoothingState] = useState<IncomeSmoothing | null>(
    () => loadIncomeSmoothingPreference()
  )
  const [spendingMode, setSpendingModeState] = useState<SpendingMode>(
    () => loadSpendingModePreference()
  )
  const [heroMeaning, setHeroMeaningState] = useState<HeroMeaning>(() => {
    const stored = loadHeroMeaningPreference()
    if (stored) return stored
    // Default: tracker mode → spent_today; guided/structured → allowance
    const mode = loadSpendingModePreference()
    return mode === 'tracker' ? 'spent_today' : 'allowance'
  })
  const [overLimitResponse, setOverLimitResponseState] = useState<OverLimitResponse>(
    () => getOverLimitResponse()
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isStale, setIsStale] = useState(false)

  // Track whether cache hydration happened so we skip the skeleton
  const hydratedFromCache = useRef(false)

  // ── Cache Hydration (synchronous, before first render paint) ───
  // Runs once when userId becomes available to populate state from localStorage cache
  useEffect(() => {
    if (!userId || hydratedFromCache.current) return
    const cache = getHomeCache(userId)
    if (cache) {
      setTransactions(cache.recentTransactions)
      setBudgets(cache.budgets)
      setIsLoading(false) // Skip skeleton — we have cached data
      hydratedFromCache.current = true
      // Check if cache is stale
      setIsStale(isCacheStale(userId))
    }
  }, [userId])
  
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
      // If cache was hydrated, this is a background reconciliation
      if (hydratedFromCache.current) {
        setIsSyncing(true)
      } else {
        setIsLoading(true)
      }
      
      const currentMonth = new Date().toISOString().slice(0, 7)
      
      // Parallel data fetch for optimal performance (Requirement 13.1)
      const [txData, budgetData, goalData, lessonData, allocationData, savingsData, debtData, payScheduleData, sinkingFundsData, fundingSourcesData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
        getLessonProgress(userId).catch(() => [] as UserLessonProgress[]),
        getMonthAllocations(userId, currentMonth).catch(() => [] as AppAllocation[]),
        getSavingsAccounts(userId).catch(() => [] as SavingsAccount[]),
        getDebts(userId).catch(() => [] as Debt[]),
        getPaySchedule(userId).catch(() => null),
        getSinkingFunds(userId).catch(() => [] as SinkingFund[]),
        getFundingSources(userId).catch(() => [] as FundingSource[]),
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
      setFundingSources(fundingSourcesData)
      
      setIsStale(false)
    } catch (err) {
      console.error('Error loading home data:', err)
      // Set empty arrays on error to allow app to function (only if no cache)
      if (!hydratedFromCache.current) {
        setTransactions([])
        setBudgets([])
        setGoals([])
        setAllocations([])
      }
    } finally {
      setIsLoading(false)
      setIsSyncing(false)
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
      setIsSyncing(true)
      const currentMonth = new Date().toISOString().slice(0, 7)
      
      // Parallel refresh for optimal performance
      const [txData, budgetData, goalData, lessonData, allocationData, savingsData, payScheduleData, sinkingFundsData, fundingSourcesData] = await Promise.all([
        getTransactions(userId),
        getBudgets(userId),
        getGoals(userId),
        getLessonProgress(userId).catch(() => [] as UserLessonProgress[]),
        getMonthAllocations(userId, currentMonth).catch(() => [] as AppAllocation[]),
        getSavingsAccounts(userId).catch(() => [] as SavingsAccount[]),
        getPaySchedule(userId).catch(() => null),
        getSinkingFunds(userId).catch(() => [] as SinkingFund[]),
        getFundingSources(userId).catch(() => [] as FundingSource[]),
      ])
      
      setTransactions(txData)
      setBudgets(budgetData)
      setGoals(goalData)
      setLessonProgress(lessonData)
      setAllocations(allocationData)
      setSavingsAccounts(savingsData)
      setPaySchedule(payScheduleData)
      setSinkingFunds(sinkingFundsData)
      setFundingSources(fundingSourcesData)
      
      setIsStale(false)
    } catch (err) {
      console.error('Error refreshing home data:', err)
      // Don't clear existing data on refresh failure
    } finally {
      setIsSyncing(false)
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
      } else {
        // Persistence failed — queue locally for background retry so it is
        // not silently lost. Supports both expense and income. (Requirements 10.2, 13.7)
        addToOfflineQueue(userId, {
          kind: 'create',
          payload: {
            category: data.category,
            amount: data.amount,
            type: data.type,
            date: data.date,
            note: data.note,
          },
        })
      }
      
      return result
    } catch (err) {
      console.error('Error adding transaction:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing transaction
   *
   * RETROACTIVE RECOMPUTATION (Task 89.2):
   * When a transaction's date is edited (e.g., backdated to last week), this
   * mutation updates local state via `setTransactions(prev => prev.map(...))`.
   * Because the `allowance` useMemo depends on `transactions`, React automatically
   * recalculates `computeDailyAllowance` with the updated dataset.
   *
   * `computeDailyAllowance` is a PURE FUNCTION that recomputes rollover from
   * scratch in O(n) time (single pass over all transactions in the date range),
   * NOT an O(days) per-day loop. This means:
   *   • Changing a transaction's date from today to 2 weeks ago → rollover for
   *     all affected days is automatically correct in the next render
   *   • No explicit "recompute affected days" step is needed
   *   • Performance is bounded by transaction count, not date range size
   *
   * The batch-compute approach (sum expected vs actual over a date range) ensures
   * that even large retroactive edits spanning many days remain performant.
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
      } else {
        // Persistence failed — queue the edit for background retry (Requirements 10.2)
        addToOfflineQueue(userId, {
          kind: 'update',
          payload: {
            transactionId: id,
            amount: data.amount,
            category: data.category,
            type: data.type,
            date: data.date,
            note: data.note,
          },
        })
        // Optimistically update local state so the user sees their change
        if (oldTx) {
          setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
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
      } else {
        // Persistence failed — queue the delete for background retry (Requirements 10.2)
        addToOfflineQueue(userId, {
          kind: 'delete',
          payload: { transactionId: id },
        })
        // Optimistically remove from local state
        setTransactions(prev => prev.filter(t => t.id !== id))
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
    
    // Capture the balance before the edit so we can log a manual balance change
    // to the contribution history (task 158.2).
    const previousBalance = savingsAccounts.find(a => a.id === id)?.balance
    
    try {
      const result = await updateSavingsAccountApi(userId, id, data)
      
      if (result) {
        setSavingsAccounts(prev => prev.map(a => a.id === id ? result : a))
        // If the balance was edited directly, record the net change so the
        // account's history reflects manual balance updates too.
        if (data.balance !== undefined && previousBalance !== undefined) {
          const delta = result.balance - previousBalance
          if (delta !== 0) recordContribution(id, delta, result.balance)
        }
      }
      
      return result
    } catch (err) {
      console.error('Error updating savings account:', err)
      return null
    }
  }, [userId, savingsAccounts])
  
  /**
   * Delete a savings account
   */
  const deleteSavingsAccountFn = useCallback(async (id: string) => {
    if (!userId) return false
    
    try {
      const success = await deleteSavingsAccountApi(userId, id)
      
      if (success) {
        setSavingsAccounts(prev => prev.filter(a => a.id !== id))
        // Clean up locally-stored contribution history so orphaned entries
        // don't accumulate (task 158.2).
        clearContributionHistory(id)
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
        // Record the contribution locally so it appears in the account's
        // per-account contribution history (task 158.2).
        recordContribution(id, amount, result.balance)
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
  
  // ── Disbursement Mutations (localStorage-only) ────────────────────────
  /**
   * Add a new disbursement and persist to localStorage.
   */
  const addDisbursement = useCallback((data: Omit<Disbursement, 'id'>) => {
    const newDisbursement: Disbursement = { ...data, id: generateDisbursementId() }
    setDisbursements(prev => {
      const updated = [...prev, newDisbursement]
      saveDisbursements(updated)
      return updated
    })
    return newDisbursement
  }, [])

  /**
   * Remove a disbursement by ID and persist to localStorage.
   */
  const removeDisbursement = useCallback((id: string) => {
    setDisbursements(prev => {
      const updated = prev.filter(d => d.id !== id)
      saveDisbursements(updated)
      return updated
    })
  }, [])

  // ── Funding Source Mutations ───────────────────────────────────
  /**
   * Add a new funding source
   */
  const addFundingSource = useCallback(async (data: {
    label: string
    emoji: string
    kind: FundingSource['kind']
    reducesBalanceNow: boolean
  }): Promise<FundingSource | null> => {
    if (!userId) return null
    
    try {
      const result = await createFundingSourceApi(userId, data)
      
      if (result) {
        setFundingSources(prev => [...prev, result])
      }
      
      return result
    } catch (err) {
      console.error('Error creating funding source:', err)
      return null
    }
  }, [userId])
  
  /**
   * Update an existing funding source
   */
  const updateFundingSourceFn = useCallback(async (
    id: string,
    updates: {
      label?: string
      emoji?: string
      kind?: FundingSource['kind']
      reducesBalanceNow?: boolean
      snapshotBalance?: number
    }
  ): Promise<FundingSource | null> => {
    if (!userId) return null
    
    try {
      const result = await updateFundingSourceApi(userId, id, updates)
      
      if (result) {
        setFundingSources(prev => prev.map(s => s.id === id ? result : s))
      }
      
      return result
    } catch (err) {
      console.error('Error updating funding source:', err)
      return null
    }
  }, [userId])
  
  /**
   * Delete a funding source
   */
  const deleteFundingSourceFn = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false
    
    try {
      const success = await deleteFundingSourceApi(userId, id)
      
      if (success) {
        setFundingSources(prev => prev.filter(s => s.id !== id))
      }
      
      return success
    } catch (err) {
      console.error('Error deleting funding source:', err)
      return false
    }
  }, [userId])
  
  /**
   * Update just the snapshot balance for a funding source (inline editing).
   */
  const updateFundingSourceBalanceFn = useCallback(async (
    id: string,
    snapshotBalance: number
  ): Promise<FundingSource | null> => {
    if (!userId) return null

    try {
      const result = await updateFundingSourceBalanceApi(userId, id, snapshotBalance)

      if (result) {
        setFundingSources(prev => prev.map(s => s.id === id ? result : s))
      }

      return result
    } catch (err) {
      console.error('Error updating funding source balance:', err)
      return null
    }
  }, [userId])

  // ── Income Smoothing Mutation ──────────────────────────────────
  /**
   * Persist a new income-smoothing preference and update state.
   * Uses localStorage as the persistence layer (no dedicated Supabase table).
   * Pass `null` to clear the preference and revert to `current_month` behaviour.
   */
  const setIncomeSmoothing = useCallback((preference: IncomeSmoothing | null) => {
    if (preference === null) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(INCOME_SMOOTHING_KEY)
        } catch {
          // Silently fail if storage is unavailable
        }
      }
    } else {
      saveIncomeSmoothingPreference(preference)
    }
    setIncomeSmoothingState(preference)
  }, [])

  // ── Spending Mode Mutation ─────────────────────────────────────
  /**
   * Persist a new spending-mode preference and update state.
   * Uses localStorage as the persistence layer (no dedicated Supabase table).
   * The mode never blocks logging — it is a display preference only.
   */
  const setSpendingModeFn = useCallback((mode: SpendingMode) => {
    saveSpendingModePreference(mode)
    setSpendingModeState(mode)
  }, [])

  // ── Hero Meaning Mutation ──────────────────────────────────────
  /**
   * Persist a new hero-meaning preference and update state.
   * Uses localStorage as the persistence layer.
   * Controls which metric is shown as the large hero number.
   */
  const setHeroMeaningFn = useCallback((meaning: HeroMeaning) => {
    saveHeroMeaningPreference(meaning)
    setHeroMeaningState(meaning)
  }, [])

  // ── Over-limit Response Mutation ───────────────────────────────
  /**
   * Persist a new over-limit response preference and update state.
   * Uses localStorage as the persistence layer.
   * Controls what the UI shows when the user exceeds their daily allowance.
   */
  const setOverLimitResponseFn = useCallback((response: OverLimitResponse) => {
    setOverLimitResponsePref(response)
    setOverLimitResponseState(response)
  }, [])

  // ── Rhythm Weights (Task 164.1) ────────────────────────────────
  // Memoize the rhythm model — only recompute when transactions or currentDay change.
  // This learns the user's weekly spending pattern from their history.
  const rhythmWeights = useMemo(() => {
    if (transactions.length === 0) return null
    return computeRhythmWeights(transactions, currentDay)
  }, [transactions, currentDay])

  // ── Memoized Computations ──────────────────────────────────────
  /**
   * Daily allowance calculation (memoized)
   * Requirement 13.2: Only recalculate when budgets or transactions change
   * Requirement 14.2: Use income-based estimation when no budgets are configured
   * Task 82: When countCreditImmediately is false, filter spending by settlement type
   *
   * RETROACTIVE CORRECTNESS (Task 89.2):
   * This useMemo recomputes whenever `transactions` changes — including when a
   * transaction's date is edited retroactively. Because `computeDailyAllowance`
   * is a pure batch computation (expected vs actual spend over a date range),
   * any backdated edit automatically produces the correct today-number without
   * needing per-day recomputation. The dependency array below guarantees that
   * ALL mutation paths (add, update date, delete) trigger recomputation.
   */
  const allowance = useMemo<DailyAllowance | null>(() => {
    if (budgets.length === 0 && transactions.length === 0 && !isLoading) {
      // Task 66: Brand-new user with zero setup — provide a sensible fallback
      // daily allowance ($50/day, ~$1500/month) so the app delivers value
      // immediately. The number is clearly marked as estimated with a gentle
      // prompt to personalize. This replaces the old null/empty state that
      // showed $0 and felt broken.
      const FALLBACK_DAILY = 50
      return {
        amount: FALLBACK_DAILY,
        dailyBudget: FALLBACK_DAILY,
        spentToday: 0,
        rollover: 0,
        status: 'healthy' as const,
        message: "You're all set — start logging when you spend something.",
        showCelebration: false,
        isEstimated: true,
        incomeSource: 'estimate' as const,
      }
    }
    
    // Calculate monthly income from this month's income transactions
    const currentMonth = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}`
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
    
    // Task 82: Get user's credit spending preference (defaults to true)
    const countCreditImmediately = userProfile?.countCreditImmediately ?? true

    // Task 210.3: Parse setupDate so mid-month logic divides by remaining days
    const setupDate = userProfile?.setupDate ? new Date(userProfile.setupDate + 'T00:00:00') : undefined
    
    return computeDailyAllowance(
      budgets,
      transactions,
      currentDay,
      (monthlyIncome ?? 0) + computeActiveDisbursementBonus(disbursements, currentDay),
      allFixedExpenses,
      setupDate,
      incomeSmoothing ?? undefined,
      undefined, // carryoverEnabled
      countCreditImmediately,
      fundingSources,
      paySchedule,   // Task 103.1: pass pay schedule for payday-aligned budget periods
      transactions,  // Task 103.1: income history for irregular cadence estimation
      termSchedule,  // Task 121.1: term schedule for semester-based budget periods
      rhythmWeights  // Task 164.1: weekly spending rhythm weights
    )
  }, [budgets, transactions, debts, sinkingFunds, disbursements, incomeSmoothing, isLoading, currentDay, userProfile?.countCreditImmediately, userProfile?.setupDate, fundingSources, paySchedule, termSchedule, rhythmWeights])
  
  // ── Cache Write Effect ─────────────────────────────────────────
  // Update localStorage cache whenever allowance/transactions/budgets change
  // (covers all mutation triggers: add/delete/update transaction, budget changes, refresh)
  //
  // CONSISTENCY GUARANTEE:
  // The cached allowance is always the output of `computeDailyAllowance` with the
  // same inputs as the live calculation. On next app open, the cached value is shown
  // immediately; when fresh data arrives (reconciliation), the live calculation
  // replaces it. If inputs haven't changed, the output is identical (deterministic
  // guarantee from the pure function). React's useMemo ensures that if reconciled
  // data produces the same allowance, no re-render occurs — the hero stays stable
  // with no jarring jumps.
  useEffect(() => {
    if (!userId || isLoading || !allowance) return
    setHomeCache(userId, { allowance, transactions, budgets })
  }, [userId, allowance, transactions, budgets, isLoading])
  
  // ── Widget Sync Effect ─────────────────────────────────────────
  // Push updated allowance data to the service worker for the PWA widget.
  // Mirrors the cache write — fires whenever allowance recalculates.
  // Task 114.1: Glanceable widgets and notifications
  useEffect(() => {
    if (!allowance || isLoading) return
    syncWidgetData(allowance)
  }, [allowance, isLoading])
  
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
   * Reconciled "money set aside" breakdown — the single source of truth that
   * maps all four features (allocation buckets, sinking funds, goals, emergency
   * fund) into one model. Computed once here and reused everywhere via props;
   * no surface should re-derive its own set-aside totals.
   * See `src/lib/setAside.ts` for the full mental model.
   */
  const setAside = useMemo<SetAsideBreakdown>(() => {
    const asIncomeAllocations: IncomeAllocation[] = allocations.map(a => ({
      spend: a.spend,
      save: a.save,
      invest: a.invest,
      setAside: a.setAside,
    }))
    return computeSetAside({
      allocations: asIncomeAllocations,
      sinkingFunds,
      goals,
      now: currentDay,
    })
  }, [allocations, sinkingFunds, goals, currentDay])

  /**
   * Headline "set aside this month" number (flow): allocation buckets +
   * sinking-fund monthly reserves. Derived from the single breakdown above.
   */
  const totalSetAside = setAside.reservedThisMonth
  
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
  
  /**
   * Weekend allowance quick-view (memoized)
   * Computes "safe to spend this weekend" only when allowance changes.
   */
  const weekendAllowance = useMemo<WeekendAllowanceResult | null>(() => {
    if (!allowance) return null
    return computeWeekendAllowance(allowance.dailyBudget, transactions, new Date())
  }, [allowance, transactions])

  /**
   * Term allowance quick-view (memoized)
   * Computes "make this last until end of term" daily number.
   */
  const termAllowance = useMemo<TermAllowanceResult | null>(() => {
    if (!termSchedule || !allowance) return null
    // Use the monthly pool (dailyBudget * AVG_DAYS_PER_MONTH) as the monthlyPool param
    // This gives us the monthly equivalent that termAllowance will scale to the full term
    const monthlyPool = allowance.dailyBudget * 30.44
    return computeTermAllowance(termSchedule, transactions, monthlyPool, currentDay)
  }, [termSchedule, allowance, transactions, currentDay])

  /**
   * Persist a new term schedule and update state.
   */
  const setTermSchedule = useCallback((schedule: TermSchedule | null) => {
    setTermScheduleState(schedule)
    saveTermSchedule(schedule)
  }, [])

  /**
   * Active spend-down plan result (memoized)
   * Computes the result for the first active plan, or null when none active.
   */
  const activeSpendDown = useMemo<SpendDownResult | null>(() => {
    if (spendDownPlans.length === 0) return null
    for (const plan of spendDownPlans) {
      if (isSpendDownActive(plan, currentDay)) {
        return computeSpendDown(plan, transactions, currentDay)
      }
    }
    return null
  }, [spendDownPlans, transactions, currentDay])

  /**
   * Time horizon stats (memoized)
   * Computes multi-horizon secondary stats: weekend, payday, term.
   */
  const timeHorizonStats = useMemo<TimeHorizonStats>(() => {
    const discretionaryAvailable = allowance ? allowance.amount : 0
    return computeTimeHorizonStats(
      weekendAllowance,
      paySchedule,
      termAllowance,
      discretionaryAvailable,
      transactions,
      currentDay
    )
  }, [weekendAllowance, paySchedule, termAllowance, allowance, transactions, currentDay])

  /**
   * Add a new spend-down plan (persisted to localStorage).
   */
  const addSpendDownPlan = useCallback((data: Omit<SpendDownPlan, 'id'>): SpendDownPlan => {
    const plan: SpendDownPlan = { ...data, id: generateSpendDownId() }
    setSpendDownPlans(prev => {
      const next = [...prev, plan]
      saveSpendDownPlans(next)
      return next
    })
    return plan
  }, [])

  /**
   * Remove a spend-down plan by ID (persisted to localStorage).
   */
  const removeSpendDownPlan = useCallback((id: string): void => {
    setSpendDownPlans(prev => {
      const next = prev.filter(p => p.id !== id)
      saveSpendDownPlans(next)
      return next
    })
  }, [])

  /**
   * Update an existing spend-down plan (persisted to localStorage).
   */
  const updateSpendDownPlan = useCallback((id: string, updates: Partial<SpendDownPlan>): void => {
    setSpendDownPlans(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p)
      saveSpendDownPlans(next)
      return next
    })
  }, [])
  
  // ── Return Hook Interface ──────────────────────────────────────
  return {
    // Core data
    transactions,
    budgets,
    goals,
    lessonProgress,
    savingsAccounts,
    paySchedule,
    incomeSmoothing,
    spendingMode,
    heroMeaning,
    fundingSources,
    
    // Computed values (memoized)
    allowance,
    weekendAllowance,
    termAllowance,
    timeHorizonStats,
    categoryRows,
    totalSetAside,
    setAside,
    totalSavingsBalance,
    savingsRate,
    
    // Loading state
    isLoading,
    isSyncing,
    isStale,
    
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
    
    // Funding source mutations
    addFundingSource,
    updateFundingSource: updateFundingSourceFn,
    updateFundingSourceBalance: updateFundingSourceBalanceFn,
    deleteFundingSource: deleteFundingSourceFn,
    
    // Direct state setters (for advanced optimistic updates)
    setTransactions,
    setBudgets,
    setGoals,
    setDisbursementBonus,
    disbursements,
    addDisbursement,
    removeDisbursement,
    setIncomeSmoothing,
    setSpendingMode: setSpendingModeFn,
    setHeroMeaning: setHeroMeaningFn,
    overLimitResponse,
    setOverLimitResponse: setOverLimitResponseFn,
    termSchedule,
    setTermSchedule,
    activeSpendDown,
    spendDownPlans,
    addSpendDownPlan,
    removeSpendDownPlan,
    updateSpendDownPlan,
  }
}
