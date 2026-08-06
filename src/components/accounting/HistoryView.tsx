"use client"
import { useState } from 'react'
import { motion } from 'framer-motion'
import { TransactionList } from './TransactionList'
import type { Transaction, TransactionCategory } from '@/types'
import type { FundingSource } from '@/lib/fundingSources'
import { shiftMonth, toMonthString } from '@/lib/budgetUtils'
import { GlassCard } from '@/components/ui/GlassCard'
import { springs } from '@/lib/animations'
import { borderRadius } from '@/styles/shared'

interface HistoryViewProps {
  transactions: Transaction[]
  isLoading?: boolean
  onEditTransaction: (tx: Transaction) => void
  onDeleteTransaction: (id: string) => void
  /** Callback to trigger bulk repeat flow (Task 93.1) */
  onRepeatTransaction?: (tx: Transaction) => void
  /** Funding sources for search/filter in TransactionList (Task 129) */
  fundingSources?: FundingSource[]
  /** Bulk delete multiple transactions (Task 131) */
  onBulkDelete?: (ids: string[]) => void
  /** Bulk recategorize multiple transactions (Task 131) */
  onBulkRecategorize?: (ids: string[], category: TransactionCategory) => void
  /** Bulk tag multiple transactions (Task 131) */
  onBulkTag?: (ids: string[], tags: string[]) => void
}

export function HistoryView({
  transactions, isLoading = false,
  onEditTransaction, onDeleteTransaction, onRepeatTransaction,
  fundingSources, onBulkDelete, onBulkRecategorize, onBulkTag,
}: HistoryViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthString(new Date()))
  const currentMonth   = toMonthString(new Date())
  const isCurrentMonth = selectedMonth === currentMonth
  const monthLabel     = new Date(selectedMonth + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthTxs       = transactions.filter(t => t.date.startsWith(selectedMonth))

  return (
    <div className="pb-24" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          padding: "0 20px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingTop: 16,
          paddingBottom: 120, // room for dock
        }}
      >
        {/* Month selector card */}
        <GlassCard elevation="low" style={{ padding: "20px", borderRadius: borderRadius.lg }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--sub)",
              fontFamily: "Inter, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            History
          </h2>

          <div className="flex items-center justify-between">
            <motion.button
              type="button"
              onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
              whileTap={{ scale: 0.9 }}
              transition={springs.snappy}
              style={{
                color: 'var(--sub)',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>

            <p
              style={{
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--text)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {monthLabel}
            </p>

            <motion.button
              type="button"
              onClick={() => setSelectedMonth(m => shiftMonth(m, 1))}
              disabled={isCurrentMonth}
              whileTap={{ scale: isCurrentMonth ? 1 : 0.9 }}
              transition={springs.snappy}
              style={{
                color: isCurrentMonth ? 'var(--border)' : 'var(--sub)',
                padding: '8px',
                background: isCurrentMonth ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                borderRadius: 8,
                border: `1px solid ${isCurrentMonth ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isCurrentMonth ? 'not-allowed' : 'pointer',
                opacity: isCurrentMonth ? 0.4 : 1,
              }}
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          </div>
        </GlassCard>

        {/* Transaction list */}
        {isLoading ? (
          <GlassCard elevation="low" style={{ padding: "32px 20px", borderRadius: borderRadius.lg }}>
            <div className="flex flex-col items-center justify-center gap-4">
              <div
                className="w-6 h-6 animate-spin"
                style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}
              />
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--sub)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                }}
              >
                Loading...
              </p>
            </div>
          </GlassCard>
        ) : (
          <TransactionList
            transactions={monthTxs}
            onDelete={isCurrentMonth ? onDeleteTransaction : undefined}
            onEdit={isCurrentMonth ? onEditTransaction : undefined}
            onRepeat={isCurrentMonth ? onRepeatTransaction : undefined}
            fundingSources={fundingSources}
            onBulkDelete={isCurrentMonth ? onBulkDelete : undefined}
            onBulkRecategorize={isCurrentMonth ? onBulkRecategorize : undefined}
            onBulkTag={isCurrentMonth ? onBulkTag : undefined}
          />
        )}
      </div>
    </div>
  )
}
