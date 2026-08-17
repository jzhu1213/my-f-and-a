import { supabase } from './supabaseClient'
import type { 
  Transaction, 
  UserProfile, 
  Budget, 
  Goal, 
  UserLessonProgress,
  TransactionCategory,
  TransactionType,
  AccountType,
} from '@/types'
import type { SavingsAccount, SavingsAccountType, Debt, DebtType } from '@/types/folio'
import type { IncomeAllocation } from '@/types/folio'
import type { SinkingFund } from './sinkingFunds'
import type { PaySchedule, PayCadence } from './paySchedule'
import type { ActiveSession } from './sessionManagement'
import type { BudgetPeriodPreference } from './budgetPeriod'
import { getTotalDaysInPeriod } from './budgetPeriod'
import type { TermSchedule } from './termSchedule'

import type { OnboardingPath, UserPriority } from '@/types'

// ============================================
// DATABASE TYPES (matching Supabase schema)
// ============================================

interface DbTransaction {
  id: string
  user_id: string
  date: string
  type: 'income' | 'expense'
  amount: number
  category: string
  note?: string
  is_recurring?: boolean
  recurring_id?: string
  account_type: string
  created_at: string
  funding_source_id?: string
}

interface DbProfile {
  id: string
  name?: string
  email?: string
  user_type?: string
  priority?: string
  has_completed_onboarding?: boolean
  display_name?: string
  avatar_url?: string
  created_at: string
  count_credit_immediately?: boolean
  setup_date?: string
  onboarding_path?: string | null
  onboarding_completed_steps?: string[] | null
  onboarding_skipped_steps?: string[] | null
  handle?: string | null
  discoverable?: boolean
}

interface DbBudget {
  id: string
  user_id: string
  category: string
  monthly_limit: number
  spent: number
  month: string
}

interface DbGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  emoji: string
  created_at: string
  target_date?: string | null
  linked_account_id?: string | null
  is_shared?: boolean | null
  share_token?: string | null
}

interface DbGoalParticipant {
  id: string
  goal_id: string
  participant_user_id?: string | null
  name: string
  contributed_amount: number
  joined_at: string
}

interface DbLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  quiz_score?: number
  completed_at?: string
}

interface DbSavingsAccount {
  id: string
  user_id: string
  type: string
  name: string
  balance: number
  monthly_contribution: number
  expected_annual_return: number
  created_at: string
}

interface DbDebt {
  id: string
  user_id: string
  type: string
  name: string
  balance: number
  apr: number
  minimum_payment: number
  created_at: string
}

interface DbSinkingFund {
  id: string
  user_id: string
  label: string
  category: string
  target_amount: number
  due_date: string | null
  saved_amount: number
  monthly_reserve: number
  created_at: string
}

interface DbAllocation {
  id: string
  user_id: string
  date: string
  spend: number
  save: number
  invest: number
  set_aside: number
  created_at: string
}

interface DbPaySchedule {
  id: string
  user_id: string
  cadence: string
  anchor_date: string
  amount?: number | null
  created_at: string
}

// ============================================
// TYPE CONVERTERS
// ============================================

function dbTransactionToApp(db: DbTransaction): Transaction {
  return {
    id: db.id,
    userId: db.user_id,
    date: db.date,
    type: db.type,
    amount: db.amount,
    category: db.category as TransactionCategory,
    note: db.note,
    isRecurring: db.is_recurring,
    recurringId: db.recurring_id,
    accountType: (db.account_type || 'personal') as AccountType,
    createdAt: db.created_at,
    fundingSourceId: db.funding_source_id,
  }
}

function dbProfileToApp(db: DbProfile): UserProfile {
  return {
    id: db.id,
    email: db.email || '',
    name: db.name || 'User',
    userType: (db.user_type || 'student') as UserProfile['userType'],
    priority: (db.priority || 'save') as UserProfile['priority'],
    hasCompletedOnboarding: db.has_completed_onboarding || false,
    displayName: db.display_name,
    avatarUrl: db.avatar_url,
    createdAt: db.created_at,
    countCreditImmediately: db.count_credit_immediately,
    setupDate: db.setup_date,
    onboardingPath: (db.onboarding_path as OnboardingPath) ?? null,
    onboardingCompletedSteps: db.onboarding_completed_steps ?? [],
    onboardingSkippedSteps: db.onboarding_skipped_steps ?? [],
    handle: db.handle ?? null,
    discoverable: db.discoverable ?? false,
  }
}

function dbBudgetToApp(db: DbBudget): Budget {
  // Gracefully read optional columns that may not exist in the DB schema yet.
  // Cast through unknown to avoid TS errors for fields not in DbBudget interface.
  const row = db as unknown as Record<string, unknown>
  return {
    id: db.id,
    userId: db.user_id,
    category: db.category as TransactionCategory,
    monthlyLimit: db.monthly_limit,
    spent: db.spent,
    month: db.month,
    ...(row.period != null ? { period: row.period as 'monthly' | 'weekly' | 'payday_aligned' } : {}),
    ...(row.per_transaction_alert != null && typeof row.per_transaction_alert === 'number'
      ? { perTransactionAlert: row.per_transaction_alert }
      : {}),
  }
}

function dbGoalToApp(db: DbGoal): Goal {
  return {
    id: db.id,
    userId: db.user_id,
    name: db.name,
    targetAmount: db.target_amount,
    currentAmount: db.current_amount,
    emoji: db.emoji,
    createdAt: db.created_at,
    ...(db.target_date ? { targetDate: db.target_date } : {}),
    ...(db.linked_account_id ? { linkedAccountId: db.linked_account_id } : {}),
    ...(db.is_shared ? { isShared: true } : {}),
    ...(db.share_token ? { shareToken: db.share_token } : {}),
  }
}

function dbGoalParticipantToApp(db: DbGoalParticipant): import('@/types').GoalParticipant {
  return {
    id: db.id,
    name: db.name,
    contributedAmount: Number(db.contributed_amount),
    joinedAt: db.joined_at,
  }
}

function dbProgressToApp(db: DbLessonProgress): UserLessonProgress {
  return {
    id: db.id,
    userId: db.user_id,
    lessonId: db.lesson_id,
    completed: db.completed,
    quizScore: db.quiz_score,
    completedAt: db.completed_at,
  }
}

