"use client"
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction, TransactionCategory } from '@/types'
import type { FundingSource } from '@/lib/fundingSources'
import { GlassCard } from '@/components/ui/GlassCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { springs, timings } from '@/lib/animations'
import { computeDailyTotal } from '@/lib/transactionUtils'
import { getTagsForTransaction, getRecentTags, parseTagInput } from '@/lib/tagUtils'
import { borderRadius, shadows } from '@/styles/shared'
import { FONT_FAMILY } from '@/styles/typography'

// ── Session storage key ──────────────────────────────────────────
const SESSION_FILTERS_KEY = 'folio-history-filters'

// ── Date range presets ───────────────────────────────────────────
type DateRangePreset = 'this_week' | 'last_7' | 'last_30' | null

function getDateRangeStart(preset: DateRangePreset): string | null {
  if (!preset) return null
  const now = new Date()
  let start: Date

  switch (preset) {
    case 'this_week': {
      start = new Date(now)
      const day = start.getDay()
      start.setDate(start.getDate() - ((day + 6) % 7)) // Monday
      break
    }
    case 'last_7':
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      break
    case 'last_30':
      start = new Date(now)
      start.setDate(start.getDate() - 30)
      break
  }

  return start.toISOString().slice(0, 10)
}

// ── Match highlighting helper ────────────────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: { text: string; highlighted: boolean }[] = []

  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlighted: false })
    }
    parts.push({ text: text.slice(index, index + query.length), highlighted: true })
    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlighted ? (
          <span
            key={i}
            style={{
              background: 'rgba(129, 140, 248, 0.2)',
              borderRadius: 3,
              padding: '0 2px',
            }}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

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
            fontFamily: FONT_FAMILY, fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text)', width: '100%', height: '100%',
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

// ── Persisted filter state shape ─────────────────────────────────
interface PersistedFilters {
  typeFilter: 'income' | 'expense' | null
  categoryFilter: TransactionCategory | null
  sourceFilter: string | null
  dateRange: DateRangePreset
}

