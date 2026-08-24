"use client"

/**
 * SettingsAutomationScreen — "Automation" sub-screen.
 *
 * Gives users full control over which predictions and suggestions Folio
 * makes automatically. All toggles default to ON.
 *
 * Requirements: 23.7
 */

import { useState, useEffect } from "react"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, semanticColors } from "@/styles/colors"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsToggle } from "@/components/ui/SettingsToggle"
import {
  getAutomationPreferences,
  setAutomationPreferences,
  resetAutomationPreferences,
  type AutomationPreferences,
} from "@/lib/automationPreferences"
import { AutomationActivityLog } from "./AutomationActivityLog"

// ============================================================================
// Types
// ============================================================================

export interface SettingsAutomationScreenProps {
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

export function SettingsAutomationScreen({ onBack }: SettingsAutomationScreenProps) {
  const [prefs, setPrefs] = useState<AutomationPreferences>(getAutomationPreferences)

  useEffect(() => {
    setPrefs(getAutomationPreferences())
  }, [])

  const updatePref = (key: keyof AutomationPreferences, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setAutomationPreferences(next)
  }

  const handleReset = () => {
    resetAutomationPreferences()
    setPrefs(getAutomationPreferences())
  }

  return (
    <SettingsSubScreen
      title="Automation"
      description="Control which predictions and suggestions Folio makes for you."
      onBack={onBack}
    >
      {/* Suggestions section */}
      <section aria-labelledby="suggestions-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="suggestions-heading">Suggestions</SectionHeading>
        <ToggleRow
          label="Suggest recurring expenses"
          description="Folio notices patterns and suggests expenses you might want to log"
          checked={prefs.autoSuggestRecurring}
          onChange={(next) => updatePref("autoSuggestRecurring", next)}
          ariaLabel="Toggle suggest recurring expenses"
        />
        <ToggleRow
          label="Include suggestions in allowance"
          description="Expected bills reduce your daily spending room automatically"
          checked={prefs.includeSuggestionsInAllowance}
          onChange={(next) => updatePref("includeSuggestionsInAllowance", next)}
          ariaLabel="Toggle include suggestions in allowance"
        />
      </section>

      {/* Visibility section */}
      <section aria-labelledby="visibility-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="visibility-heading">Home screen</SectionHeading>
        <ToggleRow
          label="Show coming up"
          description="Preview upcoming bills and expenses on your home screen"
          checked={prefs.showComingUp}
          onChange={(next) => updatePref("showComingUp", next)}
          ariaLabel="Toggle show coming up on home"
        />
      </section>

      {/* Alerts section */}
      <section aria-labelledby="alerts-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="alerts-heading">Alerts</SectionHeading>
        <ToggleRow
          label="Spending pace alerts"
          description="Get a heads-up when you're spending faster than usual"
          checked={prefs.spendingPaceAlerts}
          onChange={(next) => updatePref("spendingPaceAlerts", next)}
          ariaLabel="Toggle spending pace alerts"
        />
      </section>

      {/* Bills section */}
      <section aria-labelledby="bills-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="bills-heading">Bills</SectionHeading>
        <ToggleRow
          label="Bill pre-fill"
          description="Auto-fill bill amounts based on your history"
          checked={prefs.billPreFill}
          onChange={(next) => updatePref("billPreFill", next)}
          ariaLabel="Toggle bill pre-fill"
        />
      </section>

      {/* Activity log — transparency section */}
      <AutomationActivityLog />

      {/* Reset to defaults */}
      <button
        type="button"
        onClick={handleReset}
        aria-label="Reset all automation settings to defaults"
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
