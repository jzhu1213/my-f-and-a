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
import { typography } from "@/styles/typography"
import { textColors, semanticColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import type { SpendingMode, OverLimitResponse } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS, OVER_LIMIT_RESPONSE_LABELS } from "@/lib/spendingModes"
import type { UserGoal } from "@/types"

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

  return (
    <SettingsSubScreen title="Spending" description="Pick how Folio tracks your spending." onBack={onBack}>
      {/* Spending mode section */}
      <section aria-labelledby="spending-mode-heading">
        <SectionHeading>Spending mode</SectionHeading>
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
        <SectionHeading>When I go over</SectionHeading>
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
          <SectionHeading>My focus</SectionHeading>
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
    </SettingsSubScreen>
  )
}
