"use client"

/**
 * ProgressMilestonesScreen — Unified screen merging "Milestone Gallery",
 * "Activity Heatmap", and "Progress Garden" into a single tabbed view
 * for all gamification/progress visualization.
 *
 * Composition approach: renders existing sub-screens as tab content.
 *
 * Task 489.5 — Consolidate overlapping tools
 * Requirements: 29.7
 */

import { useState } from "react"
import { MilestoneGallery } from "./MilestoneGallery"
import { ActivityHeatmap } from "./ActivityHeatmap"
import { ProgressGarden } from "./ProgressGarden"
import { FONT_FAMILY } from "@/styles/typography"
import {
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import type { Transaction, Goal } from "@/types"
import type { GardenMetrics } from "@/lib/gardenProgress"

// ============================================================================
// Types
// ============================================================================

export interface ProgressMilestonesScreenProps {
  /** All user transactions for milestone and heatmap computation */
  transactions?: Transaction[]
  /** User's goals for savings milestone progress */
  goals?: Goal[]
  /** Garden engagement metrics */
  gardenMetrics: GardenMetrics
  /** Close/back handler */
  onClose: () => void
}

type ProgressTab = "milestones" | "heatmap" | "garden"

// ============================================================================
// Styles
// ============================================================================

const screenStyle: React.CSSProperties = {
  fontFamily: FONT_FAMILY,
  minHeight: "100vh",
  background: "var(--bg)",
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
}

const tabContainerStyle: React.CSSProperties = {
  padding: "0 20px 12px",
  background: "var(--bg)",
}

// ============================================================================
// Component
// ============================================================================

export function ProgressMilestonesScreen({
  transactions,
  goals,
  gardenMetrics,
  onClose,
}: ProgressMilestonesScreenProps) {
  const [activeTab, setActiveTab] = useState<ProgressTab>("milestones")

  return (
    <div style={screenStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text)",
            fontSize: 16,
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
            padding: 0,
          }}
          aria-label="Go back"
        >
          ← Back
        </button>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            margin: 0,
          }}
        >
          Progress & Milestones
        </h2>
        <div style={{ width: 60 }} />
      </div>

      {/* Segmented tabs */}
      <div style={tabContainerStyle}>
        <div style={segmentedControl} role="tablist" aria-label="Progress view">
          <button
            role="tab"
            aria-selected={activeTab === "milestones"}
            onClick={() => setActiveTab("milestones")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "milestones" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Milestones
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "heatmap"}
            onClick={() => setActiveTab("heatmap")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "heatmap" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Heatmap
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "garden"}
            onClick={() => setActiveTab("garden")}
            style={{
              ...segmentedButtonBase,
              ...(activeTab === "garden" ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            Garden
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "milestones" && (
        <MilestoneGallery
          transactions={transactions}
          goals={goals}
        />
      )}
      {activeTab === "heatmap" && (
        <ActivityHeatmap
          transactions={transactions ?? []}
        />
      )}
      {activeTab === "garden" && (
        <div style={{ padding: "20px" }}>
          <ProgressGarden metrics={gardenMetrics} />
        </div>
      )}
    </div>
  )
}
