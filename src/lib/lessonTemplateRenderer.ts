/**
 * Lesson Template Renderer — Injects real user data into educational content.
 *
 * Replaces `{{variable}}` placeholders in lesson content with formatted values
 * computed from the user's actual transactions, budgets, goals, and debts.
 *
 * Examples:
 *   - `{{daily_coffee_cost}}` → "$4.50"
 *   - `{{monthly_food_total}}` → "$890"
 *   - `{{debt_interest_monthly}}` → "$47"
 *   - `{{goal_completion_date}}` → "March 2027"
 *
 * Requirements: 26.2
 */

import type { Transaction, TransactionCategory, Budget, Goal } from '@/types'
import type { Debt, SavingsAccount } from '@/types/folio'
import type { ContextualLesson } from '@/lib/contextualLessonContent'
import { formatCurrency as formatCurrencyCentral } from '@/lib/currencyUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * All available template variables for lesson content interpolation.
 * Values are pre-formatted strings ready for display (e.g., "$4.50").
 */
export interface LessonTemplateData {
  // ── Spending ─────────────────────────────────────────────────────
  /** Average daily coffee/drinks spend, e.g. "$4.50" */
  daily_coffee_cost: string
  /** Total food spend this month, e.g. "$890" */
  monthly_food_total: string
  /** Total subscriptions this month, e.g. "$65" */
  monthly_subscriptions_total: string
  /** Average daily spend, e.g. "$32" */
  average_daily_spend: string
  /** Total spent this month, e.g. "$1,450" */
  monthly_spend_total: string
  /** Top spending category name, e.g. "food" */
  top_category: string
  /** Top category amount, e.g. "$890" */
  top_category_amount: string
  /** Weekend average spend, e.g. "$85" */
  weekend_average_spend: string

  // ── Income & Budget ──────────────────────────────────────────────
  /** Monthly income total, e.g. "$2,500" */
  monthly_income: string
  /** Daily budget amount, e.g. "$45" */
  daily_budget: string
  /** Savings rate as percentage, e.g. "12%" */
  savings_rate: string

  // ── Debt ─────────────────────────────────────────────────────────
  /** Monthly interest on all debt, e.g. "$47" */
  debt_interest_monthly: string
  /** Total debt balance, e.g. "$3,200" */
  total_debt: string
  /** Highest-interest debt name, e.g. "Chase Visa" */
  highest_interest_debt: string
  /** Highest interest rate, e.g. "22%" */
  highest_interest_rate: string

  // ── Goals & Savings ──────────────────────────────────────────────
  /** Estimated goal completion date, e.g. "March 2027" */
  goal_completion_date: string
  /** First goal name, e.g. "Trip to Japan" */
  goal_name: string
  /** Total savings balance, e.g. "$1,200" */
  total_savings: string
  /** Monthly savings contributions, e.g. "$150" */
  monthly_savings_contribution: string

  // ── Patterns ─────────────────────────────────────────────────────
  /** Number of transactions logged, e.g. "47" */
  total_transactions: string
  /** Days since first transaction, e.g. "32" */
  days_tracking: string
  /** Food percentage of total spending, e.g. "35%" */
  food_percentage: string
}

// ============================================================================
// Template Data Builder
// ============================================================================

export interface BuildTemplateDataParams {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  debts?: Debt[]
  savingsAccounts?: SavingsAccount[]
  dailyBudget?: number
}

/**
 * Builds a `LessonTemplateData` object from user state.
 * Computes all template variables from the user's real data.
 */
