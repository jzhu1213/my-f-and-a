"use client"

/**
 * SettingsHomeExtrasScreen — "Home screen" sub-screen.
 *
 * Controls for the savings-rate badge, spending-pace indicator, upcoming
 * expenses, and daily tip toggles.
 *
 * Requirements: 20.3
 */

import { useState, useEffect } from "react"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors } from "@/styles/colors"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsToggle } from "@/components/ui/SettingsToggle"
import {
  getSavingsRateBadgeEnabled,
  setSavingsRateBadgeEnabled,
  getInsightsEnabled,
  setInsightsEnabled,
} from "@/lib/uiPreferences"
import {
  getPaceIndicatorEnabled,
  setPaceIndicatorEnabled,
} from "@/lib/paceIndicatorPreferences"
import {
  getComingUpEnabled,
  setComingUpEnabled,
} from "@/lib/comingUpPreferences"

// ============================================================================
// Types
// ============================================================================

export interface SettingsHomeExtrasScreenProps {
  onBack: () => void
}

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
      <div style={{ flex: 1, marginRight: spacingScale["12"] }}>
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

export function SettingsHomeExtrasScreen({ onBack }: SettingsHomeExtrasScreenProps) {
  const [savingsBadge, setSavingsBadge] = useState(false)
  const [paceIndicator, setPaceIndicator] = useState(true)
  const [comingUpEnabled, setComingUpEnabledLocal] = useState(true)
  const [insightsEnabled, setInsightsEnabledLocal] = useState(false)

  useEffect(() => {
    setSavingsBadge(getSavingsRateBadgeEnabled())
    setPaceIndicator(getPaceIndicatorEnabled())
    setComingUpEnabledLocal(getComingUpEnabled())
    setInsightsEnabledLocal(getInsightsEnabled())
  }, [])

  const handleSavingsBadge = (next: boolean) => {
    setSavingsBadge(next)
    setSavingsRateBadgeEnabled(next)
  }

  const handlePaceIndicator = (next: boolean) => {
    setPaceIndicator(next)
    setPaceIndicatorEnabled(next)
  }

  const handleComingUp = (next: boolean) => {
    setComingUpEnabledLocal(next)
    setComingUpEnabled(next)
  }

  const handleInsights = (next: boolean) => {
    setInsightsEnabledLocal(next)
    setInsightsEnabled(next)
  }

  return (
    <SettingsSubScreen title="Home" description="Customize what shows up on your home screen." onBack={onBack}>
      {/* Toggles section */}
      <section aria-labelledby="home-toggles-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="home-toggles-heading">Extras</SectionHeading>
        <ToggleRow
          label="Savings badge"
          description="Monthly savings rate below the hero"
          checked={savingsBadge}
          onChange={handleSavingsBadge}
          ariaLabel="Toggle savings badge"
        />
        <ToggleRow
          label="Spending pace"
          description="Sparkline showing your spending velocity"
          checked={paceIndicator}
          onChange={handlePaceIndicator}
          ariaLabel="Toggle spending pace"
        />
        <ToggleRow
          label="Show upcoming expenses"
          description="Surface predicted expenses in the next 7 days on your home screen"
          checked={comingUpEnabled}
          onChange={handleComingUp}
          ariaLabel="Toggle upcoming expenses"
        />
        <ToggleRow
          label="Daily tip"
          description="Contextual tips on the home screen"
          checked={insightsEnabled}
          onChange={handleInsights}
          ariaLabel="Toggle daily tip"
        />
      </section>

    </SettingsSubScreen>
  )
}