function dbSavingsAccountToApp(db: DbSavingsAccount): SavingsAccount {
  return {
    id: db.id,
    userId: db.user_id,
    type: db.type as SavingsAccountType,
    name: db.name,
    balance: db.balance,
    monthlyContribution: db.monthly_contribution,
    expectedAnnualReturn: db.expected_annual_return,
    createdAt: db.created_at,
  }
}

function dbSinkingFundToApp(db: DbSinkingFund): SinkingFund {
  return {
    id: db.id,
    userId: db.user_id,
    label: db.label,
    category: db.category as TransactionCategory,
    targetAmount: db.target_amount,
    dueDate: db.due_date ?? '',
    savedAmount: db.saved_amount,
    monthlyReserve: db.monthly_reserve,
    createdAt: db.created_at,
  }
}

function dbDebtToApp(db: DbDebt): Debt {
  return {
    id: db.id,
    userId: db.user_id,
    type: db.type as DebtType,
    name: db.name,
    balance: db.balance,
    apr: db.apr,
    minimumPayment: db.minimum_payment,
    createdAt: db.created_at,
  }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

export async function getCurrentUser(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    if (error.code === 'PGRST116') {
      // Profile doesn't exist, create one
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          name: user.user_metadata?.name || 'User',
          email: user.email,
        })
      
      if (insertError) {
        console.error('Error creating profile:', insertError)
        return null
      }
      
      return {
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.name || 'User',
        userType: 'student',
        priority: 'save',
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        handle: null,
        discoverable: false,
      }
    }
    return null
  }

  const appProfile = dbProfileToApp(profile)
  return { ...appProfile, email: user.email ?? '' }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { name }
    }
  })

  if (data.user && !error) {
    await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        name,
        email,
      })
  }

  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// ============================================
// TRANSACTION FUNCTIONS
// ============================================

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }

  return (data || []).map(dbTransactionToApp)
}

export async function getMonthTransactions(userId: string, month: string): Promise<Transaction[]> {
  const [year, monthNum] = month.split('-').map(Number)
  const nextMonth = monthNum === 12 ? `${year + 1}-01` : `${year}-${String(monthNum + 1).padStart(2, '0')}`
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', `${month}-01`)
    .lt('date', `${nextMonth}-01`)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching month transactions:', error)
    return []
  }

  return (data || []).map(dbTransactionToApp)
}

export async function insertTransaction(
  userId: string, 
  tx: {
    date: string
    amount: number
    type: TransactionType
    category: TransactionCategory
    note?: string
    isRecurring?: boolean
    accountType?: AccountType
    fundingSourceId?: string
  }
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      note: tx.note ?? null,
      is_recurring: tx.isRecurring ?? false,
      account_type: tx.accountType ?? 'personal',
      ...(tx.fundingSourceId ? { funding_source_id: tx.fundingSourceId } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting transaction:', error)
    return null
  }

  return dbTransactionToApp(data)
}

export async function updateTransaction(
  userId: string,
  txId: string,
  updates: {
    date: string
    amount: number
    type: TransactionType
    category: TransactionCategory
    note?: string
  }
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      date: updates.date,
      amount: updates.amount,
      type: updates.type,
      category: updates.category,
      note: updates.note ?? null,
    })
    .eq('id', txId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating transaction:', error)
    return null
  }

  return dbTransactionToApp(data)
}

export async function deleteTransaction(userId: string, txId: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting transaction:', error)
    return false
  }

  return true
}

// ============================================
// BUDGET FUNCTIONS
// ============================================

export async function getBudgets(userId: string): Promise<Budget[]> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)

  if (error) {
    console.error('Error fetching budgets:', error)
    return []
  }

  return (data || []).map(dbBudgetToApp)
}

/**
 * On the first load of a new month, copies budget limits from the most recent
 * previous month into the current month so users don't have to re-enter them.
 * Only runs when the current month has no limits set yet; already-tracked
 * `spent` values for the current month are preserved.
 *
 * EXTENDED (Task 343.2): When a non-monthly budgetPeriod is provided, the
 * carried-forward limits are pro-rated to the period length:
 * - Weekly: monthlyLimit / 4.33
 * - Biweekly: monthlyLimit / (30.44 / 14) ≈ monthlyLimit / 2.17
 * - Term: monthlyLimit * (termDays / 30.44)
 *
 * For monthly periods (or when no budgetPeriod is provided), behavior stays
 * exactly the same (backward compatible).
 */
export async function carryForwardBudgetLimits(
  userId: string,
  budgetPeriod?: BudgetPeriodPreference | null,
  termSchedule?: TermSchedule | null
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7)

  // Fetch all current-month records
  const { data: current } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)

  const hasLimits = (current || []).some((b: DbBudget) => b.monthly_limit > 0)
  if (hasLimits) return // This month already has limits — nothing to do

  // Find the most recent previous month that has limits
  const { data: previous } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .lt('month', currentMonth)
    .gt('monthly_limit', 0)
    .order('month', { ascending: false })
    .limit(20) // enough to cover all categories in the most recent month

  if (!previous || previous.length === 0) return // No prior limits to carry

  const mostRecentMonth = (previous as DbBudget[])[0].month
  const prevBudgets = (previous as DbBudget[]).filter(b => b.month === mostRecentMonth)

  // Build a lookup of current-month spent amounts to preserve them
  const currentByCategory: Record<string, DbBudget> = {}
  ;(current || []).forEach((b: DbBudget) => { currentByCategory[b.category] = b })

  // Compute the pro-ration factor for non-monthly periods (Task 343.2)
  const AVG_DAYS_PER_MONTH = 30.44
  const proRationFactor = computeProRationFactor(budgetPeriod ?? null, termSchedule ?? null, AVG_DAYS_PER_MONTH)

  for (const prev of prevBudgets) {
    if (prev.monthly_limit <= 0) continue

    // Apply pro-ration for non-monthly periods
    const adjustedLimit = Math.round(prev.monthly_limit * proRationFactor * 100) / 100

    const existing = currentByCategory[prev.category]

    if (existing) {
      // Record exists — only update the limit, preserve spent
      await supabase
        .from('budgets')
        .update({ monthly_limit: adjustedLimit })
        .eq('id', existing.id)
    } else {
      // No record yet — insert with carried limit and 0 spent
      await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          category: prev.category,
          monthly_limit: adjustedLimit,
          spent: 0,
          month: currentMonth,
        })
    }
  }
}

