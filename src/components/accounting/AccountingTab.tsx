"use client"
import { useState } from 'react'
import { BudgetList } from './BudgetList'
import { GoalList } from './GoalList'
import { TransactionList } from './TransactionList'
import type { Transaction, Budget, Goal } from '@/types'

interface AccountingTabProps {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  isLoading?: boolean
  onAddTransaction: (category?: import('@/types').TransactionCategory) => void
  onEditTransaction: (tx: Transaction) => void
  onUpdateBudget: (category: import('@/types').TransactionCategory, limit: number) => void
  onDeleteTransaction: (id: string) => void
  onCreateGoal: (data: { name: string; targetAmount: number; emoji: string }) => void
  onUpdateGoal: (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => void
  onContributeToGoal: (goalId: string, amount: number) => void
  onDeleteGoal: (goalId: string) => void
}

type SubTab = 'budgets' | 'goals' | 'transactions'
const SUBTABS: { key: SubTab; label: string }[] = [
  { key: 'budgets',      label: 'Budget'  },
  { key: 'goals',        label: 'Goals'   },
  { key: 'transactions', label: 'History' },
]

function currentWeekStart(): string {
  const d = new Date()
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()))
  return d.toISOString().split('T')[0]
}

function weekRangeLabel(): string {
  const start = new Date(currentWeekStart() + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function AccountingTab({
  transactions, budgets, goals, isLoading = false,
  onAddTransaction, onEditTransaction, onUpdateBudget, onDeleteTransaction,
  onCreateGoal, onUpdateGoal, onContributeToGoal, onDeleteGoal,
}: AccountingTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('budgets')

  const currentMonth = new Date().toISOString().slice(0, 7)
  const ws           = currentWeekStart()

  const monthTxs      = transactions.filter(t => t.date.startsWith(currentMonth))
  const monthIncome   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const available     = monthIncome - monthExpenses

  const weekTxs      = transactions.filter(t => t.date >= ws)
  const weekIncome   = weekTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const weekExpenses = weekTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const month     = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekRange = weekRangeLabel()

  return (
    <div className="pb-20">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-12 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="label mb-8">{month}</p>

        {/* Balance — no animation, just the number */}
        <div className="mb-8">
          <p style={{
            fontSize: '64px', lineHeight: 1,
            fontFamily: 'Space Mono, monospace', fontWeight: 300,
            color: available < 0 ? 'var(--red)' : 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            {available < 0 ? '−' : ''}${Math.abs(available).toLocaleString()}
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--sub)' }}>available this month</p>
        </div>

        {/* Week range + weekly stats */}
        <p className="label mb-4" style={{ color: 'var(--sub)' }}>{weekRange}</p>
        <div className="flex gap-8">
          <div>
            <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: 'var(--red)', lineHeight: 1 }}>
              −${weekExpenses.toLocaleString()}
            </p>
            <p className="label mt-1.5">spent</p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              ${monthExpenses.toLocaleString()} mo
            </p>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
          <div>
            <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: 'var(--green)', lineHeight: 1 }}>
              +${weekIncome.toLocaleString()}
            </p>
            <p className="label mt-1.5">income</p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              ${monthIncome.toLocaleString()} mo
            </p>
          </div>
        </div>
      </div>

      {/* ── Sub-tabs — sticky so they stay visible while scrolling ── */}
      <div
        className="flex sticky top-0 z-30"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      >
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
              borderBottom: subTab === key ? '2px solid var(--text)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="px-6 pt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-6 h-6 animate-spin"
              style={{ border: '1px solid var(--line)', borderTopColor: 'var(--sub)', borderRadius: '50%' }}
            />
            <p className="label">loading</p>
          </div>
        ) : (
          <>
            {subTab === 'budgets' && (
              <BudgetList
                budgets={budgets}
                transactions={transactions}
                onUpdateBudget={onUpdateBudget}
                onAddTransaction={onAddTransaction}
              />
            )}
            {subTab === 'goals' && (
              <GoalList
                goals={goals}
                onCreateGoal={onCreateGoal}
                onUpdateGoal={onUpdateGoal}
                onContributeToGoal={onContributeToGoal}
                onDeleteGoal={onDeleteGoal}
              />
            )}
            {subTab === 'transactions' && (
              <TransactionList
                transactions={transactions}
                onDelete={onDeleteTransaction}
                onEdit={onEditTransaction}
              />
            )}
          </>
        )}
      </div>

      {/* ── FAB ────────────────────────────────────────────────── */}
      <button onClick={() => onAddTransaction()} className="t-fab" aria-label="Add transaction">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
