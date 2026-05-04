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

const QUICK_AMOUNTS = [5, 10, 20, 50, 100]

export function TransactionSheet({
  isOpen, onClose, onSubmit, prefilledCategory, recentTransactions = [],
}: TransactionSheetProps) {
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState<TransactionCategory | null>(null)
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [note,        setNote]        = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

  const uniqueRecent = (() => {
    const seen = new Set<string>(); const out: Transaction[] = []
    for (const tx of recentTransactions) {
      const key = `${tx.category}-${tx.amount}-${tx.note || ''}`
      if (!seen.has(key) && out.length < 4) { seen.add(key); out.push(tx) }
    }
    return out
  })()

  useEffect(() => {
    if (isOpen && prefilledCategory) setCategory(prefilledCategory)
  }, [isOpen, prefilledCategory])

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
    setAmount(''); setCategory(null); setNote(''); setIsRecurring(false)
    setDate(new Date().toISOString().split('T')[0])
    onClose()
  }

  const canSubmit = !!amount && !!category && !!date
  const selectedCatInfo = category ? TRANSACTION_CATEGORIES.find(c => c.category === category) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet overflow-y-auto ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="label">Add Transaction</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center transition-colors"
            style={{ color: 'var(--muted)', borderRadius: '3px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-7">
          {/* Recent templates */}
          {uniqueRecent.length > 0 && (
            <div>
              <p className="label mb-3">Recent</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                {uniqueRecent.map(tx => {
                  const cat = TRANSACTION_CATEGORIES.find(c => c.category === tx.category)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => { setAmount(tx.amount.toString()); setCategory(tx.category); setNote(tx.note || '') }}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-mono transition-all"
                      style={{
                        border: '1px solid var(--border)',
                        color: 'var(--sub)',
                        borderRadius: '3px',
                      }}
                    >
                      <span className="text-sm">{cat?.emoji}</span>
                      <div className="text-left">
                        <p style={{ color: 'var(--sub)' }}>{cat?.label || tx.category}</p>
                        <p style={{ color: 'var(--muted)' }}>${tx.amount}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <p className="label mb-3">Amount</p>
            <div className="flex gap-2 mb-4 flex-wrap">
              {QUICK_AMOUNTS.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(p.toString())}
                  className={`amount-chip ${amount === p.toString() ? 'active' : ''}`}
                >
                  ${p}
                </button>
              ))}
            </div>
            <div className="flex items-baseline gap-3">
              <span
                className="text-3xl font-mono flex-shrink-0"
                style={{ color: selectedCatInfo?.type === 'income' ? 'var(--green)' : amount ? 'var(--sub)' : 'var(--dim)' }}
              >
                {selectedCatInfo?.type === 'income' ? '+' : '−'}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                autoFocus
                className="flex-1 bg-transparent outline-none font-mono"
                style={{
                  fontSize: '40px',
                  lineHeight: 1,
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '8px',
                  caretColor: 'var(--text)',
                }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="label mb-3">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {TRANSACTION_CATEGORIES.map(cat => {
                const sel      = category === cat.category
                const isIncome = cat.type === 'income'
                const accentColor = isIncome ? 'var(--green)' : 'var(--red)'
                return (
                  <button
                    key={cat.category}
                    onClick={() => setCategory(cat.category)}
                    className={`cat-pill ${sel ? 'selected' : ''}`}
                    style={sel ? {
                      borderColor: accentColor,
                      background: isIncome ? 'var(--green-glow)' : 'var(--red-glow)',
                    } : {}}
                  >
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span
                      style={{
                        fontFamily: 'Space Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.06em',
                        color: sel ? accentColor : 'var(--muted)',
                        lineHeight: 1.3,
                      }}
                    >
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="label mb-3">Date</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="t-input flex-1 font-mono text-xs"
              />
              <button
                onClick={() => setDate(yesterday)}
                className="px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all flex-shrink-0"
                style={{
                  border: '1px solid',
                  borderColor: date === yesterday ? 'var(--sub)' : 'var(--border)',
                  color: date === yesterday ? 'var(--text)' : 'var(--muted)',
                  background: date === yesterday ? 'var(--raised)' : 'transparent',
                  borderRadius: '3px',
                  letterSpacing: '0.1em',
                }}
              >
                YEST
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="label mb-3">Note <span style={{ color: 'var(--dim)' }}>(optional)</span></p>
            <input
              type="text"
              placeholder="what was this for?"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="t-input"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between py-1">
            <span className="label-sub">Recurring</span>
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className="t-toggle"
              style={{ background: isRecurring ? 'var(--text)' : 'var(--line)' }}
            >
              <div
                className="t-toggle-knob"
                style={{ transform: isRecurring ? 'translateX(18px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-2">
            <button onClick={onClose}    className="flex-1 btn-ghost">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 btn-primary">Add</button>
          </div>
        </div>
      </div>
    </>
  )
}