/**
 * Compute the pro-ration factor for budget carry-forward based on period type.
 *
 * - monthly (or null): factor = 1.0 (no change)
 * - weekly: factor = 1 / 4.33 ≈ 0.231
 * - biweekly: factor = 14 / 30.44 ≈ 0.46
 * - term: factor = termDays / 30.44
 *
 * @internal
 */
function computeProRationFactor(
  budgetPeriod: BudgetPeriodPreference | null,
  termSchedule: TermSchedule | null,
  avgDaysPerMonth: number
): number {
  if (!budgetPeriod || budgetPeriod.type === 'monthly') return 1.0

  const totalDays = getTotalDaysInPeriod(budgetPeriod, new Date(), termSchedule)

  if (totalDays === null) {
    // Fallback if period context can't be computed
    switch (budgetPeriod.type) {
      case 'weekly': return 7 / avgDaysPerMonth
      case 'biweekly': return 14 / avgDaysPerMonth
      case 'term': return 1.0 // Can't determine term length — no pro-ration
      default: return 1.0
    }
  }

  return totalDays / avgDaysPerMonth
}

export async function upsertBudget(
  userId: string,
  category: TransactionCategory,
  monthlyLimit: number,
  spent?: number,
  options?: {
    period?: 'monthly' | 'weekly' | 'payday_aligned'
    perTransactionAlert?: number
  }
): Promise<Budget | null> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // If spent is not provided, fetch current spent value
  let currentSpent = spent ?? 0
  if (spent === undefined) {
    const { data: existing } = await supabase
      .from('budgets')
      .select('spent')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('month', currentMonth)
      .single()
    
    if (existing) {
      currentSpent = existing.spent
    }
  }

  // Build the upsert payload — only include optional columns when provided
  // so we don't overwrite existing DB values with undefined/null unexpectedly.
  const payload: Record<string, unknown> = {
    user_id: userId,
    category,
    monthly_limit: monthlyLimit,
    spent: currentSpent,
    month: currentMonth,
  }
  if (options?.period !== undefined) {
    payload.period = options.period
  }
  if (options?.perTransactionAlert !== undefined) {
    payload.per_transaction_alert = options.perTransactionAlert > 0 ? options.perTransactionAlert : null
  }
  
  const { data, error } = await supabase
    .from('budgets')
    .upsert(payload, {
      onConflict: 'user_id,category,month'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting budget:', error)
    return null
  }

  return dbBudgetToApp(data)
}

export async function updateBudgetSpent(
  userId: string,
  category: TransactionCategory,
  spentAmount: number
): Promise<Budget | null> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // Get existing budget or create one
  const { data: existing } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('month', currentMonth)
    .single()
  
  if (existing) {
    // Update spent amount
    const { data, error } = await supabase
      .from('budgets')
      .update({ spent: spentAmount })
      .eq('id', existing.id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating budget spent:', error)
      return null
    }
    
    return dbBudgetToApp(data)
  } else {
    // Create new budget with spent amount
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: userId,
        category,
        monthly_limit: 0,
        spent: spentAmount,
        month: currentMonth,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating budget:', error)
      return null
    }
    
    return dbBudgetToApp(data)
  }
}

// ============================================
// GOAL FUNCTIONS
// ============================================

export async function getGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('Error fetching goals:', error)
    return []
  }

  const goals = (data || []).map(dbGoalToApp)

  // Fetch participants for any shared goals
  const sharedGoalIds = goals.filter(g => g.isShared).map(g => g.id)
  if (sharedGoalIds.length > 0) {
    const { data: participants } = await supabase
      .from('goal_participants')
      .select('*')
      .in('goal_id', sharedGoalIds)
      .order('joined_at', { ascending: true })

    if (participants && participants.length > 0) {
      const participantsByGoal = new Map<string, import('@/types').GoalParticipant[]>()
      for (const p of participants) {
        const list = participantsByGoal.get(p.goal_id) || []
        list.push(dbGoalParticipantToApp(p))
        participantsByGoal.set(p.goal_id, list)
      }
      for (const goal of goals) {
        if (participantsByGoal.has(goal.id)) {
          goal.participants = participantsByGoal.get(goal.id)
        }
      }
    }
  }

  return goals
}

export async function createGoal(
  userId: string,
  goal: { name: string; targetAmount: number; emoji: string; targetDate?: string; linkedAccountId?: string }
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: 0,
      emoji: goal.emoji,
      ...(goal.targetDate ? { target_date: goal.targetDate } : {}),
      ...(goal.linkedAccountId ? { linked_account_id: goal.linkedAccountId } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating goal:', error)
    return null
  }

  return dbGoalToApp(data)
}

export async function updateGoalProgress(
  userId: string,
  goalId: string,
  amount: number
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .update({ current_amount: amount })
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    return null
  }

  return dbGoalToApp(data)
}

export async function updateGoal(
  userId: string,
  goalId: string,
  updates: { name: string; targetAmount: number; emoji: string; targetDate?: string; linkedAccountId?: string }
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .update({
      name: updates.name,
      target_amount: updates.targetAmount,
      emoji: updates.emoji,
      target_date: updates.targetDate || null,
      linked_account_id: updates.linkedAccountId || null,
    })
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    return null
  }

  return dbGoalToApp(data)
}

export async function deleteGoal(
  userId: string,
  goalId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting goal:', error)
    return false
  }

  return true
}

// ============================================
// SHARED GOAL FUNCTIONS
// ============================================

/**
 * Enable sharing on a goal: sets is_shared = true and generates a share_token.
 * Returns the share token string, or null on failure.
 */
export async function enableGoalSharing(
  userId: string,
  goalId: string
): Promise<string | null> {
  // Generate token client-side so we can return it immediately
  const token = crypto.randomUUID()

  const { error } = await supabase
    .from('goals')
    .update({ is_shared: true, share_token: token })
    .eq('id', goalId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error enabling goal sharing:', error)
    return null
  }

  return token
}

