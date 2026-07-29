"use client"
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction, TransactionCategory } from '@/types'
import { GlassCard } from '@/components/ui/GlassCard'
import { springs, timings } from '@/lib/animations'
import { computeDailyTotal } from '@/lib/transactionUtils'

// ── Swipeable row wrapper ────────────────────────────────────────
const SWIPE_THRESHOLD  = 56   // px to trigger reveal
const DELETE_PANEL_W   = 72   // px width of the delete panel

interface SwipeableRowProps {
  onDelete: () => void
  children: React.ReactNode
}

function SwipeableRow({ onDelete, children }: SwipeableRowProps) {
  const startXRef  = useRef(0)
  const [offset,   setOffset]   = useState(0)  // negative = swiped left
  const [snapping, setSnapping] = useState(false)

  const snapTo = (target: number) => {
    setSnapping(true)
    setOffset(target)
    // Clear transition flag after animation
    setTimeout(() => setSnapping(false), 200)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    setSnapping(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startXRef.current
    // Only allow left-swipe (negative dx), cap at panel width
    const clamped = Math.max(-DELETE_PANEL_W, Math.min(0, dx))
    setOffset(clamped)
  }

  const onTouchEnd = () => {
    if (offset < -SWIPE_THRESHOLD) {
      snapTo(-DELETE_PANEL_W) // snap open
    } else {
      snapTo(0) // snap back
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete panel sits behind, revealed by sliding the row */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${DELETE_PANEL_W}px`,
          background: 'var(--error)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '0 8px 8px 0',
        }}
      >
        <button
          onClick={e => { e.stopPropagation(); snapTo(0); onDelete() }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: '12px',
            fontWeight: 600,
            color: '#fff', width: '100%', height: '100%',
          }}
        >
          Delete
        </button>
      </div>

      {/* Sliding row content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapping ? 'transform 0.2s ease' : 'none',
          position: 'relative',
          background: 'transparent',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface TransactionListProps {
  transactions: Transaction[]
  onDelete?: (id: string) => void
  onEdit?:   (tx: Transaction) => void
  /** Callback to trigger bulk repeat flow for a transaction (Task 93.1) */
  onRepeat?: (tx: Transaction) => void
}

export function TransactionList({ transactions, onDelete, onEdit, onRepeat }: TransactionListProps) {
  const [search,      setSearch]      = useState('')
  const [activeFilter, setActiveFilter] = useState<TransactionCategory | null>(null)
  const [typeFilter,   setTypeFilter]  = useState<'income' | 'expense' | null>(null)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

  // Build unique category list from actual transactions (preserve order of first appearance)
  const presentCategories = Array.from(
    new Map(
      transactions.map(t => [t.category, TRANSACTION_CATEGORIES.find(c => c.category === t.category)])
    ).entries()
  )
    .filter(([, info]) => info !== undefined)
    .map(([cat, info]) => ({ category: cat as TransactionCategory, label: info!.label }))

  // Normalize search: strip leading $ so "$45" finds a $45 transaction
  const searchNorm = search.replace(/^\$/, '').trim().toLowerCase()

  // Filter chain: type first, then category, then search (note, category, or amount)
  const filtered = transactions
    .filter(t => !typeFilter || t.type === typeFilter)
    .filter(t => !activeFilter || t.category === activeFilter)
    .filter(t => {
      if (!searchNorm) return true
      if (t.note?.toLowerCase().includes(searchNorm)) return true
      if (t.category.toLowerCase().includes(searchNorm)) return true
      // Amount matching: "45", "45.00", "45.5" should all find a $45.50 charge
      if (t.amount.toFixed(2).includes(searchNorm)) return true
      if (String(Math.round(t.amount)).includes(searchNorm)) return true
      return false
    })

  const grouped = filtered.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Helper: get ISO week number for a date string (used for weekly total separators)
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = d.getDay() // 0=Sun
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7))
    return monday.toISOString().slice(0, 10)
  }

  // Compute weekly totals for filtered transactions
  const weeklyTotals = filtered.reduce((acc, tx) => {
    if (tx.type !== 'expense') return acc
    const wk = getWeekKey(tx.date)
    acc[wk] = (acc[wk] || 0) + tx.amount
    return acc
  }, {} as Record<string, number>)

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

  // Check if a transaction was logged late (createdAt more than 1 day after date)
  const isLoggedLate = (tx: Transaction): boolean => {
    const txDate = new Date(tx.date + 'T00:00:00')
    const createdDate = new Date(tx.createdAt)
    const diffMs = createdDate.getTime() - txDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays > 1
  }

  return (
    <div>
      {/* ── Search ──────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search transactions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '14px 16px',
            fontSize: 15,
            fontFamily: 'Inter, sans-serif',
            color: 'var(--text)',
            borderRadius: 12,
          }}
        />
      </GlassCard>

      {/* ── Type filter pills (Income/Expense) ───────────────────── */}
      <div className="flex gap-2 mb-3">
        <motion.button
          type="button"
          onClick={() => setTypeFilter(null)}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: 99,
            border: '1px solid',
            borderColor: !typeFilter ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)',
            color: !typeFilter ? 'var(--text)' : 'var(--sub)',
            background: !typeFilter ? 'rgba(129, 140, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          All
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'expense' ? null : 'expense')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: 99,
            border: '1px solid',
            borderColor: typeFilter === 'expense' ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)',
            color: typeFilter === 'expense' ? 'var(--text)' : 'var(--sub)',
            background: typeFilter === 'expense' ? 'rgba(129, 140, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          Expenses
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'income' ? null : 'income')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: 99,
            border: '1px solid',
            borderColor: typeFilter === 'income' ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)',
            color: typeFilter === 'income' ? 'var(--text)' : 'var(--sub)',
            background: typeFilter === 'income' ? 'rgba(129, 140, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          Income
        </motion.button>
      </div>

      {/* ── Category filter pills ────────────────────────────────── */}
      {presentCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4" style={{ scrollbarWidth: 'none' }}>
          {/* All pill */}
          <motion.button
            type="button"
            onClick={() => setActiveFilter(null)}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: 99,
              border: '1px solid',
              borderColor: !activeFilter ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)',
              color: !activeFilter ? 'var(--text)' : 'var(--sub)',
              background: !activeFilter ? 'rgba(129, 140, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            All
          </motion.button>

          {/* Category pills */}
          {presentCategories.map(({ category, label }) => {
            const active = activeFilter === category
            return (
              <motion.button
                key={category}
                type="button"
                onClick={() => setActiveFilter(active ? null : category)}
                whileTap={{ scale: 0.96 }}
                transition={springs.snappy}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: 99,
                  border: '1px solid',
                  borderColor: active ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  color: active ? 'var(--text)' : 'var(--sub)',
                  background: active ? 'rgba(129, 140, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {label}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* ── Rows ────────────────────────────────────────────────── */}
      {sortedDates.length > 0 ? (() => {
        let lastWeekKey = ''
        return sortedDates.map(date => {
          const weekKey = getWeekKey(date)
          const showWeekHeader = weekKey !== lastWeekKey
          lastWeekKey = weekKey

          const dailyTotal = computeDailyTotal(grouped[date])
          return (
          <div key={date} style={{ marginBottom: 24 }}>
            {/* Weekly total separator */}
            {showWeekHeader && weeklyTotals[weekKey] != null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  marginBottom: 16,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <p style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--sub)',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Week of {new Date(weekKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${weeklyTotals[weekKey].toFixed(2)} spent
                </p>
              </div>
            )}

          {/* Day header */}
          <div className="flex items-center justify-between mb-3">
            <p style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--sub)',
              fontFamily: 'Inter, sans-serif',
            }}>
              {formatDate(date)}
            </p>
            {dailyTotal > 0 && (
              <p style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--muted)',
                fontFamily: 'Inter, sans-serif',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${dailyTotal.toFixed(2)}
              </p>
            )}
          </div>

          {/* Transactions in glass card */}
          <GlassCard elevation="low" style={{ padding: '4px 0', borderRadius: 14, marginBottom: 16 }}>
            {grouped[date].map((tx, idx) => {
              const isIncome = tx.type === 'income'
              const expanded = expandedId === tx.id
              const isLast = idx === grouped[date].length - 1
              const row = (
                <div>
                  {/* Main row */}
                  <motion.div
                    className="flex items-center justify-between gap-4 py-3 px-4 cursor-pointer transition-colors"
                    style={{ borderBottom: (expanded || isLast) ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                    whileHover={{ background: 'rgba(255,255,255,0.03)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={springs.snappy}
                  >
                    <div className="min-w-0 flex-1">
                      <p style={{
                        fontSize: '15px',
                        color: 'var(--text)',
                        lineHeight: 1.4,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                      }} className="truncate">
                        {tx.note || getLabel(tx.category)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <p style={{
                          fontSize: '12px',
                          color: 'var(--sub)',
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {getLabel(tx.category)}
                        </p>
                        {isLoggedLate(tx) && (
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            color: 'var(--muted)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}>
                            Logged late
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '15px',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: isIncome ? 'var(--success)' : 'var(--text)',
                      }}>
                        {isIncome ? '+' : '−'}${tx.amount.toFixed(2)}
                      </span>
                      <svg
                        className="w-3.5 h-3.5 transition-transform duration-150"
                        style={{ color: 'var(--sub)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </motion.div>

                  {/* Expanded actions (Edit + Repeat + Delete for desktop / non-swipe fallback) */}
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={timings.normal}
                      className="flex gap-3 px-4 py-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                        borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      {onEdit && (
                        <motion.button
                          type="button"
                          onClick={e => { e.stopPropagation(); onEdit(tx); setExpandedId(null) }}
                          whileTap={{ scale: 0.96 }}
                          transition={springs.snappy}
                          style={{
                            flex: 1, padding: '10px',
                            fontFamily: 'Inter, sans-serif', fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text)', border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px', transition: 'all 0.15s',
                            cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.04)',
                          }}
                        >
                          Edit
                        </motion.button>
                      )}
                      {onRepeat && tx.type === 'expense' && (
                        <motion.button
                          type="button"
                          onClick={e => { e.stopPropagation(); onRepeat(tx); setExpandedId(null) }}
                          whileTap={{ scale: 0.96 }}
                          transition={springs.snappy}
                          style={{
                            flex: 1, padding: '10px',
                            fontFamily: 'Inter, sans-serif', fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text)', border: '1px solid rgba(129, 140, 248, 0.2)',
                            borderRadius: '8px', transition: 'all 0.15s',
                            cursor: 'pointer',
                            background: 'rgba(129, 140, 248, 0.08)',
                          }}
                        >
                          Repeat
                        </motion.button>
                      )}
                      {onDelete && (
                        <motion.button
                          type="button"
                          onClick={e => { e.stopPropagation(); onDelete(tx.id); setExpandedId(null) }}
                          whileTap={{ scale: 0.96 }}
                          transition={springs.snappy}
                          style={{
                            flex: 1, padding: '10px',
                            fontFamily: 'Inter, sans-serif', fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--error)', border: '1px solid rgba(248, 113, 113, 0.2)',
                            borderRadius: '8px', transition: 'all 0.15s',
                            cursor: 'pointer',
                            background: 'rgba(248, 113, 113, 0.08)',
                          }}
                        >
                          Delete
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </div>
              )

              // Wrap with swipe-to-delete when onDelete is available
              if (onDelete) {
                return (
                  <SwipeableRow key={tx.id} onDelete={() => { onDelete(tx.id); setExpandedId(null) }}>
                    {row}
                  </SwipeableRow>
                )
              }
              return <div key={tx.id}>{row}</div>
            })}
          </GlassCard>
        </div>
        )
      })
      })() : (
        <GlassCard elevation="low" style={{ padding: "32px 20px", borderRadius: 14 }}>
          <div className="flex flex-col items-center justify-center gap-3">
            <span style={{ fontSize: 32 }} aria-hidden="true">
              {search || activeFilter || typeFilter ? '🔍' : '📝'}
            </span>
            <p style={{
              fontSize: '15px',
              color: 'var(--text)',
              textAlign: 'center',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
            }}>
              {search || activeFilter || typeFilter ? 'No results found' : 'Ready when you are'}
            </p>
            {!search && !activeFilter && !typeFilter && (
              <p style={{
                fontSize: '13px',
                color: 'var(--sub)',
                textAlign: 'center',
                fontFamily: 'Inter, sans-serif',
              }}>
                Log your first expense to get started
              </p>
            )}
            {(activeFilter || typeFilter) && (
              <motion.button
                type="button"
                onClick={() => { setActiveFilter(null); setTypeFilter(null) }}
                whileTap={{ scale: 0.96 }}
                transition={springs.snappy}
                style={{
                  marginTop: 8,
                  padding: '8px 16px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  background: 'rgba(129, 140, 248, 0.12)',
                  border: '1px solid rgba(129, 140, 248, 0.3)',
                  borderRadius: 99,
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </motion.button>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
