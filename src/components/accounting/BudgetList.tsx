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
    const budget     = budgets.find(b => b.category === cat.category)
    const spent      = budget?.spent ?? 0
    const limit      = budget?.monthlyLimit ?? 0
    const pct        = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
    const overBudget = limit > 0 && spent > limit
    return { ...cat, spent, limit, pct, overBudget }
  })

  const barColor = (d: { overBudget: boolean; pct: number }) =>
    d.overBudget ? 'var(--red)' : d.pct >= 80 ? 'var(--amber)' : 'var(--green)'

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
          {/* Category name + amount */}
          <div className="flex items-baseline justify-between gap-4">
            <span style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 400 }}>
              {budget.label}
            </span>
            <span style={{
              fontSize: '15px',
              fontFamily: 'Space Mono, monospace',
              color: budget.overBudget ? 'var(--red)' : budget.pct >= 80 ? 'var(--amber)' : 'var(--sub)',
              flexShrink: 0,
            }}>
              {budget.limit > 0
                ? `$${budget.spent.toFixed(0)}  /  $${budget.limit.toFixed(0)}`
                : `$${budget.spent.toFixed(0)}`
              }
            </span>
          </div>

          {/* Progress bar */}
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${budget.pct}%`, background: barColor(budget) }} />
          </div>
        </button>
      ))}

      {/* Set limits button */}
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
