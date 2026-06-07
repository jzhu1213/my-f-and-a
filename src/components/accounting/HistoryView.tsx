"use client"
import { useState } from 'react'
import { TransactionList } from './TransactionList'
import type { Transaction } from '@/types'
import { shiftMonth, toMonthString } from '@/lib/budgetUtils'

interface HistoryViewProps {
  transactions: Transaction[]
  isLoading?: boolean
  onEditTransaction: (tx: Transaction) => void
  onDeleteTransaction: (id: string) => void
}

export function HistoryView({
  transactions, isLoading = false,
  onEditTransaction, onDeleteTransaction,
}: HistoryViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthString(new Date()))
  const currentMonth   = toMonthString(new Date())
  const isCurrentMonth = selectedMonth === currentMonth
  const monthLabel     = new Date(selectedMonth + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthTxs       = transactions.filter(t => t.date.startsWith(selectedMonth))

  return (
    <div className="pb-24">
      <div className="px-6 pt-12 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="label mb-6">history</p>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
            style={{ color: 'var(--muted)', padding: '4px 6px' }}
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p style={{ fontSize: '15px', color: 'var(--text)' }}>{monthLabel}</p>
          <button
            onClick={() => setSelectedMonth(m => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
            style={{ color: isCurrentMonth ? 'var(--border)' : 'var(--muted)', padding: '4px 6px' }}
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-6 pt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-6 h-6 animate-spin"
              style={{ border: '1px solid var(--line)', borderTopColor: 'var(--sub)', borderRadius: '50%' }}
            />
            <p className="label">loading</p>
          </div>
        ) : (
          <TransactionList
            transactions={monthTxs}
            onDelete={isCurrentMonth ? onDeleteTransaction : undefined}
            onEdit={isCurrentMonth ? onEditTransaction : undefined}
          />
        )}
      </div>
    </div>
  )
}
