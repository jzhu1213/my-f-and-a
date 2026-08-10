"use client"

/**
 * CategoryChipRow — Composed component (Phase 15 rebuild)
 *
 * A horizontal scrollable strip of icon chips with tinted backgrounds and
 * visible text labels, plus staggered amount suggestion reveals on selection.
 *
 * Features:
 * - Icon chips with per-category tinted background + icon + text label
 * - Every chip has a visible text label ≥1 character (no icon-only chips)
 * - Shared highlight element animated via layoutId (snappy spring, ≤200ms)
 * - On selection, reveals 1–5 amount suggestions with staggered entrance (20–60ms/item)
 * - Accessible: role="listbox" on container, role="option" on chips
 *
 * Requirements: 13.2, 13.3
 */

import React, { useMemo } from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { spacingScale } from "@/styles/layout"
import { springPresets } from "@/styles/motion"
import { radius } from "@/styles/surfaces"
import { textColors } from "@/styles/colors"
import { FONT_FAMILY, typography } from "@/styles/typography"
import { Icon } from "@/components/ui/Icon"
import { getCategoryIconName, type IconName } from "@/lib/icons"
import { getCategoryAccent } from "@/styles/shared"
import type { SmartSuggestion } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface CategoryChipItem {
  /** Unique category identifier. */
  id: string
  /** Display label (must be ≥1 character). */
  label: string
  /** Optional icon name override. Falls back to getCategoryIconName(id). */
  icon?: IconName
}

export interface CategoryChipRowProps {
  /** List of categories to display. */
  items: CategoryChipItem[]
  /** Currently selected category id (null for none). */
  selected: string | null
  /** Called when a category is selected. */
  onSelect: (id: string) => void
  /** Amount suggestions for the currently selected category (1–5 items). */
  suggestions?: SmartSuggestion[]
  /** Called when a suggestion chip is tapped. */
  onSuggestionSelect?: (suggestion: SmartSuggestion) => void
  /** Accessible label for the row. */
  "aria-label"?: string
}

// ============================================================================
// Constants
// ============================================================================

/** Stagger delay per chip item in seconds (40ms, within 20–60ms range). */
const CHIP_STAGGER_DELAY = 0.04

/** Stagger delay per suggestion item in seconds (40ms, within 20–60ms range). */
const SUGGESTION_STAGGER_DELAY = 0.04

/** Max suggestions to display per category. */
const MAX_SUGGESTIONS = 5

// ============================================================================
// Variants
// ============================================================================

const chipContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: CHIP_STAGGER_DELAY,
      delayChildren: 0.02,
    },
  },
}

const chipItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: springPresets.gentle.stiffness,
      damping: springPresets.gentle.damping,
      mass: springPresets.gentle.mass,
    },
  },
}

const suggestionContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: SUGGESTION_STAGGER_DELAY,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
}

const suggestionItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: springPresets.gentle.stiffness,
      damping: springPresets.gentle.damping,
      mass: springPresets.gentle.mass,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { type: "tween", duration: 0.1, ease: "easeOut" },
  },
}

// ============================================================================
// Subcomponents
// ============================================================================

interface CategoryChipButtonProps {
  item: CategoryChipItem
  isSelected: boolean
  onSelect: (id: string) => void
}

