/**
 * Fast-check arbitrary generators for Folio types
 * These generators create random test data for property-based testing
 */

import * as fc from 'fast-check'
import {
  TransactionCategory,
  TransactionType,
  AccountType,
  Transaction,
  Budget,
} from '@/types/index'
import {
  DailyAllowance,
  AllowanceStatus,
  SmartSuggestion,
  ContextualTip,
  TipType,
  CelebrationEvent,
  CelebrationType,
  AnimationType,
  ThemeConfiguration,
  QuickTransaction,
  OnboardingResult,
  BudgetPreset,
} from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import type { PaySchedule, PayCadence } from '@/lib/paySchedule'
import type { TermSchedule } from '@/lib/termSchedule'

// ============================================================================
// Basic Type Arbitraries
// ============================================================================

/**
 * Generates arbitrary TransactionCategory values
 */
export const arbTransactionCategory = (): fc.Arbitrary<TransactionCategory> =>
  fc.constantFrom<TransactionCategory>(
    'food',
    'rent',
    'transport',
    'school',
    'fun',
    'health',
    'subscriptions',
    'gig',
    'income',
    'other'
  )

/**
 * Generates arbitrary TransactionType values
 */
export const arbTransactionType = (): fc.Arbitrary<TransactionType> =>
  fc.constantFrom<TransactionType>('income', 'expense')

/**
 * Generates arbitrary AccountType values
 */
export const arbAccountType = (): fc.Arbitrary<AccountType> =>
  fc.constantFrom<AccountType>('personal', 'gig', 'savings')

/**
 * Generates arbitrary AllowanceStatus values
 */
export const arbAllowanceStatus = (): fc.Arbitrary<AllowanceStatus> =>
  fc.constantFrom<AllowanceStatus>('healthy', 'caution', 'warning', 'over')

// ============================================================================
// Date and Time Arbitraries
// ============================================================================

/**
 * Generates arbitrary dates within a reasonable range
 * Default: dates within the last year
 */
export const arbDate = (
  minDate: Date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  maxDate: Date = new Date()
): fc.Arbitrary<Date> =>
  fc
    .integer({ min: minDate.getTime(), max: maxDate.getTime() })
    .map((timestamp) => new Date(timestamp))

/**
 * Generates arbitrary date strings in YYYY-MM-DD format
 */
export const arbDateString = (
  minDate?: Date,
  maxDate?: Date
): fc.Arbitrary<string> =>
  arbDate(minDate, maxDate).map((date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

/**
 * Generates arbitrary ISO timestamp strings
 */
export const arbISOString = (minDate?: Date, maxDate?: Date): fc.Arbitrary<string> =>
  arbDate(minDate, maxDate).map((date) => date.toISOString())

// ============================================================================
// Money and Amount Arbitraries
// ============================================================================

/**
 * Generates arbitrary positive money amounts
 * Range: $0.01 to $9,999.99 (typical transaction amounts)
 */
export const arbMoneyAmount = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 999999 }).map((cents) => cents / 100)

/**
 * Generates arbitrary small money amounts (for daily spending)
 * Range: $0.01 to $100.00
 */
export const arbSmallAmount = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 10000 }).map((cents) => cents / 100)

/**
 * Generates arbitrary budget amounts (monthly limits)
 * Range: $10 to $5,000
 */
export const arbBudgetAmount = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1000, max: 500000 }).map((cents) => cents / 100)

// ============================================================================
// Transaction Arbitraries
// ============================================================================

/**
 * Generates arbitrary Transaction objects
 */
export const arbTransaction = (): fc.Arbitrary<Transaction> =>
  fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    date: arbDateString(),
    amount: arbMoneyAmount(),
    type: arbTransactionType(),
    category: arbTransactionCategory(),
    note: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
    isRecurring: fc.option(fc.boolean(), { nil: undefined }),
    recurringId: fc.option(fc.uuid(), { nil: undefined }),
    accountType: arbAccountType(),
    createdAt: arbISOString(),
  })

/**
 * Generates arbitrary QuickTransaction objects
 */
