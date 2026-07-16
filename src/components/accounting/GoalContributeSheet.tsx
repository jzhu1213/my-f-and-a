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

  // Don't mount until first open; goal stays populated during close animation
  // because GoalList delays nulling `selected` by 350ms.
  if (!goal) return null

  const pct       = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const complete  = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0
  const barColor  = complete ? 'var(--green)' : 'var(--blue)'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet ${isOpen ? 'open' : ''}`} style={{ maxHeight: '80vh' }}>
        <div className="sheet-handle" />

        {/* Goal header */}
        <div className="px-6 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '28px', lineHeight: 1 }}>{goal.emoji}</span>
              <div>
                <h2 style={{ fontSize: '17px', color: complete ? 'var(--green)' : 'var(--text)', fontWeight: 400 }}>
                  {goal.name}
                </h2>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: 'var(--sub)', marginTop: '3px' }}>
                  ${goal.currentAmount.toLocaleString()}
                  <span style={{ color: 'var(--muted)' }}> / ${goal.targetAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="progress-track mb-3">
            <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
          <div className="flex justify-between">
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: complete ? 'var(--green)' : 'var(--sub)' }}>
              {pct}% complete
            </span>
            {complete ? (
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: 'var(--green)' }}>goal reached ✓</span>
            ) : (
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>
                ${remaining.toLocaleString()} to go
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {complete ? (
            <div className="py-6 text-center">
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</p>
              <p style={{ fontSize: '17px', color: 'var(--green)', marginBottom: '6px' }}>You hit your goal!</p>
              <p style={{ fontSize: '13px', color: 'var(--sub)' }}>
                ${goal.currentAmount.toLocaleString()} saved toward {goal.name}
              </p>
            </div>
          ) : (
            <>
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
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '24px', color: 'var(--muted)' }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    className="flex-1 bg-transparent outline-none"
                    style={{
                      fontFamily: 'Space Mono, monospace',
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
            </>
          )}

          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={onEdit} className="flex-1 btn-ghost">Edit</button>
            <button
              onClick={handleDelete}
              className="flex-1 btn-ghost"
              style={{ color: 'var(--red)', borderColor: 'var(--border)' }}
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