function CategoryChipButton({ item, isSelected, onSelect }: CategoryChipButtonProps) {
  const iconName = item.icon ?? getCategoryIconName(item.id)
  const accent = getCategoryAccent(item.id)

  // Tinted background: category accent at ~14% opacity
  const tintBg = `color-mix(in srgb, ${accent} 14%, transparent)`
  const selectedBg = `color-mix(in srgb, ${accent} 28%, transparent)`

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: spacingScale["6"],
    minHeight: "44px",
    minWidth: "44px",
    paddingLeft: spacingScale["12"],
    paddingRight: spacingScale["12"],
    paddingTop: spacingScale["6"],
    paddingBottom: spacingScale["6"],
    borderRadius: radius.full,
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: typography["body-sm"].fontWeight,
    lineHeight: typography["body-sm"].lineHeight,
    letterSpacing: typography["body-sm"].letterSpacing,
    whiteSpace: "nowrap",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
    position: "relative",
    border: "none",
    background: isSelected ? selectedBg : tintBg,
    color: isSelected ? accent : textColors.sub,
    transition: "background 150ms ease-out, color 150ms ease-out",
  }

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-label={item.label}
      aria-pressed={isSelected}
      role="option"
      aria-selected={isSelected}
      className="focus-ring"
      style={chipStyle}
      whileTap={{ scale: 0.96 }}
      transition={{
        type: "spring",
        stiffness: springPresets.snappy.stiffness,
        damping: springPresets.snappy.damping,
        mass: springPresets.snappy.mass,
      }}
    >
      {/* Shared highlight element for selected state */}
      {isSelected && (
        <motion.div
          layoutId="category-chip-highlight"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius.full,
            border: `1.5px solid ${accent}`,
            pointerEvents: "none",
          }}
          transition={{
            type: "spring",
            stiffness: springPresets.snappy.stiffness,
            damping: springPresets.snappy.damping,
            mass: springPresets.snappy.mass,
          }}
        />
      )}
      <Icon name={iconName} size={16} />
      <span>{item.label}</span>
    </motion.button>
  )
}

interface SuggestionChipProps {
  suggestion: SmartSuggestion
  accent: string
  onSelect: (suggestion: SmartSuggestion) => void
}

function SuggestionChip({ suggestion, accent, onSelect }: SuggestionChipProps) {
  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: spacingScale["4"],
    minHeight: "36px",
    paddingLeft: spacingScale["12"],
    paddingRight: spacingScale["12"],
    paddingTop: spacingScale["4"],
    paddingBottom: spacingScale["4"],
    borderRadius: radius.full,
    fontFamily: FONT_FAMILY,
    fontSize: typography["body-sm"].fontSize,
    fontWeight: 500,
    lineHeight: typography["body-sm"].lineHeight,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
    border: "none",
    background: `color-mix(in srgb, ${accent} 10%, transparent)`,
    color: textColors.text,
  }

  const label = suggestion.label
    ? `$${suggestion.amount} · ${suggestion.label}`
    : `$${suggestion.amount}`

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(suggestion)}
      aria-label={`${suggestion.amount} dollars${suggestion.label ? `, ${suggestion.label}` : ""}`}
      className="focus-ring"
      style={chipStyle}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: springPresets.snappy.stiffness,
        damping: springPresets.snappy.damping,
        mass: springPresets.snappy.mass,
      }}
    >
      {label}
    </motion.button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CategoryChipRow({
  items,
  selected,
  onSelect,
  suggestions = [],
  onSuggestionSelect,
  "aria-label": ariaLabel = "Select category",
}: CategoryChipRowProps) {
  // Clamp suggestions to 1–5 items
  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, MAX_SUGGESTIONS),
    [suggestions]
  )

  const selectedAccent = selected ? getCategoryAccent(selected) : ""

  const scrollContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: spacingScale["8"],
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    paddingTop: spacingScale["4"],
    paddingBottom: spacingScale["4"],
    paddingLeft: spacingScale["4"],
    paddingRight: spacingScale["4"],
    msOverflowStyle: "none",
  }

  const suggestionsContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: spacingScale["8"],
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    paddingTop: spacingScale["8"],
    paddingBottom: spacingScale["4"],
    paddingLeft: spacingScale["4"],
    paddingRight: spacingScale["4"],
    msOverflowStyle: "none",
  }

  return (
    <div>
      {/* Category chips row */}
      <motion.div
        role="listbox"
        aria-label={ariaLabel}
        style={scrollContainerStyle}
        variants={chipContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {items.map((item) => (
          <motion.div key={item.id} variants={chipItemVariants}>
            <CategoryChipButton
              item={item}
              isSelected={selected === item.id}
              onSelect={onSelect}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Staggered amount suggestions (revealed on category selection) */}
      <AnimatePresence mode="wait">
        {selected && visibleSuggestions.length > 0 && (
          <motion.div
            key={selected}
            style={suggestionsContainerStyle}
            variants={suggestionContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-label={`Amount suggestions for ${selected}`}
          >
            {visibleSuggestions.map((suggestion) => (
              <motion.div key={suggestion.id} variants={suggestionItemVariants}>
                <SuggestionChip
                  suggestion={suggestion}
                  accent={selectedAccent}
                  onSelect={onSuggestionSelect ?? (() => {})}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
