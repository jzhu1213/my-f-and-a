"use client"

/**
 * SettingsTermScheduleScreen — Term schedule sub-flow.
 *
 * Shows the current term schedule (if set), preset buttons for quick setup,
 * date entry, and a "Clear term" button.
 *
 * Requirements: Phase 12 — Task 373.2
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, semanticColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import type { TermSchedule } from "@/lib/termSchedule"
import { TERM_PRESETS, getTermProgress, getDaysInTerm, getDaysRemainingInTerm, isTermActive } from "@/lib/termSchedule"

// ============================================================================
// Types
// ============================================================================

export interface SettingsTermScheduleScreenProps {
  onBack: () => void
  termSchedule: TermSchedule | null
  onSetTermSchedule: (schedule: TermSchedule | null) => void
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
// Component
// ============================================================================

export function SettingsTermScheduleScreen({
  onBack,
  termSchedule,
  onSetTermSchedule,
}: SettingsTermScheduleScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null)
  const [startDate, setStartDate] = useState("")

  const now = new Date()
  const active = termSchedule ? isTermActive(termSchedule, now) : false
  const progress = termSchedule ? getTermProgress(termSchedule, now) : 0
  const daysRemaining = termSchedule ? getDaysRemainingInTerm(termSchedule, now) : 0
  const totalDays = termSchedule ? getDaysInTerm(termSchedule) : 0

  const handlePresetSelect = (index: number) => {
    setSelectedPresetIndex(index)
  }

  const handleApply = () => {
    if (selectedPresetIndex === null || !startDate) return

    const preset = TERM_PRESETS[selectedPresetIndex]
    const start = new Date(startDate + "T00:00:00")
    const end = new Date(start)
    end.setDate(end.getDate() + preset.durationWeeks * 7)

    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

    onSetTermSchedule({
      startDate,
      endDate: endStr,
      label: preset.label,
    })

    // Reset form
    setSelectedPresetIndex(null)
    setStartDate("")
  }

  return (
    <SettingsSubScreen title="Term schedule" onBack={onBack}>
      {/* Current term display */}
      {termSchedule && (
        <section aria-labelledby="current-term-heading" style={{ marginBottom: spacingScale["32"] }}>
          <SectionHeading>Current term</SectionHeading>
          <div
            style={{
              padding: spacingScale["16"],
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
            }}
          >
            {termSchedule.label && (
              <p style={{ ...typography.body, color: textColors.text, margin: 0, marginBottom: spacingScale["8"], fontWeight: 500 }}>
                {termSchedule.label}
              </p>
            )}
            <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginBottom: spacingScale["12"] }}>
              {termSchedule.startDate} → {termSchedule.endDate}
            </p>

            {/* Progress bar */}
            <div
              style={{
                width: "100%",
                height: 6,
                background: elevations.sunken.fill,
                borderRadius: 3,
                overflow: "hidden",
                marginBottom: spacingScale["8"],
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: "100%",
                  background: colorRamp.accent[400],
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <p style={{ ...typography.caption, color: textColors.muted, margin: 0 }}>
              {active
                ? `${daysRemaining} days remaining of ${totalDays}`
                : progress >= 1
                  ? "Term completed"
                  : `Starts ${termSchedule.startDate}`
              }
            </p>
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={() => onSetTermSchedule(null)}
            style={{
              marginTop: spacingScale["12"],
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              ...typography["body-sm"],
              color: semanticColors.error,
            }}
          >
            Clear term
          </button>
        </section>
      )}

      {/* Preset buttons */}
      <section aria-labelledby="presets-heading">
        <SectionHeading>Quick setup</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacingScale["8"] }}>
          {TERM_PRESETS.map((preset, index) => {
            const isSelected = selectedPresetIndex === index
            return (
              <motion.button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSelect(index)}
                whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.snappy}
                aria-pressed={isSelected}
                style={{
                  padding: `${spacingScale["12"]} ${spacingScale["12"]}`,
                  background: isSelected ? colorRamp.accent[50] : elevations.resting.fill,
                  border: `1px solid ${isSelected ? colorRamp.accent[300] : elevations.resting.border}`,
                  borderRadius: radius.control,
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: spacingScale["4"],
                }}
              >
                <span style={{ fontSize: "20px" }}>{preset.emoji}</span>
                <span style={{ ...typography["body-sm"], color: textColors.text, fontWeight: isSelected ? 500 : 400 }}>
                  {preset.label}
                </span>
                <span style={{ ...typography.caption, color: textColors.muted }}>
                  {preset.durationWeeks} weeks
                </span>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* Date entry (visible when a preset is selected) */}
      {selectedPresetIndex !== null && (
        <section style={{ marginTop: spacingScale["24"] }}>
          <SectionHeading>Start date</SectionHeading>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Term start date"
            style={{
              width: "100%",
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              ...typography.body,
              color: textColors.text,
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              outline: "none",
            }}
          />
          {startDate && (
            <p style={{ ...typography.caption, color: textColors.muted, margin: 0, marginTop: spacingScale["8"] }}>
              End date: {(() => {
                const preset = TERM_PRESETS[selectedPresetIndex]
                const start = new Date(startDate + "T00:00:00")
                const end = new Date(start)
                end.setDate(end.getDate() + preset.durationWeeks * 7)
                return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
              })()}
            </p>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={!startDate}
            style={{
              marginTop: spacingScale["16"],
              width: "100%",
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              background: startDate ? colorRamp.accent[400] : elevations.sunken.fill,
              color: startDate ? "#fff" : textColors.muted,
              border: "none",
              borderRadius: radius.control,
              cursor: startDate ? "pointer" : "not-allowed",
              ...typography.body,
              fontWeight: 500,
            }}
          >
            Set term
          </button>
        </section>
      )}
    </SettingsSubScreen>
  )
}
