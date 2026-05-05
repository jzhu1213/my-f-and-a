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
    isRecurring?: boolean
  }) => void
  prefilledCategory?: TransactionCategory
  recentTransactions?: Transaction[]
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200]

export function TransactionSheet({
  isOpen, onClose, onSubmit, prefilledCategory, recentTransactions = [],
}: TransactionSheetProps) {
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState<TransactionCategory | null>(null)
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [note,        setNote]        = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

  useEffect(() => {
    if (isOpen && prefilledCategory) setCategory(prefilledCategory)
    if (!isOpen) { setAmount(''); setCategory(null); setNote(''); setIsRecurring(false); setDate(today) }
  }, [isOpen, prefilledCategory, today])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2 || (parts[1]?.length ?? 0) > 2) return
    setAmount(v)
  }

  const handleSubmit = () => {
    if (!amount || !category || !date) return
    const selCat = TRANSACTION_CATEGORIES.find(c => c.category === category)
    onSubmit({ amount: parseFloat(amount), category, type: selCat?.type || 'expense', date, note: note || undefined, isRecurring })
    onClose()
  }

  const canSubmit      = !!amount && !!category && !!date
  const selectedCatInfo = category ? TRANSACTION_CATEGORIES.find(c => c.category === category) : null
  const isIncomeCat    = selectedCatInfo?.type === 'income'

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
            Add Transaction
          </span>
          <button
            onClick={onClose}
            style={{ color: 'var(--muted)', padding: '4px' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-7 pb-8 space-y-8">

          {/* Amount — hero input */}
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span style={{ fontSize: '32px', fontFamily: 'Space Mono, monospace', color: isIncomeCat ? 'var(--green)' : 'var(--muted)', lineHeight: 1 }}>
                {isIncomeCat ? '+' : '−'}$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '48px',
                  lineHeight: 1,
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

          {/* Category */}
          <div>
            <p className="label mb-4">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {TRANSACTION_CATEGORIES.map(cat => {
                const sel        = category === cat.category
                const accent     = cat.type === 'income' ? 'var(--green)' : 'var(--red)'
                const accentGlow = cat.type === 'income' ? 'var(--green-glow)' : 'var(--red-glow)'
                return (
                  <button
                    key={cat.category}
                    onClick={() => setCategory(cat.category)}
                    className="cat-pill"
                    style={sel ? { borderColor: accent, background: accentGlow } : {}}
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{cat.emoji}</span>
                    <span style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.05em',
                      color: sel ? accent : 'var(--muted)',
                      lineHeight: 1.4,
                      textAlign: 'center',
                    }}>
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="label mb-4">Date</p>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setDate(today)}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em',
                  padding: '8px 14px', borderRadius: '4px',
                  border: '1px solid',
                  borderColor: date === today ? 'var(--sub)' : 'var(--border)',
                  color: date === today ? 'var(--text)' : 'var(--muted)',
                  background: date === today ? 'var(--raised)' : 'transparent',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                Today
              </button>
              <button
                onClick={() => setDate(yesterday)}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em',
                  padding: '8px 14px', borderRadius: '4px',
                  border: '1px solid',
                  borderColor: date === yesterday ? 'var(--sub)' : 'var(--border)',
                  color: date === yesterday ? 'var(--text)' : 'var(--muted)',
                  background: date === yesterday ? 'var(--raised)' : 'transparent',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                Yesterday
              </button>
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

          {/* Note */}
          <div>
            <p className="label mb-3">
              Note{' '}
              <span style={{ color: 'var(--dim)' }}>(optional)</span>
            </p>
            <input
              type="text"
              placeholder="what was this?"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="t-input"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '14px', color: 'var(--sub)' }}>Recurring monthly</span>
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className="t-toggle"
              style={{ background: isRecurring ? 'var(--text)' : 'var(--line)' }}
            >
              <div
                className="t-toggle-knob"
                style={{ transform: isRecurring ? 'translateX(20px)' : 'translateX(4px)' }}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}       className="flex-1 btn-ghost">Cancel</button>
            <button onClick={handleSubmit}  disabled={!canSubmit} className="flex-1 btn-primary">Add</button>
          </div>
        </div>
      </div>
    </>
  )
}