/**
 * Revoke sharing on a goal: sets is_shared = false and clears the share_token.
 */
export async function disableGoalSharing(
  userId: string,
  goalId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('goals')
    .update({ is_shared: false, share_token: null })
    .eq('id', goalId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error disabling goal sharing:', error)
    return false
  }

  return true
}

/**
 * Check if a goal is shared by reading the is_shared column.
 */
export async function checkGoalShared(goalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('goals')
    .select('is_shared')
    .eq('id', goalId)
    .single()

  if (error || !data) return false
  return !!data.is_shared
}

/**
 * Get the share token for a goal.
 */
export async function getGoalShareToken(goalId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('share_token')
    .eq('id', goalId)
    .single()

  if (error || !data) return null
  return data.share_token ?? null
}

/**
 * Fetch a goal by its share token (for invite link access).
 */
export async function getGoalByShareToken(token: string): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single()

  if (error || !data) return null
  return dbGoalToApp(data)
}

/**
 * Add a participant to a shared goal.
 * participant_user_id is optional (null for name-only/unlinked participants).
 */
export async function addGoalParticipant(
  goalId: string,
  name: string,
  participantUserId?: string | null
): Promise<import('@/types').GoalParticipant | null> {
  const { data, error } = await supabase
    .from('goal_participants')
    .insert({
      goal_id: goalId,
      name: name.trim() || 'Participant',
      ...(participantUserId ? { participant_user_id: participantUserId } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding goal participant:', error)
    return null
  }

  return dbGoalParticipantToApp(data)
}

/**
 * Remove a participant from a shared goal.
 */
export async function removeGoalParticipant(
  goalId: string,
  participantId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('goal_participants')
    .delete()
    .eq('id', participantId)
    .eq('goal_id', goalId)

  if (error) {
    console.error('Error removing goal participant:', error)
    return false
  }

  return true
}

/**
 * Record a contribution for a participant (adds amount to existing contributed_amount).
 */
export async function recordGoalParticipantContribution(
  goalId: string,
  participantId: string,
  amount: number
): Promise<import('@/types').GoalParticipant | null> {
  if (amount <= 0) return null

  // Fetch current amount first
  const { data: current, error: fetchError } = await supabase
    .from('goal_participants')
    .select('contributed_amount')
    .eq('id', participantId)
    .eq('goal_id', goalId)
    .single()

  if (fetchError || !current) {
    console.error('Error fetching participant:', fetchError)
    return null
  }

  const newAmount = Number(current.contributed_amount) + amount

  const { data, error } = await supabase
    .from('goal_participants')
    .update({ contributed_amount: newAmount })
    .eq('id', participantId)
    .eq('goal_id', goalId)
    .select()
    .single()

  if (error) {
    console.error('Error recording contribution:', error)
    return null
  }

  return dbGoalParticipantToApp(data)
}

/**
 * Get all participants for a shared goal.
 */
export async function getGoalParticipants(
  goalId: string
): Promise<import('@/types').GoalParticipant[]> {
  const { data, error } = await supabase
    .from('goal_participants')
    .select('*')
    .eq('goal_id', goalId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching goal participants:', error)
    return []
  }

  return (data || []).map(dbGoalParticipantToApp)
}

// ============================================
// LESSON PROGRESS FUNCTIONS
// ============================================

export async function getLessonProgress(userId: string): Promise<UserLessonProgress[]> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching lesson progress:', error)
    return []
  }

  return (data || []).map(dbProgressToApp)
}

export async function updateLessonProgress(
  userId: string,
  lessonId: string,
  quizScore: number
): Promise<UserLessonProgress | null> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      quiz_score: quizScore,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,lesson_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error updating lesson progress:', error)
    return null
  }

  return dbProgressToApp(data)
}

// ============================================
// PROFILE PREFERENCES FUNCTIONS
// ============================================

export async function updateProfilePreferences(
  userId: string,
  preferences: {
    displayName?: string
    avatarUrl?: string
    countCreditImmediately?: boolean
    setupDate?: string
    onboardingPath?: OnboardingPath
    onboardingCompletedSteps?: string[]
    onboardingSkippedSteps?: string[]
    hasCompletedOnboarding?: boolean
    priority?: UserPriority
    handle?: string | null
    discoverable?: boolean
  }
): Promise<UserProfile | null> {
  const updates: Record<string, any> = {}
  if (preferences.displayName !== undefined) {
    updates.display_name = preferences.displayName
  }
  if (preferences.avatarUrl !== undefined) {
    updates.avatar_url = preferences.avatarUrl
  }
  if (preferences.countCreditImmediately !== undefined) {
    updates.count_credit_immediately = preferences.countCreditImmediately
  }
  if (preferences.setupDate !== undefined) {
    updates.setup_date = preferences.setupDate
  }
  if (preferences.onboardingPath !== undefined) {
    updates.onboarding_path = preferences.onboardingPath
  }
  if (preferences.onboardingCompletedSteps !== undefined) {
    updates.onboarding_completed_steps = preferences.onboardingCompletedSteps
  }
  if (preferences.onboardingSkippedSteps !== undefined) {
    updates.onboarding_skipped_steps = preferences.onboardingSkippedSteps
  }
  if (preferences.hasCompletedOnboarding !== undefined) {
    updates.has_completed_onboarding = preferences.hasCompletedOnboarding
  }
  if (preferences.priority !== undefined) {
    updates.priority = preferences.priority
  }
  if (preferences.handle !== undefined) {
    updates.handle = preferences.handle
  }
  if (preferences.discoverable !== undefined) {
    updates.discoverable = preferences.discoverable
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile preferences:', error)
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  const appProfile = dbProfileToApp(data)
  return { ...appProfile, email: user?.email ?? '' }
}


// ============================================
// ALLOCATION FUNCTIONS
// ============================================

/** App-level allocation record */
export interface AppAllocation {
  id: string
  userId: string
  date: string
  spend: number
  save: number
  invest: number
  setAside: number
  createdAt: string
}

function dbAllocationToApp(db: DbAllocation): AppAllocation {
  return {
    id: db.id,
    userId: db.user_id,
    date: db.date,
    spend: db.spend,
    save: db.save,
    invest: db.invest,
    setAside: db.set_aside,
    createdAt: db.created_at,
  }
}

/**
 * Insert an income allocation record.
 */
export async function insertAllocation(
  userId: string,
  allocation: IncomeAllocation,
  date?: string
): Promise<AppAllocation | null> {
  const { data, error } = await supabase
    .from('allocations')
    .insert({
      user_id: userId,
      date: date ?? new Date().toISOString().slice(0, 10),
      spend: allocation.spend,
      save: allocation.save,
      invest: allocation.invest,
      set_aside: allocation.setAside,
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting allocation:', error)
    return null
  }

  return dbAllocationToApp(data)
}

/**
 * Get all allocations for a user within a given month (YYYY-MM format).
 */
export async function getMonthAllocations(
  userId: string,
  month: string
): Promise<AppAllocation[]> {
  const [year, monthNum] = month.split('-').map(Number)
  const nextMonth = monthNum === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNum + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('allocations')
    .select('*')
    .eq('user_id', userId)
    .gte('date', `${month}-01`)
    .lt('date', `${nextMonth}-01`)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching month allocations:', error)
    return []
  }

  return (data || []).map(dbAllocationToApp)
}

// ============================================
// SAVINGS ACCOUNT FUNCTIONS
// ============================================

export async function getSavingsAccounts(userId: string): Promise<SavingsAccount[]> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching savings accounts:', error)
    return []
  }

  return (data || []).map(dbSavingsAccountToApp)
}

