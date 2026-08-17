"use client"

/**
 * SettingsMotivationScreen — "Motivation & Progress" sub-screen.
 *
 * Master toggle + per-feature controls for gamification elements:
 * streaks, challenges, milestones, progress garden, and celebration intensity.
 *
 * Requirements: 25.5
 */

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsToggle } from "@/components/ui/SettingsToggle"
import {
  getGamificationPreferences,
  setGamificationPreferences,
} from "@/lib/gamificationPreferences"
import type { GamificationPreferences, CelebrationIntensity } from "@/lib/gamificationPreferences"

// ============================================================================
// Types
// ============================================================================

export interface SettingsMotivationScreenProps {
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
        fontWeight: 500,
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
  disabled?: boolean
}

function ToggleRow({ label, description, checked, onChange, ariaLabel, disabled }: ToggleRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${spacingScale["12"]} 0`,
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.2s ease",
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
      <SettingsToggle checked={checked} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} />
    </div>
  )
}

// ============================================================================
// Celebration intensity option card
// ============================================================================

const CELEBRATION_OPTIONS: { value: CelebrationIntensity; label: string; description: string }[] = [
  {
    value: "full",
    label: "Full",
    description: "Confetti, overlay, and message",
  },
  {
    value: "subtle",
    label: "Subtle",
    description: "Brief message only",
  },
  {
    value: "off",
    label: "Off",
    description: "No celebrations",
  },
]

interface OptionCardProps {
  label: string
  description: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
}

function OptionCard({ label, description, isSelected, onSelect, disabled }: OptionCardProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={!prefersReducedMotion && !disabled ? { scale: 0.97 } : undefined}
      transition={springs.snappy}
      aria-pressed={isSelected}
      aria-label={`Celebration style: ${label}${isSelected ? " (selected)" : ""}`}
      style={{
        width: "100%",
        textAlign: "left",
        padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
        background: isSelected ? colorRamp.accent[50] : elevations.resting.fill,
        border: `1px solid ${isSelected ? colorRamp.accent[300] : elevations.resting.border}`,
        borderRadius: radius.control,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: isSelected ? spacingScale["4"] : "0",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <span
        style={{
          ...typography.body,
          color: textColors.text,
          fontWeight: isSelected ? 500 : 400,
        }}
      >
        {label}
      </span>
      {isSelected && (
        <motion.span
          initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
          animate={{ opacity: 1, height: "auto" }}
          transition={springs.gentle}
          style={{
            ...typography["body-sm"],
            color: textColors.sub,
            lineHeight: 1.4,
          }}
        >
          {description}
        </motion.span>
      )}
    </motion.button>
  )
}

// ============================================================================
// Component
// ============================================================================

export function SettingsMotivationScreen({ onBack }: SettingsMotivationScreenProps) {
  const [prefs, setPrefs] = useState<GamificationPreferences>(getGamificationPreferences)

  // Sync from localStorage on mount
  useEffect(() => {
    setPrefs(getGamificationPreferences())
  }, [])

  // Persist helper
  const updatePrefs = (patch: Partial<GamificationPreferences>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setGamificationPreferences(next)
  }

  const masterOff = !prefs.gamificationEnabled

  return (
    <SettingsSubScreen
      title="Motivation & Progress"
      description="Control streaks, challenges, milestones, and celebration style."
      onBack={onBack}
    >
      {/* Master toggle */}
      <section aria-labelledby="gamification-master-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="gamification-master-heading">Gamification</SectionHeading>
        <ToggleRow
          label="Gamification"
          description="Turn off to hide all motivation features"
          checked={prefs.gamificationEnabled}
          onChange={(next) => updatePrefs({ gamificationEnabled: next })}
          ariaLabel="Toggle all gamification features"
        />
      </section>

      {/* Individual feature toggles */}
      <section aria-labelledby="features-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="features-heading">Features</SectionHeading>
        <ToggleRow
          label="Streak counter"
          description="Show streak badge on the home screen"
          checked={prefs.streakCounterEnabled}
          onChange={(next) => updatePrefs({ streakCounterEnabled: next })}
          ariaLabel="Toggle streak counter on home"
          disabled={masterOff}
        />
        <ToggleRow
          label="Challenges"
          description="Short, self-set spending challenges"
          checked={prefs.challengesEnabled}
          onChange={(next) => updatePrefs({ challengesEnabled: next })}
          ariaLabel="Toggle challenges"
          disabled={masterOff}
        />
        <ToggleRow
          label="Milestone celebrations"
          description="Celebrate when you hit cumulative milestones"
          checked={prefs.milestoneCelebrationsEnabled}
          onChange={(next) => updatePrefs({ milestoneCelebrationsEnabled: next })}
          ariaLabel="Toggle milestone celebrations"
          disabled={masterOff}
        />
        <ToggleRow
          label="Progress garden"
          description="Visual progress garden on the home screen"
          checked={prefs.progressGardenEnabled}
          onChange={(next) => updatePrefs({ progressGardenEnabled: next })}
          ariaLabel="Toggle progress garden"
          disabled={masterOff}
        />
      </section>

      {/* Celebration intensity selector */}
      <section aria-labelledby="celebration-style-heading">
        <SectionHeading id="celebration-style-heading">Celebration style</SectionHeading>
        <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginBottom: spacingScale["12"] }}>
          Separate from reduced-motion — controls how celebrations appear.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {CELEBRATION_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              isSelected={prefs.celebrationIntensity === option.value}
              onSelect={() => updatePrefs({ celebrationIntensity: option.value })}
              disabled={masterOff}
            />
          ))}
        </div>
      </section>
    </SettingsSubScreen>
  )
}
