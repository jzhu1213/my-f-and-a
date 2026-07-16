"use client"
import { useState, useEffect, useMemo, useRef } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { TransactionCategory, TransactionType, Transaction } from '@/types'
import { getRecentRepeats } from '@/lib/transactionUtils'
import type { TransactionRepeat } from '@/lib/transactionUtils'

interface TransactionSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    date: string
    note?: string
  }) => void
  onRepeatLog?: (repeat: TransactionRepeat) => void
  prefilledCategory?: TransactionCategory
  prefilledType?: TransactionType
  prefilledAmount?: number
  prefilledNote?: string
  budgetRemaining?: number
  editTransaction?: Transaction
  transactions?: Transaction[]
}

const EXPENSE_CATS = TRANSACTION_CATEGORIES.filter(c => c.type === 'expense')
const INCOME_CATS  = TRANSACTION_CATEGORIES.filter(c => c.type === 'income')
const DEFAULT_QUICK_AMOUNTS = [5, 10, 20, 50]

export function TransactionSheet({
  isOpen, onClose, onSubmit, onRepeatLog,
  prefilledCategory, prefilledType, prefilledAmount, prefilledNote,
  budgetRemaining, editTransaction, transactions = [],
}: TransactionSheetProps) {
  const isEditMode = !!editTransaction
  const amountRef  = useRef<HTMLInputElement>(null)

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()

  const [txType,          setTxType]          = useState<'expense' | 'income'>('expense')
  const [amount,          setAmount]          = useState('')
  const [category,        setCategory]        = useState<TransactionCategory | null>(null)
  const [date,            setDate]            = useState(today)
  const [note,            setNote]            = useState('')
  const [showDatePicker,  setShowDatePicker]  = useState(false)

  // ── Populate on open / edit ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setShowDatePicker(false)
    if (editTransaction) {
      setTxType(editTransaction.type)
      setAmount(editTransaction.amount.toString())
      setCategory(editTransaction.category)
      setDate(editTransaction.date)
      setNote(editTransaction.note ?? '')
    } else {
      const prefilled = prefilledCategory
        ? TRANSACTION_CATEGORIES.find(c => c.category === prefilledCategory)
        : null
      setTxType(prefilled?.type ?? prefilledType ?? 'expense')
      setCategory(prefilledCategory ?? null)
      setAmount(prefilledAmount ? prefilledAmount.toString() : '')
      setDate(today)
      setNote(prefilledNote ?? '')
    }
  }, [isOpen, editTransaction, prefilledCategory, prefilledType, prefilledAmount, prefilledNote, today])

  // Auto-focus amount when category is pre-selected
  useEffect(() => {
    if (isOpen && !isEditMode && prefilledCategory) {
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [isOpen, isEditMode, prefilledCategory])

  const repeats = useMemo(
    () => (!isEditMode && isOpen ? getRecentRepeats(transactions, 3) : []),
    [isEditMode, isOpen, transactions],
  )

  // ── Toggle type (the subtle link) ───────────────────────────
  const handleTypeToggle = () => {
    const next: TransactionType = txType === 'expense' ? 'income' : 'expense'
    setTxType(next)
    // Clear category if it doesn't belong to the new type
    if (category) {
      const info = TRANSACTION_CATEGORIES.find(c => c.category === category)
      if (info && info.type !== next) setCategory(null)
    }
  }

  // ── Category selection drives type ──────────────────────────
  const handleCategorySelect = (cat: TransactionCategory) => {
    setCategory(cat)
    const info = TRANSACTION_CATEGORIES.find(c => c.category === cat)
    if (info) setTxType(info.type)
  }

  // ── Context-aware quick amounts ──────────────────────────────
  const quickAmounts = useMemo(() => {
    if (!category) return DEFAULT_QUICK_AMOUNTS
    const seen  = new Set<number>()
    const recent: number[] = []
    for (const tx of transactions) {
      if (tx.category !== category) continue
      // Round to nearest 50 cents to group near-identical amounts
      const rounded = Math.round(tx.amount * 2) / 2
      if (!seen.has(rounded) && rounded > 0) {
        seen.add(rounded)
        recent.push(rounded)
        if (recent.length === 4) break
      }
    }
    return recent.length >= 2 ? recent : DEFAULT_QUICK_AMOUNTS
  }, [category, transactions])

  // ── Amount helpers ───────────────────────────────────────────
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2 || (parts[1]?.length ?? 0) > 2) return
    setAmount(v)
  }

  const adjustAmount = (delta: number) => {
    const current = parseFloat(amount) || 0
    const next    = Math.max(0.01, current + delta)
    setAmount(next % 1 === 0 ? next.toString() : next.toFixed(2))
  }

  // ── Date label ───────────────────────────────────────────────
  const dateLabel = (() => {
    if (date === today)     return 'Today'
    if (date === yesterday) return 'Yesterday'
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!amount || !category || !date) return
    onSubmit({ amount: parseFloat(amount), category, type: txType, date, note: note || undefined })
    onClose()
  }

  const canSubmit     = !!amount && parseFloat(amount) > 0 && !!category && !!date
  const needsCategory = !!amount && parseFloat(amount) > 0 && !category
  const visibleCats   = txType === 'expense' ? EXPENSE_CATS : INCOME_CATS
  const accentColor   = txType === 'income' ? 'var(--green)' : 'var(--red)'
  const accentGlow    = txType === 'income' ? 'var(--green-glow)' : 'var(--red-glow)'
  const signChar      = txType === 'income' ? '+' : '−'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet overflow-y-auto ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>
            {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-6 pb-8 space-y-7">

          {/* Budget remaining hint */}
          {!isEditMode && budgetRemaining !== undefined && prefilledCategory && (
            <p style={{
              fontFamily: 'Space Mono, monospace', fontSize: '12px',
              color: budgetRemaining < 0 ? 'var(--red)' : budgetRemaining < 10 ? 'var(--amber)' : 'var(--sub)',
              padding: '10px 12px', background: 'var(--raised)', borderRadius: '4px',
              border: '1px solid var(--border)',
            }}>
              {budgetRemaining < 0
                ? `$${Math.abs(budgetRemaining).toFixed(0)} over budget this week`
                : `$${budgetRemaining.toFixed(0)} left in ${TRANSACTION_CATEGORIES.find(c => c.category === prefilledCategory)?.label ?? 'category'} this week`}
            </p>
          )}

          {/* Log again — one tap in sheet */}
          {!isEditMode && repeats.length > 0 && onRepeatLog && (
            <div>
              <p className="label mb-3">Log again</p>
              <div className="flex gap-2 flex-wrap">
                {repeats.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { onRepeatLog(r); onClose() }}
                    className="amount-chip"
                  >
                    {r.type === 'income' ? '+' : '−'}{r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 1. Category ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="label">Category</p>
              {/* Subtle income/expense toggle link */}
              <button
                onClick={handleTypeToggle}
                style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                {txType === 'expense' ? 'income →' : '← expenses'}
              </button>
            </div>

            <div className={`grid gap-2 ${txType === 'income' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {visibleCats.map(cat => {
                const sel = category === cat.category
                return (
                  <button
                    key={cat.category}
                    onClick={() => handleCategorySelect(cat.category)}
                    className="cat-pill"
                    style={sel ? { borderColor: accentColor, background: accentGlow } : {}}
                  >
                    <span style={{ fontSize: '22px', lineHeight: 1 }}>{cat.emoji}</span>
                    <span style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '12px',
                      letterSpacing: '0.04em',
                      color: sel ? accentColor : 'var(--sub)',
                    }}>
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 2. Amount ─────────────────────────────────────────── */}
          <div>
            {/* Large amount input */}
            <div className="flex items-baseline gap-2 mb-4">
              <span style={{
                fontSize: '32px', fontFamily: 'Space Mono, monospace', lineHeight: 1,
                color: txType === 'income' ? 'var(--green)' : 'var(--muted)',
              }}>
                {signChar}$
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                style={{
                  flex: 1, background: 'transparent', outline: 'none',
                  fontSize: '48px', lineHeight: 1,
                  fontFamily: 'Space Mono, monospace',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '10px',
                  caretColor: 'var(--text)',
                }}
              />
            </div>

            {/* Quick chips + stepper */}
            <div className="flex items-center gap-2">
              <div className="flex gap-2 flex-wrap flex-1">
                {quickAmounts.map(p => {
                  const label = p % 1 === 0 ? `$${p}` : `$${p.toFixed(2)}`
                  const active = amount === p.toString() || amount === p.toFixed(2)
                  return (
                    <button
                      key={p}
                      onClick={() => setAmount(p % 1 === 0 ? p.toString() : p.toFixed(2))}
                      className="amount-chip"
                      style={active ? { borderColor: 'var(--text)', color: 'var(--text)', background: 'var(--raised)' } : {}}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Fine-tune stepper */}
              <div className="flex gap-1 flex-shrink-0">
                {(['−', '+'] as const).map(sym => (
                  <button
                    key={sym}
                    onClick={() => adjustAmount(sym === '+' ? 1 : -1)}
                    style={{
                      width: '32px', height: '32px',
                      fontFamily: 'Space Mono, monospace', fontSize: '16px',
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sub)'; e.currentTarget.style.color = 'var(--sub)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 3. Note ───────────────────────────────────────────── */}
          <input
            type="text"
            placeholder="what was this? (Restuarant, subscription, etc.)"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={60}
            className="t-input"
          />

          {/* ── 4. Date — compact ─────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="label" style={{ marginRight: '4px' }}>Date</p>

            {[{ label: 'Today', val: today }, { label: 'Yesterday', val: yesterday }].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => { setDate(val); setShowDatePicker(false) }}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em',
                  padding: '6px 12px', borderRadius: '4px', border: '1px solid', flexShrink: 0,
                  borderColor: date === val && !showDatePicker ? 'var(--sub)' : 'var(--border)',
                  color: date === val && !showDatePicker ? 'var(--text)' : 'var(--muted)',
                  background: date === val && !showDatePicker ? 'var(--raised)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}

            {/* "Pick date" toggle or current custom date chip */}
            {!showDatePicker ? (
              <button
                onClick={() => setShowDatePicker(true)}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em',
                  padding: '6px 12px', borderRadius: '4px', border: '1px solid', flexShrink: 0,
                  borderColor: date !== today && date !== yesterday ? 'var(--sub)' : 'var(--border)',
                  color: date !== today && date !== yesterday ? 'var(--text)' : 'var(--muted)',
                  background: date !== today && date !== yesterday ? 'var(--raised)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {date !== today && date !== yesterday ? dateLabel : 'Pick date'}
              </button>
            ) : (
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setShowDatePicker(false) }}
                max={today}
                autoFocus
                className="t-input"
                style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', flex: 1 }}
              />
            )}
          </div>

          {/* ── Submit hint + actions ─────────────────────────────── */}
          {needsCategory && (
            <p style={{
              fontFamily: 'Space Mono, monospace', fontSize: '11px',
              letterSpacing: '0.08em', textAlign: 'center',
              color: 'var(--sub)',
            }}>
              select a category to continue
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 btn-primary">
              {isEditMode ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