export async function createSavingsAccount(
  userId: string,
  account: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }
): Promise<SavingsAccount | null> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({
      user_id: userId,
      type: account.type,
      name: account.name,
      balance: account.balance,
      monthly_contribution: account.monthlyContribution,
      expected_annual_return: account.expectedAnnualReturn,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating savings account:', error)
    return null
  }

  return dbSavingsAccountToApp(data)
}

export async function updateSavingsAccount(
  userId: string,
  id: string,
  updates: {
    type?: SavingsAccountType
    name?: string
    balance?: number
    monthlyContribution?: number
    expectedAnnualReturn?: number
  }
): Promise<SavingsAccount | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.type !== undefined) dbUpdates.type = updates.type
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance
  if (updates.monthlyContribution !== undefined) dbUpdates.monthly_contribution = updates.monthlyContribution
  if (updates.expectedAnnualReturn !== undefined) dbUpdates.expected_annual_return = updates.expectedAnnualReturn

  const { data, error } = await supabase
    .from('savings_accounts')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating savings account:', error)
    return null
  }

  return dbSavingsAccountToApp(data)
}

export async function deleteSavingsAccount(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from('savings_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting savings account:', error)
    return false
  }

  return true
}

export async function updateSavingsAccountBalance(
  userId: string,
  id: string,
  amount: number
): Promise<SavingsAccount | null> {
  // First fetch the current balance
  const { data: current, error: fetchError } = await supabase
    .from('savings_accounts')
    .select('balance')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !current) {
    console.error('Error fetching savings account balance:', fetchError)
    return null
  }

  const newBalance = current.balance + amount

  const { data, error } = await supabase
    .from('savings_accounts')
    .update({ balance: newBalance })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating savings account balance:', error)
    return null
  }

  return dbSavingsAccountToApp(data)
}

// ============================================
// DEBT CRUD
// ============================================

export async function getDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching debts:', error)
    return []
  }

  return (data || []).map(dbDebtToApp)
}

export async function createDebt(
  userId: string,
  debt: {
    type: DebtType
    name: string
    balance: number
    apr: number
    minimumPayment: number
  }
): Promise<Debt | null> {
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userId,
      type: debt.type,
      name: debt.name,
      balance: debt.balance,
      apr: debt.apr,
      minimum_payment: debt.minimumPayment,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating debt:', error)
    return null
  }

  return dbDebtToApp(data)
}

export async function updateDebt(
  userId: string,
  id: string,
  updates: {
    type?: DebtType
    name?: string
    balance?: number
    apr?: number
    minimumPayment?: number
  }
): Promise<Debt | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.type !== undefined) dbUpdates.type = updates.type
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance
  if (updates.apr !== undefined) dbUpdates.apr = updates.apr
  if (updates.minimumPayment !== undefined) dbUpdates.minimum_payment = updates.minimumPayment

  const { data, error } = await supabase
    .from('debts')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating debt:', error)
    return null
  }

  return dbDebtToApp(data)
}

export async function deleteDebt(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting debt:', error)
    return false
  }

  return true
}

// ============================================
// SINKING FUND CRUD
// ============================================

export async function getSinkingFunds(userId: string): Promise<SinkingFund[]> {
  const { data, error } = await supabase
    .from('sinking_funds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sinking funds:', error)
    return []
  }

  return (data || []).map(dbSinkingFundToApp)
}

export async function createSinkingFund(
  userId: string,
  fund: {
    label: string
    category: TransactionCategory
    targetAmount: number
    dueDate: string
    savedAmount: number
    monthlyReserve: number
  }
): Promise<SinkingFund | null> {
  const { data, error } = await supabase
    .from('sinking_funds')
    .insert({
      user_id: userId,
      label: fund.label,
      category: fund.category,
      target_amount: fund.targetAmount,
      due_date: fund.dueDate || null,
      saved_amount: fund.savedAmount,
      monthly_reserve: fund.monthlyReserve,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating sinking fund:', error)
    return null
  }

  return dbSinkingFundToApp(data)
}

export async function updateSinkingFund(
  userId: string,
  id: string,
  updates: {
    label?: string
    category?: TransactionCategory
    targetAmount?: number
    dueDate?: string
    savedAmount?: number
    monthlyReserve?: number
  }
): Promise<SinkingFund | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.label !== undefined) dbUpdates.label = updates.label
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.targetAmount !== undefined) dbUpdates.target_amount = updates.targetAmount
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null
  if (updates.savedAmount !== undefined) dbUpdates.saved_amount = updates.savedAmount
  if (updates.monthlyReserve !== undefined) dbUpdates.monthly_reserve = updates.monthlyReserve

  const { data, error } = await supabase
    .from('sinking_funds')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating sinking fund:', error)
    return null
  }

  return dbSinkingFundToApp(data)
}

