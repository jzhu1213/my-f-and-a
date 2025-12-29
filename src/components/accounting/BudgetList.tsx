"use client"
import { useState } from 'react'
import { BUDGET_CATEGORIES } from '@/types'
import type { Budget, TransactionCategory } from '@/types'
import { BudgetLimitSheet } from './BudgetLimitSheet'

interface BudgetListProps {
  budgets: Budget[]
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
}

export function BudgetList({ budgets, onUpdateBudget }: BudgetListProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | undefined>()
  
  const handleBudgetClick = (category: TransactionCategory) => {
    setSelectedCategory(category)
    setIsSheetOpen(true)
  }
  
  const handleSetLimitsClick = () => {
    setSelectedCategory(undefined)
    setIsSheetOpen(true)
  }
  
  // Create display data for all categories
  const budgetData = BUDGET_CATEGORIES.map(cat => {
    const budget = budgets.find(b => b.category === cat.category)
    const spent = budget?.spent ?? 0
    const limit = budget?.monthlyLimit ?? 0
    const progress = limit > 0 ? Math.round((spent / limit) * 100) : 0
    
    return {
      ...cat,
      spent,
      limit,
      progress: Math.min(progress, 100),
      overBudget: progress > 100,
    }
  })
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {budgetData.map((budget) => (
          <div 
            key={budget.category}
            onClick={() => handleBudgetClick(budget.category)}
            className={`glass-card-solid p-4 transition-all duration-200 hover:scale-102 cursor-pointer ${
              budget.overBudget ? 'border-peach-dark/50' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{budget.emoji}</span>
              <span className="text-sm font-medium truncate">{budget.label}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="progress-bar-liquid mb-2">
              <div 
                className={`progress-bar-fill ${budget.overBudget ? '!bg-peach-dark' : ''}`}
                style={{ 
                  width: `${budget.progress}%`,
                  ['--fill-width' as string]: `${budget.progress}%` 
                }}
              />
            </div>
            
            <div className="flex justify-between text-xs">
              <span className={`font-mono ${budget.overBudget ? 'text-peach-dark' : 'text-folio-text-secondary-light dark:text-folio-text-secondary-dark'}`}>
                {budget.progress}%
              </span>
              {budget.limit > 0 ? (
                <span className="font-mono text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                  {budget.spent}/{budget.limit}
                </span>
              ) : (
                <span className="font-mono text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                  ${budget.spent}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Add Budget Button */}
      <button 
        onClick={handleSetLimitsClick}
        className="w-full glass-card-solid p-4 flex items-center justify-center gap-2 text-sage-dark dark:text-sage hover:bg-sage/10 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="font-medium">Set Budget Limits</span>
      </button>
      
      {/* Budget Limit Sheet */}
      <BudgetLimitSheet
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
          setSelectedCategory(undefined)
        }}
        budgets={budgets}
        onUpdateBudget={onUpdateBudget}
        selectedCategory={selectedCategory}
      />
    </div>
  )
}

