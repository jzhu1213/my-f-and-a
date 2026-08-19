"use client"

/**
 * RecurringScreen — Unified screen merging "Recurring Bills" (manual/fixed)
 * and "Recurring Patterns" (auto-detected) into a single tabbed view.
 *
 * Composition approach: renders existing sub-screens as tab content.
 *
 * Task 489.1 — Consolidate overlapping tools
 * Requirements: 29.7
 */

import { useState } from "react"
import { RecurringBillsScreen } from "./RecurringBillsScreen"
import { RecurrenceManagementScreen } from "./RecurrenceManagementScreen"
import { FONT_FAMILY } from "@/styles/typography"
import {
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import type { Transaction } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import type { MergedRecurrence } from "@/lib/recurrenceDetector"

// ============================================================================
// Types
// ============================================================================

export interface RecurringScreenProps {
  /** User's manually-added recurring bills */
  bills: FixedExpense[]
  /** All user transactions for pattern detection */
  transactions: Transaction[]
  /** Add a new bill */
  onAddBill: (bill: Omit<FixedExpense, "id" | "userId">) => Promise<void>
  /** Update an existing bill */
  onUpdateBill: (id: string, bill: Partial<FixedExpense>) => Promise<void>
  /** Delete a bill */
  onDeleteBill: (id: string) => Promise<void>
  /** Close/back handler */
  onClose: () => void
  /** Confirm a detected recurrence as a bill */
  onConfirmRecurrence?: (recurrence: MergedRecurrence) => Promise<void>
  /** Dismiss a detected recurrence */
  onDismissRecurrence?: (recurrenceId: string) => void
  /** Pause a recurrence */
  onPauseRecurrence?: (recurrenceId: string) => void
}

type RecurringTab = "bills" | "patterns"

// ============================================================================
// Styles
// ============================================================================

const tabContainerStyle: React.CSSProperties = {
  padding: "16px 20px 12px",
  background: "var(--bg)",
}

// ============================================================================
// Component
// ============================================================================

export function RecurringScreen({
  bills,
  transactions,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onClose,
  onConfirmRecurrence,
  onDismissRecurrence,
  onPauseRecurrence,
}: RecurringScreenProps) {
  const [activeTab, setActiveTab] = useState<RecurringTab>("bills")

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Segmented tabs at top */}
      <div style={tabContainerStyle}>
        <div style={segmentedControl} role="tablist" aria-label="Recurring view">
          <button
            role="tab"
            aria-selected={activeTab === "bills"}
            onClick={() => setActiveTab("bills")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "bills" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Bills
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "patterns"}
            onClick={() => setActiveTab("patterns")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "patterns" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Patterns
          </button>
        </div>
      </div>

      {/* Tab content — renders existing screens via composition */}
      {activeTab === "bills" && (
        <RecurringBillsScreen
          bills={bills}
          onAddBill={onAddBill}
          onUpdateBill={onUpdateBill}
          onDeleteBill={onDeleteBill}
          onClose={onClose}
        />
      )}
      {activeTab === "patterns" && (
        <RecurrenceManagementScreen
          transactions={transactions}
          bills={bills}
          onClose={onClose}
          onConfirmRecurrence={onConfirmRecurrence}
          onDismissRecurrence={onDismissRecurrence}
          onPauseRecurrence={onPauseRecurrence}
          embedded
        />
      )}
    </div>
  )
}