function loadSessionFilters(): PersistedFilters | null {
  try {
    const raw = sessionStorage.getItem(SESSION_FILTERS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedFilters
  } catch {
    return null
  }
}

function saveSessionFilters(filters: PersistedFilters): void {
  try {
    sessionStorage.setItem(SESSION_FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Silently fail if sessionStorage is unavailable
  }
}

interface TransactionListProps {
  transactions: Transaction[]
  onDelete?: (id: string) => void
  onEdit?:   (tx: Transaction) => void
  /** Callback to trigger bulk repeat flow for a transaction (Task 93.1) */
  onRepeat?: (tx: Transaction) => void
  /** Funding sources for search matching and filter chips (Task 129) */
  fundingSources?: FundingSource[]
  /** Bulk delete multiple transactions (Task 131) */
  onBulkDelete?: (ids: string[]) => void
  /** Bulk recategorize multiple transactions (Task 131) */
  onBulkRecategorize?: (ids: string[], category: TransactionCategory) => void
  /** Bulk tag multiple transactions (Task 131) */
  onBulkTag?: (ids: string[], tags: string[]) => void
}

export function TransactionList({ transactions, onDelete, onEdit, onRepeat, fundingSources = [], onBulkDelete, onBulkRecategorize, onBulkTag }: TransactionListProps) {
  // ── State ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Multi-select state (Task 131) ───────────────────────────────
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInputValue, setTagInputValue] = useState('')
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasBulkActions = !!(onBulkDelete || onBulkRecategorize || onBulkTag)

  const enterMultiSelect = useCallback((initialId?: string) => {
    setIsMultiSelectMode(true)
    setExpandedId(null)
    if (initialId) {
      setSelectedIds(new Set([initialId]))
    }
  }, [])

  const exitMultiSelect = useCallback(() => {
    setIsMultiSelectMode(false)
    setSelectedIds(new Set())
    setShowCategoryPicker(false)
    setShowTagInput(false)
    setTagInputValue('')
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(transactions.map(t => t.id)))
  }, [transactions])

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0 || !onBulkDelete) return
    onBulkDelete(Array.from(selectedIds))
    exitMultiSelect()
  }, [selectedIds, onBulkDelete, exitMultiSelect])

  const handleBulkRecategorize = useCallback((category: TransactionCategory) => {
    if (selectedIds.size === 0 || !onBulkRecategorize) return
    onBulkRecategorize(Array.from(selectedIds), category)
    setShowCategoryPicker(false)
    exitMultiSelect()
  }, [selectedIds, onBulkRecategorize, exitMultiSelect])

  const handleBulkTag = useCallback(() => {
    if (selectedIds.size === 0 || !onBulkTag || !tagInputValue.trim()) return
    const tags = parseTagInput(tagInputValue)
    if (tags.length === 0) return
    onBulkTag(Array.from(selectedIds), tags)
    setShowTagInput(false)
    setTagInputValue('')
    exitMultiSelect()
  }, [selectedIds, onBulkTag, tagInputValue, exitMultiSelect])

  // Long-press handler for entering multi-select
  const handleRowPointerDown = useCallback((id: string) => {
    if (isMultiSelectMode || !hasBulkActions) return
    longPressTimerRef.current = setTimeout(() => {
      enterMultiSelect(id)
    }, 500)
  }, [isMultiSelectMode, hasBulkActions, enterMultiSelect])

  const handleRowPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Filter state — initialized from session storage
  const [activeFilter, setActiveFilter] = useState<TransactionCategory | null>(() => {
    const saved = loadSessionFilters()
    return saved?.categoryFilter ?? null
  })
  const [typeFilter, setTypeFilter] = useState<'income' | 'expense' | null>(() => {
    const saved = loadSessionFilters()
    return saved?.typeFilter ?? null
  })
  const [sourceFilter, setSourceFilter] = useState<string | null>(() => {
    const saved = loadSessionFilters()
    return saved?.sourceFilter ?? null
  })
  const [dateRange, setDateRange] = useState<DateRangePreset>(() => {
    const saved = loadSessionFilters()
    return saved?.dateRange ?? null
  })

  // ── Debounced search (300ms) ─────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // ── Persist filter state to sessionStorage ────────────────────────
  useEffect(() => {
    saveSessionFilters({
      typeFilter,
      categoryFilter: activeFilter,
      sourceFilter,
      dateRange,
    })
  }, [typeFilter, activeFilter, sourceFilter, dateRange])

  // ── Funding source lookup map ─────────────────────────────────────
  const sourceMap = useMemo(() => {
    const map = new Map<string, FundingSource>()
    fundingSources.forEach(s => map.set(s.id, s))
    return map
  }, [fundingSources])

  // ── Present funding sources (those used in transactions) ──────────
  const presentSources = useMemo(() => {
    const usedIds = new Set<string>()
    transactions.forEach(t => {
      if (t.fundingSourceId) usedIds.add(t.fundingSourceId)
    })
    return fundingSources.filter(s => usedIds.has(s.id))
  }, [transactions, fundingSources])

  // Build unique category list from actual transactions (preserve order of first appearance)
  const presentCategories = Array.from(
    new Map(
      transactions.map(t => [t.category, TRANSACTION_CATEGORIES.find(c => c.category === t.category)])
    ).entries()
  )
    .filter(([, info]) => info !== undefined)
    .map(([cat, info]) => ({ category: cat as TransactionCategory, label: info!.label }))

  // ── Check if any filter is active ─────────────────────────────────
  const hasActiveFilters = !!(typeFilter || activeFilter || sourceFilter || dateRange || debouncedSearch)

  // ── Clear all handler ──────────────────────────────────────────────
  const clearAllFilters = useCallback(() => {
    setTypeFilter(null)
    setActiveFilter(null)
    setSourceFilter(null)
    setDateRange(null)
    setSearch('')
    setDebouncedSearch('')
  }, [])

  // Normalize search: strip leading $ so "$45" finds a $45 transaction
  const searchNorm = debouncedSearch.replace(/^\$/, '').trim().toLowerCase()

  // ── Filter chain ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const dateStart = getDateRangeStart(dateRange)

    return transactions
      .filter(t => !typeFilter || t.type === typeFilter)
      .filter(t => !activeFilter || t.category === activeFilter)
      .filter(t => !sourceFilter || t.fundingSourceId === sourceFilter)
      .filter(t => {
        if (!dateStart) return true
        return t.date >= dateStart
      })
      .filter(t => {
        if (!searchNorm) return true
        if (t.note?.toLowerCase().includes(searchNorm)) return true
        if (t.category.toLowerCase().includes(searchNorm)) return true
        // Category label matching
        const catLabel = TRANSACTION_CATEGORIES.find(c => c.category === t.category)?.label
        if (catLabel?.toLowerCase().includes(searchNorm)) return true
        // Funding source label matching
        if (t.fundingSourceId) {
          const source = sourceMap.get(t.fundingSourceId)
          if (source?.label.toLowerCase().includes(searchNorm)) return true
        }
        // Tag matching
        const txTags = t.tags ?? getTagsForTransaction(t.id)
        if (txTags?.some(tag => tag.includes(searchNorm))) return true
        // Amount matching: "45", "45.00", "45.5" should all find a $45.50 charge
        if (t.amount.toFixed(2).includes(searchNorm)) return true
        if (String(Math.round(t.amount)).includes(searchNorm)) return true
        return false
      })
  }, [transactions, typeFilter, activeFilter, sourceFilter, dateRange, searchNorm, sourceMap])

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

  // ── Pill style helper ─────────────────────────────────────────────
  const pillStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    padding: '8px 16px',
    fontFamily: FONT_FAMILY,
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
  })

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
            fontFamily: FONT_FAMILY,
            color: 'var(--text)',
            borderRadius: 12,
          }}
        />
      </GlassCard>

      {/* ── Clear All button (visible when any filter is active) ─── */}
      {hasActiveFilters && !isMultiSelectMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <motion.button
            type="button"
            onClick={clearAllFilters}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={{
              padding: '6px 14px',
              fontFamily: FONT_FAMILY,
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--accent)',
              background: 'rgba(129, 140, 248, 0.08)',
              border: '1px solid rgba(129, 140, 248, 0.2)',
              borderRadius: 99,
              cursor: 'pointer',
            }}
          >
            Clear all
          </motion.button>
        </div>
      )}

      {/* ── Select button / multi-select header (Task 131) ──────── */}
      {hasBulkActions && !isMultiSelectMode && transactions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <motion.button
            type="button"
            onClick={() => enterMultiSelect()}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            aria-label="Enter multi-select mode"
            style={{
              padding: '6px 14px',
              fontFamily: FONT_FAMILY,
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--sub)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 99,
              cursor: 'pointer',
            }}
          >
            Select
          </motion.button>
        </div>
      )}

      {isMultiSelectMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          marginBottom: 8,
        }}>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text)',
          }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              type="button"
              onClick={selectAll}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={{
                padding: '6px 12px',
                fontFamily: FONT_FAMILY,
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--accent)',
                background: 'rgba(129, 140, 248, 0.08)',
                border: '1px solid rgba(129, 140, 248, 0.2)',
                borderRadius: 99,
                cursor: 'pointer',
              }}
            >
              Select all
            </motion.button>
            <motion.button
              type="button"
              onClick={exitMultiSelect}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={{
                padding: '6px 12px',
                fontFamily: FONT_FAMILY,
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--sub)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 99,
                cursor: 'pointer',
              }}
            >
              Done
            </motion.button>
          </div>
        </div>
      )}

      {/* ── Type filter pills (Income/Expense) ───────────────────── */}
      <div className="flex gap-2 mb-3">
        <motion.button
          type="button"
          onClick={() => setTypeFilter(null)}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(!typeFilter)}
        >
          All
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'expense' ? null : 'expense')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(typeFilter === 'expense')}
        >
          Expenses
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'income' ? null : 'income')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(typeFilter === 'income')}
        >
          Income
        </motion.button>
      </div>

      {/* ── Category filter pills ────────────────────────────────── */}
      {presentCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1" style={{ scrollbarWidth: 'none' }}>
          {/* All pill */}
          <motion.button
            type="button"
            onClick={() => setActiveFilter(null)}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={pillStyle(!activeFilter)}
          >
            All
          </motion.button>

          {/* Category pills */}
          {presentCategories.map(({ category, label }) => (
            <motion.button
              key={category}
              type="button"
              onClick={() => setActiveFilter(activeFilter === category ? null : category)}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={pillStyle(activeFilter === category)}
            >
              {label}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Funding source filter pills ──────────────────────────── */}
      {presentSources.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1" style={{ scrollbarWidth: 'none' }}>
          <motion.button
            type="button"
            onClick={() => setSourceFilter(null)}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={pillStyle(!sourceFilter)}
          >
            All sources
          </motion.button>
          {presentSources.map(source => (
            <motion.button
              key={source.id}
              type="button"
              onClick={() => setSourceFilter(sourceFilter === source.id ? null : source.id)}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={pillStyle(sourceFilter === source.id)}
            >
              {source.emoji} {source.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Date range filter pills ──────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-3" style={{ scrollbarWidth: 'none' }}>
        <motion.button
          type="button"
          onClick={() => setDateRange(null)}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(!dateRange)}
        >
          All time
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setDateRange(dateRange === 'this_week' ? null : 'this_week')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(dateRange === 'this_week')}
        >
          This week
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setDateRange(dateRange === 'last_7' ? null : 'last_7')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(dateRange === 'last_7')}
        >
          Last 7 days
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setDateRange(dateRange === 'last_30' ? null : 'last_30')}
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          style={pillStyle(dateRange === 'last_30')}
        >
          Last 30 days
        </motion.button>
      </div>

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
                  fontFamily: FONT_FAMILY,
                }}>
                  Week of {new Date(weekKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontFamily: FONT_FAMILY,
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
              fontFamily: FONT_FAMILY,
            }}>
              {formatDate(date)}
            </p>
            {dailyTotal > 0 && (
              <p style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--muted)',
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${dailyTotal.toFixed(2)} spent
              </p>
            )}
          </div>

          {/* Transactions in glass card with timeline (255.1) */}
          <GlassCard elevation="low" style={{ padding: '4px 0', borderRadius: borderRadius.lg, marginBottom: 16, position: 'relative' }}>
            {/* Vertical timeline accent line */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 20,
                top: 12,
                bottom: 12,
                width: 1.5,
                background: 'rgba(129, 140, 248, 0.15)',
                borderRadius: 1,
                pointerEvents: 'none',
              }}
            />
            {grouped[date].map((tx, idx) => {
              const isIncome = tx.type === 'income'
              const expanded = !isMultiSelectMode && expandedId === tx.id
              const isLast = idx === grouped[date].length - 1
              const txSource = tx.fundingSourceId ? sourceMap.get(tx.fundingSourceId) : undefined
              const isSelected = selectedIds.has(tx.id)
              const row = (
                <div
                  onPointerDown={() => handleRowPointerDown(tx.id)}
                  onPointerUp={handleRowPointerUp}
                  onPointerLeave={handleRowPointerUp}
                  style={{ position: 'relative' }}
                >
                  {/* Timeline node (255.1) */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isIncome ? 'var(--success)' : 'var(--accent)',
                      boxShadow: `0 0 4px ${isIncome ? 'rgba(74, 222, 128, 0.3)' : 'rgba(129, 140, 248, 0.3)'}`,
                      zIndex: 1,
                    }}
                  />
                  {/* Main row */}
                  <motion.div
                    className="flex items-center justify-between gap-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03]"
                    style={{
                      paddingLeft: 36,
                      paddingRight: 16,
                      borderBottom: (expanded || isLast) ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                      background: isSelected ? 'rgba(129, 140, 248, 0.08)' : undefined,
                    }}
                    onClick={() => {
                      if (isMultiSelectMode) {
                        toggleSelection(tx.id)
                      } else {
                        setExpandedId(expanded ? null : tx.id)
                      }
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={springs.snappy}
                  >
                    {/* Checkbox in multi-select mode */}
                    {isMultiSelectMode && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: isSelected ? '2px solid var(--accent)' : '2px solid rgba(255, 255, 255, 0.2)',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                        aria-checked={isSelected}
                        role="checkbox"
                        aria-label={`Select ${tx.note || getLabel(tx.category)}`}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p style={{
                        fontSize: '15px',
                        color: 'var(--text)',
                        lineHeight: 1.4,
                        fontFamily: FONT_FAMILY,
                        fontWeight: 500,
                      }} className="truncate">
                        <HighlightText text={tx.note || getLabel(tx.category)} query={searchNorm} />
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        <p style={{
                          fontSize: '12px',
                          color: 'var(--sub)',
                          fontFamily: FONT_FAMILY,
                        }}>
                          <HighlightText text={getLabel(tx.category)} query={searchNorm} />
                        </p>
                        {txSource && (
                          <span style={{
                            fontSize: '10px',
                            fontFamily: FONT_FAMILY,
                            fontWeight: 500,
                            color: 'var(--sub)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>
                            <HighlightText text={`${txSource.emoji} ${txSource.label}`} query={searchNorm} />
                          </span>
                        )}
                        {isLoggedLate(tx) && (
                          <span style={{
                            fontSize: '10px',
                            fontFamily: FONT_FAMILY,
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
                        {/* Tag pills */}
                        {(tx.tags ?? getTagsForTransaction(tx.id))?.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '10px',
                              fontFamily: FONT_FAMILY,
                              fontWeight: 500,
                              color: 'rgba(129, 140, 248, 0.85)',
                              background: 'rgba(129, 140, 248, 0.08)',
                              border: '1px solid rgba(129, 140, 248, 0.2)',
                              padding: '1px 6px',
                              borderRadius: 99,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span style={{
                        fontFamily: FONT_FAMILY,
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
                            fontFamily: FONT_FAMILY, fontSize: '13px',
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
                            fontFamily: FONT_FAMILY, fontSize: '13px',
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
                            fontFamily: FONT_FAMILY, fontSize: '13px',
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

              // Disable swipe-to-delete in multi-select mode
              if (onDelete && !isMultiSelectMode) {
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
        <GlassCard elevation="low" style={{ padding: "4px 0", borderRadius: borderRadius.lg }}>
          {hasActiveFilters ? (
            <EmptyState
              illustration="filter"
              title="No results found"
              subtitle="Try adjusting your filters to see more"
              actionLabel="Clear filters"
              onAction={clearAllFilters}
            />
          ) : (
            <EmptyState
              illustration="transactions"
              title="Ready when you are"
              subtitle="Log your first expense to get started"
            />
          )}
        </GlassCard>
      )}

      {/* ── Floating Bulk Action Bar (Task 131) ────────────────────── */}
      <AnimatePresence>
        {isMultiSelectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={timings.normal}
            style={{
              position: 'fixed',
              bottom: 90,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              borderRadius: borderRadius.lg,
              boxShadow: shadows.xl,
              zIndex: 100,
              fontFamily: FONT_FAMILY,
            }}
            aria-label="Bulk actions"
            role="toolbar"
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginRight: 4 }}>
              {selectedIds.size}
            </span>

            {onBulkDelete && (
              <motion.button
                type="button"
                onClick={handleBulkDelete}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                aria-label={`Delete ${selectedIds.size} transactions`}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--error)',
                  background: 'rgba(248, 113, 113, 0.1)',
                  border: '1px solid rgba(248, 113, 113, 0.25)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>
                Delete
              </motion.button>
            )}

            {onBulkRecategorize && (
              <motion.button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                aria-label={`Recategorize ${selectedIds.size} transactions`}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--text)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Recategorize
              </motion.button>
            )}

            {onBulkTag && (
              <motion.button
                type="button"
                onClick={() => setShowTagInput(true)}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                aria-label={`Tag ${selectedIds.size} transactions`}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--text)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Tag
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Picker Overlay (Task 131) ─────────────────────── */}
      <AnimatePresence>
        {showCategoryPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.normal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(14, 14, 26, 0.7)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
            onClick={() => setShowCategoryPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springs.snappy}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 560,
                background: 'var(--surface)',
                borderRadius: '16px 16px 0 0',
                padding: '24px 20px 32px',
                maxHeight: '60vh',
                overflowY: 'auto',
              }}
              role="dialog"
              aria-label="Choose category"
            >
              <p style={{
                fontFamily: FONT_FAMILY,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 16,
              }}>
                Move to category
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {TRANSACTION_CATEGORIES.filter(c => c.type === 'expense').map(cat => (
                  <motion.button
                    key={cat.category}
                    type="button"
                    onClick={() => handleBulkRecategorize(cat.category)}
                    whileTap={{ scale: 0.96 }}
                    transition={springs.snappy}
                    style={{
                      padding: '12px',
                      fontFamily: FONT_FAMILY,
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </motion.button>
                ))}
              </div>
              <motion.button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                whileTap={{ scale: 0.96 }}
                transition={springs.snappy}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '12px',
                  fontFamily: FONT_FAMILY,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--sub)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tag Input Overlay (Task 131) ───────────────────────────── */}
      <AnimatePresence>
        {showTagInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.normal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(14, 14, 26, 0.7)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
            onClick={() => setShowTagInput(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springs.snappy}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 560,
                background: 'var(--surface)',
                borderRadius: '16px 16px 0 0',
                padding: '24px 20px 32px',
              }}
              role="dialog"
              aria-label="Add tags"
            >
              <p style={{
                fontFamily: FONT_FAMILY,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 12,
              }}>
                Add tags to {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''}
              </p>
              <input
                type="text"
                value={tagInputValue}
                onChange={e => setTagInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBulkTag() }}
                placeholder="e.g. trip, groceries, splitwithAlex"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontFamily: FONT_FAMILY,
                  fontSize: 14,
                  color: 'var(--text)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 10,
                  outline: 'none',
                }}
                aria-label="Tag input"
              />
              {/* Recent tag suggestions */}
              {(() => {
                const recent = getRecentTags(transactions, 6)
                if (recent.length === 0) return null
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {recent.map(tag => (
                      <motion.button
                        key={tag}
                        type="button"
                        onClick={() => setTagInputValue(prev => prev ? `${prev}, ${tag}` : tag)}
                        whileTap={{ scale: 0.95 }}
                        transition={springs.snappy}
                        style={{
                          padding: '4px 10px',
                          fontFamily: FONT_FAMILY,
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'rgba(129, 140, 248, 0.85)',
                          background: 'rgba(129, 140, 248, 0.08)',
                          border: '1px solid rgba(129, 140, 248, 0.2)',
                          borderRadius: 99,
                          cursor: 'pointer',
                        }}
                      >
                        #{tag}
                      </motion.button>
                    ))}
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <motion.button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  whileTap={{ scale: 0.96 }}
                  transition={springs.snappy}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontFamily: FONT_FAMILY,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--sub)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleBulkTag}
                  whileTap={{ scale: 0.96 }}
                  transition={springs.snappy}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontFamily: FONT_FAMILY,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    opacity: tagInputValue.trim() ? 1 : 0.5,
                  }}
                  disabled={!tagInputValue.trim()}
                >
                  Apply tags
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