export const arbQuickTransaction = (): fc.Arbitrary<QuickTransaction> =>
  fc.record({
    category: arbTransactionCategory(),
    amount: arbSmallAmount(),
    note: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
  })

/**
 * Generates array of transactions for a specific date
 */
export const arbTransactionsForDate = (date: string): fc.Arbitrary<Transaction[]> =>
  fc.array(
    arbTransaction().map((tx) => ({ ...tx, date })),
    { minLength: 0, maxLength: 20 }
  )

// ============================================================================
// Budget Arbitraries
// ============================================================================

/**
 * Generates arbitrary Budget objects
 */
export const arbBudget = (): fc.Arbitrary<Budget> =>
  fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    category: arbTransactionCategory(),
    monthlyLimit: arbBudgetAmount(),
    spent: arbBudgetAmount().chain((limit) => 
      fc.integer({ min: 0, max: Math.floor(limit * 1.5 * 100) }).map(cents => cents / 100)
    ),
    month: fc
      .integer({ min: 2020, max: 2030 })
      .chain((year) =>
        fc
          .integer({ min: 1, max: 12 })
          .map((month) => `${year}-${String(month).padStart(2, '0')}`)
      ),
  })

/**
 * Generates array of budgets (one per category)
 */
export const arbBudgetSet = (): fc.Arbitrary<Budget[]> => {
  const categories: TransactionCategory[] = [
    'food',
    'rent',
    'transport',
    'school',
    'fun',
    'health',
    'subscriptions',
    'other',
  ]
  return fc.record(
    Object.fromEntries(
      categories.map((cat) => [
        cat,
        arbBudget().map((b) => ({ ...b, category: cat })),
      ])
    )
  ).map((obj) => Object.values(obj))
}

// ============================================================================
// Daily Allowance Arbitraries
// ============================================================================

/**
 * Generates arbitrary DailyAllowance objects
 */
export const arbDailyAllowance = (): fc.Arbitrary<DailyAllowance> =>
  fc.record({
    amount: fc.nat({ max: 10000 }).map((cents) => cents / 100),
    dailyBudget: arbBudgetAmount(),
    spentToday: arbMoneyAmount(),
    rollover: fc.integer({ min: -20000, max: 20000 }).map((cents) => cents / 100),
    status: arbAllowanceStatus(),
    message: fc.string({ minLength: 10, maxLength: 100 }),
    showCelebration: fc.boolean(),
  })

// ============================================================================
// Smart Suggestion Arbitraries
// ============================================================================

/**
 * Generates arbitrary SmartSuggestion objects
 */
export const arbSmartSuggestion = (): fc.Arbitrary<SmartSuggestion> =>
  fc.record({
    id: fc.uuid(),
    amount: arbSmallAmount(),
    category: arbTransactionCategory(),
    label: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    confidence: fc.double({ min: 0, max: 1, noNaN: true }),
    source: fc.constantFrom<'frequent' | 'recent' | 'typical' | 'preset'>(
      'frequent',
      'recent',
      'typical',
      'preset'
    ),
    frequency: fc.nat({ max: 100 }),
  })

// ============================================================================
// Contextual Tip Arbitraries
// ============================================================================

/**
 * Generates arbitrary TipType values
 */
export const arbTipType = (): fc.Arbitrary<TipType> =>
  fc.constantFrom<TipType>(
    'celebration',
    'gentle_nudge',
    'did_you_know',
    'smart_suggestion'
  )

/**
 * Generates arbitrary ContextualTip objects
 */
export const arbContextualTip = (): fc.Arbitrary<ContextualTip> =>
  fc.record({
    id: fc.uuid(),
    type: arbTipType(),
    title: fc.string({ minLength: 5, maxLength: 40 }),
    message: fc.string({ minLength: 20, maxLength: 150 }),
    emoji: fc.constantFrom('🎉', '💡', '✨', '🔥', '👍', '📊', '💰', '🎯'),
    actionLabel: fc.option(fc.string({ minLength: 5, maxLength: 30 }), { nil: undefined }),
    actionType: fc.option(
      fc.constantFrom<'set_goal' | 'adjust_budget' | 'view_insight' | 'learn_more'>(
        'set_goal',
        'adjust_budget',
        'view_insight',
        'learn_more'
      ),
      { nil: undefined }
    ),
    priority: fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high'),
    triggerCondition: fc.constantFrom(
      { type: 'under_budget_streak' as const, days: 3 },
      { type: 'first_goal_progress' as const },
      { type: 'weekly_summary' as const },
      { type: 'payday_detected' as const }
    ),
  })