export async function deleteSinkingFund(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from('sinking_funds')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting sinking fund:', error)
    return false
  }

  return true
}

// ============================================
// PAY SCHEDULE FUNCTIONS
// ============================================

function dbPayScheduleToApp(db: DbPaySchedule): PaySchedule {
  return {
    cadence: (db.cadence || 'irregular') as PayCadence,
    anchorDate: db.anchor_date,
    amount: db.amount ?? undefined,
  }
}

/**
 * Get the user's saved pay schedule, or null if none has been set yet.
 * Returns null (rather than throwing) when no row exists so callers can fall
 * back to a flexible default.
 */
export async function getPaySchedule(userId: string): Promise<PaySchedule | null> {
  const { data, error } = await supabase
    .from('pay_schedules')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // PGRST116 = no rows found; that's an expected "not set yet" state.
    if (error.code !== 'PGRST116') {
      console.error('Error fetching pay schedule:', error)
    }
    return null
  }

  return dbPayScheduleToApp(data)
}

/**
 * Create or update the user's pay schedule (one schedule per user).
 * Follows the existing upsert-on-user pattern used elsewhere in this module.
 */
export async function upsertPaySchedule(
  userId: string,
  schedule: PaySchedule
): Promise<PaySchedule | null> {
  const { data, error } = await supabase
    .from('pay_schedules')
    .upsert({
      user_id: userId,
      cadence: schedule.cadence,
      anchor_date: schedule.anchorDate,
      amount: schedule.amount ?? null,
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting pay schedule:', error)
    return null
  }

  return dbPayScheduleToApp(data)
}

// ============================================
// REIMBURSEMENT / IOU FUNCTIONS
// ============================================

import type { Reimbursement, ReimbursementDirection } from '@/lib/reimbursements'

interface DbReimbursement {
  id: string
  user_id: string
  person_name: string
  direction: string
  amount: number
  note: string
  settled: boolean
  settled_at: string | null
  created_at: string
  linked_transaction_id?: string | null
  settled_via_source_id?: string | null
  /** ISO 4217 code the IOU is denominated in (task 426.1) */
  currency?: string | null
  /** Exchange rate at IOU creation time (task 426.1) */
  exchange_rate?: number | null
  /** Amount in the original foreign currency (task 426.1) */
  original_amount?: number | null
}

function dbReimbursementToApp(db: DbReimbursement): Reimbursement {
  return {
    id: db.id,
    userId: db.user_id,
    personName: db.person_name,
    direction: db.direction as ReimbursementDirection,
    amount: db.amount,
    note: db.note || '',
    settled: db.settled,
    settledAt: db.settled_at,
    createdAt: db.created_at,
    linkedTransactionId: db.linked_transaction_id ?? undefined,
    settledViaSourceId: db.settled_via_source_id ?? undefined,
    ...(db.currency ? { currency: db.currency } : {}),
    ...(db.exchange_rate != null ? { exchangeRate: db.exchange_rate } : {}),
    ...(db.original_amount != null ? { originalAmount: db.original_amount } : {}),
  }
}

export async function getReimbursements(userId: string): Promise<Reimbursement[]> {
  const { data, error } = await supabase
    .from('reimbursements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reimbursements:', error)
    return []
  }

  return (data || []).map(dbReimbursementToApp)
}

export async function createReimbursement(
  userId: string,
  iou: {
    personName: string
    direction: ReimbursementDirection
    amount: number
    note?: string
    linkedTransactionId?: string
    /** ISO 4217 code the IOU is denominated in (task 426.1) */
    currency?: string
    /** Exchange rate at IOU creation time (task 426.1) */
    exchangeRate?: number
    /** Amount in the original foreign currency (task 426.1) */
    originalAmount?: number
  }
): Promise<Reimbursement | null> {
  const { data, error } = await supabase
    .from('reimbursements')
    .insert({
      user_id: userId,
      person_name: iou.personName.trim(),
      direction: iou.direction,
      amount: iou.amount,
      note: iou.note?.trim() ?? '',
      settled: false,
      settled_at: null,
      ...(iou.linkedTransactionId ? { linked_transaction_id: iou.linkedTransactionId } : {}),
      ...(iou.currency ? { currency: iou.currency } : {}),
      ...(iou.exchangeRate != null ? { exchange_rate: iou.exchangeRate } : {}),
      ...(iou.originalAmount != null ? { original_amount: iou.originalAmount } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating reimbursement:', error)
    return null
  }

  return dbReimbursementToApp(data)
}

export async function settleReimbursement(
  userId: string,
  id: string,
  fundingSourceId?: string
): Promise<Reimbursement | null> {
  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      settled: true,
      settled_at: new Date().toISOString(),
      ...(fundingSourceId ? { settled_via_source_id: fundingSourceId } : {}),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error settling reimbursement:', error)
    return null
  }

  return dbReimbursementToApp(data)
}

export async function unsettleReimbursement(
  userId: string,
  id: string
): Promise<Reimbursement | null> {
  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      settled: false,
      settled_at: null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error unsettling reimbursement:', error)
    return null
  }

  return dbReimbursementToApp(data)
}

/**
 * Settle all unsettled IOUs for a given person, optionally recording the funding source.
 * Returns the settled reimbursements or empty array on failure.
 */
export async function settleAllForPerson(
  userId: string,
  iouIds: string[],
  fundingSourceId?: string
): Promise<Reimbursement[]> {
  if (iouIds.length === 0) return []

  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      settled: true,
      settled_at: new Date().toISOString(),
      ...(fundingSourceId ? { settled_via_source_id: fundingSourceId } : {}),
    })
    .in('id', iouIds)
    .eq('user_id', userId)
    .select()

  if (error) {
    console.error('Error settling all for person:', error)
    return []
  }

  return (data || []).map(dbReimbursementToApp)
}

export async function deleteReimbursement(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from('reimbursements')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting reimbursement:', error)
    return false
  }

  return true
}

// ============================================
// FUNDING SOURCE FUNCTIONS
// ============================================

import type { FundingSource, FundingSourceKind } from '@/lib/fundingSources'

interface DbFundingSource {
  id: string
  user_id: string
  label: string
  emoji: string
  kind: string
  reduces_balance_now: boolean
  snapshot_balance: number | null
  created_at: string
}

