"use client"

import type { Transaction } from "@/types"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { HistoryView } from "@/components/accounting/HistoryView"
import { InsightTrendCard } from "./InsightTrendCard"
import { InsightBreakdownCard } from "./InsightBreakdownCard"

// ============================================================================
// HistoryScreen Props
// ============================================================================

export interface HistoryScreenProps {
  /** All user transactions passed to HistoryView */
  transactions: Transaction[]
  /** Whether data is still loading */
  isLoading: boolean
  /** Called when user edits a transaction */
  onEditTransaction: (tx: Transaction) => void
  /** Called when user deletes a transaction */
  onDeleteTransaction: (id: string) => void
  /** Called when the FAB is tapped to log a new expense */
  onLogExpense: () => void
  /** Called when user wants to repeat a transaction across dates (Task 93.1) */
  onRepeatTransaction?: (tx: Transaction) => void
}

// ============================================================================
// HistoryScreen Component
// ============================================================================

/**
 * HistoryScreen — wraps the existing HistoryView for the simplified AppShell layout.
 *
 * Adds proper padding/layout for the AppShell context plus a floating "+" FAB
 * in the bottom-right corner (above the dock) to quickly log a new expense.
 *
 * Requirements: 9.2, 11.1
 */
export function HistoryScreen({
  transactions,
  isLoading,
  onEditTransaction,
  onDeleteTransaction,
  onLogExpense,
  onRepeatTransaction,
}: HistoryScreenProps) {
  return (
    <div className="history-screen">
      {/* Month-over-month trend insight (Requirement 9.4) */}
      <div style={{ padding: "12px 16px 0" }}>
        <InsightTrendCard transactions={transactions} />
      </div>

      {/* Spending breakdown insight (Requirement 9.4) */}
      <div style={{ padding: "8px 16px 0" }}>
        <InsightBreakdownCard transactions={transactions} />
      </div>

      <HistoryView
        transactions={transactions}
        isLoading={isLoading}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
        onRepeatTransaction={onRepeatTransaction}
      />

      {/* Floating Action Button — log new expense */}
      <motion.button
        type="button"
        className="history-screen__fab"
        onClick={onLogExpense}
        whileTap={{ scale: 0.96 }}
        transition={springs.snappy}
        aria-label="Log new expense"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </motion.button>
    </div>
  )
}
