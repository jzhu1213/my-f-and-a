"use client"

/**
 * SettingsLookFeelScreen — Look & feel sub-screen.
 *
 * Contains the theme selector (segmented control: Warm / Dark / System)
 * and the existing RegionSettings component for currency/locale.
 * Kept small and focused — nothing else lives here.
 *
 * Requirements: 20.3
 */

import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { useTheme } from "@/contexts/ThemeContext"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { RegionSettings } from "./RegionSettings"

// ============================================================================
// Types
// ============================================================================

export interface SettingsLookFeelScreenProps {
  onBack: () => void
}

// ============================================================================
// Theme option type
// ============================================================================

type ThemeOption = 'warm' | 'dark' | 'system'

interface ThemeChoice {
  value: ThemeOption
  label: string
}

const THEME_OPTIONS: ThemeChoice[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

// ============================================================================
// SegmentedControl — 3-button row for theme selection
// ============================================================================

interface SegmentedControlProps {
  options: ThemeChoice[]
  value: ThemeOption
  onChange: (value: ThemeOption) => void
}

function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'flex',
        gap: 0,
        background: elevations.sunken.fill,
        border: `1px solid ${elevations.resting.border}`,
        borderRadius: radius.control,
        padding: 3,
      }}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              padding: `${spacingScale['8']} ${spacingScale['12']}`,
              border: 'none',
              borderRadius: radius.control,
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
              background: isSelected ? colorRamp.accent[100] : 'transparent',
              boxShadow: isSelected ? `inset 0 0 0 1px ${colorRamp.accent[300]}` : 'none',
              ...typography.body,
              fontWeight: isSelected ? 500 : 400,
              color: isSelected ? textColors.text : textColors.sub,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function SettingsLookFeelScreen({ onBack }: SettingsLookFeelScreenProps) {
  const { theme, setTheme } = useTheme()

  return (
    <SettingsSubScreen title="Appearance" description="Choose how Folio looks." onBack={onBack}>
      {/* Theme section */}
      <section aria-labelledby="theme-heading">
        <h2
          id="theme-heading"
          style={{
            ...typography['body-sm'],
            color: textColors.muted,
            margin: 0,
            marginBottom: spacingScale['12'],
            fontWeight: fontWeights.medium,
          }}
        >
          Theme
        </h2>

        <SegmentedControl
          options={THEME_OPTIONS}
          value={theme}
          onChange={setTheme}
        />
      </section>

      {/* Region / currency section */}
      <section
        aria-label="Region and currency"
        style={{ marginTop: spacingScale['32'] }}
      >
        <RegionSettings />
      </section>
    </SettingsSubScreen>
  )
}
