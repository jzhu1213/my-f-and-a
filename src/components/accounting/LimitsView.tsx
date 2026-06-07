"use client"
import { useState } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import { BudgetLimitSheet } from './BudgetLimitSheet'
import { GoalList } from './GoalList'
import type { Budget, Goal, TransactionCategory } from '@/types'

interface LimitsViewProps {
  budgets: Budget[]
  goals: Goal[]
  onBack: () => void
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  onCreateGoal: (data: { name: string; targetAmount: number; emoji: string }) => void
  onUpdateGoal: (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => void
  onContributeToGoal: (goalId: string, amount: number) => void
  onDeleteGoal: (goalId: string) => void
}

export function LimitsView({
  budgets, goals, onBack,
  onUpdateBudget, onCreateGoal, onUpdateGoal, onContributeToGoal, onDeleteGoal,
}: LimitsViewProps) {
  const [showLimitSheet, setShowLimitSheet]       = useState(false)
  const [focusCategory, setFocusCategory]         = useState<TransactionCategory | undefined>()

  const openSheet = (cat?: TransactionCategory) => {
    setFocusCategory(cat)
    setShowLimitSheet(true)
  }

  return (
    <div className="pb-24">
      <div className="px-6 pt-12 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 transition-colors"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="label" style={{ color: 'inherit' }}>back</span>
        </button>
        <p className="label mb-4">limits & savings</p>
        <p style={{ fontSize: '14px', color: 'var(--sub)', lineHeight: 1.5 }}>
          Monthly limits split into weekly budgets on Today.
        </p>
      </div>

      <div className="px-6 pt-6">
        {/* Inline limits list */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <p className="label">Category limits</p>
            <button
              onClick={() => openSheet()}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--sub)' }}
            >
              edit all →
            </button>
          </div>

          {BUDGET_CATEGORIES.map(cat => {
            const budget       = budgets.find(b => b.category === cat.category)
            const monthlyLimit = budget?.monthlyLimit ?? 0
            const weeklyLimit  = monthlyLimit > 0 ? monthlyLimit / 4.33 : 0

            return (
              <button
                key={cat.category}
                onClick={() => openSheet(cat.category)}
                className="w-full flex items-center justify-between gap-4 py-4 text-left transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{ fontSize: '15px', color: 'var(--text)' }}>{cat.label}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  {monthlyLimit > 0 ? (
                    <>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', color: 'var(--text)' }}>
                        ${monthlyLimit.toFixed(0)}/mo
                      </p>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        ≈ ${weeklyLimit.toFixed(0)}/wk
                      </p>
                    </>
                  ) : (
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', color: 'var(--dim)' }}>
                      not set
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Savings goals */}
        <div>
          <p className="label mb-4">Savings goals</p>
          <GoalList
            goals={goals}
            onCreateGoal={onCreateGoal}
            onUpdateGoal={onUpdateGoal}
            onContributeToGoal={onContributeToGoal}
            onDeleteGoal={onDeleteGoal}
          />
        </div>
      </div>

      <BudgetLimitSheet
        isOpen={showLimitSheet}
        onClose={() => { setShowLimitSheet(false); setFocusCategory(undefined) }}
        budgets={budgets}
        onUpdateBudget={onUpdateBudget}
        selectedCategory={focusCategory}
      />
    </div>
  )
}
