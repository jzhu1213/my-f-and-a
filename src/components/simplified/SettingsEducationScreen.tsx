"use client"

/**
 * SettingsEducationScreen — "Financial Tips & Learning" sub-screen.
 *
 * Controls learning mode (on/subtle/off), lesson frequency (normal/less),
 * and per-topic opt-out so users can skip subjects they already know.
 *
 * Requirements: 26.6
 */

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import {
  getEducationPreferences,
  setEducationPreferences,
} from "@/lib/educationPreferences"
import type { EducationPreferences, LearningMode, LessonFrequency } from "@/lib/educationPreferences"
import { LESSON_TOPICS } from "@/types"
import type { LessonTopic } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface SettingsEducationScreenProps {
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
// Option card (reusable selector)
// ============================================================================

interface OptionCardProps {
  label: string
  description: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  ariaLabel: string
}

function OptionCard({ label, description, isSelected, onSelect, disabled, ariaLabel }: OptionCardProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={!prefersReducedMotion && !disabled ? { scale: 0.97 } : undefined}
      transition={springs.snappy}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
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
// Topic checkbox row
// ============================================================================

interface TopicCheckboxProps {
  emoji: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function TopicCheckbox({ emoji, label, checked, onChange, disabled }: TopicCheckboxProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingScale["12"],
        padding: `${spacingScale["12"]} 0`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={`Opt out of ${label} lessons`}
        style={{
          width: 20,
          height: 20,
          accentColor: colorRamp.accent[400],
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
        }}
      />
      <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>{emoji}</span>
      <span style={{ ...typography.body, color: textColors.text }}>{label}</span>
    </label>
  )
}

// ============================================================================
// Learning mode options
// ============================================================================

const LEARNING_MODE_OPTIONS: { value: LearningMode; label: string; description: string }[] = [
  {
    value: "on",
    label: "On",
    description: "Full lessons with micro-tips and deep dives when relevant",
  },
  {
    value: "subtle",
    label: "Subtle",
    description: "Micro-lessons only — quick tips without deep dives",
  },
  {
    value: "off",
    label: "Off",
    description: "No financial tips or educational content",
  },
]

// ============================================================================
// Frequency options
// ============================================================================

const FREQUENCY_OPTIONS: { value: LessonFrequency; label: string; description: string }[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Up to 1 per session, max 3 per week",
  },
  {
    value: "less",
    label: "Less",
    description: "At most 1 per week",
  },
]

// ============================================================================
// Component
// ============================================================================

export function SettingsEducationScreen({ onBack }: SettingsEducationScreenProps) {
  const [prefs, setPrefs] = useState<EducationPreferences>(getEducationPreferences)

  // Sync from localStorage on mount
  useEffect(() => {
    setPrefs(getEducationPreferences())
  }, [])

  // Persist helper
  const updatePrefs = (patch: Partial<EducationPreferences>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setEducationPreferences(next)
  }

  // Toggle a topic in/out of the opted-out list
  const toggleTopicOptOut = (topic: LessonTopic, optOut: boolean) => {
    const current = prefs.optedOutTopics
    const next = optOut
      ? [...current.filter(t => t !== topic), topic]
      : current.filter(t => t !== topic)
    updatePrefs({ optedOutTopics: next })
  }

  const isOff = prefs.learningMode === "off"

  return (
    <SettingsSubScreen
      title="Financial Tips & Learning"
      description="Control when and how educational tips appear. Learn at your own pace — or turn them off entirely."
      onBack={onBack}
    >
      {/* Learning mode selector */}
      <section aria-labelledby="learning-mode-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="learning-mode-heading">Learning mode</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {LEARNING_MODE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              isSelected={prefs.learningMode === option.value}
              onSelect={() => updatePrefs({ learningMode: option.value })}
              ariaLabel={`Learning mode: ${option.label}${prefs.learningMode === option.value ? " (selected)" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* Frequency selector */}
      <section aria-labelledby="frequency-heading" style={{ marginBottom: spacingScale["32"] }}>
        <SectionHeading id="frequency-heading">Frequency</SectionHeading>
        <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginBottom: spacingScale["12"] }}>
          How often tips and lessons appear.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {FREQUENCY_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              isSelected={prefs.frequency === option.value}
              onSelect={() => updatePrefs({ frequency: option.value })}
              disabled={isOff}
              ariaLabel={`Frequency: ${option.label}${prefs.frequency === option.value ? " (selected)" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* Topic opt-out */}
      <section aria-labelledby="topic-optout-heading">
        <SectionHeading id="topic-optout-heading">Topics you already know</SectionHeading>
        <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginBottom: spacingScale["12"] }}>
          Check topics you&rsquo;re comfortable with — we won&rsquo;t show lessons about them.
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {LESSON_TOPICS.map(({ topic, emoji, label }) => (
            <TopicCheckbox
              key={topic}
              emoji={emoji}
              label={label}
              checked={prefs.optedOutTopics.includes(topic)}
              onChange={(checked) => toggleTopicOptOut(topic, checked)}
              disabled={isOff}
            />
          ))}
        </div>
      </section>
    </SettingsSubScreen>
  )
}
