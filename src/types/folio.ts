import { TransactionCategory } from './index'

// ============================================================================
// Daily Allowance Types (Requirements 1.1, 1.6-1.9)
// ============================================================================

/**
 * Computed daily allowance with status and messaging
 * Represents the core "can I afford this?" calculation
 */
export interface DailyAllowance {
  /** Amount user can spend today */
  amount: number
  /** Original daily budget before spending */
  dailyBudget: number
  /** Amount spent so far today */
  spentToday: number
  /** Rollover from previous days (can be negative) */
  rollover: number
  /** Status for UI coloring */
  status: AllowanceStatus
  /** Encouraging message to display */
  message: string
  /** Whether to show celebration animation */
  showCelebration: boolean
  /** Whether the allowance is an estimate based on income (no budget limits configured) */
  isEstimated?: boolean
  /** Source of income used for the discretionary pool calculation */
  incomeSource?: 'budget' | 'transactions' | 'estimate'
  /** Total amount reserved for upcoming unpaid bills this month */
  reservedForBills?: number
  /** Number of upcoming bills still due this month */
  upcomingBillCount?: number
  /** Month-boundary carryover info (only present when carryoverEnabled is true and it's the 1st) */
  monthBoundaryCarryover?: MonthBoundaryCarryover
}

/**
 * Information about leftover savings at a month boundary.
 * When a user underspends their daily budget consistently, the raw rollover can exceed
 * the ±2-day cap. The excess is the "carryover" — money that could be routed to savings.
 *
 * Requirements: 1.2, new
 */
export interface MonthBoundaryCarryover {
  /** Amount available to route to savings (excess beyond the ±2-day rollover cap) */
  amount: number
  /** The raw uncapped rollover from the previous month */
  rawRollover: number
  /** The capped rollover that was actually applied */
  cappedRollover: number
  /** Whether carryover is enabled */
  enabled: boolean
}

/**
 * Budget health status thresholds
 * - healthy: >50% remaining
 * - caution: 25-50% remaining
 * - warning: 0-25% remaining
 * - over: negative (overspent)
 */
export type AllowanceStatus = 'healthy' | 'caution' | 'warning' | 'over'

// ============================================================================
// Smart Suggestion Types (Requirements 4.1-4.5)
// ============================================================================

/**
 * Smart amount suggestion based on transaction history
 */
export interface SmartSuggestion {
  /** Unique identifier */
  id: string
  /** Suggested transaction amount */
  amount: number
  /** Category this suggestion applies to */
  category: TransactionCategory
  /** Optional note/label */
  label?: string
  /** Confidence score 0-1 */
  confidence: number
  /** Source of suggestion */
  source: 'frequent' | 'recent' | 'typical' | 'preset'
  /** Times this exact transaction occurred */
  frequency: number
}

// ============================================================================
// Contextual Tips Types (Requirements 5.1-5.3)
// ============================================================================

/**
 * Contextual tip displayed on home screen
 */
export interface ContextualTip {
  id: string
  type: TipType
  title: string
  message: string
  emoji: string
  actionLabel?: string
  actionType?: 'set_goal' | 'adjust_budget' | 'view_insight' | 'learn_more'
  priority: 'low' | 'medium' | 'high'
  triggerCondition: TipTrigger
}

/**
 * Type of contextual tip
 */
export type TipType =
  | 'celebration'      // User hit a positive milestone
  | 'gentle_nudge'     // Spending is trending high
  | 'did_you_know'     // Educational content
  | 'smart_suggestion' // AI-powered recommendation

/**
 * Condition that triggers a tip to be shown
 */
export type TipTrigger =
  | { type: 'under_budget_streak'; days: number }
  | { type: 'category_spike'; category: TransactionCategory; percentIncrease: number }
  | { type: 'first_goal_progress' }
  | { type: 'weekly_summary' }
  | { type: 'payday_detected' }
  | { type: 'burn_rate_warning'; projectedOverspend: number }
  | { type: 'bill_due_soon'; label: string; dueDay: number; daysUntil: number }
  | { type: 'low_balance_warning'; projectedLowBalance: number; buffer: number; daysUntilDip?: number }
  | { type: 'subscription_audit'; count: number; monthlyTotal: number }
  | { type: 'lump_income_spike'; spikeAmount: number; averageMonthlyIncome: number }
  | { type: 'over_budget_today' }

