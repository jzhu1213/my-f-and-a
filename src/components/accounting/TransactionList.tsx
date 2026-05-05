"use client"
import { useState } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  onDelete?: (id: string) => void
}

export function TransactionList({ transactions, onDelete }: TransactionListProps) {
  const [search,     setSearch]     = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = transactions.filter(t =>
    t.note?.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const getLabel = (cat: Transaction['category']) =>
    (TRANSACTION_CATEGORIES.find(c => c.category === cat)?.label ?? cat)

  const formatDate = (s: string) => {
    const d    = new Date(s + 'T00:00:00')
    const now  = new Date()
    const yest = new Date(now); yest.setDate(yest.getDate() - 1)
    if (s === now.toISOString().split('T')[0])  return 'Today'
    if (s === yest.toISOString().split('T')[0]) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="t-input"
        />
      </div>

      {sortedDates.length > 0 ? sortedDates.map(date => (
        <div key={date} className="mb-8">
          {/* Date header */}
          <p className="label mb-4" style={{ color: 'var(--sub)' }}>{formatDate(date)}</p>

          {/* Rows */}
          {grouped[date].map(tx => {
            const isIncome = tx.type === 'income'
            const expanded = expandedId === tx.id

            return (
              <div key={tx.id}>
                {/* Main row */}
                <div
                  className="flex items-center justify-between gap-4 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onClick={() => setExpandedId(expanded ? null : tx.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Left: description + category */}
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.4 }} className="truncate">
                      {tx.note || getLabel(tx.category)}
                    </p>
                    <p className="label mt-1" style={{ color: 'var(--muted)' }}>
                      {getLabel(tx.category)}{tx.isRecurring ? ' · recurring' : ''}
                    </p>
                  </div>

                  {/* Right: amount */}
                  <span style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '15px',
                    color: isIncome ? 'var(--green)' : 'var(--text)',
                    flexShrink: 0,
                  }}>
                    {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                  </span>
                </div>

                {/* Delete reveal */}
                {expanded && onDelete && (
                  <div
                    className="flex justify-end px-1 py-3 animate-fade-in"
                    style={{ background: 'var(--raised)', borderBottom: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(tx.id); setExpandedId(null) }}
                      style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace', color: 'var(--red)', letterSpacing: '0.08em' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )) : (
        <div className="py-20 text-center">
          <p style={{ fontSize: '15px', color: 'var(--sub)', marginBottom: '8px' }}>
            {search ? 'No results' : 'No transactions yet'}
          </p>
          {!search && <p className="label">tap + to add your first</p>}
        </div>
      )}
    </div>
  )
}
