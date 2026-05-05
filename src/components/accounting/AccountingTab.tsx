"use client"
import { useState, useEffect } from 'react'
import { BudgetList } from './BudgetList'
import { GoalList } from './GoalList'
import { TransactionList } from './TransactionList'
import type { Transaction, Budget, Goal } from '@/types'

interface AccountingTabProps {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  onAddTransaction: (category?: import('@/types').TransactionCategory) => void
  onUpdateBudget: (category: import('@/types').TransactionCategory, limit: number) => void
  onDeleteTransaction: (id: string) => void
  onCreateGoal: (data: { name: string; targetAmount: number; emoji: string }) => void
  onUpdateGoal: (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => void
  onContributeToGoal: (goalId: string, amount: number) => void
  onDeleteGoal: (goalId: string) => void
}

type SubTab = 'budgets' | 'goals' | 'transactions'
const SUBTABS: { key: SubTab; label: string }[] = [
  { key: 'budgets',      label: 'Budget' },
  { key: 'goals',        label: 'Goals' },
  { key: 'transactions', label: 'History' },
]

export function AccountingTab({
  transactions, budgets, goals,
  onAddTransaction, onUpdateBudget, onDeleteTransaction,
  onCreateGoal, onUpdateGoal, onContributeToGoal, onDeleteGoal,
}: AccountingTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('budgets')
  const [animatedBalance, setAnimatedBalance] = useState(0)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTxs = transactions.filter(t => t.date.startsWith(currentMonth))
  const income    = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses  = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const available = income - expenses

  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    const steps = 50
    const inc = available / steps
    let cur = 0
    const t = setInterval(() => {
      cur += inc
      if (cur >= available) { setAnimatedBalance(available); clearInterval(t) }
      else setAnimatedBalance(Math.round(cur))
    }, 900 / steps)
    return () => clearInterval(t)
  }, [available])

  return (
    <div className="pb-20">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-6 pt-12 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Month */}
        <p className="label mb-8">{month}</p>

        {/* Balance — the hero number */}
        <div className="mb-7">
          <p style={{ fontSize: '64px', lineHeight: 1, fontFamily: 'Space Mono, monospace', fontWeight: 300, color: available < 0 ? 'var(--red)' : 'var(--text)', letterSpacing: '-0.02em' }}>
            {available < 0 ? '−' : ''}${Math.abs(animatedBalance).toLocaleString()}
          </p>
          <p className="mt-2" style={{ fontSize: '13px', color: 'var(--sub)' }}>available this month</p>
        </div>

        {/* Income / Expenses — two clear items only */}
        <div className="flex gap-8">
          <div>
            <p style={{ fontSize: '18px', fontFamily: 'Space Mono, monospace', fontWeight: 400, color: 'var(--green)' }}>
              +${income.toLocaleString()}
            </p>
            <p className="label mt-1">income</p>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
          <div>
            <p style={{ fontSize: '18px', fontFamily: 'Space Mono, monospace', fontWeight: 400, color: 'var(--red)' }}>
              −${expenses.toLocaleString()}
            </p>
            <p className="label mt-1">spent</p>
          </div>
        </div>
      </div>

      {/* ── Sub-tabs ────────────────────────────────────────── */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className="flex-1 py-4 transition-colors duration-150"
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: subTab === key ? 'var(--text)' : 'var(--muted)',
              borderBottom: subTab === key ? '1px solid var(--text)' : '1px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="px-6 pt-6">
        {subTab === 'budgets'      && <BudgetList budgets={budgets} onUpdateBudget={onUpdateBudget} onAddTransaction={onAddTransaction} />}
        {subTab === 'goals'        && <GoalList goals={goals} onCreateGoal={onCreateGoal} onUpdateGoal={onUpdateGoal} onContributeToGoal={onContributeToGoal} onDeleteGoal={onDeleteGoal} />}
        {subTab === 'transactions' && <TransactionList transactions={transactions} onDelete={onDeleteTransaction} />}
      </div>

      {/* ── FAB ─────────────────────────────────────────────── */}
      <button onClick={() => onAddTransaction()} className="t-fab" aria-label="Add transaction">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
