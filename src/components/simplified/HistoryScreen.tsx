"use client"

import type { Transaction, TransactionCategory } from "@/types"
import type { DailyAllowance } from "@/types/folio"
import type { FundingSource } from "@/lib/fundingSources"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
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
  /** Daily allowance data — reinforces the core "can I afford this?" identity (Task 117.1) */
  allowance?: DailyAllowance | null
  /** Funding sources for search/filter in TransactionList (Task 129) */
  fundingSources?: FundingSource[]
  /** Bulk delete multiple transactions (Task 131) */
  onBulkDelete?: (ids: string[]) => void
  /** Bulk recategorize multiple transactions (Task 131) */
  onBulkRecategorize?: (ids: string[], category: TransactionCategory) => void
  /** Bulk tag multiple transactions (Task 131) */
  onBulkTag?: (ids: string[], tags: string[]) => void
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
  allowance,
  fundingSources,
  onBulkDelete,
  onBulkRecategorize,
  onBulkTag,
}: HistoryScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  return (
    <div className="history-screen">
      {/* Compact daily allowance reinforcement — keeps the core identity visible (Task 117.1) */}
      {allowance && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 16px 2px",
            fontFamily: FONT_FAMILY,
          }}
          aria-label={`Today's remaining: $${Math.round(allowance.amount)}`}
        >
          <span
            style={{
              fontSize: 13,
              color: "var(--sub)",
              fontWeight: 400,
            }}
          >
            Today&rsquo;s budget:
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: allowance.amount > 0 ? "var(--success)" : "var(--error)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${Math.round(allowance.amount)}
          </span>
        </div>
      )}
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
        fundingSources={fundingSources}
        onBulkDelete={onBulkDelete}
        onBulkRecategorize={onBulkRecategorize}
        onBulkTag={onBulkTag}
      />

      {/* Floating Action Button — log new expense */}
      <motion.button
        type="button"
        className="history-screen__fab"
        onClick={onLogExpense}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
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
