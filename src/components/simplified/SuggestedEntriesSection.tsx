"use client"

import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography } from '@/styles/typography'
import { sectionHeader } from "@/styles/shared"
import type { SuggestedEntry } from "@/lib/suggestedEntries"
import { SuggestedTransactionRow } from "./SuggestedTransactionRow"

// ============================================================================
// Types
// ============================================================================

export interface SuggestedEntriesSectionProps {
  /** Pending suggested entries to display */
  entries: SuggestedEntry[]
  /** Called when user confirms a suggestion */
  onConfirm: (entry: SuggestedEntry) => void
  /** Called when user dismisses a suggestion */
  onDismiss: (entryId: string) => void
  /** Called when user wants to edit a suggestion */
  onEdit: (entry: SuggestedEntry) => void
  /** Total amount of pending suggestions */
  pendingTotal: number
  /** Whether suggestions are included in allowance */
  includedInAllowance: boolean
}

// ============================================================================
// SuggestedEntriesSection Component
// ============================================================================

/**
 * SuggestedEntriesSection — renders pending suggested transaction entries
 * above the recent transactions list. Shows a compact section header with
 * the total impact and individual rows with confirm/dismiss/edit actions.
 *
 * Validates: Requirements 23.2
 */
export function SuggestedEntriesSection({
  entries,
  onConfirm,
  onDismiss,
  onEdit,
  pendingTotal,
  includedInAllowance,
}: SuggestedEntriesSectionProps) {
  if (entries.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={springs.gentle}
      aria-label="Suggested transactions"
      style={{ marginBottom: spacing.md }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3 style={{ ...sectionHeader, margin: 0 }}>
          Expected today
        </h3>
        {pendingTotal > 0 && (
          <span
            style={{
              fontSize: typography.caption.fontSize,
              color: "var(--muted)",
              fontFamily: FONT_FAMILY,
            }}
          >
            {includedInAllowance ? "Included in allowance" : "Not in allowance"} · ~${pendingTotal.toFixed(0)}
          </span>
        )}
      </div>

      {/* Suggested entry rows */}
      <div role="list" aria-label="Suggested transaction entries">
        <AnimatePresence>
          {entries.map(entry => (
            <SuggestedTransactionRow
              key={entry.id}
              entry={entry}
              onConfirm={onConfirm}
              onDismiss={onDismiss}
              onEdit={onEdit}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
