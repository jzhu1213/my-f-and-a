"use client"
import { useState } from 'react'
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
  const [showLimitSheet, setShowLimitSheet] = useState(false)

  const limitsSet = budgets.some(b => b.monthlyLimit > 0)

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
          Adjust how much you can spend per week. Monthly limits are split into weekly budgets automatically.
        </p>
      </div>

      <div className="px-6 pt-6">
        {/* Budget limits section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <p className="label">Weekly limits</p>
            <button
              onClick={() => setShowLimitSheet(true)}
              style={{
                fontFamily: 'Space Mono, monospace', fontSize: '11px',
                letterSpacing: '0.08em', color: 'var(--sub)',
              }}
            >
              {limitsSet ? 'edit →' : 'set →'}
            </button>
          </div>

          {!limitsSet ? (
            <button
              onClick={() => setShowLimitSheet(true)}
              className="w-full py-8 text-center transition-colors"
              style={{
                background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '6px',
                color: 'var(--sub)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>No limits set</p>
              <p style={{ fontSize: '13px' }}>Tap to set Food, Rent, Fun, etc.</p>
            </button>
          ) : (
            <button
              onClick={() => setShowLimitSheet(true)}
              className="w-full text-left py-4 transition-colors"
              style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <span className="label">Tap to adjust category limits</span>
            </button>
          )}
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
        onClose={() => setShowLimitSheet(false)}
        budgets={budgets}
        onUpdateBudget={onUpdateBudget}
      />
    </div>
  )
}
