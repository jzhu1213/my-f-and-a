"use client"

/**
 * SavingsScreen — Unified screen merging "Savings Projections", "Manage Savings",
 * and "Portfolio Allocation" into a single tabbed view with three sub-sections:
 * Overview (projections), Accounts (manage), Allocation (pie chart).
 *
 * Composition approach: renders existing sub-screens as tab content.
 *
 * Task 489.3 — Consolidate overlapping tools
 * Requirements: 29.7
 */

import { useState } from "react"
import { SavingsProjectionsScreen } from "./SavingsProjectionsScreen"
import { ManageSavingsAccountsScreen } from "./ManageSavingsAccountsScreen"
import { PortfolioAllocationScreen } from "./PortfolioAllocationScreen"
import { FONT_FAMILY } from "@/styles/typography"
import {
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import type { SavingsAccount, SavingsAccountType } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface SavingsScreenProps {
  savingsAccounts: SavingsAccount[]
  totalBalance: number
  onCreateAccount: (data: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }) => Promise<SavingsAccount | null>
  onUpdateAccount: (
    id: string,
    data: {
      type?: SavingsAccountType
      name?: string
      balance?: number
      monthlyContribution?: number
      expectedAnnualReturn?: number
    }
  ) => Promise<SavingsAccount | null>
  onDeleteAccount: (id: string) => Promise<boolean>
  onBack: () => void
}

type SavingsTab = "overview" | "accounts" | "allocation"

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

export function SavingsScreen({
  savingsAccounts,
  totalBalance,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onBack,
}: SavingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SavingsTab>("overview")

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Segmented tabs */}
      <div style={tabContainerStyle}>
        <div style={segmentedControl} role="tablist" aria-label="Savings view">
          <button
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "overview" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Overview
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "accounts"}
            onClick={() => setActiveTab("accounts")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "accounts" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Accounts
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "allocation"}
            onClick={() => setActiveTab("allocation")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "allocation" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Allocation
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <SavingsProjectionsScreen
          savingsAccounts={savingsAccounts}
          totalBalance={totalBalance}
          onCreateAccount={onCreateAccount}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onBack={onBack}
        />
      )}
      {activeTab === "accounts" && (
        <ManageSavingsAccountsScreen
          savingsAccounts={savingsAccounts}
          onCreateAccount={onCreateAccount}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onBack={onBack}
        />
      )}
      {activeTab === "allocation" && (
        <PortfolioAllocationScreen
          savingsAccounts={savingsAccounts}
          onBack={onBack}
        />
      )}
    </div>
  )
}
