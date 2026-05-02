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
      <div className="fixed inset-0 bg-black/70 z-40 animate-fade-in" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88vh] animate-slide-up" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[10px] font-mono tracking-[0.2em] text-t-muted uppercase">Set Budget Limits</span>
          <button onClick={onClose} className="text-t-muted hover:text-t-text transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5">
          {BUDGET_CATEGORIES.map(cat => {
            const spent = budgets.find(b => b.category === cat.category)?.spent ?? 0
            const isSelected = selectedCategory === cat.category
            return (
              <div
                key={cat.category}
                className="py-4"
                style={{
                  borderBottom: '1px solid var(--border)',
                  borderLeft: isSelected ? '2px solid var(--text)' : '2px solid transparent',
                  paddingLeft: isSelected ? '12px' : '0',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[11px] font-mono tracking-widest text-t-muted uppercase">{cat.label}</p>
                    {spent > 0 && (
                      <p className="text-[10px] font-mono text-t-muted mt-0.5">${spent} spent</p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-mono text-t-muted">$</span>
                    <input
                      type="number"
                      value={limits[cat.category] || ''}
                      onChange={e => setLimits(prev => ({ ...prev, [cat.category]: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                      className="bg-transparent text-xl font-mono text-t-text text-right w-24 outline-none border-b"
                      style={{ borderColor: 'var(--line)' }}
                      min="0"
                      step="10"
                    />
                    <span className="text-[10px] font-mono text-t-muted">/mo</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}   className="flex-1 btn-ghost">CANCEL</button>
          <button onClick={handleSave} className="flex-1 btn-primary">SAVE</button>
        </div>
      </div>
    </>
  )
}
