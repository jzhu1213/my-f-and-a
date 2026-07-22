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
  /** Total amount reserved for upcoming unpaid bills this month */
  reservedForBills?: number
  /** Number of upcoming bills still due this month */
  upcomingBillCount?: number
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
