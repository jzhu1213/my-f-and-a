"use client"

/**
 * SettingsSpendingStyleScreen — Spending style sub-screen.
 *
 * Combines the spending mode selector, over-limit response selector,
 * and "My focus" goal picker into a single focused sub-screen.
 * Each option shows its 1-line description only when selected,
 * cutting vertical space roughly in half.
 *
 * Requirements: 20.3, 20.4
 */

import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, semanticColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import type { SpendingMode, OverLimitResponse } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS, OVER_LIMIT_RESPONSE_LABELS } from "@/lib/spendingModes"
import type { UserGoal } from "@/types"
import { isTravelModeActive, getTravelModeConfig, clearTravelMode } from "@/lib/travelMode"
import type { TravelModeConfig } from "@/lib/travelMode"
import { useState, useEffect } from "react"

// ============================================================================
// Types
// ============================================================================

export interface SettingsSpendingStyleScreenProps {
  onBack: () => void
  spendingMode: SpendingMode
  onSetSpendingMode: (mode: SpendingMode) => void
  overLimitResponse: OverLimitResponse
  onSetOverLimitResponse: (response: OverLimitResponse) => void
  userGoal?: UserGoal
  onGoalChange?: (goal: UserGoal) => void
  /** Open the travel mode activation sheet (task 424.2) */
  onOpenTravelMode?: () => void
}

// ============================================================================
// Goal labels & descriptions
// ============================================================================

const GOAL_LABELS: Record<UserGoal, { label: string; description: string }> = {
  save: {
    label: "Save more",
    description: "Build savings or an emergency fund",
  },
  track_spending: {
    label: "Awareness",
    description: "See where the money goes",
  },
  reduce_spending: {
    label: "Spend less",
    description: "Cut back in specific areas",
  },
  avoid_overdraft: {
    label: "Stay safe",
    description: "Never go below zero",
  },
  pay_debt: {
    label: "Pay debt",
    description: "Chip away at what you owe",
  },
  learn_investing: {
    label: "Invest",
    description: "Put money to work for the future",
  },
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
// OptionCard — selectable chip showing description only when active
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
        textAlign: "start",
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

export function SettingsSpendingStyleScreen({
  onBack,
  spendingMode,
  onSetSpendingMode,
  overLimitResponse,
  onSetOverLimitResponse,
  userGoal,
  onGoalChange,
  onOpenTravelMode,
}: SettingsSpendingStyleScreenProps) {
  const spendingModes: SpendingMode[] = ["tracker", "guided", "structured"]
  const overLimitOptions: OverLimitResponse[] = ["quiet", "gentle", "headsup"]
  const goalOptions: UserGoal[] = [
    "save",
    "track_spending",
    "reduce_spending",
    "avoid_overdraft",
    "pay_debt",
    "learn_investing",
  ]

  // Travel mode state (task 424.2)
  const [travelActive, setTravelActive] = useState(false)
  const [travelConfig, setTravelConfig] = useState<TravelModeConfig | null>(null)
  useEffect(() => {
    setTravelActive(isTravelModeActive())
    setTravelConfig(getTravelModeConfig())
  }, [])

  return (
    <SettingsSubScreen title="Spending" description="Pick how Folio tracks your spending." onBack={onBack}>
      {/* Spending mode section */}
      <section aria-labelledby="spending-mode-heading">
        <SectionHeading id="spending-mode-heading">Spending mode</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {spendingModes.map((mode) => (
            <OptionCard
              key={mode}
              label={SPENDING_MODE_LABELS[mode].label}
              description={SPENDING_MODE_LABELS[mode].description}
              isSelected={spendingMode === mode}
              onSelect={() => onSetSpendingMode(mode)}
            />
          ))}
        </div>
      </section>

      {/* Over-limit response section */}
      <section
        aria-labelledby="over-limit-heading"
        style={{ marginTop: spacingScale["32"] }}
      >
        <SectionHeading id="over-limit-heading">When I go over</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {overLimitOptions.map((option) => (
            <OptionCard
              key={option}
              label={OVER_LIMIT_RESPONSE_LABELS[option].label}
              description={OVER_LIMIT_RESPONSE_LABELS[option].description}
              isSelected={overLimitResponse === option}
              onSelect={() => onSetOverLimitResponse(option)}
            />
          ))}
        </div>
      </section>

      {/* My focus section */}
      {onGoalChange && (
        <section
          aria-labelledby="focus-heading"
          style={{ marginTop: spacingScale["32"] }}
        >
          <SectionHeading id="focus-heading">My focus</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
            {goalOptions.map((goal) => (
              <OptionCard
                key={goal}
                label={GOAL_LABELS[goal].label}
                description={GOAL_LABELS[goal].description}
                isSelected={userGoal === goal}
                onSelect={() => onGoalChange(goal)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Travel mode section (Task 424.2) */}
      <section
        aria-labelledby="travel-mode-heading"
        style={{ marginTop: spacingScale["32"] }}
      >
        <SectionHeading id="travel-mode-heading">Travel mode</SectionHeading>
        {travelActive && travelConfig ? (
          <div
            style={{
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              background: colorRamp.accent[50],
              border: `1px solid ${colorRamp.accent[200]}`,
              borderRadius: radius.control,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ ...typography.body, color: textColors.text, margin: 0 }}>
                ✈️ {travelConfig.destinationLabel || travelConfig.currency}
              </p>
              {travelConfig.dailyBudgetOverride && (
                <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: 2 }}>
                  ${travelConfig.dailyBudgetOverride}/day
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                clearTravelMode()
                setTravelActive(false)
                setTravelConfig(null)
              }}
              style={{
                padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                background: colorRamp.error[500],
                color: "var(--text)",
                border: "none",
                borderRadius: radius.control,
                cursor: "pointer",
                ...typography["body-sm"],
                fontWeight: fontWeights.medium,
              }}
            >
              End trip
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenTravelMode}
            style={{
              width: "100%",
              textAlign: "start",
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              cursor: "pointer",
              ...typography.body,
              color: textColors.text,
            }}
          >
            ✈️ Going somewhere? Set a travel currency.
          </button>
        )}
      </section>
    </SettingsSubScreen>
  )
}
