// ============================================================================
// Folio — Money-Container Taxonomy
// ============================================================================
//
// Folio tracks money through three distinct concepts. Each serves a different
// purpose and lives in its own domain:
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Concept         │ Purpose                         │ Source              │
// ├─────────────────┼─────────────────────────────────┼─────────────────────┤
// │ FundingSource   │ HOW you pay (debit, cash,       │ src/lib/            │
// │                 │ credit, wallet, borrowed)       │   fundingSources.ts │
// │                 │ Linked to transactions via      │                     │
// │                 │ `fundingSourceId`. Determines   │                     │
// │                 │ whether a payment settles       │                     │
// │                 │ immediately or is deferred.     │                     │
// ├─────────────────┼─────────────────────────────────┼─────────────────────┤
// │ SavingsAccount  │ WHERE long-term money grows     │ src/types/folio.ts  │
// │                 │ (HYSA, Roth IRA, 401k,         │                     │
// │                 │ brokerage). Tracks balance      │                     │
// │                 │ appreciation over time with     │                     │
// │                 │ monthly contributions and       │                     │
// │                 │ expected returns.               │                     │
// ├─────────────────┼─────────────────────────────────┼─────────────────────┤
// │ LinkedAccount   │ An EXTERNAL bank/card account   │ src/types/folio.ts  │
// │                 │ optionally connected via Plaid. │                     │
// │                 │ Behind feature flag; Folio is   │                     │
// │                 │ fully usable without any linked │                     │
// │                 │ accounts.                       │                     │
// └─────────────────┴─────────────────────────────────┴─────────────────────┘
//
// The legacy `Account` interface below is DEPRECATED — it was an early generic
// abstraction that was never instantiated. `AccountType` on Transaction is a
// vestigial field that always defaults to 'personal'.
//
// See also: docs/DATA-MODEL.md for the full persistence layer mapping.
// ============================================================================

// Folio - User Types
export type UserType = 'student' | 'gig_worker' | 'small_business'
export type UserPriority = 'avoid_overdraft' | 'pay_debt' | 'save' | 'learn_investing'

/**
 * Canonical goal type covering all goals a user can express during onboarding.
 * Unifies the old narrow `OnboardingResult.primaryGoal` values with the broader
 * `UserPriority` values into one comprehensive enum.
 */
export type UserGoal = 'save' | 'track_spending' | 'reduce_spending' | 'avoid_overdraft' | 'pay_debt' | 'learn_investing'

/** The onboarding path the user selected (or null if not yet chosen) */
export type OnboardingPath = 'express' | 'preset' | 'paycheck' | 'minimal' | null

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
  setupDate?: string
  /** Which onboarding path the user chose (task 211.1) */
  onboardingPath?: OnboardingPath
  /** Steps the user completed during onboarding (task 211.1) */
  onboardingCompletedSteps?: string[]
  /** Steps the user skipped during onboarding (task 211.1) */
  onboardingSkippedSteps?: string[]
  /** Unique public handle for discovery (task 277.1) */
  handle?: string | null
  /** Whether this profile is visible in public search (task 277.1) */
  discoverable?: boolean
}

// Transaction Types
export type TransactionType = 'income' | 'expense'

export type TransactionCategory = 
  | 'food'
  | 'drinks'
  | 'rent'
  | 'transport'
  | 'school'
  | 'fun'
  | 'health'
  | 'subscriptions'
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
  /**
   * Vestigial field from an early 3-bucket account model. In all current code
   * paths this is hardcoded to `'personal'` — the `'gig'` and `'savings'`
   * values are never assigned. Retained for backward compatibility with
   * existing persisted data.
   *
   * For tracking HOW a transaction was paid, see `fundingSourceId` below.
   * @default 'personal'
   */
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
  /**
   * Optional lightweight user tags for personal organization/filtering.
   * Max 5 tags, each max 20 chars. Stored in localStorage keyed by txId
   * until a DB column is available.
   */
  tags?: string[]
  /**
   * Optional receipt photo URL. When a receipt is attached via Supabase Storage,
   * this holds the public/signed URL. Falls back to localStorage blob URL offline.
   */
  receiptUrl?: string
  /**
   * Optional link to an income stream (side hustle). When set on an expense,
   * it attributes that cost to the stream so users can see true profit per hustle.
   * References an `IncomeStream.id` from `src/types/folio.ts`.
   */
  incomeStreamId?: string
  /**
   * Optional ISO 4217 currency code (e.g. "THB", "EUR") of the currency the
   * user actually spent in — used for study-abroad terms and international
   * students (task 195.1).
   *
   * Multi-currency is strictly additive: when `currency` is absent (or equals
   * the user's home currency), the transaction behaves exactly as before and
   * `amount` is already in the home currency.
   */
  currency?: string
  /**
   * Optional stored exchange rate captured at log time: home-currency units per
   * 1 unit of `currency`. For example, if `currency` is "THB" and 1 THB = 0.028
   * USD, then `exchangeRate` is `0.028`.
   *
   * `amount` is ALWAYS stored in the home currency (so every existing daily
   * allowance / budget / rollover calculation is unchanged). The original local
   * amount is derived for display only via `amount / exchangeRate`. The rate is
   * stored so display never requires a network call. Absent means no conversion.
   */
  exchangeRate?: number
  /** Server-side timestamp of last modification (task 523) */
  updatedAt?: string
}

