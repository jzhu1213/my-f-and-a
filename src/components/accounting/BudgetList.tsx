"use client"
import { useState } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, Transaction, TransactionCategory } from '@/types'
import { BudgetLimitSheet } from './BudgetLimitSheet'

interface BudgetListProps {
  budgets: Budget[]
  transactions: Transaction[]
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  onAddTransaction: (category: TransactionCategory) => void
}

/** Monday of the current week */
function weekStart(): string {
  const d = new Date()
  const day = d.getDay()               // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function BudgetList({ budgets, transactions, onUpdateBudget, onAddTransaction }: BudgetListProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const ws = weekStart()

  const budgetData = BUDGET_CATEGORIES.map(cat => {
    const budget      = budgets.find(b => b.category === cat.category)
    const monthlySpent = budget?.spent ?? 0
    const monthlyLimit = budget?.monthlyLimit ?? 0

    // Weekly limit = monthly ÷ 4.33  (≈ avg weeks/month)
    const weeklyLimit = monthlyLimit > 0 ? monthlyLimit / 4.33 : 0

    // Weekly spent from transactions this week
    const weeklySpent = transactions
      .filter(t => t.category === cat.category && t.type === 'expense' && t.date >= ws)
      .reduce((s, t) => s + t.amount, 0)

    const weekPct    = weeklyLimit > 0 ? Math.min((weeklySpent / weeklyLimit) * 100, 100) : 0
    const overWeekly = weeklyLimit > 0 && weeklySpent > weeklyLimit

    return { ...cat, monthlySpent, monthlyLimit, weeklySpent, weeklyLimit, weekPct, overWeekly }
  })

  const barColor = (d: { overWeekly: boolean; weekPct: number }) =>
    d.overWeekly ? 'var(--red)' : d.weekPct >= 80 ? 'var(--amber)' : 'var(--green)'

  const amountColor = (d: { overWeekly: boolean; weekPct: number }) =>
    d.overWeekly ? 'var(--red)' : d.weekPct >= 80 ? 'var(--amber)' : 'var(--sub)'

  return (
    <div>
      {budgetData.map(budget => (
        <button
          key={budget.category}
          onClick={() => onAddTransaction(budget.category)}
          className="w-full text-left flex flex-col gap-3 py-5 transition-colors"
          style={{ borderBottom: '1px solid var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Category name + weekly amount (primary) */}
          <div className="flex items-baseline justify-between gap-4">
            <span style={{ fontSize: '15px', color: 'var(--text)' }}>
              {budget.label}
            </span>
            <span style={{
              fontSize: '15px',
              fontFamily: 'Space Mono, monospace',
              color: amountColor(budget),
              flexShrink: 0,
            }}>
              {budget.weeklyLimit > 0
                ? `$${budget.weeklySpent.toFixed(0)}  /  $${budget.weeklyLimit.toFixed(0)}`
                : `$${budget.weeklySpent.toFixed(0)}`
              }
            </span>
          </div>

          {/* Weekly progress bar */}
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${budget.weekPct}%`, background: barColor(budget) }} />
          </div>

          {/* Monthly sub-number */}
          {budget.monthlyLimit > 0 && (
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>
              ${budget.monthlySpent.toFixed(0)} / ${budget.monthlyLimit.toFixed(0)} mo
            </p>
          )}
        </button>
      ))}

      {/* Set limits */}
      <button
        onClick={() => setIsSheetOpen(true)}
        className="w-full flex items-center justify-center gap-2.5 py-6 transition-colors"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="label" style={{ color: 'inherit' }}>Set Limits</span>
      </button>

      <BudgetLimitSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        budgets={budgets}
        onUpdateBudget={onUpdateBudget}
      />
    </div>
  )
}
