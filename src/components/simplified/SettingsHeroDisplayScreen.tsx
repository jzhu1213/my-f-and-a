"use client"

/**
 * SettingsHeroDisplayScreen — "What the number shows" sub-screen.
 *
 * Lets the user pick which meaning the hero number displays.
 * Shows a 1-line description only for the currently selected option,
 * following the same OptionCard pattern as SettingsSpendingStyleScreen.
 *
 * Requirements: 20.3, 20.4
 */

import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import type { HeroMeaning } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface SettingsHeroDisplayScreenProps {
  onBack: () => void
  heroMeaning: HeroMeaning
  onSetHeroMeaning: (meaning: HeroMeaning) => void
}

// ============================================================================
// Hero meaning options
// ============================================================================

const HERO_OPTIONS: { value: HeroMeaning; label: string; description: string }[] = [
  {
    value: "allowance",
    label: "Today's budget",
    description: "How much you can spend today",
  },
  {
    value: "spent_today",
    label: "Spent today",
    description: "Total spending so far today",
  },
  {
    value: "spent_week",
    label: "This week",
    description: "Rolling 7-day spend total",
  },
  {
    value: "balance",
    label: "Balance",
    description: "Income minus expenses right now",
  },
]

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

export function SettingsHeroDisplayScreen({
  onBack,
  heroMeaning,
  onSetHeroMeaning,
}: SettingsHeroDisplayScreenProps) {
  return (
    <SettingsSubScreen title="Hero number" description="Choose what the big number on your home screen means." onBack={onBack}>
      <section aria-labelledby="hero-meaning-heading">
        <SectionHeading>Hero display</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {HERO_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              isSelected={heroMeaning === option.value}
              onSelect={() => onSetHeroMeaning(option.value)}
            />
          ))}
        </div>
      </section>
    </SettingsSubScreen>
  )
}
