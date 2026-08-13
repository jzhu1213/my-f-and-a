"use client"

/**
 * SettingsHomeExtrasScreen — "Home screen" sub-screen.
 *
 * Controls for the savings-rate badge, spending-pace indicator, home style
 * selection (minimal vs dashboard), and pinned card summary.
 *
 * Requirements: 20.3
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
  getSavingsRateBadgeEnabled,
  setSavingsRateBadgeEnabled,
  getInsightsEnabled,
  setInsightsEnabled,
  getHomeStyle,
  setHomeStyle,
  type HomeStyle,
} from "@/lib/uiPreferences"
import {
  getPaceIndicatorEnabled,
  setPaceIndicatorEnabled,
} from "@/lib/paceIndicatorPreferences"
import { getPinnedCards, CARD_META, type PinnedCard } from "@/lib/homeWidgets"

// ============================================================================
// Types
// ============================================================================

export interface SettingsHomeExtrasScreenProps {
  onBack: () => void
}

// ============================================================================
// Section heading
// ============================================================================

function SectionHeading({ children }: { children: string }) {
  return (
    <h2
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
// OptionCard — style selector
// ============================================================================

interface OptionCardProps {
  label: string
  description: string
  isSelected: boolean
  onSelect: () => void
}

function OptionCard({ label, description, isSelected, onSelect }: OptionCardProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
      transition={springs.snappy}
      aria-pressed={isSelected}
      aria-label={`${label}${isSelected ? " (selected)" : ""}`}
      style={{
        width: "100%",
        textAlign: "left",
        padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
        background: isSelected ? colorRamp.accent[50] : elevations.resting.fill,
        border: `1px solid ${isSelected ? colorRamp.accent[300] : elevations.resting.border}`,
        borderRadius: radius.control,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: isSelected ? spacingScale["4"] : "0",
      }}
    >
      <span style={{ ...typography.body, color: textColors.text, fontWeight: isSelected ? 500 : 400 }}>
        {label}
      </span>
      {isSelected && (
        <motion.span
          initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
          animate={{ opacity: 1, height: "auto" }}
          transition={springs.gentle}
          style={{ ...typography["body-sm"], color: textColors.sub, lineHeight: 1.4 }}
        >
          {description}
        </motion.span>
      )}
    </motion.button>
  )
}

// ============================================================================
// Home style options
// ============================================================================

const HOME_STYLE_OPTIONS: { value: HomeStyle; label: string; description: string }[] = [
  { value: "minimal", label: "Minimal", description: "Hero, quick log, and recent activity" },
  { value: "dashboard", label: "Dashboard", description: "Pinned cards plus quick log" },
]

// ============================================================================
// Component
// ============================================================================

export function SettingsHomeExtrasScreen({ onBack }: SettingsHomeExtrasScreenProps) {
  const [savingsBadge, setSavingsBadge] = useState(false)
  const [paceIndicator, setPaceIndicator] = useState(true)
  const [insightsEnabled, setInsightsEnabledLocal] = useState(false)
  const [homeStyle, setHomeStyleLocal] = useState<HomeStyle>("minimal")
  const [pinnedCards, setPinnedCards] = useState<PinnedCard[]>([])

  useEffect(() => {
    setSavingsBadge(getSavingsRateBadgeEnabled())
    setPaceIndicator(getPaceIndicatorEnabled())
    setInsightsEnabledLocal(getInsightsEnabled())
    setHomeStyleLocal(getHomeStyle())
    setPinnedCards(getPinnedCards())
  }, [])

  const handleSavingsBadge = (next: boolean) => {
    setSavingsBadge(next)
    setSavingsRateBadgeEnabled(next)
  }

  const handlePaceIndicator = (next: boolean) => {
    setPaceIndicator(next)
    setPaceIndicatorEnabled(next)
  }

  const handleInsights = (next: boolean) => {
    setInsightsEnabledLocal(next)
    setInsightsEnabled(next)
  }

  const handleHomeStyle = (style: HomeStyle) => {
    setHomeStyleLocal(style)
    setHomeStyle(style)
    // Refresh pinned cards when switching to dashboard
    if (style === "dashboard") {
      setPinnedCards(getPinnedCards())
    }
  }

  return (
    <SettingsSubScreen title="Home" description="Customize what shows up on your home screen." onBack={onBack}>
      {/* Toggles section */}
      <section aria-labelledby="home-toggles-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading>Extras</SectionHeading>
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
          label="Daily tip"
          description="Contextual tips on the home screen"
          checked={insightsEnabled}
          onChange={handleInsights}
          ariaLabel="Toggle daily tip"
        />
      </section>

      {/* Home style section */}
      <section aria-labelledby="home-style-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading>Home style</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {HOME_STYLE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              isSelected={homeStyle === option.value}
              onSelect={() => handleHomeStyle(option.value)}
            />
          ))}
        </div>
      </section>

      {/* Pinned cards summary (dashboard mode only) */}
      {homeStyle === "dashboard" && pinnedCards.length > 0 && (
        <section aria-labelledby="pinned-cards-heading">
          <SectionHeading>Pinned cards</SectionHeading>
          <div
            style={{
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              padding: spacingScale["16"],
            }}
          >
            {pinnedCards.map((card) => {
              const meta = CARD_META[card.type]
              return (
                <div
                  key={card.type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacingScale["8"],
                    padding: `${spacingScale["4"]} 0`,
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span style={{ ...typography["body-sm"], color: textColors.text }}>{meta.label}</span>
                </div>
              )
            })}
            <p style={{ ...typography["body-sm"], color: textColors.muted, margin: 0, marginTop: spacingScale["8"] }}>
              Manage pinned cards from the home screen long-press menu.
            </p>
          </div>
        </section>
      )}
    </SettingsSubScreen>
  )
}
