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
    setAmount('')
    onClose()
  }

  const handleDelete = () => {
    if (!goal) return
    if (confirm(`Delete "${goal.name}"?`)) { onDelete(goal.id); onClose() }
  }

  if (!isOpen || !goal) return null

  const progress  = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40 animate-fade-in" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[80vh] animate-slide-up" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{goal.emoji}</span>
              <div>
                <h2 className="text-base text-t-text font-medium">{goal.name}</h2>
                <p className="text-xs font-mono text-t-muted">
                  ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-t-muted hover:text-t-text transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="progress-track mb-2">
            <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%`, background: 'var(--blue)' }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-t-muted">
            <span>{progress}% complete</span>
            <span>${remaining.toLocaleString()} to go</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Add Amount</p>
            <div className="flex gap-2 mb-3">
              {QUICK_AMOUNTS.map(q => (
                <button
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  className="flex-1 py-1.5 text-xs font-mono transition-colors"
                  style={{
                    border: '1px solid',
                    borderColor: amount === q.toString() ? 'var(--text)' : 'var(--border)',
                    color: amount === q.toString() ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  ${q}
                </button>
              ))}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono text-t-muted">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent text-3xl font-mono text-t-text outline-none border-b"
                style={{ borderColor: 'var(--line)' }}
              />
            </div>
          </div>

          <button
            onClick={handleContribute}
            disabled={!amount}
            className="w-full btn-primary"
          >
            ADD ${amount || '0'}
          </button>

          <div className="flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button onClick={onEdit} className="flex-1 btn-ghost text-[10px] tracking-widest">EDIT</button>
            <button
              onClick={handleDelete}
              className="flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--red)' }}
            >
              DELETE
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
