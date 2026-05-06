"use client"
import { useState, useEffect } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { TransactionCategory, TransactionType, Transaction } from '@/types'

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
  prefilledCategory?: TransactionCategory
  editTransaction?: Transaction   // when set, we're in edit mode
}

const EXPENSE_CATS = TRANSACTION_CATEGORIES.filter(c => c.type === 'expense')
const INCOME_CATS  = TRANSACTION_CATEGORIES.filter(c => c.type === 'income')
const QUICK_AMOUNTS = [10, 20, 50, 100, 200]

export function TransactionSheet({
  isOpen, onClose, onSubmit, prefilledCategory, editTransaction,
}: TransactionSheetProps) {
  const isEditMode = !!editTransaction

  const [txType,   setTxType]   = useState<'expense' | 'income'>('expense')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [note,     setNote]     = useState('')

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

  // Reset / populate when sheet opens or edit target changes
  useEffect(() => {
    if (!isOpen) return
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
      setTxType(prefilled?.type ?? 'expense')
      setCategory(prefilledCategory ?? null)
      setAmount('')
      setDate(today)
      setNote('')
    }
  }, [isOpen, editTransaction, prefilledCategory, today])

  // When user toggles type, clear category if it belongs to the old type
  const handleTypeSwitch = (t: 'expense' | 'income') => {
    setTxType(t)
    if (category) {
      const catInfo = TRANSACTION_CATEGORIES.find(c => c.category === category)
      if (catInfo && catInfo.type !== t) setCategory(null)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2 || (parts[1]?.length ?? 0) > 2) return
    setAmount(v)
  }

  const handleSubmit = () => {
    if (!amount || !category || !date) return
    onSubmit({ amount: parseFloat(amount), category, type: txType, date, note: note || undefined })
    onClose()
  }

  const canSubmit = !!amount && parseFloat(amount) > 0 && !!category && !!date
  const visibleCats = txType === 'expense' ? EXPENSE_CATS : INCOME_CATS

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

          {/* ── Expense / Income toggle ── */}
          <div
            className="flex"
            style={{ background: 'var(--raised)', borderRadius: '6px', padding: '3px' }}
          >
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTypeSwitch(t)}
                className="flex-1 py-2.5 transition-all duration-150"
                style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                  color: txType === t ? (t === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--muted)',
                  background: txType === t ? 'var(--bg)' : 'transparent',
                  border: txType === t ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Amount ── */}
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span style={{
                fontSize: '32px', fontFamily: 'Space Mono, monospace', lineHeight: 1,
                color: txType === 'income' ? 'var(--green)' : 'var(--muted)',
              }}>
                {txType === 'income' ? '+' : '−'}$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                autoFocus
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
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(p.toString())}
                  className="amount-chip"
                  style={amount === p.toString() ? { borderColor: 'var(--text)', color: 'var(--text)', background: 'var(--raised)' } : {}}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>

          {/* ── Category ── */}
          <div>
            <p className="label mb-4">Category</p>
            <div className={`grid gap-2 ${txType === 'income' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {visibleCats.map(cat => {
                const sel    = category === cat.category
                const accent = txType === 'income' ? 'var(--green)' : 'var(--red)'
                const glow   = txType === 'income' ? 'var(--green-glow)' : 'var(--red-glow)'
                return (
                  <button
                    key={cat.category}
                    onClick={() => setCategory(cat.category)}
                    className="cat-pill"
                    style={sel ? { borderColor: accent, background: glow } : {}}
                  >
                    <span style={{ fontSize: '22px', lineHeight: 1 }}>{cat.emoji}</span>
                    <span style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '12px',
                      letterSpacing: '0.04em',
                      color: sel ? accent : 'var(--sub)',
                    }}>
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Date ── */}
          <div>
            <p className="label mb-4">Date</p>
            <div className="flex gap-3 items-center">
              {[{ label: 'Today', val: today }, { label: 'Yesterday', val: yesterday }].map(({ label, val }) => (
                <button
                  key={val}
                  onClick={() => setDate(val)}
                  style={{
                    fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em',
                    padding: '8px 14px', borderRadius: '4px', border: '1px solid', flexShrink: 0,
                    borderColor: date === val ? 'var(--sub)' : 'var(--border)',
                    color: date === val ? 'var(--text)' : 'var(--muted)',
                    background: date === val ? 'var(--raised)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={today}
                className="t-input flex-1"
                style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* ── Note ── */}
          <div>
            <p className="label mb-3">
              Note <span style={{ color: 'var(--dim)' }}>(optional)</span>
            </p>
            <input
              type="text"
              placeholder="what was this?"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="t-input"
            />
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
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
