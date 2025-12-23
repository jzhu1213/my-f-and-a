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
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  note?: string
  isRecurring?: boolean
  recurringId?: string
  accountType: AccountType
  createdAt: string
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
}

export const BUDGET_CATEGORIES: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: '🍕', label: 'Food' },
  { category: 'rent', emoji: '🏠', label: 'Rent' },
  { category: 'transport', emoji: '🚗', label: 'Transport' },
  { category: 'school', emoji: '📚', label: 'School' },
  { category: 'fun', emoji: '🎮', label: 'Fun' },
  { category: 'other', emoji: '💼', label: 'Other' },
]

export const TRANSACTION_CATEGORIES: { category: TransactionCategory; emoji: string; label: string; type: TransactionType }[] = [
  { category: 'food', emoji: '🍕', label: 'Food', type: 'expense' },
  { category: 'rent', emoji: '🏠', label: 'Rent', type: 'expense' },
  { category: 'transport', emoji: '🚗', label: 'Transport', type: 'expense' },
  { category: 'school', emoji: '📚', label: 'School', type: 'expense' },
  { category: 'fun', emoji: '🎮', label: 'Fun', type: 'expense' },
  { category: 'other', emoji: '💼', label: 'Other', type: 'expense' },
  { category: 'gig', emoji: '💼', label: 'Gig', type: 'income' },
  { category: 'income', emoji: '📈', label: 'Income', type: 'income' },
]

// Goal Types
export interface Goal {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  emoji: string
  createdAt: string
}

// Finance Lesson Types
export interface Lesson {
  id: string
  title: string
  description: string
  content: string // 3 paragraphs max
  example: string // College student example
  quizQuestions: QuizQuestion[]
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

// Onboarding Types
export interface OnboardingData {
  userType: UserType | null
  priority: UserPriority | null
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
