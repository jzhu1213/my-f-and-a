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
    .limit(100)

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

export async function upsertBudget(
  userId: string,
  category: TransactionCategory,
  monthlyLimit: number
): Promise<Budget | null> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      user_id: userId,
      category,
      monthly_limit: monthlyLimit,
      spent: 0,
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