// ============================================================================
// Celebration Arbitraries
// ============================================================================

/**
 * Generates arbitrary CelebrationType values
 */
export const arbCelebrationType = (): fc.Arbitrary<CelebrationType> =>
  fc.constantFrom<CelebrationType>(
    'under_budget_today',
    'streak_3_days',
    'streak_7_days',
    'streak_14_days',
    'streak_30_days',
    'goal_progress',
    'goal_complete',
    'first_transaction',
    'weekly_win',
    'logging_streak',
    'lowest_spend_day',
    'no_spend_streak',
    'no_spend_weekend'
  )

/**
 * Generates arbitrary AnimationType values
 */
export const arbAnimationType = (): fc.Arbitrary<AnimationType> =>
  fc.constantFrom<AnimationType>('confetti', 'sparkle', 'pulse', 'bounce', 'none')

/**
 * Generates arbitrary CelebrationEvent objects
 */
export const arbCelebrationEvent = (): fc.Arbitrary<CelebrationEvent> =>
  fc.record({
    id: fc.uuid(),
    type: arbCelebrationType(),
    title: fc.string({ minLength: 5, maxLength: 40 }),
    message: fc.string({ minLength: 20, maxLength: 100 }),
    emoji: fc.constantFrom('🎉', '🔥', '✨', '🎊', '🌟', '💪', '🏆'),
    animation: arbAnimationType(),
    duration: fc.integer({ min: 1000, max: 5000 }),
    sound: fc.option(fc.constantFrom<'subtle' | 'cheerful' | 'none'>('subtle', 'cheerful', 'none'), {
      nil: undefined,
    }),
  })

// ============================================================================
// Theme Arbitraries
// ============================================================================

/**
 * Generates arbitrary hex color strings
 */
export const arbHexColor = (): fc.Arbitrary<string> =>
  fc.integer({ min: 0, max: 0xffffff }).map((num) => 
    `#${num.toString(16).padStart(6, '0')}`
  )

/**
 * Generates arbitrary ThemeConfiguration objects
 */