function dbFundingSourceToApp(db: DbFundingSource): FundingSource {
  return {
    id: db.id,
    userId: db.user_id,
    label: db.label,
    emoji: db.emoji,
    kind: db.kind as FundingSourceKind,
    reducesBalanceNow: db.reduces_balance_now,
    snapshotBalance: db.snapshot_balance ?? 0,
    createdAt: db.created_at,
  }
}

export async function getFundingSources(userId: string): Promise<FundingSource[]> {
  const { data, error } = await supabase
    .from('funding_sources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching funding sources:', error)
    return []
  }

  return (data || []).map(dbFundingSourceToApp)
}

export async function createFundingSource(
  userId: string,
  source: {
    label: string
    emoji: string
    kind: FundingSourceKind
    reducesBalanceNow: boolean
    snapshotBalance?: number
  }
): Promise<FundingSource | null> {
  const { data, error } = await supabase
    .from('funding_sources')
    .insert({
      user_id: userId,
      label: source.label,
      emoji: source.emoji,
      kind: source.kind,
      reduces_balance_now: source.reducesBalanceNow,
      snapshot_balance: source.snapshotBalance ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating funding source:', error)
    return null
  }

  return dbFundingSourceToApp(data)
}

export async function updateFundingSource(
  userId: string,
  id: string,
  updates: {
    label?: string
    emoji?: string
    kind?: FundingSourceKind
    reducesBalanceNow?: boolean
    snapshotBalance?: number
  }
): Promise<FundingSource | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.label !== undefined) dbUpdates.label = updates.label
  if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji
  if (updates.kind !== undefined) dbUpdates.kind = updates.kind
  if (updates.reducesBalanceNow !== undefined) dbUpdates.reduces_balance_now = updates.reducesBalanceNow
  if (updates.snapshotBalance !== undefined) dbUpdates.snapshot_balance = updates.snapshotBalance

  const { data, error } = await supabase
    .from('funding_sources')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating funding source:', error)
    return null
  }

  return dbFundingSourceToApp(data)
}

export async function deleteFundingSource(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from('funding_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting funding source:', error)
    return false
  }

  return true
}

/**
 * Update just the snapshot balance for a funding source.
 * Used for inline-editing the user's starting balance.
 */
export async function updateFundingSourceBalance(
  userId: string,
  id: string,
  snapshotBalance: number
): Promise<FundingSource | null> {
  const { data, error } = await supabase
    .from('funding_sources')
    .update({ snapshot_balance: snapshotBalance })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating funding source balance:', error)
    return null
  }

  return dbFundingSourceToApp(data)
}

// ============================================
// ACCOUNT & DATA DELETION (GDPR / CCPA) — task 191.1
// ============================================

/**
 * Every Supabase table that holds user-owned rows, in a delete-safe order
 * (children before anything they might reference). All rows are scoped by the
 * authenticated user's id, so Supabase RLS keeps the delete confined to the
 * signed-in person's own data.
 *
 * Phase 7 social tables are listed BEFORE existing tables so that child tables
 * (e.g. goal_participants) are deleted before their parents (goals). Social
 * tables with cross-user references (friendships, split_participants,
 * pool_members, goal_participants) are handled specially before this loop —
 * see the "detach to name-only" logic in deleteAllUserData.
 */
const USER_DATA_TABLES = [
  // Phase 7 social tables — children/dependents first
  'notifications',
  'split_participants',
  'splits',
  'pool_entries',
  'pool_members',
  'pools',
  'goal_participants',
  'share_links',
  // Original tables
  'transactions',
  'reimbursements',
  'allocations',
  'sinking_funds',
  'savings_accounts',
  'debts',
  'funding_sources',
  'pay_schedules',
  'goals',
  'budgets',
  'lesson_progress',
  'user_sessions',
] as const

export interface DeleteAllUserDataResult {
  /** True when every table (and the profile row) was cleared without error. */
  success: boolean
  /** Table names that were successfully cleared. */
  deletedTables: string[]
  /** Human-readable error, present only when success is false. */
  error?: string
}

/**
 * Permanently delete every piece of data Folio stores about a user across all
 * tables, then the profile row. This is the GDPR/CCPA "delete everything"
 * primitive behind the Privacy & Data dashboard (task 191.1).
 *
 * Notes:
 *   • Each delete is scoped by user id, so RLS keeps it to the caller's data.
 *   • Deleting the auth user itself requires a service-role key and is handled
 *     separately (best-effort) — data removal here is the durable guarantee.
 *   • Idempotent: deleting rows that don't exist is a no-op, not an error.
 */
