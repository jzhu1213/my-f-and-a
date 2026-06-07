import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, Transaction, TransactionCategory } from '@/types'

export function toMonthString(d: Date): string {
  return d.toISOString().slice(0, 7)
}

export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return toMonthString(d)
}

export function weekStart(): string {
  const d   = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export function weekRangeLabel(): string {
  const start = new Date(weekStart() + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function daysLeftInWeek(): number {
  const day = new Date().getDay()
  return day === 0 ? 1 : 8 - day
}

export interface CategoryBudgetRow {
  category: TransactionCategory
  emoji: string
  label: string
  monthlyLimit: number
  monthlySpent: number
  weeklyLimit: number
  weeklySpent: number
  weeklyLeft: number
  weekPct: number
  monthPct: number
  overWeekly: boolean
  nearLimit: boolean
  hasLimit: boolean
}

export function computeCategoryBudgets(
  budgets: Budget[],
  transactions: Transaction[],
  selectedMonth: string,
  isCurrentMonth: boolean,
): CategoryBudgetRow[] {
  const ws = weekStart()

  return BUDGET_CATEGORIES.map(cat => {
    const budget       = budgets.find(b => b.category === cat.category)
    const monthlyLimit = budget?.monthlyLimit ?? 0
    const weeklyLimit  = monthlyLimit > 0 ? monthlyLimit / 4.33 : 0

    const monthlySpent = isCurrentMonth
      ? (budget?.spent ?? 0)
      : transactions
          .filter(t => t.category === cat.category && t.type === 'expense' && t.date.startsWith(selectedMonth))
          .reduce((s, t) => s + t.amount, 0)

    const weeklySpent = isCurrentMonth
      ? transactions
          .filter(t => t.category === cat.category && t.type === 'expense' && t.date >= ws)
          .reduce((s, t) => s + t.amount, 0)
      : 0

    const weeklyLeft = weeklyLimit > 0 ? weeklyLimit - weeklySpent : 0
    const weekPct    = weeklyLimit > 0 ? Math.min((weeklySpent / weeklyLimit) * 100, 100) : 0
    const monthPct   = monthlyLimit > 0 ? Math.min((monthlySpent / monthlyLimit) * 100, 100) : 0
    const overWeekly = isCurrentMonth && weeklyLimit > 0 && weeklySpent > weeklyLimit
    const nearLimit  = isCurrentMonth && !overWeekly && weeklyLimit > 0 && weekPct >= 80

    return {
      category: cat.category,
      emoji: cat.emoji,
      label: cat.label,
      monthlyLimit,
      monthlySpent,
      weeklyLimit,
      weeklySpent,
      weeklyLeft,
      weekPct,
      monthPct,
      overWeekly,
      nearLimit,
      hasLimit: monthlyLimit > 0,
    }
  })
}

export function computeWeeklyTotals(rows: CategoryBudgetRow[]) {
  const totalWeeklySpent = rows.reduce((s, b) => s + b.weeklySpent, 0)
  const totalWeeklyLimit = rows.reduce((s, b) => s + b.weeklyLimit, 0)
  const weeklyLeft       = totalWeeklyLimit - totalWeeklySpent
  const totalWeekPct     = totalWeeklyLimit > 0 ? Math.min((totalWeeklySpent / totalWeeklyLimit) * 100, 100) : 0
  const safePerDay       = totalWeeklyLimit > 0 ? Math.max(0, weeklyLeft) / daysLeftInWeek() : null

  return { totalWeeklySpent, totalWeeklyLimit, weeklyLeft, totalWeekPct, safePerDay }
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

/** Daily budget context for the Today hero */
export function computeDailyBudget(
  transactions: Transaction[],
  totals: ReturnType<typeof computeWeeklyTotals>,
) {
  const spentToday = transactions
    .filter(t => t.date === todayString() && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const overWeekly = totals.totalWeeklyLimit > 0 && totals.weeklyLeft < 0

  // Left today = daily allowance minus what's already spent today,
  // capped by what's safe to spend to stay on track for the week.
  let leftToday: number | null = null
  if (totals.totalWeeklyLimit > 0) {
    const dailyAllowance = totals.totalWeeklyLimit / 7
    const byDailyCap     = dailyAllowance - spentToday
    const byWeeklyPace   = totals.safePerDay ?? 0
    leftToday            = Math.max(0, Math.min(byDailyCap, byWeeklyPace))
  }

  return { spentToday, leftToday, overWeekly }
}
