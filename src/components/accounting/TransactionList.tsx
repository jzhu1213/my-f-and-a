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
    const d   = new Date(s + 'T00:00:00')
    const now = new Date()
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    if (s === now.toISOString().split('T')[0])   return 'TODAY'
    if (s === yest.toISOString().split('T')[0])  return 'YESTERDAY'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="t-input"
          style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px' }}
        />
      </div>

      {sortedDates.length > 0 ? (
        sortedDates.map(date => (
          <div key={date} className="mb-6">
            {/* Date header */}
            <div
              className="text-[10px] font-mono tracking-[0.2em] text-t-muted py-2 mb-1"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {formatDate(date)}
            </div>

            {/* Rows */}
            {grouped[date].map(tx => {
              const cat      = getCatInfo(tx.category)
              const isIncome = tx.type === 'income'
              const expanded = expandedId === tx.id

              return (
                <div key={tx.id}>
                  <div
                    className="flex items-center justify-between py-3 cursor-pointer transition-colors hover:bg-t-hover"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                  >
                    {/* Left */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="text-[10px] font-mono tracking-wider flex-shrink-0 w-20 truncate"
                        style={{ color: 'var(--muted)' }}
                      >
                        {cat.label.toUpperCase()}
                      </span>
                      <span className="text-sm text-t-text truncate">
                        {tx.note || cat.label}
                        {tx.isRecurring && (
                          <span className="ml-1.5 text-[9px] font-mono text-t-muted tracking-wider">↺</span>
                        )}
                      </span>
                    </div>

                    {/* Right */}
                    <span
                      className="text-sm font-mono flex-shrink-0 ml-4"
                      style={{ color: isIncome ? 'var(--green)' : 'var(--red)' }}
                    >
                      {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                    </span>
                  </div>

                  {/* Expanded delete */}
                  {expanded && onDelete && (
                    <div
                      className="flex justify-end px-2 py-2 animate-fade-in"
                      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(tx.id); setExpandedId(null) }}
                        className="text-[10px] font-mono tracking-widest text-t-red hover:text-red-400 transition-colors uppercase"
                      >
                        delete
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
          <p className="text-xs font-mono tracking-widest text-t-muted uppercase">
            {searchQuery ? 'no results' : 'no transactions'}
          </p>
        </div>
      )}
    </div>
  )
}
