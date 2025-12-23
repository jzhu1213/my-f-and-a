"use client"
import type { Goal } from '@/types'

interface GoalListProps {
  goals: Goal[]
}

export function GoalList({ goals }: GoalListProps) {
  // Show up to 3 goals max as per spec
  const displayGoals = goals.slice(0, 3)
  
  return (
    <div className="space-y-4">
      {displayGoals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {displayGoals.map((goal) => {
            const progress = goal.targetAmount > 0 
              ? Math.round((goal.currentAmount / goal.targetAmount) * 100) 
              : 0
            
            return (
              <div 
                key={goal.id}
                className="glass-card-solid p-5 transition-all duration-200 hover:scale-102 cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{goal.emoji}</span>
                  <h3 className="font-semibold truncate">{goal.name}</h3>
                </div>
                
                {/* Amount Display */}
                <div className="mb-3">
                  <span className="text-2xl font-mono font-bold text-sage-dark dark:text-sage">
                    ${goal.currentAmount.toLocaleString()}
                  </span>
                  <span className="text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                    /${goal.targetAmount.toLocaleString()}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="progress-bar-liquid">
                  <div 
                    className="progress-bar-fill"
                    style={{ 
                      width: `${Math.min(progress, 100)}%`,
                      ['--fill-width' as string]: `${Math.min(progress, 100)}%` 
                    }}
                  />
                </div>
                
                <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark mt-2">
                  {progress}% complete
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card-solid p-8 text-center">
          <span className="text-4xl mb-4 block">🎯</span>
          <h3 className="font-semibold mb-2">No goals yet</h3>
          <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-4">
            Set savings goals to track your progress
          </p>
        </div>
      )}
      
      {/* Add Goal Button - Only show if less than 3 goals */}
      {goals.length < 3 && (
        <button className="w-full glass-card-solid p-4 flex items-center justify-center gap-2 text-sage-dark dark:text-sage hover:bg-sage/10 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="font-medium">Add Goal {goals.length > 0 ? `(${3 - goals.length} left)` : ''}</span>
        </button>
      )}
    </div>
  )
}

