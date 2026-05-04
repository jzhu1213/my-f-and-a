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
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

  const filtered = transactions.filter(t =>
    t.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const grouped = filtered.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const getCatInfo = (cat: Transaction['category']) =>
    TRANSACTION_CATEGORIES.find(c => c.category === cat) ||
    { emoji: '', label: cat, category: cat, type: 'expense' as const }

  const formatDate = (s: string) => {
    const d    = new Date(s + 'T00:00:00')
    const now  = new Date()
    const yest = new Date(now); yest.setDate(yest.getDate() - 1)
    if (s === now.toISOString().split('T')[0])   return 'Today'
    if (s === yest.toISOString().split('T')[0])  return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="t-input"
        />
      </div>

      {sortedDates.length > 0 ? (
        sortedDates.map(date => (
          <div key={date} className="mb-6">
            {/* Date header */}
            <div className="flex items-center gap-3 py-2 mb-1">
              <span className="label">{formatDate(date)}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* Rows */}
            {grouped[date].map(tx => {
              const cat      = getCatInfo(tx.category)
              const isIncome = tx.type === 'income'
              const expanded = expandedId === tx.id

              return (
                <div key={tx.id}>
                  <div
                    className="t-row cursor-pointer py-3.5 gap-3"
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                  >
                    {/* Emoji */}
                    <span className="text-lg flex-shrink-0 w-7 text-center">{cat.emoji}</span>

                    {/* Label + note */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                        {tx.note || cat.label}
                      </p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>
                        {cat.label.toUpperCase()}
                        {tx.isRecurring && <span className="ml-2">↺</span>}
                      </p>
                    </div>

                    {/* Amount */}
                    <span
                      className="text-sm font-mono flex-shrink-0 tabular-nums"
                      style={{ color: isIncome ? 'var(--green)' : 'var(--red)' }}
                    >
                      {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                    </span>
                  </div>

                  {/* Inline delete */}
                  {expanded && onDelete && (
                    <div
                      className="flex justify-end items-center px-4 py-2.5 animate-fade-in"
                      style={{ background: 'var(--raised)', borderBottom: '1px solid var(--border)' }}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(tx.id); setExpandedId(null) }}
                        className="text-xs font-mono tracking-wider uppercase transition-colors"
                        style={{ color: 'var(--red)' }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      ) : (
        <div className="py-16 text-center">
          <p className="label mb-1.5">
            {searchQuery ? 'No results' : 'No transactions'}
          </p>
          {!searchQuery && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Tap + to add your first</p>
          )}
        </div>
      )}
    </div>
  )
}
