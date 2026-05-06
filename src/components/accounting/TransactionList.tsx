"use client"
import { useState } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction, TransactionCategory } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  onDelete?: (id: string) => void
  onEdit?:   (tx: Transaction) => void
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {
  const [search,      setSearch]      = useState('')
  const [activeFilter, setActiveFilter] = useState<TransactionCategory | null>(null)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

  // Build unique category list from actual transactions (preserve order of first appearance)
  const presentCategories = Array.from(
    new Map(
      transactions.map(t => [t.category, TRANSACTION_CATEGORIES.find(c => c.category === t.category)])
    ).entries()
  )
    .filter(([, info]) => info !== undefined)
    .map(([cat, info]) => ({ category: cat as TransactionCategory, label: info!.label }))

  // Filter chain: category first, then search
  const filtered = transactions
    .filter(t => !activeFilter || t.category === activeFilter)
    .filter(t =>
      !search ||
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
    TRANSACTION_CATEGORIES.find(c => c.category === cat)?.label ?? cat

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
      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="t-input"
        />
      </div>

      {/* ── Category filter pills ────────────────────────────────── */}
      {presentCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-6 px-6" style={{ scrollbarWidth: 'none' }}>
          {/* All pill */}
          <button
            onClick={() => setActiveFilter(null)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              fontFamily: 'Space Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: !activeFilter ? 'var(--sub)' : 'var(--border)',
              color: !activeFilter ? 'var(--text)' : 'var(--muted)',
              background: !activeFilter ? 'var(--raised)' : 'transparent',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>

          {/* Category pills */}
          {presentCategories.map(({ category, label }) => {
            const active = activeFilter === category
            return (
              <button
                key={category}
                onClick={() => setActiveFilter(active ? null : category)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: active ? 'var(--sub)' : 'var(--border)',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  background: active ? 'var(--raised)' : 'transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Rows ────────────────────────────────────────────────── */}
      {sortedDates.length > 0 ? sortedDates.map(date => (
        <div key={date} className="mb-8">
          <p className="label mb-4" style={{ color: 'var(--sub)' }}>{formatDate(date)}</p>

          {grouped[date].map(tx => {
            const isIncome = tx.type === 'income'
            const expanded = expandedId === tx.id

            return (
              <div key={tx.id}>
                {/* Main row */}
                <div
                  className="flex items-center justify-between gap-4 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}
                  onClick={() => setExpandedId(expanded ? null : tx.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.4 }} className="truncate">
                      {tx.note || getLabel(tx.category)}
                    </p>
                    <p className="label mt-1" style={{ color: 'var(--muted)' }}>
                      {getLabel(tx.category)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '15px',
                      color: isIncome ? 'var(--green)' : 'var(--text)',
                    }}>
                      {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                    </span>
                    <svg
                      className="w-3.5 h-3.5 transition-transform duration-150"
                      style={{ color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded actions */}
                {expanded && (
                  <div
                    className="flex gap-3 px-1 py-3 animate-fade-in"
                    style={{ background: 'var(--raised)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}
                  >
                    {onEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); onEdit(tx); setExpandedId(null) }}
                        style={{
                          flex: 1, padding: '8px',
                          fontFamily: 'Space Mono, monospace', fontSize: '11px',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--sub)', border: '1px solid var(--border)',
                          borderRadius: '4px', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sub)'; e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--sub)' }}
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(tx.id); setExpandedId(null) }}
                        style={{
                          flex: 1, padding: '8px',
                          fontFamily: 'Space Mono, monospace', fontSize: '11px',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--red)', border: '1px solid var(--border)',
                          borderRadius: '4px', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )) : (
        <div className="py-20 text-center">
          <p style={{ fontSize: '15px', color: 'var(--sub)', marginBottom: '8px' }}>
            {search || activeFilter ? 'No results' : 'No transactions yet'}
          </p>
          {!search && !activeFilter && <p className="label">tap + to add your first</p>}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="label mt-2"
              style={{ color: 'var(--sub)', textDecoration: 'underline' }}
            >
              clear filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