export function buildLessonTemplateData(params: BuildTemplateDataParams): LessonTemplateData {
  const { transactions, budgets, goals, debts = [], savingsAccounts = [], dailyBudget = 0 } = params

  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)

  // ── Filter current month's transactions ───────────────────────────────
  const monthTxns = transactions.filter(t => t.date.startsWith(currentMonth))
  const monthExpenses = monthTxns.filter(t => t.type === 'expense')
  const monthIncome = monthTxns.filter(t => t.type === 'income')

  // ── Spending calculations ─────────────────────────────────────────────
  const totalMonthlySpend = monthExpenses.reduce((sum, t) => sum + t.amount, 0)
  const totalMonthlyIncome = monthIncome.reduce((sum, t) => sum + t.amount, 0)

  // Coffee/drinks spend (drinks category)
  const drinksExpenses = monthExpenses.filter(t => t.category === 'drinks')
  const totalDrinks = drinksExpenses.reduce((sum, t) => sum + t.amount, 0)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysSoFar = Math.max(1, now.getDate())
  const dailyCoffee = totalDrinks / daysSoFar

  // Food spend
  const foodExpenses = monthExpenses.filter(t => t.category === 'food')
  const totalFood = foodExpenses.reduce((sum, t) => sum + t.amount, 0)

  // Subscriptions
  const subExpenses = monthExpenses.filter(t => t.category === 'subscriptions')
  const totalSubs = subExpenses.reduce((sum, t) => sum + t.amount, 0)

  // Average daily spend
  const avgDailySpend = totalMonthlySpend / daysSoFar

  // Top spending category
  const categoryTotals = new Map<TransactionCategory, number>()
  for (const t of monthExpenses) {
    categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + t.amount)
  }
  let topCategory: TransactionCategory = 'other'
  let topCategoryAmount = 0
  for (const [cat, amount] of categoryTotals) {
    if (amount > topCategoryAmount) {
      topCategory = cat
      topCategoryAmount = amount
    }
  }

  // Weekend average (Sat/Sun)
  const weekendExpenses = monthExpenses.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    const day = d.getDay()
    return day === 0 || day === 6
  })
  const weekendTotal = weekendExpenses.reduce((sum, t) => sum + t.amount, 0)
  // Count weekend days elapsed this month
  let weekendDays = 0
  for (let d = 1; d <= daysSoFar; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d)
    const day = date.getDay()
    if (day === 0 || day === 6) weekendDays++
  }
  const weekendAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0

  // ── Savings rate ──────────────────────────────────────────────────────
  const savingsRate = totalMonthlyIncome > 0
    ? Math.round(((totalMonthlyIncome - totalMonthlySpend) / totalMonthlyIncome) * 100)
    : 0

  // ── Debt calculations ─────────────────────────────────────────────────
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0)
  const monthlyInterest = debts.reduce((sum, d) => {
    const monthlyRate = (d.apr ?? 0) / 100 / 12
    return sum + d.balance * monthlyRate
  }, 0)

  // Highest interest debt
  let highestInterestDebt = debts.length > 0 ? debts[0] : null
  for (const d of debts) {
    if ((d.apr ?? 0) > (highestInterestDebt?.apr ?? 0)) {
      highestInterestDebt = d
    }
  }

  // ── Goal calculations ─────────────────────────────────────────────────
  const firstGoal = goals.length > 0 ? goals[0] : null
  let goalCompletionDate = 'soon'
  if (firstGoal?.targetDate) {
    const target = new Date(firstGoal.targetDate)
    goalCompletionDate = target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // ── Savings calculations ──────────────────────────────────────────────
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0)
  const monthlySavingsContribution = savingsAccounts.reduce(
    (sum, a) => sum + (a.monthlyContribution ?? 0),
    0
  )

  // ── Tracking stats ────────────────────────────────────────────────────
  const totalTransactions = transactions.length
  let daysTracking = 0
  if (transactions.length > 0) {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const firstDate = new Date(sorted[0].date + 'T00:00:00')
    daysTracking = Math.max(1, Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // Food percentage
  const foodPercentage = totalMonthlySpend > 0
    ? Math.round((totalFood / totalMonthlySpend) * 100)
    : 0

  // ── Build the template data ───────────────────────────────────────────
  return {
    daily_coffee_cost: formatCurrency(dailyCoffee),
    monthly_food_total: formatCurrency(totalFood),
    monthly_subscriptions_total: formatCurrency(totalSubs),
    average_daily_spend: formatCurrency(avgDailySpend),
    monthly_spend_total: formatCurrency(totalMonthlySpend),
    top_category: topCategory,
    top_category_amount: formatCurrency(topCategoryAmount),
    weekend_average_spend: formatCurrency(weekendAvg),
    monthly_income: formatCurrency(totalMonthlyIncome),
    daily_budget: formatCurrency(dailyBudget),
    savings_rate: `${Math.max(0, savingsRate)}%`,
    debt_interest_monthly: formatCurrency(monthlyInterest),
    total_debt: formatCurrency(totalDebt),
    highest_interest_debt: highestInterestDebt?.name ?? 'your debt',
    highest_interest_rate: highestInterestDebt
      ? `${highestInterestDebt.apr ?? 0}%`
      : '0%',
    goal_completion_date: goalCompletionDate,
    goal_name: firstGoal?.name ?? 'your goal',
    total_savings: formatCurrency(totalSavings),
    monthly_savings_contribution: formatCurrency(monthlySavingsContribution),
    total_transactions: String(totalTransactions),
    days_tracking: String(daysTracking),
    food_percentage: `${foodPercentage}%`,
  }
}

// ============================================================================
// Template Renderer
// ============================================================================

/**
 * Replaces `{{variable}}` placeholders in a template string with values from data.
 * Unknown placeholders are left as-is (graceful degradation).
 */
export function renderTemplate(template: string, data: LessonTemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (data as unknown as Record<string, string>)[key]
    return value !== undefined ? value : match
  })
}

/**
 * Returns a new ContextualLesson with interpolated content (microContent + deepDiveContent).
 * Does not mutate the original lesson object.
 */
export function renderLesson(lesson: ContextualLesson, data: LessonTemplateData): ContextualLesson {
  return {
    ...lesson,
    microContent: renderTemplate(lesson.microContent, data),
    deepDiveContent: lesson.deepDiveContent
      ? renderTemplate(lesson.deepDiveContent, data)
      : undefined,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a number as USD currency string. Uses compact format for readability.
 */
function formatCurrency(amount: number): string {
  if (amount === 0) return '$0'
  // For amounts under $1, show cents
  if (amount < 1 && amount > 0) {
    return formatCurrencyCentral(amount, 'USD', { fractionDigits: 2 })
  }
  // For amounts under $10, show one decimal
  if (amount < 10) {
    const digits = amount % 1 === 0 ? 0 : (Math.round(amount * 10) % 10 === 0 ? 1 : 2)
    return formatCurrencyCentral(amount, 'USD', { fractionDigits: digits })
  }
  // For larger amounts, round to nearest dollar
  return formatCurrencyCentral(Math.round(amount), 'USD', { fractionDigits: 0 })
}
