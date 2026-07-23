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
  }
}

function dbBudgetToApp(db: DbBudget): Budget {
  return {
    id: db.id,
    userId: db.user_id,
    category: db.category as TransactionCategory,
    monthlyLimit: db.monthly_limit,
    spent: db.spent,
    month: db.month,
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
 */
export async function carryForwardBudgetLimits(userId: string): Promise<void> {
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

  for (const prev of prevBudgets) {
    if (prev.monthly_limit <= 0) continue
    const existing = currentByCategory[prev.category]

    if (existing) {
      // Record exists — only update the limit, preserve spent
      await supabase
        .from('budgets')
        .update({ monthly_limit: prev.monthly_limit })
        .eq('id', existing.id)
    } else {
      // No record yet — insert with carried limit and 0 spent
      await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          category: prev.category,
          monthly_limit: prev.monthly_limit,
          spent: 0,
          month: currentMonth,
        })
    }
  }
}

export async function upsertBudget(
  userId: string,
  category: TransactionCategory,
  monthlyLimit: number,
  spent?: number
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
  
  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      user_id: userId,
      category,
      monthly_limit: monthlyLimit,
      spent: currentSpent,
      month: currentMonth,
    }, {
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

  return (data || []).map(dbGoalToApp)
}

export async function createGoal(
  userId: string,
  goal: { name: string; targetAmount: number; emoji: string }
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: 0,
      emoji: goal.emoji,
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
  updates: { name: string; targetAmount: number; emoji: string }
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .update({
      name: updates.name,
      target_amount: updates.targetAmount,
      emoji: updates.emoji,
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
  preferences: { displayName?: string; avatarUrl?: string }
): Promise<UserProfile | null> {
  const updates: Record<string, any> = {}
  if (preferences.displayName !== undefined) {
    updates.display_name = preferences.displayName
  }
  if (preferences.avatarUrl !== undefined) {
    updates.avatar_url = preferences.avatarUrl
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
