"use client"
import { TRANSACTION_CATEGORIES } from '@/types'
import type { Transaction, TransactionCategory } from '@/types'
import type { CategoryBudgetRow } from '@/lib/budgetUtils'
import { weekStart } from '@/lib/budgetUtils'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { FONT_FAMILY, typography } from '@/styles/typography'

interface CategoryDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  row: CategoryBudgetRow | null
  transactions: Transaction[]
  onLogHere: (category: TransactionCategory) => void
}

function getLabel(cat: TransactionCategory) {
  return TRANSACTION_CATEGORIES.find(c => c.category === cat)?.label ?? cat
}

export function CategoryDetailSheet({
  isOpen, onClose, row, transactions, onLogHere,
}: CategoryDetailSheetProps) {
  if (!row) return null

  const ws         = weekStart()
  const recentTxs  = transactions
    .filter(t => t.category === row.category && t.type === 'expense' && t.date >= ws)
    .slice(0, 3)

  const leftLabel = (() => {
    if (!row.hasLimit) return row.weeklySpent > 0 ? `$${row.weeklySpent.toFixed(0)} spent this week` : 'No limit set'
    if (row.overWeekly) return `$${Math.abs(row.weeklyLeft).toFixed(0)} over this week`
    return `$${Math.max(0, row.weeklyLeft).toFixed(0)} left this week`
  })()

  const statusColor = !row.hasLimit ? 'var(--sub)'
    : row.overWeekly ? 'var(--red)'
    : row.nearLimit ? 'var(--amber)'
    : 'var(--green)'

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'var(--color-canvas)' }}
        onClick={onClose}
      />

      <div className={`sheet ${isOpen ? 'open' : ''}`} style={{ maxHeight: '75vh' }}>
        <div className="sheet-handle" />

        <div className="px-6 pb-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <CategoryIcon category={row.category} size={48} />
            <div>
              <p style={{ fontSize: '17px', color: 'var(--text)' }}>{row.label}</p>
              <p style={{
                fontFamily: FONT_FAMILY, fontSize: typography.body.fontSize,
                color: statusColor, marginTop: '4px',
              }}>
                {leftLabel}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto">
          {row.hasLimit && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="label">Weekly progress</span>
                <span style={{ fontFamily: FONT_FAMILY, fontSize: typography['body-sm'].fontSize, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  ${row.weeklySpent.toFixed(0)} / ${row.weeklyLimit.toFixed(0)}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    ["--progress-fill-fraction" as string]: row.weekPct / 100,
                    background: row.overWeekly ? 'var(--red)' : row.nearLimit ? 'var(--amber)' : 'var(--green)',
                  } as React.CSSProperties}
                />
              </div>
              {row.monthlyLimit > 0 && (
                <p style={{ fontFamily: FONT_FAMILY, fontSize: typography.caption.fontSize, color: 'var(--muted)', marginTop: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${row.monthlySpent.toFixed(0)} / ${row.monthlyLimit.toFixed(0)} this month
                </p>
              )}
            </div>
          )}

          {recentTxs.length > 0 && (
            <div>
              <p className="label mb-3">This week</p>
              {recentTxs.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span style={{ fontSize: typography.body.fontSize, color: 'var(--text)' }} className="truncate flex-1 mr-4">
                    {tx.note || getLabel(tx.category)}
                  </span>
                  <span style={{ fontFamily: FONT_FAMILY, fontSize: typography.body.fontSize, color: 'var(--sub)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    −${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {recentTxs.length === 0 && (
            <p style={{ fontSize: typography.body.fontSize, color: 'var(--muted)' }}>No spending in this category yet this week.</p>
          )}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { onLogHere(row.category); onClose() }}
            className="w-full btn-primary"
          >
            Log expense here
          </button>
        </div>
      </div>
    </>
  )
}
