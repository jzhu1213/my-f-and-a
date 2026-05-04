"use client"
import { useState } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, TransactionCategory } from '@/types'
import { BudgetLimitSheet } from './BudgetLimitSheet'

interface BudgetListProps {
  budgets: Budget[]
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  onAddTransaction: (category: TransactionCategory) => void
}

export function BudgetList({ budgets, onUpdateBudget, onAddTransaction }: BudgetListProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const budgetData = BUDGET_CATEGORIES.map(cat => {
    const budget   = budgets.find(b => b.category === cat.category)
    const spent    = budget?.spent ?? 0
    const limit    = budget?.monthlyLimit ?? 0
    const pct      = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0
    const overBudget = limit > 0 && spent > limit
    return { ...cat, spent, limit, pct, overBudget }
  })

  const barColor = (d: { overBudget: boolean; pct: number }) => {
    if (d.overBudget)  return 'var(--red)'
    if (d.pct >= 80)   return 'var(--amber)'
    return 'var(--green)'
  }

  const amountColor = (d: { overBudget: boolean; pct: number }) => {
    if (d.overBudget)  return 'var(--red)'
    if (d.pct >= 80)   return 'var(--amber)'
    return 'var(--sub)'
  }

  return (
    <div>
      {budgetData.map(budget => (
        <button
          key={budget.category}
          onClick={() => onAddTransaction(budget.category)}
          className="t-row w-full text-left py-4 px-0 flex-col items-stretch gap-2.5"
        >
          {/* Top row */}
          <div className="flex items-center justify-between w-full">
            <span className="label">{budget.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: amountColor(budget) }}>
                {budget.limit > 0
                  ? `$${budget.spent.toFixed(0)} / $${budget.limit.toFixed(0)}`
                  : `$${budget.spent.toFixed(0)}`
                }
              </span>
              <span
                className="text-[10px] font-mono w-8 text-right"
                style={{ color: budget.overBudget ? 'var(--red)' : 'var(--muted)' }}
              >
                {budget.pct}%
              </span>
            </div>
          </div>

          {/* Bar */}
          <div className="progress-track w-full">
            <div
              className="progress-fill"
              style={{ width: `${budget.pct}%`, background: barColor(budget) }}
            />
          </div>
        </button>
      ))}

      {/* Set limits */}
      <button
        onClick={() => setIsSheetOpen(true)}
        className="w-full py-5 flex items-center justify-center gap-2 transition-colors mt-1"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
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
