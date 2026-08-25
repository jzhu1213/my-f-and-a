import { TransactionCategory, UserType, UserPriority, UserGoal } from './index'
import type { IconName } from '@/lib/icons'

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
  /** Amount spent on deferred-settlement sources today (only present when countCreditImmediately is false) */
  deferredSpending?: number
  /** Amount spent on borrowed/parents' sources today (doesn't count against allowance) */
  borrowedSpending?: number
  /** Total amount of future-dated (scheduled) expenses within the current month — informational only */
  reservedForScheduled?: number
  /** Number of future-dated (scheduled) transactions this month */
  scheduledCount?: number
  /** Confidence band for variable income — "usually $X–$Y/day" (Task 164.2) */
  confidenceBand?: ConfidenceBand
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

/**
 * What the hero number represents — user-selectable via Settings.
 *
 * - 'allowance':   "Safe to spend today" — the default for guided/structured mode.
 *                  Shows the daily allowance remaining (budget-aware).
 * - 'spent_today': "Spent today" — default for tracker mode.
 *                  Shows total spending so far today, no budget comparison.
 * - 'spent_week':  "Spent this week" — rolling 7-day spend total.
 * - 'balance':     "Money on hand" — current net balance (income minus expenses).
 */
export type HeroMeaning = 'allowance' | 'spent_today' | 'spent_week' | 'balance'

/**
 * The display-ready output of heroMeaningStatus — everything the hero needs to
 * render itself agnostically, without knowing which meaning is active.
 */
export interface HeroDisplay {
  /** The number to show as the large hero amount */
  displayAmount: number
  /** Short label shown below/above the amount, e.g. "Safe to spend" */
  label: string
  /** Status for color/ring theming */
  status: AllowanceStatus
  /** Encouraging context message */
  message: string
}

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
  /**
   * Legacy expressive emoji. Retained for backward compatibility, but the UI
   * now renders a themeable icon (see {@link iconName}). Structural surfaces
   * should prefer the icon; celebration surfaces keep expressive emoji.
   */
  emoji: string
  /**
   * Semantic registry icon for the tip's structural indicator. When omitted the
   * card falls back to the per-{@link TipType} default via `getTipIconName`.
   */
  iconName?: IconName
  actionLabel?: string
  actionType?: 'set_goal' | 'adjust_budget' | 'view_insight' | 'learn_more'
  priority: 'low' | 'medium' | 'high'
  triggerCondition: TipTrigger
  /** Links this tip to a related financial literacy lesson (used by "Learn more" action). */
  relatedLessonId?: string
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
  | { type: 'first_goal_lesson' }
  | { type: 'over_budget_week_lesson'; overBudgetDays: number }
  | { type: 'weekly_summary' }
  | { type: 'payday_detected' }
  | { type: 'burn_rate_warning'; projectedOverspend: number }
  | { type: 'bill_due_soon'; label: string; dueDay: number; daysUntil: number }
  | { type: 'low_balance_warning'; projectedLowBalance: number; buffer: number; daysUntilDip?: number }
  | { type: 'subscription_audit'; count: number; monthlyTotal: number }
  | { type: 'subscription_renewal_soon'; label: string; amount: number; daysUntil: number }
  | { type: 'trial_ending'; label: string; amount: number; daysUntil: number }
  | { type: 'lump_income_spike'; spikeAmount: number; averageMonthlyIncome: number }
  | { type: 'over_budget_today' }
  | { type: 'source_breakdown'; creditPercent: number; creditTotal: number; monthlyIncome: number }
  | { type: 'weekly_auto_save_recap'; weeklyAmount: number }
  | { type: 'money_confidence_checkin' }
  | { type: 'contribution_gap'; accountName: string; target: number; remaining: number }
  | { type: 'first_savings_account_lesson' }
  | { type: 'first_contribution_lesson' }
  | { type: 'spend_anomaly'; category: TransactionCategory; amount: number; typicalAmount: number }
  | { type: 'income_shortfall'; expectedAmount: number; daysPastDue: number }
  | { type: 'seasonal_mode_suggestion'; suggestedMode: string; reason: string }
  | { type: 'spending_pace_alert'; paceMultiplier: number; remainingBudget: number }
  | { type: 'yesterday_surplus'; amountSaved: number; yesterdayDate: string }

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
  | 'streak_14_days'
  | 'streak_30_days'
  | 'goal_progress'
  | 'goal_complete'
  | 'first_transaction'
  | 'weekly_win'
  | 'logging_streak'
  | 'lowest_spend_day'
  | 'no_spend_streak'
  | 'no_spend_weekend'
  // Milestone journeys (Phase 4 task 199.1) — once-ever, warm re-engagement moments
  | 'first_month'
  | 'first_goal_met'
  | 'first_no_spend_week'
  // Wish list (Phase 11 task 352.3)
  | 'wish_complete'
  // Income encouragement (Phase 11 task 356)
  | 'income_growth'
  | 'income_record'
  // New user first-week milestones (Phase 13 task 393.1)
  | 'new_user_first_expense'
  | 'new_user_first_day'
  | 'new_user_3_day_streak'
  | 'new_user_first_week'
  // Streak milestones (Phase 17 task 430.3)
  | 'streak_milestone'
  // Challenge completion (Phase 17 task 432.2)
  | 'challenge_complete'
  // Cumulative milestones (Phase 17 task 433)
  | 'milestone_earned'

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
// Confidence Band Types (Task 164.2)
// ============================================================================

