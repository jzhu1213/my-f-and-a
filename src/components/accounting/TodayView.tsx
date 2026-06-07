"use client"
import { useState } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Budget, Transaction, TransactionCategory } from '@/types'
import {
  computeCategoryBudgets,
  computeWeeklyTotals,
  daysLeftInWeek,
  toMonthString,
  weekRangeLabel,
} from '@/lib/budgetUtils'
import type { CategoryBudgetRow } from '@/lib/budgetUtils'
import { getRecentRepeats } from '@/lib/transactionUtils'
import type { TransactionRepeat } from '@/lib/transactionUtils'
import { CategoryDetailSheet } from './CategoryDetailSheet'

interface TodayViewProps {
  transactions: Transaction[]
  budgets: Budget[]
  isLoading?: boolean
  onLogExpense: (category?: TransactionCategory) => void
  onLogIncome: () => void
  onRepeatLog: (repeat: TransactionRepeat) => void
  onOpenLimits: () => void
  onViewHistory: () => void
  onEditTransaction: (tx: Transaction) => void
}

function getLabel(cat: TransactionCategory) {
  return TRANSACTION_CATEGORIES.find(c => c.category === cat)?.label ?? cat
}

export function TodayView({
  transactions, budgets, isLoading = false,
  onLogExpense, onLogIncome, onRepeatLog,
  onOpenLimits, onViewHistory, onEditTransaction,
}: TodayViewProps) {
  const [showMonthSummary, setShowMonthSummary] = useState(false)
  const [detailRow,       setDetailRow]       = useState<CategoryBudgetRow | null>(null)

  const currentMonth = toMonthString(new Date())
  const rows         = computeCategoryBudgets(budgets, transactions, currentMonth, true)
  const totals       = computeWeeklyTotals(rows)
  const weekRange    = weekRangeLabel()
  const repeats      = getRecentRepeats(transactions, 3)

  const monthTxs      = transactions.filter(t => t.date.startsWith(currentMonth))
  const monthIncome   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const showIncomeNudge = monthIncome === 0 && monthExpenses > 0

  const noLimitsSet = rows.every(r => !r.hasLimit)

  const sortedRows = [...rows].sort((a, b) => {
    if (a.overWeekly !== b.overWeekly) return a.overWeekly ? -1 : 1
    if (a.hasLimit !== b.hasLimit) return a.hasLimit ? -1 : 1
    if (a.hasLimit && b.hasLimit) return a.weeklyLeft - b.weeklyLeft
    return b.weeklySpent - a.weeklySpent
  })

  const recentTxs = transactions.slice(0, 5)

  const heroAmount = (() => {
    if (isLoading || noLimitsSet) return null
    if (totals.weeklyLeft < 0) return { value: `$${Math.abs(totals.weeklyLeft).toFixed(0)}`, over: true }
    return { value: `$${Math.max(0, totals.weeklyLeft).toFixed(0)}`, over: false }
  })()

  return (
    <>
      <div className="pb-24">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="px-6 pt-12 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-6">
            <p className="label">{isLoading ? '\u00A0' : weekRange}</p>
            <button
              onClick={onOpenLimits}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              limits →
            </button>
          </div>

          {isLoading ? (
            <div className="mb-6">
              <p style={{ fontSize: '56px', fontFamily: 'Space Mono, monospace', color: 'var(--line)', lineHeight: 1 }}>—</p>
            </div>
          ) : noLimitsSet ? (
            <div className="mb-6">
              <p style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '8px', lineHeight: 1.3 }}>
                Set limits to see what&apos;s left
              </p>
              <p style={{ fontSize: '14px', color: 'var(--sub)', marginBottom: '16px' }}>
                Know instantly if you can afford coffee, dinner, or going out.
              </p>
              <button onClick={onOpenLimits} className="btn-primary w-full">Set weekly limits</button>
            </div>
          ) : (
            <div className="mb-6">
              <p style={{
                fontSize: '56px', lineHeight: 1, fontFamily: 'Space Mono, monospace', fontWeight: 300,
                letterSpacing: '-0.02em', color: heroAmount?.over ? 'var(--red)' : 'var(--text)',
              }}>
                {heroAmount?.over ? '−' : ''}{heroAmount?.value}
              </p>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--sub)' }}>
                {heroAmount?.over ? 'over budget this week' : 'left this week'}
              </p>
              {totals.safePerDay !== null && !heroAmount?.over && (
                <p style={{
                  marginTop: '12px', fontFamily: 'Space Mono, monospace', fontSize: '14px',
                  color: totals.safePerDay <= 0 ? 'var(--red)' : totals.safePerDay < 10 ? 'var(--amber)' : 'var(--sub)',
                }}>
                  ≈ ${Math.max(0, totals.safePerDay).toFixed(0)}/day · {daysLeftInWeek()}d left
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => onLogExpense()} className="flex-1 btn-primary" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
              − Log expense
            </button>
            <button onClick={onLogIncome} className="flex-1 btn-ghost" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
              + Log income
            </button>
          </div>
        </div>

        {/* ── Log again ─────────────────────────────────────────── */}
        {repeats.length > 0 && (
          <div className="px-6 pt-5 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="label mb-3">Log again</p>
            <div className="flex gap-2 flex-wrap pb-3">
              {repeats.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onRepeatLog(r)}
                  className="amount-chip"
                  style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.type === 'income' ? '+' : '−'}{r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Categories — tap to check, not log ─────────────────── */}
        <div className="px-6 pt-6">
          <p className="label mb-4">By category</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', marginTop: '-8px' }}>
            Tap to check what&apos;s left
          </p>

          {sortedRows.map(row => {
            const leftLabel = (() => {
              if (!row.hasLimit) return row.weeklySpent > 0 ? `$${row.weeklySpent.toFixed(0)} spent` : 'no limit'
              if (row.overWeekly) return `$${Math.abs(row.weeklyLeft).toFixed(0)} over`
              return `$${Math.max(0, row.weeklyLeft).toFixed(0)} left`
            })()

            const rightColor = !row.hasLimit ? 'var(--dim)'
              : row.overWeekly ? 'var(--red)' : row.nearLimit ? 'var(--amber)' : 'var(--green)'

            return (
              <button
                key={row.category}
                onClick={() => setDetailRow(row)}
                className="w-full text-left flex items-center gap-4 py-4 transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{row.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span style={{ fontSize: '15px', color: 'var(--text)' }}>{row.label}</span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', color: rightColor, flexShrink: 0 }}>
                      {leftLabel}
                    </span>
                  </div>
                  {row.hasLimit && (
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${row.weekPct}%`,
                          background: row.overWeekly ? 'var(--red)' : row.nearLimit ? 'var(--amber)' : 'var(--green)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Recent ──────────────────────────────────────────────── */}
        {recentTxs.length > 0 && (
          <div className="px-6 pt-8">
            <div className="flex items-center justify-between mb-4">
              <p className="label">Recent</p>
              <button onClick={onViewHistory} style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>
                all →
              </button>
            </div>
            {recentTxs.map(tx => {
              const isIncome = tx.type === 'income'
              return (
                <button
                  key={tx.id}
                  onClick={() => onEditTransaction(tx)}
                  className="w-full flex items-center justify-between gap-4 py-3.5 text-left transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: '14px', color: 'var(--text)' }} className="truncate">
                      {tx.note || getLabel(tx.category)}
                    </p>
                    <p className="label mt-0.5">{getLabel(tx.category)}</p>
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', color: isIncome ? 'var(--green)' : 'var(--text)', flexShrink: 0 }}>
                    {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Month summary ───────────────────────────────────────── */}
        <div className="px-6 pt-6">
          <button
            onClick={() => setShowMonthSummary(v => !v)}
            className="w-full flex items-center justify-between py-4"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="label">This month</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>
              {showMonthSummary ? '−' : '+'}
            </span>
          </button>
          {showMonthSummary && (
            <div className="pb-4 animate-fade-in">
              {showIncomeNudge ? (
                <div className="flex items-center justify-between gap-4">
                  <p style={{ fontSize: '14px', color: 'var(--sub)' }}>Log income to see your balance</p>
                  <button onClick={onLogIncome} className="label" style={{ color: 'var(--green)', flexShrink: 0 }}>
                    + log
                  </button>
                </div>
              ) : (
                <div className="flex gap-8">
                  <div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', color: 'var(--green)' }}>+${monthIncome.toLocaleString()}</p>
                    <p className="label mt-1">income</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', color: 'var(--red)' }}>−${monthExpenses.toLocaleString()}</p>
                    <p className="label mt-1">spent</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', color: monthIncome - monthExpenses < 0 ? 'var(--red)' : 'var(--text)' }}>
                      ${Math.abs(monthIncome - monthExpenses).toLocaleString()}
                    </p>
                    <p className="label mt-1">net</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CategoryDetailSheet
        isOpen={!!detailRow}
        onClose={() => setDetailRow(null)}
        row={detailRow}
        transactions={transactions}
        onLogHere={cat => { setDetailRow(null); onLogExpense(cat) }}
      />
    </>
  )
}