// Account Types (3 buckets)
/**
 * @deprecated Vestigial type from an early 3-bucket model that was never fully
 * implemented. In practice, all transactions use `'personal'`. Retained for
 * backward compatibility — the `accountType` field on `Transaction` always
 * defaults to `'personal'` in all creation paths (offlineQueue, useHomeData,
 * transactionUtils, affordabilityUtils).
 *
 * For the active money-container types, see:
 * - `FundingSource` (src/lib/fundingSources.ts) — payment method tracking
 * - `SavingsAccount` (src/types/folio.ts) — growth/investment tracking
 * - `LinkedAccount` (src/types/folio.ts) — optional external bank linking
 */
export type AccountType = 'personal' | 'gig' | 'savings'

/**
 * @deprecated This interface is unused — never imported or instantiated anywhere
 * in the app. It represented a generic "account bucket" that was superseded by
 * the more specific `SavingsAccount` (for growth tracking) and `FundingSource`
 * (for payment method tracking). Kept for backward compatibility only.
 *
 * Do NOT use this type for new features. Instead use:
 * - `FundingSource` for payment methods (how you pay)
 * - `SavingsAccount` for savings/investment containers (where money grows)
 * - `LinkedAccount` for external bank connections (optional Plaid linking)
 */
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
  period?: 'monthly' | 'weekly' | 'payday_aligned' | 'semester'
  /**
   * Optional per-transaction alert threshold (in dollars).
   * When a single expense for this category exceeds this amount,
   * a gentle one-line nudge is surfaced — never blocking.
   * `undefined` or `0` means disabled.
   */
  perTransactionAlert?: number
  /** Server-side timestamp of last modification (task 523) */
  updatedAt?: string
}

export const BUDGET_CATEGORIES: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: '🍕', label: 'Food' },
  { category: 'drinks', emoji: '☕', label: 'Drinks' },
  { category: 'rent', emoji: '🏠', label: 'Rent & Bills' },
  { category: 'transport', emoji: '🚲', label: 'Transportation' },
  { category: 'school', emoji: '📚', label: 'School' },
  { category: 'fun', emoji: '🎶', label: 'Fun' },
  { category: 'health', emoji: '💪', label: 'Health' },
  { category: 'subscriptions', emoji: '🔄', label: 'Subscriptions' },
  { category: 'other', emoji: '📦', label: 'Other' },
]

export const TRANSACTION_CATEGORIES: { category: TransactionCategory; emoji: string; label: string; type: TransactionType }[] = [
  { category: 'food', emoji: '🍕', label: 'Food', type: 'expense' },
  { category: 'drinks', emoji: '☕', label: 'Drinks', type: 'expense' },
  { category: 'rent', emoji: '🏠', label: 'Rent & Bills', type: 'expense' },
  { category: 'transport', emoji: '🚲', label: 'Transportation', type: 'expense' },
  { category: 'school', emoji: '📚', label: 'School', type: 'expense' },
  { category: 'fun', emoji: '🎶', label: 'Fun', type: 'expense' },
  { category: 'health', emoji: '💪', label: 'Health', type: 'expense' },
  { category: 'subscriptions', emoji: '🔄', label: 'Subscriptions', type: 'expense' },
  { category: 'other', emoji: '📦', label: 'Other', type: 'expense' },
  { category: 'income', emoji: '⚡', label: 'Other Pay', type: 'income' },
  { category: 'income', emoji: '💵', label: 'Paycheck', type: 'income' },
]

// Goal Types
export type GoalType = 'savings' | 'emergency_fund' | 'shared'

/** A participant in a shared goal (e.g., roommates splitting an apartment deposit). */
export interface GoalParticipant {
  id: string
  name: string
  contributedAmount: number
  joinedAt: string
}

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
  /** Whether this goal is shared with other participants */
  isShared?: boolean
  /** Participants contributing toward this shared goal */
  participants?: GoalParticipant[]
  /** Token for sharing this goal via link (reuses the existing token flow) */
  shareToken?: string
  /** Optional linked savings/investment account — progress reflects account balance */
  linkedAccountId?: string
  /** Server-side timestamp of last modification (task 523) */
  updatedAt?: string
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

// ============================================================================
// Unified Money-Container Reference Type
// ============================================================================

/**
 * Union type representing all active money-container concepts in Folio.
 *
 * This is a **documentation aid** — it clarifies the relationship between the
 * three distinct container types without introducing a new runtime abstraction.
 *
 * - `FundingSource`: Payment method (debit, cash, credit, wallet, borrowed).
 *   Tracks HOW you pay and whether settlement is immediate or deferred.
 * - `SavingsAccount`: Growth container (HYSA, IRA, 401k, brokerage).
 *   Tracks WHERE long-term money appreciates with contributions and returns.
 * - `LinkedAccount`: External bank/card connection (optional Plaid linking).
 *   Behind feature flag — Folio works fully without any linked accounts.
 *
 * These three types are intentionally kept separate because they model
 * fundamentally different financial concepts with non-overlapping field sets.
 */
export type MoneyContainer = FundingSource | SavingsAccount | LinkedAccount

// Re-import for the union type (these are already exported from ./folio)
import type { FundingSource } from '@/lib/fundingSources'
import type { SavingsAccount, LinkedAccount } from './folio'

// Export Folio Simplification types
export * from './folio'
