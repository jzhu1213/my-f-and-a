"use client"
import { useState, useEffect } from 'react'
import { ProgressRing } from '../ui/ProgressRing'
import { BudgetList } from './BudgetList'
import { GoalList } from './GoalList'
import { TransactionList } from './TransactionList'
import type { Transaction, Budget, Goal } from '@/types'

interface AccountingTabProps {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  onAddTransaction: () => void
  onUpdateBudget: (category: import('@/types').TransactionCategory, limit: number) => void
  onDeleteTransaction: (id: string) => void
}

type SubTab = 'budgets' | 'goals' | 'transactions'

export function AccountingTab({ 
  transactions, 
  budgets, 
  goals,
  onAddTransaction,
  onUpdateBudget,
  onDeleteTransaction
}: AccountingTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('budgets')
  const [animatedBalance, setAnimatedBalance] = useState(0)
  
  // Calculate totals
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonth))
  const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const available = income - expenses
  
  // Budget calculations
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  const budgetProgress = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  
  // Safe to spend (daily)
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
  const safeToSpend = daysLeft > 0 ? Math.max(0, Math.round((available) / daysLeft)) : 0
  
  // Animate balance count-up
  useEffect(() => {
    const duration = 1000
    const steps = 30
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
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [available])

  return (
    <div className="pb-32">
      {/* Hero Section */}
      <div className="hero-gradient p-6 pt-12 pb-8">
        <p className="text-white/80 text-sm font-medium mb-1">$Folio</p>
        <h1 className="text-5xl font-mono text-white font-bold mb-1">
          ${animatedBalance.toLocaleString()}
        </h1>
        <p className="text-white/70 text-lg">Available this month</p>
      </div>
      
      {/* Two Glass Cards */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-2 gap-3 stagger-1">
          {/* Budget Progress */}
          <div className="glass-card-solid p-4 flex flex-col items-center">
            <ProgressRing 
              progress={budgetProgress} 
              size={60} 
              strokeWidth={6}
              color="sage"
            />
            <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark mt-2 text-center">
              Budget
            </p>
          </div>
          
          {/* Safe to Spend */}
          <div className="glass-card-solid p-4 flex flex-col items-center bg-sage-light/50 dark:bg-sage-dark/20">
            <p className="text-2xl font-mono font-bold text-sage-dark dark:text-sage">
              ${safeToSpend}
            </p>
            <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark mt-2 text-center">
              Safe today
            </p>
          </div>
        </div>
      </div>
      
      {/* Sub-Tab Navigation */}
      <div className="px-4 mt-6 stagger-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['budgets', 'goals', 'transactions'] as SubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`category-pill whitespace-nowrap ${
                subTab === tab 
                  ? 'bg-sage text-black' 
                  : 'bg-folio-bg-light dark:bg-folio-bg-dark border border-gray-200 dark:border-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Sub-Tab Content */}
      <div className="px-4 mt-4 stagger-3">
        {subTab === 'budgets' && <BudgetList budgets={budgets} onUpdateBudget={onUpdateBudget} />}
        {subTab === 'goals' && <GoalList goals={goals} />}
        {subTab === 'transactions' && <TransactionList transactions={transactions} onDelete={onDeleteTransaction} />}
      </div>
      
      {/* Floating Action Button */}
      <button 
        onClick={onAddTransaction}
        className="fab"
        aria-label="Add transaction"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
