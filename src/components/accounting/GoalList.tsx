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
  const [showCreateSheet,    setShowCreateSheet]    = useState(false)
  const [showContributeSheet, setShowContributeSheet] = useState(false)
  const [selectedGoal,  setSelectedGoal]  = useState<Goal | null>(null)
  const [editingGoal,   setEditingGoal]   = useState<Goal | null>(null)

  const displayGoals = goals.slice(0, 3)

  const handleGoalClick = (goal: Goal) => {
    setSelectedGoal(goal)
    setShowContributeSheet(true)
  }

  const handleEditGoal = () => {
    setEditingGoal(selectedGoal)
    setShowContributeSheet(false)
    setShowCreateSheet(true)
  }

  const handleCreateOrUpdate = (data: { name: string; targetAmount: number; emoji: string }) => {
    if (editingGoal) {
      onUpdateGoal(editingGoal.id, data)
      setEditingGoal(null)
    } else {
      onCreateGoal(data)
    }
  }

  return (
    <div>
      {displayGoals.length > 0 ? (
        <div>
          {displayGoals.map(goal => {
            const progress  = goal.targetAmount > 0
              ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
              : 0
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

            return (
              <button
                key={goal.id}
                onClick={() => handleGoalClick(goal)}
                className="w-full text-left py-4 transition-colors hover:bg-t-hover"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{goal.emoji}</span>
                    <span className="text-sm text-t-text">{goal.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-t-muted">{progress}%</span>
                </div>

                <div className="progress-track mb-2">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%`, background: 'var(--blue)' }}
                  />
                </div>

                <div className="flex justify-between text-[10px] font-mono text-t-muted">
                  <span>${goal.currentAmount.toLocaleString()}</span>
                  <span>${remaining.toLocaleString()} to go</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-xs font-mono tracking-widest text-t-muted uppercase mb-1">No goals</p>
          <p className="text-xs text-t-muted">tap below to create one</p>
        </div>
      )}

      {goals.length < 3 && (
        <button
          onClick={() => setShowCreateSheet(true)}
          className="w-full py-4 flex items-center justify-center gap-2 text-[11px] font-mono tracking-widest text-t-muted hover:text-t-text transition-colors uppercase mt-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Goal {goals.length > 0 ? `(${3 - goals.length} left)` : ''}
        </button>
      )}

      <GoalSheet
        isOpen={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setEditingGoal(null) }}
        onSubmit={handleCreateOrUpdate}
        editGoal={editingGoal ? {
          id: editingGoal.id,
          name: editingGoal.name,
          targetAmount: editingGoal.targetAmount,
          emoji: editingGoal.emoji,
        } : undefined}
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
