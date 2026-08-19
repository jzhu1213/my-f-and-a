"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeader } from "@/styles/shared"
import { getCategoryEmoji } from "@/lib/vocabulary"
import {
  getComingUpCollapsed,
  setComingUpCollapsed,
  getComingUpDismissed,
  dismissComingUpItem,
} from "@/lib/comingUpPreferences"
import type { TransactionCategory } from "@/types"
import type { SuggestedEntry } from "@/lib/suggestedEntries"
import { SuggestedTransactionRow } from "./SuggestedTransactionRow"

// ============================================================================
// Types
// ============================================================================

/** A predicted upcoming expense item for the "Coming up" section. */
export interface ComingUpItem {
  /** Recurrence ID */
  id: string
  /** Merchant/expense label */
  label: string
  /** Predicted amount */
  predictedAmount: number
  /** Expected date (YYYY-MM-DD) */
  expectedDate: string
  /** Days until this expense */
  daysUntil: number
  /** Category */
  category: TransactionCategory
}

export interface ComingUpSectionProps {
  /** Upcoming predicted expenses (max 3, within 7 days) */
  items: ComingUpItem[]
  /** Called when user taps the checkmark to pre-log an expense */
  onPreLog: (item: ComingUpItem) => void
  /** Task 485.4: Suggested entries merged into this section */
  suggestedEntries?: SuggestedEntry[]
  /** Called when user confirms a suggested entry */
  onConfirmSuggestion?: (entry: SuggestedEntry) => void
  /** Called when user dismisses a suggested entry */
  onDismissSuggestion?: (entryId: string) => void
  /** Called when user wants to edit a suggested entry */
  onEditSuggestion?: (entry: SuggestedEntry) => void
  /** Total amount of pending suggestions */
  suggestedEntriesTotal?: number
  /** Whether suggestions are included in allowance */
  suggestionsIncludedInAllowance?: boolean
}

// ============================================================================
// ComingUpSection Component
// ============================================================================

/**
 * ComingUpSection — collapsible section showing the next 3 predicted expenses
 * in the next 7 days, plus merged suggested entries (task 485.4). Each row
 * shows merchant, predicted amount, and time until due, with confirm (pre-log)
 * and dismiss actions. Suggested entries show confirm/dismiss/edit actions.
 *
 * Validates: Requirements 23.4, 29.4
 */
export function ComingUpSection({
  items,
  onPreLog,
  suggestedEntries,
  onConfirmSuggestion,
  onDismissSuggestion,
  onEditSuggestion,
  suggestedEntriesTotal,
  suggestionsIncludedInAllowance,
}: ComingUpSectionProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isCollapsed, setIsCollapsed] = useState(() => getComingUpCollapsed())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getComingUpDismissed())

  // Sync collapsed state to localStorage
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      setComingUpCollapsed(next)
      return next
    })
  }, [])

  // Handle dismiss
  const handleDismiss = useCallback((id: string) => {
    dismissComingUpItem(id)
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Filter out dismissed items
  const visibleItems = items.filter(item => !dismissedIds.has(item.id))
  const hasSuggestions = suggestedEntries && suggestedEntries.length > 0

  if (visibleItems.length === 0 && !hasSuggestions) return null

  return (
    <motion.section
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      aria-label="Coming up — upcoming predicted expenses"
      style={{ marginBottom: 16 }}
    >
      {/* Section header with collapse toggle */}
      <button
        type="button"
        onClick={handleToggleCollapse}
        aria-expanded={!isCollapsed}
        aria-controls="coming-up-list"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          color: "inherit",
          textAlign: "start",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: isCollapsed ? 0 : 10,
          borderRadius: 4,
        }}
      >
        <h3 style={{ ...sectionHeader, margin: 0 }}>
          Coming up
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasSuggestions && suggestedEntriesTotal != null && suggestedEntriesTotal > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
              }}
            >
              {suggestionsIncludedInAllowance ? "Incl. in allowance" : "Not in allowance"} · ~${suggestedEntriesTotal.toFixed(0)}
            </span>
          )}
          <motion.span
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={springs.snappy}
            style={{
              fontSize: 12,
              color: "var(--sub)",
              opacity: 0.7,
              display: "inline-block",
            }}
            aria-hidden="true"
          >
            ▾
          </motion.span>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            id="coming-up-list"
            role="list"
            aria-label="Upcoming predicted expenses"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden" }}
          >
            {/* Suggested entries — confirm/dismiss/edit (task 485.4 merged) */}
            {hasSuggestions && onConfirmSuggestion && onDismissSuggestion && onEditSuggestion && (
              <div style={{ marginBottom: visibleItems.length > 0 ? 8 : 0 }}>
                <AnimatePresence>
                  {suggestedEntries!.map(entry => (
                    <SuggestedTransactionRow
                      key={entry.id}
                      entry={entry}
                      onConfirm={onConfirmSuggestion}
                      onDismiss={onDismissSuggestion}
                      onEdit={onEditSuggestion}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Predicted recurring expenses — pre-log or dismiss */}
            {visibleItems.map(item => (
              <ComingUpRow
                key={item.id}
                item={item}
                onPreLog={onPreLog}
                onDismiss={handleDismiss}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ============================================================================
// ComingUpRow — individual row
// ============================================================================

interface ComingUpRowProps {
  item: ComingUpItem
  onPreLog: (item: ComingUpItem) => void
  onDismiss: (id: string) => void
}

function ComingUpRow({ item, onPreLog, onDismiss }: ComingUpRowProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const emoji = getCategoryEmoji(item.category)
  const daysLabel = item.daysUntil === 0
    ? "today"
    : item.daysUntil === 1
    ? "tomorrow"
    : `in ${item.daysUntil} days`

  return (
    <motion.div
      role="listitem"
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
      transition={timings.normal}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* Emoji */}
      <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
        {emoji}
      </span>

      {/* Label */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: "var(--text)",
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.label}
      </span>

      {/* Amount */}
      <span
        style={{
          fontSize: 12,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        ~${Math.round(item.predictedAmount)}
      </span>

      {/* Days until */}
      <span
        style={{
          fontSize: 11,
          color: "var(--muted)",
          fontFamily: FONT_FAMILY,
          flexShrink: 0,
          minWidth: 60,
          textAlign: "end",
        }}
      >
        {daysLabel}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onPreLog(item)}
          aria-label={`Pre-log ${item.label} for ~$${Math.round(item.predictedAmount)}`}
          style={{
            background: "rgba(74, 222, 128, 0.1)",
            border: "none",
            padding: "2px 6px",
            margin: 0,
            font: "inherit",
            cursor: "pointer",
            fontSize: 14,
            borderRadius: 4,
            color: "var(--success)",
            lineHeight: 1,
          }}
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label={`Dismiss ${item.label} from upcoming`}
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "none",
            padding: "2px 6px",
            margin: 0,
            font: "inherit",
            cursor: "pointer",
            fontSize: 14,
            borderRadius: 4,
            color: "var(--muted)",
            lineHeight: 1,
          }}
        >
          ✗
        </button>
      </div>
    </motion.div>
  )
}
