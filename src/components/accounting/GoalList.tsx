"use client"
import { useState } from 'react'
import type { Goal } from '@/types'
import { GoalSheet } from './GoalSheet'
import { GoalContributeSheet } from './GoalContributeSheet'

interface GoalListProps {
  goals: Goal[]
  onCreateGoal: (data: { name: string; targetAmount: number; emoji: string }) => void
  onUpdateGoal: (goalId: string, data: { name: string; targetAmount: number; emoji: string }) => void
  onContributeToGoal: (goalId: string, amount: number) => void
  onDeleteGoal: (goalId: string) => void
}

export function GoalList({ goals, onCreateGoal, onUpdateGoal, onContributeToGoal, onDeleteGoal }: GoalListProps) {
  const [showCreate,     setShowCreate]     = useState(false)
  const [showContribute, setShowContribute] = useState(false)
  const [selected,       setSelected]       = useState<Goal | null>(null)
  const [editing,        setEditing]        = useState<Goal | null>(null)

  const handleClick  = (g: Goal) => { setSelected(g); setShowContribute(true) }
  const handleEdit   = () => { setEditing(selected); setShowContribute(false); setShowCreate(true) }
  const handleSubmit = (data: { name: string; targetAmount: number; emoji: string }) => {
    if (editing) { onUpdateGoal(editing.id, data); setEditing(null) }
    else onCreateGoal(data)
  }

  return (
    <div>
      {goals.length > 0 ? (
        goals.slice(0, 3).map(goal => {
          const pct       = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
          const complete  = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0

          return (
            <button
              key={goal.id}
              onClick={() => handleClick(goal)}
              className="w-full text-left flex flex-col gap-3 py-5 transition-colors"
              style={{
                borderBottom: '1px solid var(--border)',
                // Subtle green tint on completed rows
                ...(complete ? { background: 'rgba(62,207,110,0.03)' } : {}),
              }}
              onMouseEnter={e => (e.currentTarget.style.background = complete
                ? 'rgba(62,207,110,0.06)'
                : 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = complete
                ? 'rgba(62,207,110,0.03)'
                : 'transparent')}
            >
              {/* Name + badge */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg flex-shrink-0">{goal.emoji}</span>
                  <span
                    style={{ fontSize: '15px', color: complete ? 'var(--green)' : 'var(--text)' }}
                    className="truncate"
                  >
                    {goal.name}
                  </span>
                </div>

                {complete ? (
                  /* Completion badge */
                  <span style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--green)',
                    border: '1px solid var(--green)',
                    borderRadius: '3px',
                    padding: '2px 7px',
                    flexShrink: 0,
                  }}>
                    Complete
                  </span>
                ) : (
                  <span style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '13px',
                    color: 'var(--sub)',
                    flexShrink: 0,
                  }}>
                    {Math.round(pct)}%
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: complete ? 'var(--green)' : 'var(--blue)',
                  }}
                />
              </div>

              {/* Amounts */}
              <div className="flex justify-between">
                <span style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '13px',
                  color: complete ? 'var(--green)' : 'var(--sub)',
                }}>
                  ${goal.currentAmount.toLocaleString()} saved
                </span>
                {complete ? (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: 'var(--green)' }}>
                    goal reached ✓
                  </span>
                ) : (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: 'var(--muted)' }}>
                    ${remaining.toLocaleString()} left
                  </span>
                )}
              </div>
            </button>
          )
        })
      ) : (
        <div className="py-16 text-center">
          <p style={{ color: 'var(--sub)', fontSize: '15px', marginBottom: '6px' }}>No goals yet</p>
          <p className="label">create up to 3 savings goals</p>
        </div>
      )}

      {goals.length < 3 && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2.5 py-6 transition-colors"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="label" style={{ color: 'inherit' }}>
            New Goal {goals.length > 0 ? `(${3 - goals.length} left)` : ''}
          </span>
        </button>
      )}

      <GoalSheet
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditing(null) }}
        onSubmit={handleSubmit}
        editGoal={editing
          ? { id: editing.id, name: editing.name, targetAmount: editing.targetAmount, emoji: editing.emoji }
          : undefined}
      />
      <GoalContributeSheet
        isOpen={showContribute}
        onClose={() => {
          setShowContribute(false)
          // Delay clearing so the close animation can complete before unmounting
          setTimeout(() => setSelected(null), 350)
        }}
        goal={selected}
        onContribute={onContributeToGoal}
        onEdit={handleEdit}
        onDelete={onDeleteGoal}
      />
    </div>
  )
}
