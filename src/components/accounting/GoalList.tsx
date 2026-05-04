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
  const [showCreateSheet,     setShowCreateSheet]     = useState(false)
  const [showContributeSheet, setShowContributeSheet] = useState(false)
  const [selectedGoal,  setSelectedGoal]  = useState<Goal | null>(null)
  const [editingGoal,   setEditingGoal]   = useState<Goal | null>(null)

  const displayGoals = goals.slice(0, 3)

  const handleGoalClick = (goal: Goal) => { setSelectedGoal(goal); setShowContributeSheet(true) }
  const handleEditGoal  = () => { setEditingGoal(selectedGoal); setShowContributeSheet(false); setShowCreateSheet(true) }
  const handleCreateOrUpdate = (data: { name: string; targetAmount: number; emoji: string }) => {
    if (editingGoal) { onUpdateGoal(editingGoal.id, data); setEditingGoal(null) }
    else onCreateGoal(data)
  }

  return (
    <div>
      {displayGoals.length > 0 ? (
        displayGoals.map(goal => {
          const pct       = goal.targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100) : 0
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

          return (
            <button
              key={goal.id}
              onClick={() => handleGoalClick(goal)}
              className="t-row w-full text-left py-4 px-0 flex-col items-stretch gap-2.5"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{goal.emoji}</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{goal.name}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{pct}%</span>
              </div>

              <div className="progress-track w-full">
                <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--blue)' }} />
              </div>

              <div className="flex justify-between w-full">
                <span className="text-xs font-mono" style={{ color: 'var(--sub)' }}>
                  ${goal.currentAmount.toLocaleString()}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  ${remaining.toLocaleString()} left
                </span>
              </div>
            </button>
          )
        })
      ) : (
        <div className="py-14 text-center">
          <p className="label mb-1.5">No goals yet</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Create up to 3 savings goals</p>
        </div>
      )}

      {goals.length < 3 && (
        <button
          onClick={() => setShowCreateSheet(true)}
          className="w-full py-5 flex items-center justify-center gap-2 transition-colors mt-1"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="label" style={{ color: 'inherit' }}>
            New Goal {goals.length > 0 ? `(${3 - goals.length} left)` : ''}
          </span>
        </button>
      )}

      <GoalSheet
        isOpen={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setEditingGoal(null) }}
        onSubmit={handleCreateOrUpdate}
        editGoal={editingGoal ? { id: editingGoal.id, name: editingGoal.name, targetAmount: editingGoal.targetAmount, emoji: editingGoal.emoji } : undefined}
      />
      <GoalContributeSheet
        isOpen={showContributeSheet}
        onClose={() => { setShowContributeSheet(false); setSelectedGoal(null) }}
        goal={selectedGoal}
        onContribute={onContributeToGoal}
        onEdit={handleEditGoal}
        onDelete={onDeleteGoal}
      />
    </div>
  )
}
