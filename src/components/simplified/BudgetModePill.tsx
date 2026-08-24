"use client"

/**
 * BudgetModePill — A quick-swap pill shown on the home screen when 2+ budget
 * modes exist. Tapping it opens a small bottom sheet to switch between modes.
 *
 * Only renders when the user has saved 2+ modes. Shows the active mode name
 * and icon. If no mode is active, shows "No mode".
 *
 * Task 337.2
 */

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp, semanticColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import type { BudgetMode } from "@/lib/spendingModeConfig"

// ============================================================================
// Props
// ============================================================================

export interface BudgetModePillProps {
  /** All saved budget modes */
  budgetModes: BudgetMode[]
  /** Currently active budget mode ID, or null */
  activeBudgetModeId: string | null
  /** Callback to switch the active mode */
  onSetActiveBudgetMode: (id: string | null) => void
}

// ============================================================================
// Component
// ============================================================================

export function BudgetModePill({
  budgetModes,
  activeBudgetModeId,
  onSetActiveBudgetMode,
}: BudgetModePillProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Only show when 2+ modes exist
  if (budgetModes.length < 2) return null

  const activeMode = budgetModes.find(m => m.id === activeBudgetModeId) ?? null

  const handleSelect = useCallback((id: string | null) => {
    onSetActiveBudgetMode(id)
    setIsSheetOpen(false)
  }, [onSetActiveBudgetMode])

  return (
    <>
      {/* The pill button */}
      <motion.button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        aria-label={`Budget mode: ${activeMode?.name ?? 'None'}. Tap to switch.`}
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.snappy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacingScale["6"],
          padding: `${spacingScale["6"]} ${spacingScale["12"]}`,
          borderRadius: radius.full,
          background: elevations.raised.fill,
          border: `1px solid ${semanticColors.borderSubtle}`,
          cursor: "pointer",
          ...typography["body-sm"],
          color: textColors.sub,
        }}
      >
        {activeMode ? (
          <>
            <span aria-hidden="true">{activeMode.icon}</span>
            <span>{activeMode.name}</span>
          </>
        ) : (
          <span style={{ color: textColors.muted }}>No mode</span>
        )}
        <span aria-hidden="true" style={{ fontSize: "0.65rem", opacity: 0.6 }}>▾</span>
      </motion.button>

      {/* Bottom sheet selector */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        ariaLabel="Switch budget mode"
        maxHeight="50vh"
      >
        <div style={{ padding: `${spacingScale["20"]} ${spacingScale["20"]} ${spacingScale["32"]}` }}>
          <p style={{ ...typography.subhead, color: textColors.text, marginBottom: spacingScale["16"] }}>
            Switch budget mode
          </p>

          {/* No mode option */}
          <ModeOption
            icon="—"
            name="No mode (base budgets)"
            isSelected={activeBudgetModeId === null}
            onSelect={() => handleSelect(null)}
          />

          {/* Mode options */}
          {budgetModes.map(mode => (
            <ModeOption
              key={mode.id}
              icon={mode.icon}
              name={mode.name}
              isSelected={mode.id === activeBudgetModeId}
              onSelect={() => handleSelect(mode.id)}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  )
}

// ============================================================================
// Internal: ModeOption row
// ============================================================================

function ModeOption({
  icon,
  name,
  isSelected,
  onSelect,
}: {
  icon: string
  name: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingScale["12"],
        width: "100%",
        padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
        marginBottom: spacingScale["8"],
        borderRadius: radius.card,
        border: isSelected
          ? `2px solid ${colorRamp.accent[500]}`
          : `1px solid ${semanticColors.borderSubtle}`,
        background: isSelected ? colorRamp.accent[50] : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{icon}</span>
      <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>{name}</span>
      {isSelected && (
        <span style={{ ...typography["body-sm"], color: colorRamp.accent[500] }}>✓</span>
      )}
    </button>
  )
}
