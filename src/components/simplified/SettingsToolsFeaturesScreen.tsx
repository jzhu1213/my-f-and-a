"use client"

/**
 * SettingsToolsFeaturesScreen — "Tools & features" sub-screen.
 *
 * All 14 feature visibility toggles in a clean list, plus a navigation link
 * to categorization rules and a "Reset to defaults" button at the bottom.
 *
 * Requirements: 20.3, 20.5
 */

import { useState, useEffect } from "react"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, semanticColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsToggle } from "@/components/ui/SettingsToggle"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { FeatureFlags } from "@/lib/featureFlags"
import {
  getCreditScoreCheckinEnabled,
  setCreditScoreCheckinEnabled,
  getPeerContextEnabled,
  setPeerContextEnabled,
} from "@/lib/uiPreferences"

// ============================================================================
// Types
// ============================================================================

export interface SettingsToolsFeaturesScreenProps {
  onBack: () => void
  onOpenCategorizationRules?: () => void
}

// ============================================================================
// Feature flag definitions (label + optional description)
// ============================================================================

interface FeatureFlagDef {
  key: keyof FeatureFlags
  label: string
  description?: string
}

const FEATURE_FLAG_DEFS: FeatureFlagDef[] = [
  { key: "debtTracking", label: "Debt tracking" },
  { key: "recurringBills", label: "Recurring bills" },
  { key: "reimbursements", label: "Reimbursements" },
  { key: "sinkingFunds", label: "Sinking funds" },
  { key: "subscriptionAudit", label: "Subscription audit" },
  { key: "savingsProjections", label: "Savings projections" },
  { key: "compoundGrowthCalculator", label: "Growth calculator" },
  { key: "creditPayoffCalculator", label: "Payoff calculator" },
  { key: "lessons", label: "Lessons" },
  { key: "goals", label: "Goals" },
  { key: "financialTrajectory", label: "Trajectory", description: "Directional progress without raw net-worth figures" },
  { key: "cashFlowForecast", label: "Cash-flow forecast", description: "Projects your balance through next payday" },
  { key: "accountLinking", label: "Account linking", description: "Bank/card linking via Plaid" },
  { key: "householdPool", label: "Household pool", description: "Shared expenses for roommates or family" },
]

// ============================================================================
// Section heading
// ============================================================================

function SectionHeading({ children, id }: { children: string; id?: string }) {
  return (
    <h2
      id={id}
      style={{
        ...typography["body-sm"],
        color: textColors.muted,
        margin: 0,
        marginBottom: spacingScale["12"],
        fontWeight: fontWeights.medium,
      }}
    >
      {children}
    </h2>
  )
}

// ============================================================================
// Toggle row
// ============================================================================

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
}

function ToggleRow({ label, description, checked, onChange, ariaLabel }: ToggleRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${spacingScale["12"]} 0`,
      }}
    >
      <div style={{ flex: 1, marginInlineEnd: spacingScale["12"] }}>
        <span style={{ ...typography.body, color: textColors.text }}>{label}</span>
        {description && (
          <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: spacingScale["4"] }}>
            {description}
          </p>
        )}
      </div>
      <SettingsToggle checked={checked} onChange={onChange} ariaLabel={ariaLabel} />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function SettingsToolsFeaturesScreen({
  onBack,
  onOpenCategorizationRules,
}: SettingsToolsFeaturesScreenProps) {
  const { flags, setFlag, resetFlags } = useFeatureFlags()
  const [creditScoreEnabled, setCreditScoreEnabledLocal] = useState(true)
  const [peerContextEnabled, setPeerContextEnabledLocal] = useState(false)

  useEffect(() => {
    setCreditScoreEnabledLocal(getCreditScoreCheckinEnabled())
    setPeerContextEnabledLocal(getPeerContextEnabled())
  }, [])

  const handleCreditScore = (next: boolean) => {
    setCreditScoreEnabledLocal(next)
    setCreditScoreCheckinEnabled(next)
  }

  const handlePeerContext = (next: boolean) => {
    setPeerContextEnabledLocal(next)
    setPeerContextEnabled(next)
  }

  return (
    <SettingsSubScreen title="Features" description="Turn tools on or off to keep things simple." onBack={onBack}>
      {/* Feature visibility toggles */}
      <section aria-labelledby="feature-toggles-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="feature-toggles-heading">Feature visibility</SectionHeading>
        {FEATURE_FLAG_DEFS.map((def) => (
          <ToggleRow
            key={def.key}
            label={def.label}
            description={def.description}
            checked={flags[def.key]}
            onChange={(next) => setFlag(def.key, next)}
            ariaLabel={`Toggle ${def.label}`}
          />
        ))}
      </section>

      {/* Preferences section */}
      <section aria-labelledby="preferences-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="preferences-heading">Preferences</SectionHeading>
        <ToggleRow
          label="Credit score"
          description="Track your credit score over time"
          checked={creditScoreEnabled}
          onChange={handleCreditScore}
          ariaLabel="Toggle credit score"
        />
        <ToggleRow
          label="Peer context"
          description="Compare spending to students like you"
          checked={peerContextEnabled}
          onChange={handlePeerContext}
          ariaLabel="Toggle peer context"
        />
      </section>

      {/* Categorization rules link */}
      {onOpenCategorizationRules && (
        <section style={{ marginBottom: spacingScale["32"] }}>
          <SectionHeading>Rules</SectionHeading>
          <button
            type="button"
            onClick={onOpenCategorizationRules}
            aria-label="Open categorization rules"
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: `${spacingScale["16"]}`,
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              cursor: "pointer",
              textAlign: "start",
            }}
          >
            <span style={{ ...typography.body, color: textColors.text }}>
              Categorization rules
            </span>
            <span
              aria-hidden="true"
              style={{ ...typography.body, color: textColors.muted, flexShrink: 0 }}
            >
              ›
            </span>
          </button>
        </section>
      )}

      {/* Reset to defaults */}
      <button
        type="button"
        onClick={resetFlags}
        aria-label="Reset all feature flags to defaults"
        style={{
          background: "none",
          border: "none",
          ...typography["body-sm"],
          color: semanticColors.error,
          cursor: "pointer",
          padding: `${spacingScale["12"]} 0`,
        }}
      >
        Reset to defaults
      </button>
    </SettingsSubScreen>
  )
}