/**
 * Confidence band for variable income — shows the typical daily range
 * ("usually $X–$Y") when income is irregular enough to warrant it.
 * Purely informational; never changes the primary daily number.
 */
export interface ConfidenceBand {
  /** Low end of the typical daily range */
  low: number
  /** High end of the typical daily range */
  high: number
  /** Whether the band is meaningful (enough income variance to warrant showing) */
  isSignificant: boolean
}

// ============================================================================
// Rhythm Model Types (Task 164.1)
// ============================================================================

/**
 * Day-of-week spending rhythm weights derived from transaction history.
 * Used to adjust the flat daily allowance based on observed weekly patterns
 * (e.g., higher weekend spending, quieter weekdays).
 *
 * Weights average to 1.0 (sum = 7.0) and are capped to [0.5, 2.0] to prevent
 * wild swings in the daily number.
 */
export interface RhythmWeights {
  /** Day-of-week weights [Sun, Mon, Tue, Wed, Thu, Fri, Sat], averaging 1.0, each capped to [0.5, 2.0] */
  weights: [number, number, number, number, number, number, number]
  /** Number of weeks of data used to compute the model */
  weeksOfData: number
  /** Whether the model has enough data to be reliable (>= 4 weeks) */
  isReliable: boolean
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
// Onboarding Data Types
// ============================================================================

/**
 * Data collected from the onboarding flow.
 */
export interface OnboardingData {
  userType: UserType | null
  priority: UserPriority | null
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
 * Persona a new user can optionally self-identify as during onboarding, used to
 * tailor sensible starting defaults (budget preset, starting income, currency).
 *
 * Task 200.1 — Persona-based onboarding branches. Purely a starting hint: the
 * step is skippable, never forces setup, and never overrides an explicit choice.
 */
export type OnboardingPersona =
  | 'on_campus'      // On-campus student — dorm/meal plan, tight budget
  | 'freelancer'     // Freelancer / gig worker — variable income across gigs
  | 'international'   // International student — studying abroad, home currency

/**
 * Result of onboarding flow
 */
export interface OnboardingResult {
  monthlyIncome: number
  budgetPreset: BudgetPreset
  customLimits?: Record<TransactionCategory, number>
  primaryGoal?: UserGoal
  /**
   * The persona the user optionally selected (task 200.1). Undefined when the
   * persona step was skipped — the flow keeps its neutral defaults in that case.
   */
  persona?: OnboardingPersona
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
  /** Server-side timestamp of last modification (task 523) */
  updatedAt?: string
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
  /** Server-side timestamp of last modification (task 523) */
  updatedAt?: string
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
  /**
   * Optional semantic icon name from the central icon registry (Phase 6, task
   * 234.2). New custom categories pick an icon from the set; when absent, the
   * stored `emoji` is rendered as a graceful fallback so pre-icon categories
   * keep working. Typed loosely as `string` here to avoid a hard dependency on
   * `@/lib/icons` from the domain types — callers narrow it to `IconName`.
   */
  icon?: string
}

// ============================================================================
// Linked Account Types (Group 14 — Optional bank/card linking, task 107.1)
// ============================================================================

/** Kind of linked financial account */
export type LinkedAccountKind = 'bank' | 'card'

/** Connection status of a linked account */
export type LinkedAccountStatus = 'connected' | 'disconnected' | 'error'

/**
 * A financial account the user has OPTIONALLY linked (e.g. via Plaid).
 *
 * IMPORTANT — security & positioning:
 * - Linking is strictly opt-in. Folio is fully usable with zero linked accounts.
 * - The raw Plaid access_token is NEVER stored client-side. Only a server-side
 *   reference (`accessTokenRef`) is kept here — the actual token lives behind a
 *   server boundary and is exchanged server-side (public_token → access_token).
 * - No secrets or tokens ever appear in this client type.
 */
export interface LinkedAccount {
  id: string
  userId: string
  /** Human-friendly institution name, e.g. "Chase" */
  institutionName: string
  /** Last 4 digits / mask of the account, e.g. "1234" — never the full number */
  mask: string
  kind: LinkedAccountKind
  /**
   * Opaque server-side reference to the securely-stored access token.
   * This is NOT the token itself — it's a lookup key the server uses to
   * retrieve the real access_token. Never place a raw token here.
   */
  accessTokenRef: string
  status: LinkedAccountStatus
  /** ISO timestamp of the last successful sync, if any */
  lastSyncedAt?: string
  createdAt: string
}

// ============================================================================
// Income Stream Types (Task 176.1)
// ============================================================================

/** Classification of income source — for display/grouping purposes. */
export type IncomeStreamType = 'job' | 'gig' | 'aid' | 'parental' | 'other'

/**
 * A named income stream with its own cadence and expected amount.
 * Multiple streams feed a single combined daily number (the daily allowance).
 *
 * Examples: "Campus Job", "Freelance Design", "Financial Aid", "Dad"
 */
export interface IncomeStream {
  /** Unique identifier */
  id: string
  /** User-chosen name (e.g., "Campus Job", "Freelance", "Dad") */
  name: string
  /** Classification for display/grouping */
  type: IncomeStreamType
  /** Expected amount per pay period (in dollars) */
  amount: number
  /** How often this stream pays — reuses existing PayCadence type */
  cadence: import('@/lib/paySchedule').PayCadence
  /** ISO date string (YYYY-MM-DD) of a known payment for this stream */
  anchorDate: string
  /** Whether this stream is currently active (toggle without deleting) */
  isActive: boolean
  /** Optional emoji icon for display */
  emoji?: string
  /** Optional description/note */
  note?: string
}

// ============================================================================
// Reimbursement / IOU Types (Requirements 12.3, 13.7)
// ============================================================================

export type { Reimbursement, ReimbursementDirection } from '@/lib/reimbursements'

// ============================================================================
// Year in Review Types (Task 183.1)
// ============================================================================
//
// The shape of the warm, once-a-year recap computed by `lib/yearInReview.ts`.
// Extends the celebratory month/weekly-review pattern into an annual moment.
// Never a leaderboard or a comparison to other people — every field is a
// personal, shame-free highlight.

/** The month a user came out furthest ahead (income − expense). */
export interface YearInReviewMonth {
  /** 0-indexed month (0 = January). */
  month: number
  /** Friendly month name, e.g. "March". */
  monthLabel: string
  /** Net amount saved that month (always > 0 when present). */
  saved: number
}

/** The expense category with the most spend across the year. */
export interface YearInReviewCategory {
  category: TransactionCategory
  /** Friendly label, e.g. "Food & Drinks". */
  label: string
  /** Category emoji. */
  emoji: string
  /** Total spent in this category over the year. */
  total: number
}

/** How the standout "biggest win" was chosen. */
export type YearInReviewWinKind = 'streak' | 'saved' | 'month' | 'showed_up'

/** The single standout achievement of the year, framed warmly. */
export interface YearInReviewWin {
  kind: YearInReviewWinKind
  /** Short celebratory headline. */
  headline: string
  /** One warm supporting sentence. */
  detail: string
}

/** The full annual recap. */
export interface YearInReviewData {
  /** The calendar year summarized. */
  year: number
  /** Number of in-year transactions considered. */
  transactionCount: number
  /** Whether there is enough data for the recap to feel earned. */
  hasEnoughData: boolean
  /** Longest run of consecutive days within the daily number (or no-spend). */
  bestStreak: number
  /** The month the user saved the most, or null if never net-positive. */
  mostSavedMonth: YearInReviewMonth | null
  /** The category with the most spend, or null if no expenses. */
  topCategory: YearInReviewCategory | null
  /** Net income − expense across the whole year (can be negative). */
  totalSaved: number
  /** The single standout highlight of the year. */
  biggestWin: YearInReviewWin
}

// ============================================================================
// Term / Monthly Review Types (Task 184.1)
// ============================================================================
//
// The shape of the richer, end-of-period recap computed by `lib/termReview.ts`.
// Extends the celebratory month-in-review pattern (improvement 5.4) into a
// term-aware moment that ties to the academic term model (Phase 2 task 121.1).
//
// When a term schedule exists, the recap spans the whole academic term (e.g.
// "Fall 2024") with term-level stats. When no term is configured, it degrades
// gracefully to a single-month recap so nothing breaks. Like every recap in
// Folio: personal, shame-free, never a leaderboard or comparison to others.

/** Which period a term review summarizes. */
export type TermReviewMode = 'term' | 'month'

/** A calendar month inside the summarized period, and how much was set aside. */
export interface TermReviewMonth {
  /** Year-month key, e.g. "2024-09". */
  monthKey: string
  /** Friendly label including the year, e.g. "September 2024". */
  monthLabel: string
  /** Net amount saved that month (income − expense; always > 0 when present). */
  saved: number
}

/** An expense category and its total across the summarized period. */
export interface TermReviewCategory {
  category: TransactionCategory
  /** Friendly label, e.g. "Food & Drinks". */
  label: string
  /** Category emoji. */
  emoji: string
  /** Total spent in this category over the period. */
  total: number
}

/** How the standout "biggest win" was chosen for the period. */
export type TermReviewWinKind =
  | 'streak'
  | 'saved'
  | 'best_month'
  | 'consistency'
  | 'showed_up'

/** The single standout highlight of the period, framed warmly. */
export interface TermReviewWin {
  kind: TermReviewWinKind
  /** Short celebratory headline. */
  headline: string
  /** One warm supporting sentence. */
  detail: string
}

/** The full term / monthly recap. */
export interface TermReviewData {
  /** Whether this recap spans an academic term or a single month. */
  mode: TermReviewMode
  /** Friendly title for the period, e.g. "Fall 2024" or "September 2024". */
  periodLabel: string
  /** Start of the summarized window (ISO YYYY-MM-DD, inclusive). */
  startDate: string
  /** End of the summarized window (ISO YYYY-MM-DD, inclusive). */
  endDate: string
  /** Total days in the summarized window (inclusive of both ends). */
  daysInPeriod: number
  /** Number of transactions considered within the window. */
  transactionCount: number
  /** Whether there is enough data for the recap to feel earned. */
  hasEnoughData: boolean
  /** Total income logged in the window. */
  totalIncome: number
  /** Total expense logged in the window. */
  totalExpense: number
  /** Net income − expense across the window (can be negative). */
  totalSaved: number
  /**
   * The strongest single month within the period, or null if no month was
   * net-positive. For a month-mode recap this is simply that month when saved.
   */
  bestMonth: TermReviewMonth | null
  /** Top expense categories across the period (highest spend first, up to 3). */
  topCategories: TermReviewCategory[]
  /** Longest run of consecutive days within the daily number (or no-spend). */
  bestStreak: number
  /** The single standout highlight of the period. */
  biggestWin: TermReviewWin
}

// ============================================================================
// Peer Context — encouraging "typical for a student" framing (Task 186.1)
// ============================================================================
//
// Optional, anonymized, encouraging context that compares a user's monthly
// spending against rough, static student ranges. It is OFF by default and only
// surfaces behind Tools when enabled. It is deliberately NOT a ranking, a
// leaderboard, or a pass/fail — every band is framed warmly and shame-free.

/**
 * Where a user's spend for a category sits relative to the typical student
 * range. All three bands are framed positively — `above` is never a scolding.
 */
export type PeerBand = 'lighter' | 'typical' | 'above'

/** Encouraging peer context for a single spending category. */
export interface PeerCategoryContext {
  /** The spending category this context describes. */
  category: TransactionCategory
  /** Friendly display label, e.g. "Food & Drinks". */
  label: string
  /** Emoji for the category. */
  emoji: string
  /** The user's total spend in this category for the month. */
  monthlySpend: number
  /** Low end of the typical monthly student range for this category. */
  typicalLow: number
  /** High end of the typical monthly student range for this category. */
  typicalHigh: number
  /** Which band the user's spend falls into (all framed warmly). */
  band: PeerBand
  /** A warm, shame-free one-liner describing the comparison. */
  message: string
}

/** The full opt-in peer-context summary for a month. */
export interface PeerContextData {
  /** Friendly month label, e.g. "September 2024". */
  monthLabel: string
  /** Whether there is enough logged spending for context to feel meaningful. */
  hasEnoughData: boolean
  /** A warm intro line setting expectations (context, not competition). */
  intro: string
  /** Per-category encouraging comparisons (only categories with spend). */
  categories: PeerCategoryContext[]
  /** A gentle closing reminder that these are ballpark ranges, not targets. */
  disclaimer: string
}
