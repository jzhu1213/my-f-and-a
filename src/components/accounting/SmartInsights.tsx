"use client"
import type { SmartInsight } from '@/types'

interface SmartInsightsProps {
  insights: SmartInsight[]
}

export function SmartInsights({ insights }: SmartInsightsProps) {
  if (insights.length === 0) return null
  
  const getInsightStyle = (type: SmartInsight['type']) => {
    switch (type) {
      case 'safe_to_spend':
        return 'bg-sage-light/50 dark:bg-sage-dark/30 border-sage'
      case 'spending_increase':
        return 'bg-peach/20 dark:bg-peach/30 border-peach'
      case 'income_pattern':
        return 'bg-sage-light/50 dark:bg-sage-dark/30 border-sage'
      case 'under_budget':
        return 'bg-sage-light/50 dark:bg-sage-dark/30 border-sage'
      case 'recurring_suggestion':
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300'
    }
  }
  
  const getInsightIcon = (type: SmartInsight['type']) => {
    switch (type) {
      case 'safe_to_spend':
        return '✅'
      case 'spending_increase':
        return '📈'
      case 'income_pattern':
        return '💰'
      case 'under_budget':
        return '🎉'
      case 'recurring_suggestion':
        return '🔄'
      default:
        return '💡'
    }
  }
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
        Smart Insights
      </h3>
      
      <div className="space-y-2">
        {insights.slice(0, 3).map((insight) => (
          <div
            key={insight.id}
            className={`rounded-xl p-4 border-l-4 transition-all duration-200 hover:scale-101 cursor-pointer ${getInsightStyle(insight.type)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{getInsightIcon(insight.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{insight.title}</p>
                <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark mt-0.5">
                  {insight.description}
                </p>
              </div>
              {insight.actionLabel && (
                <button className={`text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 ${
                  insight.type === 'spending_increase' 
                    ? 'bg-peach text-white' 
                    : 'bg-sage text-black'
                }`}>
                  {insight.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

