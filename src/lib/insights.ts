import type { Transaction, Budget, SmartInsight, TransactionCategory } from '@/types'

// Rule-based insights generation (Phase 1 - future TensorFlow.js ready)
export function generateInsights(
  transactions: Transaction[],
  budgets: Budget[]
): SmartInsight[] {
  const insights: SmartInsight[] = []
  
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTx = transactions.filter(t => t.date.startsWith(currentMonth))
  
  const income = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const available = income - expenses
  
  // Calculate days remaining in month
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - today.getDate()
  
  // 1. Safe to spend today
  if (available > 0 && daysLeft > 0) {
    const safeAmount = Math.round(available / daysLeft)
    insights.push({
      id: 'safe-to-spend',
      type: 'safe_to_spend',
      title: `Safe to spend: $${safeAmount} today`,
      description: `Based on your ${daysLeft} days left this month`,
    })
  }
  
  // 2. Spending increase detection
  const lastMonth = getLastMonth(currentMonth)
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonth))
  
  // Check each category
  const categorySpending: Record<TransactionCategory, { current: number; last: number }> = {} as any
  
  for (const tx of monthTx.filter(t => t.type === 'expense')) {
    if (!categorySpending[tx.category]) {
      categorySpending[tx.category] = { current: 0, last: 0 }
    }
    categorySpending[tx.category].current += tx.amount
  }
  
  for (const tx of lastMonthTx.filter(t => t.type === 'expense')) {
    if (!categorySpending[tx.category]) {
      categorySpending[tx.category] = { current: 0, last: 0 }
    }
    categorySpending[tx.category].last += tx.amount
  }
  
  for (const [category, spending] of Object.entries(categorySpending)) {
    if (spending.last > 0 && spending.current > spending.last * 1.2) {
      const increase = Math.round(((spending.current - spending.last) / spending.last) * 100)
      insights.push({
        id: `spending-increase-${category}`,
        type: 'spending_increase',
        title: `${capitalize(category)} spending up ${increase}%`,
        description: `$${spending.current} vs $${spending.last} last month`,
        actionLabel: 'Adjust?',
        actionType: 'adjust_budget',
        category: category as TransactionCategory,
      })
    }
  }
  
  // 3. Income pattern detection (for gig workers)
  const incomeTransactions = monthTx.filter(t => t.type === 'income' && t.category === 'gig')
  if (incomeTransactions.length >= 3) {
    const avgGigIncome = Math.round(incomeTransactions.reduce((s, t) => s + t.amount, 0) / incomeTransactions.length)
    insights.push({
      id: 'gig-income-pattern',
      type: 'income_pattern',
      title: `Gig income steady at ~$${avgGigIncome}`,
      description: `Consider setting a $${avgGigIncome}/mo savings goal`,
      actionLabel: 'Set Goal',
      actionType: 'set_goal',
      value: avgGigIncome,
    })
  }
  
  // 4. Under budget celebration
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  
  if (totalBudget > 0 && totalSpent < totalBudget * 0.7 && today.getDate() > 20) {
    const saved = Math.round(totalBudget - totalSpent)
    insights.push({
      id: 'under-budget',
      type: 'under_budget',
      title: `Under budget by $${saved}!`,
      description: 'Great job this month! Reward yourself?',
      actionLabel: '$10 treat?',
      actionType: 'reward',
      value: 10,
    })
  }
  
  // 5. Recurring transaction suggestion
  const recentTx = transactions.slice(0, 10).filter(t => !t.isRecurring && t.type === 'expense')
  for (const tx of recentTx) {
    // Check if similar transaction exists (same category, similar amount)
    const similar = transactions.filter(t => 
      t.id !== tx.id && 
      t.category === tx.category && 
      Math.abs(t.amount - tx.amount) < tx.amount * 0.1 &&
      !t.isRecurring
    )
    
    if (similar.length >= 2) {
      insights.push({
        id: `recurring-${tx.id}`,
        type: 'recurring_suggestion',
        title: `${tx.note || capitalize(tx.category)} detected`,
        description: 'This looks like a recurring expense',
        actionLabel: 'Make recurring',
        actionType: 'make_recurring',
      })
      break // Only show one recurring suggestion
    }
  }
  
  // Limit to 5 insights max
  return insights.slice(0, 5)
}

function getLastMonth(currentMonth: string): string {
  const [year, month] = currentMonth.split('-').map(Number)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

