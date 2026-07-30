// Folio - User Types
export type UserType = 'student' | 'gig_worker' | 'small_business'
export type UserPriority = 'avoid_overdraft' | 'pay_debt' | 'save' | 'learn_investing'

export interface UserProfile {
  id: string
  email: string
  name: string
  userType: UserType
  priority: UserPriority
  hasCompletedOnboarding: boolean
  createdAt: string
  displayName?: string
  avatarUrl?: string
  countCreditImmediately?: boolean
}

// Transaction Types
export type TransactionType = 'income' | 'expense'

export type TransactionCategory = 
  | 'food'
  | 'rent'
  | 'transport'
  | 'school'
  | 'fun'
  | 'gig'
  | 'income'
  | 'other'

export interface Transaction {
  id: string
  userId: string
  /**
   * The financial/effective date of the transaction (YYYY-MM-DD).
   * This is the date the transaction OCCURRED — set by the user via the date
   * picker (defaulting to today). All financial calculations (daily allowance,
   * rollover, budget spent) use this field, NOT `createdAt`.
   *
   * A backdated transaction (e.g., logged today for last Tuesday) will have
   * `date` = last Tuesday and `createdAt` = today's timestamp.
   */
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  note?: string
  isRecurring?: boolean
  recurringId?: string
  accountType: AccountType
  /**
   * Timestamp of when the transaction was logged in the app (ISO string).
   * Used for audit trails and "logged late" indicators, NOT for financial math.
   */
  createdAt: string
  fundingSourceId?: string
  /**
   * True when the transaction's `date` is in the future relative to when it
   * was logged. Scheduled transactions are excluded from today's spend and
   * auto-realize when their date arrives (the pure date-based computation
   * handles this naturally — no explicit transition needed).
   */
  scheduled?: boolean
}

// Account Types (3 buckets)
export type AccountType = 'personal' | 'gig' | 'savings'

export interface Account {
  id: string
  userId: string
  type: AccountType
  name: string
  balance: number
  icon: string
}

// Budget Types
export interface Budget {
  id: string
  userId: string
  category: TransactionCategory
  monthlyLimit: number
  spent: number
  month: string // YYYY-MM
  isFixed?: boolean // marks this budget category as a fixed/recurring obligation
  /**
   * Controls the messaging intensity for this category's limit.
   * - `'soft'` (default): informational target — gentle nudges, standard colors
   * - `'hard'`: user wants a firmer signal — earlier "approaching" messaging
   *   (at 70% instead of 80%) and a more prominent progress bar color.
   *
   * Never actually blocks logging — this is a UX preference only.
   */
  limitType?: 'soft' | 'hard'
  /**
   * The budget period for `monthlyLimit`.
   * - `'monthly'` (default): `monthlyLimit` is a calendar-month amount.
   * - `'weekly'`: `monthlyLimit` is treated as a *weekly* amount directly.
   *   Monthly equivalent = monthlyLimit × 4.33.
   * - `'payday_aligned'`: the budget period runs from one payday to the next
   *   instead of calendar-month boundaries. The daily allowance is divided by
   *   the number of days in the current pay cycle.
   *
   * Absent/undefined behaves identically to `'monthly'` (fully backward-compatible).
   */
  period?: 'monthly' | 'weekly' | 'payday_aligned'
  /**
   * Optional per-transaction alert threshold (in dollars).
   * When a single expense for this category exceeds this amount,
   * a gentle one-line nudge is surfaced — never blocking.
   * `undefined` or `0` means disabled.
   */
  perTransactionAlert?: number
}

export const BUDGET_CATEGORIES: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: '🍔', label: 'Food' },
  { category: 'rent', emoji: '🏠', label: 'Rent' },
  { category: 'transport', emoji: '🚌', label: 'Transport' },
  { category: 'school', emoji: '📚', label: 'School' },
  { category: 'fun', emoji: '🎉', label: 'Social' },
  { category: 'other', emoji: '📦', label: 'Other' },
]

export const TRANSACTION_CATEGORIES: { category: TransactionCategory; emoji: string; label: string; type: TransactionType }[] = [
  { category: 'food', emoji: '🍔', label: 'Food', type: 'expense' },
  { category: 'rent', emoji: '🏠', label: 'Rent', type: 'expense' },
  { category: 'transport', emoji: '🚌', label: 'Transport', type: 'expense' },
  { category: 'school', emoji: '📚', label: 'School', type: 'expense' },
  { category: 'fun', emoji: '🎉', label: 'Social', type: 'expense' },
  { category: 'other', emoji: '📦', label: 'Other', type: 'expense' },
  { category: 'income', emoji: '⚡', label: 'Other Pay', type: 'income' },
  { category: 'income', emoji: '💵', label: 'Paycheck', type: 'income' },
]

// Goal Types
export type GoalType = 'savings' | 'emergency_fund'

export interface Goal {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  emoji: string
  createdAt: string
  /** Optional goal classification; defaults to 'savings' when absent */
  type?: GoalType
  /** Optional target date (ISO date string, e.g. "2025-09-01") for reaching the goal */
  targetDate?: string
}

// Finance Lesson Types

// Topic grouping so lessons can be organized by subject area.
export type LessonTopic =
  | 'budgeting'
  | 'saving'      // savings / Roth / IRA accounts
  | 'credit'      // credit cards
  | 'investing'   // investing fundamentals
  | 'stocks'      // stocks specifically
  | 'loans'       // loans / bonds

// Friendly metadata for each topic, used for grouping and display.
export const LESSON_TOPICS: { topic: LessonTopic; emoji: string; label: string }[] = [
  { topic: 'budgeting', emoji: '📊', label: 'Budgeting' },
  { topic: 'saving', emoji: '🏦', label: 'Saving' },
  { topic: 'credit', emoji: '💳', label: 'Credit' },
  { topic: 'investing', emoji: '📈', label: 'Investing' },
  { topic: 'stocks', emoji: '📉', label: 'Stocks' },
  { topic: 'loans', emoji: '🧾', label: 'Loans & Bonds' },
]

export interface Lesson {
  id: string
  title: string
  description: string
  content: string // 3 paragraphs max
  example: string // College student example
  quizQuestions: QuizQuestion[]
  topic: LessonTopic // Topic grouping for organizing lessons
  actionLink?: string // Links to Accounting tab feature
  order: number
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export interface UserLessonProgress {
  id: string
  userId: string
  lessonId: string
  completed: boolean
  quizScore?: number
  completedAt?: string
}

// Smart Insights Types
export type InsightType = 
  | 'safe_to_spend'
  | 'spending_increase'
  | 'income_pattern'
  | 'under_budget'
  | 'recurring_suggestion'

export interface SmartInsight {
  id: string
  type: InsightType
  title: string
  description: string
  actionLabel?: string
  actionType?: 'adjust_budget' | 'set_goal' | 'make_recurring' | 'reward'
  value?: number
  category?: TransactionCategory
}



// Calculator Types
export interface CreditPayoffResult {
  monthsToPayoff: number
  totalInterest: number
  totalPaid: number
  monthlyPayment: number
}

export interface CompoundGrowthResult {
  finalAmount: number
  totalContributions: number
  totalInterest: number
  yearlyBreakdown: { year: number; balance: number }[]
}

// Export Folio Simplification types
export * from './folio'
