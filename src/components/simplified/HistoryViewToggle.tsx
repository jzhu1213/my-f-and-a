"use client"

import { useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import {
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export type HistoryGroupingView = "timeline" | "category" | "merchant"

export interface HistoryViewToggleProps {
  value: HistoryGroupingView
  onChange: (view: HistoryGroupingView) => void
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_OPTIONS: { key: HistoryGroupingView; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "category", label: "By Category" },
  { key: "merchant", label: "By Merchant" },
]

// ============================================================================
// Component
// ============================================================================

/**
 * HistoryViewToggle — segmented control for switching between Timeline,
 * By Category, and By Merchant grouping modes.
 *
 * Implements roving tabindex + arrow key navigation per WAI-ARIA tabs pattern.
 *
 * Requirements: 22.4, accessibility standard
 */
export function HistoryViewToggle({ value, onChange }: HistoryViewToggleProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        nextIndex = (index + 1) % VIEW_OPTIONS.length
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        nextIndex = (index - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length
      } else if (e.key === "Home") {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === "End") {
        e.preventDefault()
        nextIndex = VIEW_OPTIONS.length - 1
      }

      if (nextIndex !== null) {
        tabRefs.current[nextIndex]?.focus()
        onChange(VIEW_OPTIONS[nextIndex].key)
      }
    },
    [onChange]
  )

  return (
    <div
      role="tablist"
      aria-label="Transaction grouping mode"
      style={segmentedControl}
    >
      {VIEW_OPTIONS.map(({ key, label }, index) => {
        const isActive = value === key
        return (
          <motion.button
            key={key}
            ref={(el: HTMLButtonElement | null) => { tabRefs.current[index] = el }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Group by ${label}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(e, index)}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...segmentedButtonBase,
              ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
            }}
          >
            {label}
          </motion.button>
        )
      })}
    </div>
  )
}