// ============================================================================
// Celebration Types (Requirements 6.1-6.7)
// ============================================================================

/**
 * Celebration event triggered by positive financial behavior
 */
export interface CelebrationEvent {
  id: string
  type: CelebrationType
  title: string
  message: string
  emoji: string
  animation: AnimationType
  duration: number // milliseconds
  sound?: 'subtle' | 'cheerful' | 'none'
}

/**
 * Type of celebration milestone
 */
export type CelebrationType =
  | 'under_budget_today'
  | 'streak_3_days'
  | 'streak_7_days'
  | 'goal_progress'
  | 'goal_complete'
  | 'first_transaction'
  | 'weekly_win'
  | 'no_spend_streak'
  | 'no_spend_weekend'

/**
 * Animation style for celebrations
 */
export type AnimationType =
  | 'confetti'
  | 'sparkle'
  | 'pulse'
  | 'bounce'
  | 'none'

// ============================================================================
// Theme Types (Requirements 8.1-8.7)
// ============================================================================

/**
 * Complete theme configuration for the app
 */
export interface ThemeConfiguration {
  mode: 'warm' | 'dark' | 'system'
  colors: ThemeColors
  typography: ThemeTypography
  spacing: ThemeSpacing
}

/**
 * Color palette for theme
 */
export interface ThemeColors {
  // Primary surfaces
  background: string      // Warm: #1a1a2e, Dark: #000000
  surface: string         // Warm: #25253a, Dark: #0d0d0d
  surfaceElevated: string // Warm: #2d2d44, Dark: #161616

  // Text hierarchy
  textPrimary: string     // High contrast for key numbers
  textSecondary: string   // Supporting text
  textMuted: string       // Labels, hints

  // Semantic colors (warmer variants)
  success: string         // #4ade80 (softer green)
  warning: string         // #fbbf24 (warm amber)
  error: string           // #f87171 (softer red)
  info: string            // #60a5fa (friendly blue)

  // Accent for interactive elements
  accent: string          // #818cf8 (soft purple)
  accentMuted: string     // rgba(129, 140, 248, 0.15)
}

/**
 * Typography style definition
 */
export interface TypographyStyle {
  size: number
  weight: number
  family: string
}

/**
 * Typography system for the app
 */
export interface ThemeTypography {
  // Display: Large numbers (daily allowance)
  displayLarge: TypographyStyle
  displayMedium: TypographyStyle

  // Headlines: Section titles
  headlineMedium: TypographyStyle
  headlineSmall: TypographyStyle

  // Body: General content
  bodyLarge: TypographyStyle
  bodyMedium: TypographyStyle

  // Labels: UI elements
  labelLarge: TypographyStyle
  labelMedium: TypographyStyle
  labelSmall: TypographyStyle
}

/**
 * Spacing and border radius configuration
 */
export interface ThemeSpacing {
  borderRadius: {
    small: number    // Buttons, chips
    medium: number   // Cards, inputs
    large: number    // Modals, sheets
    full: number     // Pills, avatars
  }
}

// ============================================================================
// Income Smoothing Types (Requirement 1.1)
// ============================================================================

/**
 * Configuration for income smoothing strategy.
 * Gig workers with variable income benefit from trailing_average to stabilize
 * the daily budget calculation across irregular pay periods.
 */
export interface IncomeSmoothing {
  /** Strategy: 'current_month' uses only this month, 'trailing_average' smooths over recent months */
  strategy: 'current_month' | 'trailing_average'
  /** Number of months to average for trailing_average (default: 3) */
  windowMonths?: number
}

// ============================================================================
// Income Allocation Types (Requirement 3.1)
// ============================================================================

/**
 * Income allocation breakdown across four buckets.
 * Amounts represent dollar values summing to the total income logged.
 */
export interface IncomeAllocation {
  spend: number
  save: number
  invest: number
  setAside: number
}

/**
 * Preset for quickly splitting income into buckets.
 * The split array represents percentages for [spend, save, invest, setAside].
 */
