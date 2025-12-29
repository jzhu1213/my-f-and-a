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

export function BudgetLimitSheet({ 
  isOpen, 
  onClose, 
  budgets, 
  onUpdateBudget,
  selectedCategory 
}: BudgetLimitSheetProps) {
  const [limits, setLimits] = useState<Record<TransactionCategory, number>>({} as Record<TransactionCategory, number>)
  
  useEffect(() => {
    if (isOpen) {
      // Initialize limits from current budgets
      const initialLimits = {} as Record<TransactionCategory, number>
      BUDGET_CATEGORIES.forEach(cat => {
        const budget = budgets.find(b => b.category === cat.category)
        initialLimits[cat.category] = budget?.monthlyLimit ?? 0
      })
      setLimits(initialLimits)
    }
  }, [isOpen, budgets])
  
  const handleSave = () => {
    // Save all limits
    Object.entries(limits).forEach(([category, limit]) => {
      onUpdateBudget(category as TransactionCategory, limit)
    })
    onClose()
  }
  
  const updateLimit = (category: TransactionCategory, value: string) => {
    const numValue = parseFloat(value) || 0
    setLimits(prev => ({ ...prev, [category]: numValue }))
  }
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl animate-slide-up max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-folio-text-primary-light dark:text-folio-text-primary-dark">
              Set Budget Limits
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mt-2">
            Set monthly spending limits for each category
          </p>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {BUDGET_CATEGORIES.map(cat => {
            const budget = budgets.find(b => b.category === cat.category)
            const isSelected = selectedCategory === cat.category
            
            return (
              <div 
                key={cat.category}
                className={`glass-card-solid p-4 transition-all ${
                  isSelected ? 'ring-2 ring-sage' : ''
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-medium text-folio-text-primary-light dark:text-folio-text-primary-dark">
                      {cat.label}
                    </p>
                    {budget && budget.spent > 0 && (
                      <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                        ${budget.spent} spent this month
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono text-folio-text-primary-light dark:text-folio-text-primary-dark">
                    $
                  </span>
                  <input
                    type="number"
                    value={limits[cat.category] || ''}
                    onChange={(e) => updateLimit(cat.category, e.target.value)}
                    placeholder="0"
                    className="flex-1 text-2xl font-mono bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-sage focus:outline-none transition-colors px-2 py-1"
                    min="0"
                    step="10"
                  />
                  <span className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                    / month
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-folio-bg-light dark:bg-folio-bg-dark">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 rounded-xl bg-sage text-black font-medium hover:bg-sage-dark transition-colors"
            >
              Save Limits
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

