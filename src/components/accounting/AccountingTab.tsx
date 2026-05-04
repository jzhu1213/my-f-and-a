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
const SUBTABS: SubTab[] = ['budgets', 'goals', 'transactions']

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

  const daysLeft = new Date(
    new Date().getFullYear(), new Date().getMonth() + 1, 0
  ).getDate() - new Date().getDate()
  const safeToSpend = daysLeft > 0 ? Math.max(0, Math.round(available / daysLeft)) : 0

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()

  useEffect(() => {
    const steps = 50
    const increment = available / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= available) { setAnimatedBalance(available); clearInterval(timer) }
      else setAnimatedBalance(Math.round(current))
    }, 900 / steps)
    return () => clearInterval(timer)
  }, [available])

  const balanceColor = available < 0 ? 'var(--red)' : 'var(--text)'

  return (
    <div className="pb-20">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-5 pt-10 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Top row */}
        <div className="flex items-center justify-between mb-7">
          <span className="label">folio</span>
          <span className="label">{monthLabel}</span>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <span className="label mb-2 block">available</span>
          <div
            className="text-[52px] leading-none font-mono tracking-tighter animate-slide-up"
            style={{ color: balanceColor, fontWeight: 300 }}
          >
            {available < 0 ? '−' : ''}${Math.abs(animatedBalance).toLocaleString()}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-0 divide-x" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          <div className="flex items-baseline gap-1.5 pr-4">
            <span className="text-sm font-mono" style={{ color: 'var(--green)' }}>+${income.toLocaleString()}</span>
            <span className="label">in</span>
          </div>
          <div className="flex items-baseline gap-1.5 px-4">
            <span className="text-sm font-mono" style={{ color: 'var(--red)' }}>${expenses.toLocaleString()}</span>
            <span className="label">out</span>
          </div>
          <div className="flex items-baseline gap-1.5 pl-4">
            <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>${safeToSpend}</span>
            <span className="label">/day</span>
          </div>
        </div>
      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────────── */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {SUBTABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className="flex-1 py-3.5 transition-colors duration-150 relative"
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: subTab === tab ? 'var(--text)' : 'var(--muted)',
              borderBottom: subTab === tab ? '1px solid var(--text)' : '1px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="px-5 pt-5">
        {subTab === 'budgets'      && <BudgetList budgets={budgets} onUpdateBudget={onUpdateBudget} onAddTransaction={onAddTransaction} />}
        {subTab === 'goals'        && <GoalList goals={goals} onCreateGoal={onCreateGoal} onUpdateGoal={onUpdateGoal} onContributeToGoal={onContributeToGoal} onDeleteGoal={onDeleteGoal} />}
        {subTab === 'transactions' && <TransactionList transactions={transactions} onDelete={onDeleteTransaction} />}
      </div>

      {/* ── FAB ───────────────────────────────────────────────────── */}
      <button onClick={() => onAddTransaction()} className="t-fab" aria-label="Add transaction">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
