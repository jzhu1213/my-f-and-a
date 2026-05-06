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

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/75 z-40 animate-fade-in"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88vh] animate-slide-up"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderRadius: '8px 8px 0 0' }}
      >
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>Set Budget Limits</span>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6">
          {BUDGET_CATEGORIES.map(cat => {
            const spent = budgets.find(b => b.category === cat.category)?.spent ?? 0
            return (
              <div
                key={cat.category}
                className="py-5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--text)' }}>{cat.label}</p>
                  {spent > 0 && (
                    <p className="label mt-1">${spent} spent this month</p>
                  )}
                  {(limits[cat.category] ?? 0) > 0 && (
                    <p className="label mt-0.5" style={{ color: 'var(--dim)' }}>
                      ≈ ${(limits[cat.category] / 4.33).toFixed(0)} / wk
                    </p>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', color: 'var(--muted)' }}>$</span>
                  <input
                    type="number"
                    value={limits[cat.category] || ''}
                    onChange={e => setLimits(prev => ({ ...prev, [cat.category]: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className="bg-transparent text-right outline-none"
                    style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '22px',
                      width: '96px',
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
            )
          })}
        </div>

        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}    className="flex-1 btn-ghost">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Save</button>
        </div>
      </div>
    </>
  )
}
