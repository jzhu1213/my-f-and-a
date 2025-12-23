"use client"
import { useState } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  onDelete?: (id: string) => void
}

export function TransactionList({ transactions, onDelete }: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [swipedId, setSwipedId] = useState<string | null>(null)
  
  // Filter transactions by search
  const filteredTransactions = transactions.filter(t => 
    t.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Group by date
  const groupedByDate = filteredTransactions.reduce((acc, tx) => {
    const date = tx.date
    if (!acc[date]) acc[date] = []
    acc[date].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)
  
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))
  
  const getCategoryInfo = (category: Transaction['category']) => {
    return TRANSACTION_CATEGORIES.find(c => c.category === category) || 
      { emoji: '💰', label: category, category, type: 'expense' as const }
  }
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }
  
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <svg 
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-folio-text-secondary-light dark:text-folio-text-secondary-dark" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-folio pl-12"
        />
      </div>
      
      {/* Transaction Groups */}
      {sortedDates.length > 0 ? (
        sortedDates.map(date => (
          <div key={date}>
            <h4 className="text-sm font-medium text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2 px-1">
              {formatDate(date)}
            </h4>
            <div className="glass-card-solid p-2 space-y-1">
              {groupedByDate[date].map((tx) => {
                const catInfo = getCategoryInfo(tx.category)
                const isIncome = tx.type === 'income'
                
                return (
                  <div
                    key={tx.id}
                    className={`transaction-item relative overflow-hidden ${
                      swipedId === tx.id ? 'bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                    onClick={() => setSwipedId(swipedId === tx.id ? null : tx.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{catInfo.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {tx.note || catInfo.label}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                          <span className={`px-2 py-0.5 rounded-full ${
                            isIncome 
                              ? 'bg-sage-light/50 text-sage-dark' 
                              : 'bg-peach/20 text-peach-dark'
                          }`}>
                            {catInfo.label}
                          </span>
                          {tx.isRecurring && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Recurring
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold ${
                        isIncome ? 'text-sage-dark dark:text-sage' : 'text-peach-dark dark:text-peach'
                      }`}>
                        {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                      </span>
                      
                      {/* Delete button (shown on swipe/click) */}
                      {swipedId === tx.id && onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(tx.id)
                            setSwipedId(null)
                          }}
                          className="p-2 bg-red-500 text-white rounded-lg tap-target"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="glass-card-solid p-8 text-center">
          <span className="text-4xl mb-4 block">📭</span>
          <h3 className="font-semibold mb-2">No transactions yet</h3>
          <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
            Tap the + button to add your first transaction
          </p>
        </div>
      )}
    </div>
  )
}