export async function deleteAllUserData(userId: string): Promise<DeleteAllUserDataResult> {
  if (!userId) {
    return { success: false, deletedTables: [], error: 'Missing user id' }
  }

  const deletedTables: string[] = []

  // -----------------------------------------------------------------------
  // Phase 7 social tables: "detach to name-only" for cross-user rows.
  //
  // Some social tables have rows where the user appears as a participant but
  // is NOT the owner. Deleting those rows would orphan the owner's records.
  // Instead, we null out the user link so the row degrades to a name-only
  // reference (the participant name text is preserved for the owner's context).
  //
  // Similarly, friendships uses requester_id/addressee_id (not user_id), so
  // the generic .eq('user_id', userId) pattern won't find them — we need
  // explicit delete calls for both columns.
  // -----------------------------------------------------------------------

  // Detach: split_participants where this user is a participant (not owner).
  // Sets participant_user_id to null so the split owner's record stays intact.
  const { error: detachSplitParts } = await supabase
    .from('split_participants')
    .update({ participant_user_id: null })
    .eq('participant_user_id', userId)

  if (detachSplitParts) {
    console.error('Error detaching split_participants:', detachSplitParts)
    return {
      success: false,
      deletedTables,
      error: "Couldn't detach your split participation records — please try again.",
    }
  }

  // Detach: pool_members where this user appears as a member (not owner).
  // Sets user_id to null so the pool owner's roster stays intact.
  const { error: detachPoolMembers } = await supabase
    .from('pool_members')
    .update({ user_id: null })
    .eq('user_id', userId)

  if (detachPoolMembers) {
    console.error('Error detaching pool_members:', detachPoolMembers)
    return {
      success: false,
      deletedTables,
      error: "Couldn't detach your pool membership records — please try again.",
    }
  }

  // Detach: goal_participants where this user appears as a participant.
  // Sets participant_user_id to null so the goal owner's record stays intact.
  const { error: detachGoalParts } = await supabase
    .from('goal_participants')
    .update({ participant_user_id: null })
    .eq('participant_user_id', userId)

  if (detachGoalParts) {
    console.error('Error detaching goal_participants:', detachGoalParts)
    return {
      success: false,
      deletedTables,
      error: "Couldn't detach your goal participation records — please try again.",
    }
  }

  // Delete friendships: uses requester_id / addressee_id (no user_id column).
  // The user may appear as either party, so we need two delete passes.
  const { error: delFriendReq } = await supabase
    .from('friendships')
    .delete()
    .eq('requester_id', userId)

  if (delFriendReq) {
    console.error('Error deleting friendships (as requester):', delFriendReq)
    return {
      success: false,
      deletedTables,
      error: "Couldn't remove your friend connections — please try again.",
    }
  }

  const { error: delFriendAddr } = await supabase
    .from('friendships')
    .delete()
    .eq('addressee_id', userId)

  if (delFriendAddr) {
    console.error('Error deleting friendships (as addressee):', delFriendAddr)
    return {
      success: false,
      deletedTables,
      error: "Couldn't remove your friend connections — please try again.",
    }
  }

  deletedTables.push('friendships (detached + deleted)')

  // -----------------------------------------------------------------------
  // Main loop: delete all user-owned rows from every table via .eq('user_id').
  // Tables where the user is only a participant (not owner) were already
  // handled above via the detach logic. The loop below catches rows the user
  // OWNS (e.g. their own splits, pools, notifications, share_links).
  // -----------------------------------------------------------------------

  for (const table of USER_DATA_TABLES) {
    // Determine the correct user-scoping column for each table.
    // Most tables use 'user_id'; Phase 7 tables vary:
    //   - splits, pools: use 'owner_id'
    //   - pool_entries: use 'added_by'
    //   - split_participants, goal_participants: deleted via CASCADE from parent
    //     table deletion (splits/goals), so we skip direct deletion here.
    //     The detach logic above already handled the user-as-participant case.
    const skipCascadeTables = ['split_participants', 'goal_participants']
    if (skipCascadeTables.includes(table)) {
      deletedTables.push(table)
      continue
    }

    let userColumn: string
    if (table === 'splits' || table === 'pools') {
      userColumn = 'owner_id'
    } else if (table === 'pool_entries') {
      userColumn = 'added_by'
    } else {
      userColumn = 'user_id'
    }

    const { error } = await supabase.from(table).delete().eq(userColumn, userId)

    if (error) {
      console.error(`Error deleting ${table}:`, error)
      return {
        success: false,
        deletedTables,
        error: `Couldn't remove your ${table.replace(/_/g, ' ')} just now. Nothing else was deleted — please try again.`,
      }
    }

    deletedTables.push(table)
  }

  // Profile row is keyed by id (not user_id).
  const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId)

  if (profileError) {
    console.error('Error deleting profile:', profileError)
    return {
      success: false,
      deletedTables,
      error: "Your records were cleared, but we couldn't remove your profile. Please try again.",
    }
  }

  deletedTables.push('profiles')

  return { success: true, deletedTables }
}

// ============================================
// ACTIVE SESSIONS (device list + revoke) — task 192.1
// ============================================

/** Row shape for the additive `user_sessions` table (see sessionManagement.ts). */
interface DbUserSession {
  id: string
  user_id: string
  device_id: string
  label: string
  user_agent: string | null
  created_at: string
  last_seen_at: string
}

/**
 * Record — or refresh — the current device's session row. Upserts on
 * (user_id, device_id) so each device keeps a single, stable row and we simply
 * bump `last_seen_at` on each cold open. Best-effort and non-throwing: if the
 * table hasn't been created yet, this quietly no-ops so the app never breaks.
 */
export async function registerSession(
  userId: string,
  device: { deviceId: string; label: string; userAgent?: string }
): Promise<boolean> {
  if (!userId || !device.deviceId) return false
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from('user_sessions')
    .upsert(
      {
        user_id: userId,
        device_id: device.deviceId,
        label: device.label,
        user_agent: device.userAgent ?? null,
        last_seen_at: nowIso,
      },
      { onConflict: 'user_id,device_id' }
    )

  if (error) {
    // Table may not exist on older backends — additive feature, fail quietly.
    console.warn('registerSession skipped:', error.message)
    return false
  }
  return true
}

/**
 * List the active sessions for a user, newest activity first, flagging the
 * current device. Returns an empty array (never throws) when the table is
 * missing so the caller can fall back to a locally-synthesized current device.
 */
export async function getActiveSessions(
  userId: string,
  currentDeviceId: string
): Promise<ActiveSession[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })

  if (error) {
    console.warn('getActiveSessions skipped:', error.message)
    return []
  }

  return (data as DbUserSession[]).map((row) => ({
    deviceId: row.device_id,
    label: row.label,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    isCurrent: row.device_id === currentDeviceId,
  }))
}

/**
 * Remove a single device's session row from the registry (revoke it from the
 * visible list). Scoped by user id so RLS confines it to the caller's data.
 */
export async function revokeSession(userId: string, deviceId: string): Promise<boolean> {
  if (!userId || !deviceId) return false
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId)

  if (error) {
    console.error('Error revoking session:', error)
    return false
  }
  return true
}

/**
 * Remove every session row *except* the current device — paired with the auth
 * "sign out other devices" call so the visible list matches reality.
 */
export async function revokeOtherSessions(
  userId: string,
  currentDeviceId: string
): Promise<boolean> {
  if (!userId || !currentDeviceId) return false
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('device_id', currentDeviceId)

  if (error) {
    console.error('Error revoking other sessions:', error)
    return false
  }
  return true
}

/**
 * The hard security guarantee: invalidate every *other* device's refresh token
 * via Supabase auth (the current device stays signed in). This is the reliable
 * revoke that the session list's "Sign out all other devices" action performs.
 */
export async function signOutOtherSessions(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  return { error }
}
