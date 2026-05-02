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
  transactions,
  budgets,
  goals,
  onAddTransaction,
  onUpdateBudget,
  onDeleteTransaction,
  onCreateGoal,
  onUpdateGoal,
  onContributeToGoal,
  onDeleteGoal,
}: AccountingTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('budgets')
  const [animatedBalance, setAnimatedBalance] = useState(0)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTxs = transactions.filter(t => t.date.startsWith(currentMonth))
  const income   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const available = income - expenses

  const daysLeft = new Date(
    new Date().getFullYear(), new Date().getMonth() + 1, 0
  ).getDate() - new Date().getDate()
  const safeToSpend = daysLeft > 0 ? Math.max(0, Math.round(available / daysLeft)) : 0

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()

  useEffect(() => {
    const steps = 40
    const increment = available / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= available) {
        setAnimatedBalance(available)
        clearInterval(timer)
      } else {
        setAnimatedBalance(Math.round(current))
      }
    }, 800 / steps)
    return () => clearInterval(timer)
  }, [available])

  return (
    <div className="pb-20">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-5 pt-10 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-8">
          <span className="text-[10px] font-mono tracking-[0.2em] text-t-muted">FOLIO</span>
          <span className="text-[10px] font-mono tracking-widest text-t-muted">{monthLabel}</span>
        </div>

        <div className="mb-1">
          <span className="text-[10px] font-mono tracking-[0.15em] text-t-muted">AVAILABLE</span>
        </div>
        <div className="text-5xl font-mono text-t-text font-normal mb-5 tracking-tight animate-slide-up">
          ${animatedBalance < 0 ? '-' : ''}{Math.abs(animatedBalance).toLocaleString()}
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-mono text-t-green">+{income.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-t-muted tracking-widest">IN</span>
          </div>
          <div className="w-px h-3" style={{ background: 'var(--line)' }} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-mono text-t-red">{expenses.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-t-muted tracking-widest">OUT</span>
          </div>
          <div className="w-px h-3" style={{ background: 'var(--line)' }} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-mono text-t-text">${safeToSpend}</span>
            <span className="text-[10px] font-mono text-t-muted tracking-widest">/DAY</span>
          </div>
        </div>
      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {SUBTABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex-1 py-3 text-[10px] font-mono tracking-[0.18em] uppercase transition-colors ${
              subTab === tab
                ? 'text-t-text border-b-2 border-t-text -mb-px'
                : 'text-t-muted hover:text-t-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="px-5 pt-4">
        {subTab === 'budgets' && (
          <BudgetList
            budgets={budgets}
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
          <TransactionList transactions={transactions} onDelete={onDeleteTransaction} />
        )}
      </div>

      {/* ── Add button ───────────────────────────────────────── */}
      <button
        onClick={() => onAddTransaction()}
        className="t-fab"
        aria-label="Add transaction"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
