"use client"
import { useState } from 'react'
import type { Goal } from '@/types'

interface GoalContributeSheetProps {
  isOpen: boolean
  onClose: () => void
  goal: Goal | null
  onContribute: (goalId: string, amount: number) => void
  onEdit: () => void
  onDelete: (goalId: string) => void
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

export function GoalContributeSheet({ isOpen, onClose, goal, onContribute, onEdit, onDelete }: GoalContributeSheetProps) {
  const [amount, setAmount] = useState('')

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2 || (parts[1]?.length ?? 0) > 2) return
    setAmount(v)
  }

  const handleContribute = () => {
    if (!amount || !goal) return
    onContribute(goal.id, parseFloat(amount))
    setAmount(''); onClose()
  }

  const handleDelete = () => {
    if (!goal) return
    if (confirm(`Delete "${goal.name}"?`)) { onDelete(goal.id); onClose() }
  }

  if (!isOpen || !goal) return null

  const pct       = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

  return (
    <>
      <div
        className="fixed inset-0 bg-black/75 z-40 animate-fade-in"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[80vh] animate-slide-up"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderRadius: '8px 8px 0 0' }}
      >
        <div className="sheet-handle" />

        {/* Goal header */}
        <div className="px-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{goal.emoji}</span>
              <div>
                <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>{goal.name}</h2>
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>
                  ${goal.currentAmount.toLocaleString()} <span style={{ color: 'var(--dim)' }}>/ ${goal.targetAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="progress-track mb-2">
            <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--blue)' }} />
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{pct}% complete</span>
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>${remaining.toLocaleString()} to go</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Amount input */}
          <div>
            <p className="label mb-3">Add Amount</p>
            <div className="flex gap-2 mb-4">
              {QUICK_AMOUNTS.map(q => (
                <button
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  className={`amount-chip flex-1 text-center ${amount === q.toString() ? 'active' : ''}`}
                >
                  ${q}
                </button>
              ))}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-mono" style={{ color: 'var(--muted)' }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent outline-none font-mono"
                style={{
                  fontSize: '36px',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '6px',
                  caretColor: 'var(--text)',
                }}
              />
            </div>
          </div>

          <button onClick={handleContribute} disabled={!amount} className="w-full btn-primary">
            Add ${amount || '0'}
          </button>

          <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={onEdit} className="flex-1 btn-ghost">Edit</button>
            <button
              onClick={handleDelete}
              className="flex-1 py-3.5 text-xs font-mono tracking-wide uppercase transition-colors"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--red)',
                borderRadius: '3px',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