export const arbThemeConfiguration = (): fc.Arbitrary<ThemeConfiguration> =>
  fc.record({
    mode: fc.constantFrom<'warm' | 'dark' | 'system'>('warm', 'dark', 'system'),
    colors: fc.record({
      background: arbHexColor(),
      surface: arbHexColor(),
      surfaceElevated: arbHexColor(),
      textPrimary: arbHexColor(),
      textSecondary: arbHexColor(),
      textMuted: arbHexColor(),
      success: arbHexColor(),
      warning: arbHexColor(),
      error: arbHexColor(),
      info: arbHexColor(),
      accent: arbHexColor(),
      accentMuted: fc.string(),
    }),
    typography: fc.record({
      displayLarge: fc.record({
        size: fc.integer({ min: 40, max: 80 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      displayMedium: fc.record({
        size: fc.integer({ min: 30, max: 60 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      headlineMedium: fc.record({
        size: fc.integer({ min: 20, max: 40 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      headlineSmall: fc.record({
        size: fc.integer({ min: 16, max: 30 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      bodyLarge: fc.record({
        size: fc.integer({ min: 14, max: 20 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      bodyMedium: fc.record({
        size: fc.integer({ min: 12, max: 18 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      labelLarge: fc.record({
        size: fc.integer({ min: 12, max: 18 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      labelMedium: fc.record({
        size: fc.integer({ min: 10, max: 16 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
      labelSmall: fc.record({
        size: fc.integer({ min: 8, max: 14 }),
        weight: fc.integer({ min: 100, max: 900 }),
        family: fc.constant('Inter'),
      }),
    }),
    spacing: fc.record({
      borderRadius: fc.record({
        small: fc.integer({ min: 2, max: 12 }),
        medium: fc.integer({ min: 8, max: 20 }),
        large: fc.integer({ min: 12, max: 30 }),
        full: fc.constant(9999),
      }),
    }),
  })

// ============================================================================
// Onboarding Arbitraries
// ============================================================================

/**
 * Generates arbitrary BudgetPreset values
 */
export const arbBudgetPreset = (): fc.Arbitrary<BudgetPreset> =>
  fc.constantFrom<BudgetPreset>(
    'student_tight',
    'student_moderate',
    'young_professional',
    'custom'
  )

/**
 * Generates arbitrary OnboardingResult objects
 */
export const arbOnboardingResult = (): fc.Arbitrary<OnboardingResult> =>
  fc.record({
    monthlyIncome: arbBudgetAmount(),
    budgetPreset: arbBudgetPreset(),
    customLimits: fc.option(
      fc.record({
        food: arbBudgetAmount(),
        rent: arbBudgetAmount(),
        transport: arbBudgetAmount(),
        school: arbBudgetAmount(),
        fun: arbBudgetAmount(),
        health: arbBudgetAmount(),
        subscriptions: arbBudgetAmount(),
        gig: arbBudgetAmount(),
        income: arbBudgetAmount(),
        other: arbBudgetAmount(),
      }),
      { nil: undefined }
    ),
    primaryGoal: fc.option(
      fc.constantFrom<'save' | 'track' | 'reduce_spending'>('save', 'track', 'reduce_spending'),
      { nil: undefined }
    ),
  })


// ============================================================================
// Fixed Expense Arbitraries
// ============================================================================

/**
 * Generates arbitrary FixedExpense objects
 */
export const arbFixedExpense = (): fc.Arbitrary<FixedExpense> =>
  fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    category: arbTransactionCategory(),
    label: fc.string({ minLength: 2, maxLength: 30 }),
    amount: arbBudgetAmount(),
    dueDay: fc.integer({ min: 1, max: 31 }),
    recurringId: fc.uuid(),
    isActive: fc.boolean(),
  })

// ============================================================================
// Pay Schedule Arbitraries
// ============================================================================

/**
 * Generates arbitrary PayCadence values
 */
export const arbPayCadence = (): fc.Arbitrary<PayCadence> =>
  fc.constantFrom<PayCadence>('weekly', 'biweekly', 'semimonthly', 'monthly', 'irregular')

/**
 * Generates arbitrary PaySchedule objects
 */
export const arbPaySchedule = (): fc.Arbitrary<PaySchedule> =>
  fc.record({
    cadence: arbPayCadence(),
    anchorDate: arbDateString(),
    amount: fc.option(arbBudgetAmount(), { nil: undefined }),
  })

// ============================================================================
// Term Schedule Arbitraries
// ============================================================================

/**
 * Generates arbitrary TermSchedule objects with valid date ranges (end > start).
 * Term length ranges from 30 to 150 days.
 */
export const arbTermSchedule = (): fc.Arbitrary<TermSchedule> =>
  fc
    .record({
      startYear: fc.integer({ min: 2022, max: 2026 }),
      startMonth: fc.integer({ min: 1, max: 12 }),
      startDay: fc.integer({ min: 1, max: 28 }),
      durationDays: fc.integer({ min: 30, max: 150 }),
      label: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
    })
    .map(({ startYear, startMonth, startDay, durationDays, label }) => {
      const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
      const start = new Date(startYear, startMonth - 1, startDay)
      const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000)
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      return { startDate, endDate, label } as TermSchedule
    })

// ============================================================================
// Budget with Period Arbitraries
// ============================================================================

/**
 * Generates arbitrary Budget objects with a specific period
 */
export const arbBudgetWithPeriod = (
  period: 'monthly' | 'weekly' | 'payday_aligned' | 'semester'
): fc.Arbitrary<Budget> =>
  arbBudget().map((b) => ({ ...b, period }))