export interface AllocationPreset {
  label: string
  emoji: string
  split: [number, number, number, number]
}

// ============================================================================
// Quick Transaction Types (Requirement 7.3)
// ============================================================================

/**
 * Simplified transaction for quick logging
 */
export interface QuickTransaction {
  category: TransactionCategory
  amount: number
  note?: string
}

// ============================================================================
// Onboarding Types (Requirements 7.1-7.3)
// ============================================================================

/**
 * Result of onboarding flow
 */
export interface OnboardingResult {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  customLimits?: Record<TransactionCategory, number>
  primaryGoal?: 'save' | 'track' | 'reduce_spending'
}

/**
 * Budget preset options for new users
 */
export type BudgetPreset =
  | 'student_tight'        // Very limited budget
  | 'student_moderate'     // Some spending room
  | 'young_professional'   // Entry-level income
  | 'custom'               // User sets all limits

/**
 * Single step in onboarding flow
 */
export interface OnboardingStep {
  id: string
  title: string
  subtitle: string
  illustration: string // Friendly illustration asset
  inputType: 'slider' | 'options' | 'number' | 'confirm'
  options?: OnboardingOption[]
}

/**
 * Option within an onboarding step
 */
export interface OnboardingOption {
  value: string
  label: string
  emoji: string
  description: string
}

// ============================================================================
// Savings/Investment Account Types (Requirement 13.7)
// ============================================================================

/** Type of savings/investment account */
export type SavingsAccountType = 'hysa' | 'roth_ira' | '401k' | 'brokerage' | 'savings' | 'other'

/** Metadata for each account type */
export const SAVINGS_ACCOUNT_TYPES: { type: SavingsAccountType; label: string; emoji: string; defaultReturn: number }[] = [
  { type: 'hysa', label: 'High-Yield Savings', emoji: '🏦', defaultReturn: 4.5 },
  { type: 'roth_ira', label: 'Roth IRA', emoji: '🌱', defaultReturn: 7 },
  { type: '401k', label: '401(k)', emoji: '🏢', defaultReturn: 7 },
  { type: 'brokerage', label: 'Brokerage', emoji: '📊', defaultReturn: 8 },
  { type: 'savings', label: 'Savings Account', emoji: '💰', defaultReturn: 0.5 },
  { type: 'other', label: 'Other', emoji: '📁', defaultReturn: 0 },
]

/** A tracked savings/investment account */
export interface SavingsAccount {
  id: string
  userId: string
  type: SavingsAccountType
  name: string
  balance: number
  monthlyContribution: number
  expectedAnnualReturn: number
  createdAt: string
}

// ============================================================================
// Debt Tracking Types
// ============================================================================

/** Type of debt */
export type DebtType = 'student_loan' | 'credit_card' | 'personal_loan' | 'car_loan' | 'other'

/** Metadata for each debt type */
export const DEBT_TYPES: { type: DebtType; label: string; emoji: string }[] = [
  { type: 'student_loan', label: 'Student Loan', emoji: '🎓' },
  { type: 'credit_card', label: 'Credit Card', emoji: '💳' },
  { type: 'personal_loan', label: 'Personal Loan', emoji: '🤝' },
  { type: 'car_loan', label: 'Car Loan', emoji: '🚗' },
  { type: 'other', label: 'Other', emoji: '📄' },
]

/** A tracked debt (student loan, credit card, etc.) */
export interface Debt {
  id: string
  userId: string
  type: DebtType
  name: string
  balance: number
  apr: number // Annual percentage rate (e.g., 6.5 for 6.5%)
  minimumPayment: number
  createdAt: string
}

// ============================================================================
// Custom Category Types (Requirements 3.1, 12.3, new)
// ============================================================================

/**
 * User-defined spending category layered on top of the fixed TransactionCategory enum.
 * Custom categories map to 'other' for underlying accounting/budget logic.
 */
export interface CustomCategory {
  id: string
  label: string
  emoji: string
  userId: string
  createdAt: string
}

// ============================================================================
// Reimbursement / IOU Types (Requirements 12.3, 13.7)
// ============================================================================

export type { Reimbursement, ReimbursementDirection } from '@/lib/reimbursements'
