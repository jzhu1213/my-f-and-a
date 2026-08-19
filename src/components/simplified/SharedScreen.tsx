"use client"

/**
 * SharedScreen — Unified screen merging "Shared Pools" (SharingScreen / household),
 * "Invite a Roommate" (RoommateInviteScreen), and "Shared Budgets" (SharedBudgetsScreen)
 * into a single tabbed view for all social/shared money features.
 *
 * Composition approach: renders existing sub-screens as tab content.
 *
 * Task 489.4 — Consolidate overlapping tools
 * Requirements: 29.7
 */

import { useState } from "react"
import { RoommateInviteScreen } from "./RoommateInviteScreen"
import { SharedBudgetsScreen } from "./SharedBudgetsScreen"
import { FONT_FAMILY } from "@/styles/typography"
import {
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import type { Goal } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface SharedScreenProps {
  /** Close/back handler */
  onClose: () => void
  /** Open the household pool view (existing SharingScreen with pool functionality) */
  onOpenHouseholdPool?: () => void
  /** The current user's display name, used to warm up the invite copy */
  inviterName?: string
  /** The user's goals — shared goals become invite targets */
  goals?: Goal[]
}

type SharedTab = "pools" | "budgets" | "invite"

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

export function SharedScreen({
  onClose,
  onOpenHouseholdPool,
  inviterName,
  goals,
}: SharedScreenProps) {
  const [activeTab, setActiveTab] = useState<SharedTab>("pools")

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Segmented tabs */}
      <div style={tabContainerStyle}>
        <div style={segmentedControl} role="tablist" aria-label="Shared view">
          <button
            role="tab"
            aria-selected={activeTab === "pools"}
            onClick={() => setActiveTab("pools")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "pools" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Pools
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "budgets"}
            onClick={() => setActiveTab("budgets")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "budgets" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Budgets
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "invite"}
            onClick={() => setActiveTab("invite")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "invite" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Invite
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "pools" && (
        <PoolsTabContent onOpenHouseholdPool={onOpenHouseholdPool} onClose={onClose} />
      )}
      {activeTab === "budgets" && (
        <SharedBudgetsScreen onBack={onClose} />
      )}
      {activeTab === "invite" && (
        <RoommateInviteScreen
          onClose={onClose}
          inviterName={inviterName}
          goals={goals}
        />
      )}
    </div>
  )
}

// ============================================================================
// Pools tab — triggers the existing household pool overlay or shows a prompt
// ============================================================================

function PoolsTabContent({
  onOpenHouseholdPool,
  onClose,
}: {
  onOpenHouseholdPool?: () => void
  onClose: () => void
}) {
  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div
        style={{
          textAlign: "center",
          padding: "32px 20px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <p style={{ fontSize: 32, marginBottom: 12 }}>🏠</p>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            margin: "0 0 8px",
          }}
        >
          Shared Pools
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "var(--sub)",
            fontFamily: FONT_FAMILY,
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          Split shared expenses with roommates using household pools.
        </p>
        {onOpenHouseholdPool && (
          <button
            onClick={onOpenHouseholdPool}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: FONT_FAMILY,
              color: "var(--text)",
              background: "var(--accent)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Open Shared Pools
          </button>
        )}
      </div>
    </div>
  )
}
