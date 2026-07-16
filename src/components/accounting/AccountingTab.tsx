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

function toMonthString(d: Date): string {
  return d.toISOString().slice(0, 7)
}

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return toMonthString(d)
}

function currentWeekStart(): string {
  const d   = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

function weekRangeLabel(): string {
  const start = new Date(currentWeekStart() + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function daysLeftInWeek(): number {
  const day = new Date().getDay() // 0 = Sunday
  return day === 0 ? 1 : 8 - day  // Mon=7 … Sat=2, Sun=1
}

export function AccountingTab({
  transactions, budgets, goals, isLoading = false,
  onAddTransaction, onEditTransaction, onUpdateBudget, onDeleteTransaction,
  onCreateGoal, onUpdateGoal, onContributeToGoal, onDeleteGoal,
}: AccountingTabProps) {
  const [subTab,        setSubTab]        = useState<SubTab>('budgets')
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthString(new Date()))

  const currentMonth   = toMonthString(new Date())
  const isCurrentMonth = selectedMonth === currentMonth
  const ws             = currentWeekStart()

  // ── Month-scoped stats ───────────────────────────────────────
  const monthTxs      = transactions.filter(t => t.date.startsWith(selectedMonth))
  const monthIncome   = monthTxs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0)
  const monthExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const available     = monthIncome - monthExpenses

  // ── Income nudge: no income logged yet but expenses exist ────
  const showIncomeNudge = monthIncome === 0 && monthExpenses > 0

  // ── Week stats (current month only) ─────────────────────────
  const weekTxs      = isCurrentMonth ? transactions.filter(t => t.date >= ws) : []
  const weekIncome   = weekTxs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0)
  const weekExpenses = weekTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // ── Safe to spend per day (current week, current month only) ─
  const totalWeeklyLimit  = budgets.reduce((s, b) => s + (b.monthlyLimit > 0 ? b.monthlyLimit / 4.33 : 0), 0)
  const weeklyBudgetLeft  = Math.max(0, totalWeeklyLimit - weekExpenses)
  const safePerDay        = isCurrentMonth && totalWeeklyLimit > 0
    ? weeklyBudgetLeft / daysLeftInWeek()
    : null

  // ── Labels ───────────────────────────────────────────────────
  const monthLabel = new Date(selectedMonth + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekRange  = weekRangeLabel()

  return (
    <div className="pb-20">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-12 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
            style={{ color: 'var(--muted)', padding: '4px 6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <p className="label" style={{ color: isCurrentMonth ? 'var(--sub)' : 'var(--text)' }}>
            {monthLabel}
          </p>

          <button
            onClick={() => setSelectedMonth(m => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
            style={{ color: isCurrentMonth ? 'var(--border)' : 'var(--muted)', padding: '4px 6px' }}
            onMouseEnter={e => { if (!isCurrentMonth) e.currentTarget.style.color = 'var(--sub)' }}
            onMouseLeave={e => { if (!isCurrentMonth) e.currentTarget.style.color = 'var(--muted)' }}
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Balance */}
        <div className="mb-8">
          <p style={{
            fontSize: '64px', lineHeight: 1,
            fontFamily: 'Space Mono, monospace', fontWeight: 300,
            letterSpacing: '-0.02em',
            color: isLoading ? 'var(--line)'
              : showIncomeNudge ? 'var(--muted)'
              : available < 0 ? 'var(--red)' : 'var(--text)',
          }}>
            {isLoading
              ? '—'
              : showIncomeNudge
                ? '—'
                : `${available < 0 ? '−' : ''}$${Math.abs(available).toLocaleString()}`}
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--sub)' }}>
            {isLoading
              ? '\u00A0'
              : showIncomeNudge
                ? 'add income to see your balance'
                : 'available this month'}
          </p>
        </div>

        {/* Week stats (current month only) */}
        {isCurrentMonth ? (
          <>
            <p className="label mb-4" style={{ color: 'var(--sub)' }}>{isLoading ? '\u00A0' : weekRange}</p>
            <div className="flex gap-6">
              <div>
                <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: isLoading ? 'var(--line)' : 'var(--red)', lineHeight: 1 }}>
                  {isLoading ? '—' : `−$${weekExpenses.toLocaleString()}`}
                </p>
                <p className="label mt-1.5">spent</p>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  ${monthExpenses.toLocaleString()} mo
                </p>
              </div>

              <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />

              <div>
                <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: isLoading ? 'var(--line)' : 'var(--green)', lineHeight: 1 }}>
                  {isLoading ? '—' : `+$${weekIncome.toLocaleString()}`}
                </p>
                <p className="label mt-1.5">income</p>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  {isLoading ? '' : `$${monthIncome.toLocaleString()} mo`}
                </p>
              </div>

              {/* Safe to spend per day */}
              {safePerDay !== null && (
                <>
                  <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
                  <div>
                    <p style={{
                      fontSize: '20px', fontFamily: 'Space Mono, monospace', lineHeight: 1,
                      color: safePerDay <= 0 ? 'var(--red)' : safePerDay < 10 ? 'var(--amber)' : 'var(--text)',
                    }}>
                      {safePerDay <= 0 ? '$0' : `$${safePerDay.toFixed(0)}`}
                    </p>
                    <p className="label mt-1.5">safe/day</p>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      {daysLeftInWeek()}d left
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* Past month: show monthly totals only */
          <div className="flex gap-6">
            <div>
              <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: 'var(--red)', lineHeight: 1 }}>
                −${monthExpenses.toLocaleString()}
              </p>
              <p className="label mt-1.5">spent</p>
            </div>
            <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
            <div>
              <p style={{ fontSize: '20px', fontFamily: 'Space Mono, monospace', color: 'var(--green)', lineHeight: 1 }}>
                +${monthIncome.toLocaleString()}
              </p>
              <p className="label mt-1.5">income</p>
            </div>
          </div>
        )}
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
                selectedMonth={selectedMonth}
                isCurrentMonth={isCurrentMonth}
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
                transactions={monthTxs}
                onDelete={isCurrentMonth ? onDeleteTransaction : undefined}
                onEdit={isCurrentMonth ? onEditTransaction : undefined}
              />
            )}
          </>
        )}
      </div>

      {/* ── FAB — only visible for current month ───────────────── */}
      {isCurrentMonth && (
        <button onClick={() => onAddTransaction()} className="t-fab" aria-label="Add transaction">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
