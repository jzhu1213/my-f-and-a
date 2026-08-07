"use client"

/**
 * CategoryChipRow — Composed component
 *
 * A horizontal scrollable strip of Chip primitives with staggered selection
 * animation (20–60ms per item). Used for category selection in the logging flow.
 *
 * - Horizontal scrollable container (no scrollbar)
 * - Staggered selection animation on mount/change
 * - Uses Chip primitive for each item
 * - Accessible: role="listbox" on container, role="option" on chips
 *
 * Requirements: 16.1, 14.2
 */

import React from "react"
import { motion } from "framer-motion"
import { Chip } from "@/components/ui/primitives/Chip"
import { spacingScale } from "@/styles/layout"
import { springPresets } from "@/styles/motion"
import { Icon } from "@/components/ui/Icon"
import { getCategoryIconName, type IconName } from "@/lib/icons"

// ============================================================================
// Types
// ============================================================================

export interface CategoryChipItem {
  /** Unique category identifier. */
  id: string
  /** Display label. */
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
  /** Accessible label for the row. */
  "aria-label"?: string
}

// ============================================================================
// Constants
// ============================================================================

/** Stagger delay per item in seconds (40ms, within 20–60ms range). */
const STAGGER_DELAY = 0.04

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_DELAY,
      delayChildren: 0.02,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: springPresets.gentle.stiffness,
      damping: springPresets.gentle.damping,
      mass: springPresets.gentle.mass,
    },
  },
}

// ============================================================================
// Component
// ============================================================================

export function CategoryChipRow({
  items,
  selected,
  onSelect,
  "aria-label": ariaLabel = "Select category",
}: CategoryChipRowProps) {
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
    /* Hide scrollbar for Webkit */
    msOverflowStyle: "none",
  }

  return (
    <motion.div
      role="listbox"
      aria-label={ariaLabel}
      style={scrollContainerStyle}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => {
        const iconName = item.icon ?? getCategoryIconName(item.id)
        const isSelected = selected === item.id

        return (
          <motion.div key={item.id} variants={itemVariants}>
            <Chip
              variant="category"
              selected={isSelected}
              onClick={() => onSelect(item.id)}
              aria-label={item.label}
            >
              <Icon name={iconName} size={16} />
              {item.label}
            </Chip>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
