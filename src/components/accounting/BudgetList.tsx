"use client"
import { useState } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, Transaction, TransactionCategory } from '@/types'
import { BudgetLimitSheet } from './BudgetLimitSheet'

interface BudgetListProps {
  budgets: Budget[]
  transactions: Transaction[]
  selectedMonth: string
  isCurrentMonth?: boolean
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  onAddTransaction: (category: TransactionCategory) => void
}

/** Monday of the current week as YYYY-MM-DD */
function weekStart(): string {
  const d   = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export function BudgetList({ budgets, transactions, selectedMonth, isCurrentMonth = true, onUpdateBudget, onAddTransaction }: BudgetListProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const ws = weekStart()

  const budgetData = BUDGET_CATEGORIES.map(cat => {
    const budget       = budgets.find(b => b.category === cat.category)
    const monthlyLimit = budget?.monthlyLimit ?? 0
    const weeklyLimit  = monthlyLimit > 0 ? monthlyLimit / 4.33 : 0

    // For current month use the DB spent field; for past months compute from transactions
    const monthlySpent = isCurrentMonth
      ? (budget?.spent ?? 0)
      : transactions
          .filter(t => t.category === cat.category && t.type === 'expense' && t.date.startsWith(selectedMonth))
          .reduce((s, t) => s + t.amount, 0)

    const weeklySpent = isCurrentMonth
      ? transactions
          .filter(t => t.category === cat.category && t.type === 'expense' && t.date >= ws)
          .reduce((s, t) => s + t.amount, 0)
      : 0

    const weekPct    = weeklyLimit > 0 ? Math.min((weeklySpent / weeklyLimit) * 100, 100) : 0
    const monthPct   = monthlyLimit > 0 ? Math.min((monthlySpent / monthlyLimit) * 100, 100) : 0
    const overWeekly = isCurrentMonth && weeklyLimit > 0 && weeklySpent > weeklyLimit
    const nearLimit  = isCurrentMonth && !overWeekly && weeklyLimit > 0 && weekPct >= 80

    return { ...cat, monthlySpent, monthlyLimit, weeklySpent, weeklyLimit, weekPct, monthPct, overWeekly, nearLimit }
  })

  // ── Weekly totals (current month only) ──────────────────────────
  const totalWeeklySpent = budgetData.reduce((s, b) => s + b.weeklySpent, 0)
  const totalWeeklyLimit = budgetData.reduce((s, b) => s + b.weeklyLimit, 0)
  const totalWeekPct     = totalWeeklyLimit > 0 ? Math.min((totalWeeklySpent / totalWeeklyLimit) * 100, 100) : 0

  // ── Monthly totals (past months) ────────────────────────────────
  const totalMonthlySpent = budgetData.reduce((s, b) => s + b.monthlySpent, 0)
  const totalMonthlyLimit = budgetData.reduce((s, b) => s + b.monthlyLimit, 0)
  const totalMonthPct     = totalMonthlyLimit > 0 ? Math.min((totalMonthlySpent / totalMonthlyLimit) * 100, 100) : 0

  // ── Alert state (current month only) ────────────────────────────
  const overCategories  = budgetData.filter(b => b.overWeekly)
  const nearCategories  = budgetData.filter(b => b.nearLimit)
  const hasAlert        = isCurrentMonth && (overCategories.length > 0 || nearCategories.length > 0)

  const barColor = (d: { overWeekly: boolean; weekPct: number }) =>
    d.overWeekly ? 'var(--red)' : d.weekPct >= 80 ? 'var(--amber)' : 'var(--green)'

  const amountColor = (d: { overWeekly: boolean; weekPct: number }) =>
    d.overWeekly ? 'var(--red)' : d.weekPct >= 80 ? 'var(--amber)' : 'var(--sub)'

  const alertColor = overCategories.length > 0 ? 'var(--red)' : 'var(--amber)'
  const alertBg    = overCategories.length > 0 ? 'rgba(245,101,101,0.07)' : 'rgba(246,173,85,0.07)'

  const alertMessage = (() => {
    if (overCategories.length > 0 && nearCategories.length > 0)
      return `Over budget on ${overCategories.map(b => b.label).join(', ')} · near limit on ${nearCategories.map(b => b.label).join(', ')}`
    if (overCategories.length > 0)
      return `Over weekly budget on ${overCategories.map(b => b.label).join(', ')}`
    return `Near weekly limit on ${nearCategories.map(b => b.label).join(', ')}`
  })()

  // ── Empty state: no limits set at all ──────────────────────────
  const noLimitsSet = budgetData.every(b => b.monthlyLimit === 0)

  return (
    <div>
      {/* ── First-time empty state ─────────────────────────────────── */}
      {noLimitsSet && (
        <div
          className="mb-5 px-5 py-5 flex items-start gap-4"
          style={{ background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '6px' }}
        >
          <div className="flex-1">
            <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>Set your weekly limits</p>
            <p style={{ fontSize: '13px', color: 'var(--sub)' }}>
              Tap "Set Limits" below to set a monthly budget per category — weekly limits are derived automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Alert banner ──────────────────────────────────────────── */}
      {hasAlert && (
        <div
          className="flex items-start gap-3 px-4 py-3.5 mb-4 rounded animate-fade-in"
          style={{ background: alertBg, border: `1px solid ${alertColor}22`, borderRadius: '6px' }}
        >
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: alertColor, flexShrink: 0, lineHeight: 1.5 }}>!</span>
          <p style={{ fontSize: '13px', color: alertColor, lineHeight: 1.5 }}>{alertMessage}</p>
        </div>
      )}

      {/* ── Summary bar ────────────────────────────────────────────── */}
      {isCurrentMonth ? (
        totalWeeklyLimit > 0 && (
          <div className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-baseline justify-between mb-2.5">
              <span style={{ fontSize: '13px', color: 'var(--sub)' }}>Total this week</span>
              <span style={{
                fontFamily: 'Space Mono, monospace', fontSize: '14px',
                color: totalWeeklySpent > totalWeeklyLimit ? 'var(--red)' : 'var(--sub)',
              }}>
                ${totalWeeklySpent.toFixed(0)}
                <span style={{ color: 'var(--muted)' }}> / ${totalWeeklyLimit.toFixed(0)}</span>
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${totalWeekPct}%`,
                  background: totalWeeklySpent > totalWeeklyLimit ? 'var(--red)'
                    : totalWeekPct >= 80 ? 'var(--amber)' : 'var(--green)',
                }}
              />
            </div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'right' }}>
              {totalWeekPct.toFixed(0)}% of weekly budget
            </p>
          </div>
        )
      ) : (
        totalMonthlyLimit > 0 && (
          <div className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-baseline justify-between mb-2.5">
              <span style={{ fontSize: '13px', color: 'var(--sub)' }}>Total this month</span>
              <span style={{
                fontFamily: 'Space Mono, monospace', fontSize: '14px',
                color: totalMonthlySpent > totalMonthlyLimit ? 'var(--red)' : 'var(--sub)',
              }}>
                ${totalMonthlySpent.toFixed(0)}
                <span style={{ color: 'var(--muted)' }}> / ${totalMonthlyLimit.toFixed(0)}</span>
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${totalMonthPct}%`,
                  background: totalMonthlySpent > totalMonthlyLimit ? 'var(--red)'
                    : totalMonthPct >= 80 ? 'var(--amber)' : 'var(--green)',
                }}
              />
            </div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'right' }}>
              {totalMonthPct.toFixed(0)}% of monthly budget
            </p>
          </div>
        )
      )}

      {/* ── Category rows ─────────────────────────────────────────── */}
      {budgetData.map(budget => {
        const isEmpty = budget.monthlyLimit === 0 && budget.monthlySpent === 0 && budget.weeklySpent === 0
        return (
          <button
            key={budget.category}
            onClick={() => isCurrentMonth ? onAddTransaction(budget.category) : undefined}
            className="w-full text-left flex flex-col gap-3 py-5 transition-colors"
            style={{ borderBottom: '1px solid var(--border)', cursor: isCurrentMonth ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (isCurrentMonth) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Name + amount */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '15px', color: 'var(--text)' }}>{budget.label}</span>
                {budget.overWeekly && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--red)', lineHeight: 1 }}>↑</span>
                )}
                {budget.nearLimit && !budget.overWeekly && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--amber)', lineHeight: 1 }}>~</span>
                )}
              </div>

              {isCurrentMonth ? (
                <span style={{
                  fontSize: '15px', fontFamily: 'Space Mono, monospace', flexShrink: 0,
                  color: isEmpty ? 'var(--dim)' : amountColor(budget),
                }}>
                  {budget.weeklyLimit > 0
                    ? `$${budget.weeklySpent.toFixed(0)} / $${budget.weeklyLimit.toFixed(0)}`
                    : budget.weeklySpent > 0
                      ? `$${budget.weeklySpent.toFixed(0)}`
                      : '—'}
                </span>
              ) : (
                <span style={{
                  fontSize: '15px', fontFamily: 'Space Mono, monospace', flexShrink: 0,
                  color: budget.monthlySpent === 0 ? 'var(--dim)'
                    : budget.monthlyLimit > 0 && budget.monthlySpent > budget.monthlyLimit ? 'var(--red)'
                    : 'var(--sub)',
                }}>
                  {budget.monthlyLimit > 0
                    ? `$${budget.monthlySpent.toFixed(0)} / $${budget.monthlyLimit.toFixed(0)}`
                    : budget.monthlySpent > 0
                      ? `$${budget.monthlySpent.toFixed(0)}`
                      : '—'}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${isCurrentMonth ? budget.weekPct : budget.monthPct}%`,
                  background: isCurrentMonth ? barColor(budget)
                    : budget.monthlyLimit > 0 && budget.monthlySpent > budget.monthlyLimit ? 'var(--red)'
                    : budget.monthPct >= 80 ? 'var(--amber)' : 'var(--green)',
                }}
              />
            </div>

            {/* Sub-number: monthly for current month, nothing extra for past */}
            {isCurrentMonth && budget.monthlyLimit > 0 && (
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>
                ${budget.monthlySpent.toFixed(0)} / ${budget.monthlyLimit.toFixed(0)} mo
              </p>
            )}
          </button>
        )
      })}

      {/* ── Set limits (current month only) ───────────────────────── */}
      {isCurrentMonth && (
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
      )}

      <BudgetLimitSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        budgets={budgets}
        onUpdateBudget={onUpdateBudget}
      />
    </div>
  )
}
