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
    const budget = budgets.find(b => b.category === cat.category)
    const spent    = budget?.spent ?? 0
    const limit    = budget?.monthlyLimit ?? 0
    const progress = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0
    const overBudget = limit > 0 && spent > limit

    return { ...cat, spent, limit, progress, overBudget }
  })

  const barColor = (d: { overBudget: boolean; progress: number }) => {
    if (d.overBudget)       return 'var(--red)'
    if (d.progress >= 80)   return 'var(--amber)'
    return 'var(--green)'
  }

  return (
    <div>
      {/* Row list */}
      <div>
        {budgetData.map(budget => (
          <button
            key={budget.category}
            onClick={() => onAddTransaction(budget.category)}
            className="w-full text-left py-4 transition-colors hover:bg-t-hover"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono tracking-widest text-t-muted uppercase">
                {budget.label}
              </span>
              <div className="flex items-center gap-3">
                {budget.limit > 0 ? (
                  <span
                    className="text-xs font-mono"
                    style={{ color: budget.overBudget ? 'var(--red)' : budget.progress >= 80 ? 'var(--amber)' : 'var(--muted)' }}
                  >
                    ${budget.spent.toFixed(0)}&nbsp;/&nbsp;${budget.limit.toFixed(0)}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-t-muted">
                    ${budget.spent.toFixed(0)}
                  </span>
                )}
                <span
                  className="text-[10px] font-mono w-8 text-right"
                  style={{ color: budget.overBudget ? 'var(--red)' : 'var(--muted)' }}
                >
                  {budget.progress}%
                </span>
              </div>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${budget.progress}%`,
                  background: barColor(budget),
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Set limits */}
      <button
        onClick={() => setIsSheetOpen(true)}
        className="w-full py-4 flex items-center justify-center gap-2 text-[11px] font-mono tracking-widest text-t-muted hover:text-t-text transition-colors uppercase mt-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Set Limits
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
