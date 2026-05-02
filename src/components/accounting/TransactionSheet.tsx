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

export function TransactionSheet({ isOpen, onClose, onSubmit, prefilledCategory, recentTransactions = [] }: TransactionSheetProps) {
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState<TransactionCategory | null>(null)
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [note,        setNote]        = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

  const uniqueRecent = (() => {
    const seen = new Set<string>()
    const out: Transaction[] = []
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
    onSubmit({
      amount: parseFloat(amount),
      category,
      type: selCat?.type || 'expense',
      date,
      note: note || undefined,
      isRecurring,
    })
    setAmount(''); setCategory(null); setNote(''); setIsRecurring(false)
    setDate(new Date().toISOString().split('T')[0])
    onClose()
  }

  const canSubmit = !!amount && !!category && !!date

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet overflow-y-auto ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[10px] font-mono tracking-[0.2em] text-t-muted uppercase">Add Transaction</span>
          <button onClick={onClose} className="text-t-muted hover:text-t-text transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Recent templates */}
          {uniqueRecent.length > 0 && (
            <div>
              <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Recent</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                {uniqueRecent.map(tx => {
                  const cat = TRANSACTION_CATEGORIES.find(c => c.category === tx.category)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => { setAmount(tx.amount.toString()); setCategory(tx.category); setNote(tx.note || '') }}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-mono text-t-muted hover:text-t-text transition-colors"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <span className="text-t-muted">{cat?.label || tx.category}</span>
                      <span>${tx.amount}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Amount</p>
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {QUICK_AMOUNTS.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(p.toString())}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-mono transition-colors"
                  style={{
                    border: '1px solid',
                    borderColor: amount === p.toString() ? 'var(--text)' : 'var(--border)',
                    color: amount === p.toString() ? 'var(--text)' : 'var(--muted)',
                    background: amount === p.toString() ? 'var(--raised)' : 'transparent',
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-t-muted">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                autoFocus
                className="flex-1 bg-transparent text-4xl font-mono text-t-text outline-none border-b"
                style={{ borderColor: 'var(--line)' }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {TRANSACTION_CATEGORIES.map(cat => {
                const sel = category === cat.category
                const isIncome = cat.type === 'income'
                return (
                  <button
                    key={cat.category}
                    onClick={() => setCategory(cat.category)}
                    className="cat-pill"
                    style={sel ? {
                      borderColor: isIncome ? 'var(--green)' : 'var(--red)',
                      background: isIncome ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                    } : {}}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span
                      className="text-[9px] font-mono tracking-wide truncate w-full text-center leading-none"
                      style={{ color: sel ? (isIncome ? 'var(--green)' : 'var(--red)') : 'var(--muted)' }}
                    >
                      {cat.label.toUpperCase()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Date</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="t-input flex-1 text-xs font-mono"
              />
              <button
                onClick={() => setDate(yesterday)}
                className="px-4 py-2 text-[10px] font-mono tracking-widest uppercase transition-colors"
                style={{
                  border: '1px solid',
                  borderColor: date === yesterday ? 'var(--text)' : 'var(--border)',
                  color: date === yesterday ? 'var(--text)' : 'var(--muted)',
                }}
              >
                YEST
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Note</p>
            <input
              type="text"
              placeholder="optional"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="t-input text-sm"
            />
          </div>

          {/* Recurring */}
          <div
            className="flex items-center justify-between py-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-[11px] font-mono tracking-widest text-t-muted uppercase">Recurring</span>
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className="relative w-10 h-5 transition-colors"
              style={{
                background: isRecurring ? 'var(--text)' : 'var(--line)',
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-black transition-transform"
                style={{ transform: isRecurring ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-4">
            <button onClick={onClose} className="flex-1 btn-ghost">CANCEL</button>
            <button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 btn-primary">ADD</button>
          </div>
        </div>
      </div>
    </>
  )
}
