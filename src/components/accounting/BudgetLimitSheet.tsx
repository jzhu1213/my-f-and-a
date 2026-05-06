"use client"
import { useState, useEffect } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, TransactionCategory } from '@/types'

interface BudgetLimitSheetProps {
  isOpen: boolean
  onClose: () => void
  budgets: Budget[]
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  selectedCategory?: TransactionCategory
}

export function BudgetLimitSheet({ isOpen, onClose, budgets, onUpdateBudget, selectedCategory }: BudgetLimitSheetProps) {
  const [limits, setLimits] = useState<Record<TransactionCategory, number>>({} as Record<TransactionCategory, number>)

  useEffect(() => {
    if (isOpen) {
      const init = {} as Record<TransactionCategory, number>
      BUDGET_CATEGORIES.forEach(cat => {
        init[cat.category] = budgets.find(b => b.category === cat.category)?.monthlyLimit ?? 0
      })
      setLimits(init)
    }
  }, [isOpen, budgets])

  const handleSave = () => {
    Object.entries(limits).forEach(([cat, limit]) => onUpdateBudget(cat as TransactionCategory, limit))
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet ${isOpen ? 'open' : ''}`} style={{ maxHeight: '88vh' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>
              Set Budget Limits
            </span>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Leave blank or tap × to remove a limit
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-6">
          {BUDGET_CATEGORIES.map(cat => {
            const spent = budgets.find(b => b.category === cat.category)?.spent ?? 0
            const isSelected = selectedCategory === cat.category
            return (
              <div
                key={cat.category}
                className="py-5 flex items-center justify-between"
                style={{
                  borderBottom: '1px solid var(--border)',
                  borderLeft: isSelected ? '2px solid var(--sub)' : '2px solid transparent',
                  paddingLeft: isSelected ? '10px' : '0',
                }}
              >
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--text)' }}>{cat.label}</p>
                  {spent > 0 && (
                    <p className="label mt-1">${spent.toFixed(0)} spent this month</p>
                  )}
                  {(limits[cat.category] ?? 0) > 0 && (
                    <p className="label mt-0.5" style={{ color: 'var(--dim)' }}>
                      ≈ ${(limits[cat.category] / 4.33).toFixed(0)} / wk
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Clear button — only shown when a limit is set */}
                  {(limits[cat.category] ?? 0) > 0 && (
                    <button
                      onClick={() => setLimits(prev => ({ ...prev, [cat.category]: 0 }))}
                      style={{ color: 'var(--muted)', padding: '4px', lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                      title="Remove limit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', color: 'var(--muted)' }}>$</span>
                    <input
                      type="number"
                      value={limits[cat.category] || ''}
                      onChange={e => setLimits(prev => ({ ...prev, [cat.category]: parseFloat(e.target.value) || 0 }))}
                      placeholder="—"
                      className="bg-transparent text-right outline-none"
                      style={{
                        fontFamily: 'Space Mono, monospace',
                        fontSize: '22px',
                        width: '88px',
                        color: 'var(--text)',
                        borderBottom: '1px solid var(--line)',
                        paddingBottom: '4px',
                        caretColor: 'var(--text)',
                      }}
                      min="0"
                      step="10"
                    />
                    <span className="label">/mo</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}    className="flex-1 btn-ghost">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Save</button>
        </div>
      </div>
    </>
  )
}
