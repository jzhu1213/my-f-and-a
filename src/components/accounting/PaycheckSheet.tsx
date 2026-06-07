"use client"
import { useState, useEffect } from 'react'
import type { Goal } from '@/types'

interface PaycheckSheetProps {
  isOpen: boolean
  amount: number
  goals: Goal[]
  onContribute: (goalId: string, amount: number) => void
  onClose: () => void
}

const QUICK_CONTRIBUTIONS = [10, 25, 50]

export function PaycheckSheet({ isOpen, amount, goals, onContribute, onClose }: PaycheckSheetProps) {
  const [contributed, setContributed] = useState(0)

  useEffect(() => {
    if (isOpen) setContributed(0)
  }, [isOpen, amount])

  const handleContribute = (goalId: string, amt: number) => {
    onContribute(goalId, amt)
    setContributed(c => c + amt)
  }

  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)
  const remaining   = Math.max(0, amount - contributed)

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      <div className={`sheet ${isOpen ? 'open' : ''}`} style={{ maxHeight: '80vh' }}>
        <div className="sheet-handle" />

        <div className="px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="label mb-3">Paycheck logged</p>
          <p style={{
            fontSize: '40px', fontFamily: 'Space Mono, monospace', fontWeight: 300,
            color: 'var(--green)', lineHeight: 1,
          }}>
            +${amount.toLocaleString()}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--sub)', marginTop: '10px' }}>
            Set some aside for savings, or tap Done to keep it all for spending.
          </p>
        </div>

        <div className="px-6 py-6 flex-1 overflow-y-auto space-y-6">
          {activeGoals.length > 0 ? (
            activeGoals.map(goal => {
              const pct = goal.targetAmount > 0
                ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                : 0
              return (
                <div key={goal.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontSize: '20px' }}>{goal.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '15px', color: 'var(--text)' }} className="truncate">{goal.name}</p>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()} · {pct}%
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {QUICK_CONTRIBUTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => handleContribute(goal.id, q)}
                        className="amount-chip flex-1 text-center"
                      >
                        +${q}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              No active savings goals. Create one in Limits to split paychecks automatically.
            </p>
          )}

          {contributed > 0 && (
            <div
              className="px-4 py-3"
              style={{ background: 'var(--raised)', borderRadius: '6px', border: '1px solid var(--border)' }}
            >
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: 'var(--sub)' }}>
                ${contributed.toLocaleString()} saved · ${remaining.toLocaleString()} for spending
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="w-full btn-primary">Done</button>
        </div>
      </div>
    </>
  )
}
