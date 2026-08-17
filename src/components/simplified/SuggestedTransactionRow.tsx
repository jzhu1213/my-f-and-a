"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius, fills } from "@/styles/shared"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { SuggestedEntry } from "@/lib/suggestedEntries"

// ============================================================================
// Types
// ============================================================================

export interface SuggestedTransactionRowProps {
  /** The suggested entry to display */
  entry: SuggestedEntry
  /** Called when user confirms — becomes a real transaction */
  onConfirm: (entry: SuggestedEntry) => void
  /** Called when user dismisses — disappears, noted for learning */
  onDismiss: (entryId: string) => void
  /** Called when user wants to edit — opens edit sheet pre-filled */
  onEdit: (entry: SuggestedEntry) => void
}

// ============================================================================
// Helpers
// ============================================================================

function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? "💼"
}

// ============================================================================
// Styles
// ============================================================================

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 16px",
  borderRadius: borderRadius.md,
  border: "1.5px dashed rgba(167, 139, 250, 0.4)",
  background: "rgba(167, 139, 250, 0.04)",
  position: "relative",
  overflow: "hidden",
}

const labelContainerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text)",
  fontFamily: FONT_FAMILY,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  fontFamily: FONT_FAMILY,
  margin: 0,
  marginTop: 2,
}

const amountStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text)",
  fontFamily: FONT_FAMILY,
  fontVariantNumeric: "tabular-nums",
  marginRight: 8,
}

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
}

const actionBtnBase: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  transition: "background 0.15s",
}

const confirmBtnStyle: React.CSSProperties = {
  ...actionBtnBase,
  background: "rgba(74, 222, 128, 0.15)",
  color: "var(--success, #4ade80)",
}

const dismissBtnStyle: React.CSSProperties = {
  ...actionBtnBase,
  background: "rgba(248, 113, 113, 0.12)",
  color: "var(--error, #f87171)",
}

const editBtnStyle: React.CSSProperties = {
  ...actionBtnBase,
  background: fills[6],
  color: "var(--sub)",
}

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--accent, #a78bfa)",
  background: "rgba(167, 139, 250, 0.12)",
  padding: "2px 6px",
  borderRadius: 6,
  fontFamily: FONT_FAMILY,
  letterSpacing: "0.03em",
}

// ============================================================================
// SuggestedTransactionRow Component
// ============================================================================

/**
 * SuggestedTransactionRow — a visually distinct transaction row for auto-suggested
 * entries. Features a dashed border and subtle purple tint to differentiate from
 * real transactions. Provides one-tap confirm/dismiss and edit actions.
 *
 * Validates: Requirements 23.2
 */
export function SuggestedTransactionRow({
  entry,
  onConfirm,
  onDismiss,
  onEdit,
}: SuggestedTransactionRowProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  const handleConfirm = () => {
    setIsConfirming(true)
    // Brief delay for visual transition before actually confirming
    setTimeout(() => {
      onConfirm(entry)
    }, 300)
  }

  const handleDismiss = () => {
    setIsDismissing(true)
    setTimeout(() => {
      onDismiss(entry.id)
    }, 250)
  }

  return (
    <AnimatePresence mode="popLayout">
      {!isDismissing && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{
            opacity: isConfirming ? 1 : 1,
            y: 0,
            scale: 1,
            borderColor: isConfirming
              ? "rgba(74, 222, 128, 0.5)"
              : "rgba(167, 139, 250, 0.4)",
            background: isConfirming
              ? "rgba(74, 222, 128, 0.06)"
              : "rgba(167, 139, 250, 0.04)",
          }}
          exit={{
            opacity: 0,
            height: 0,
            marginBottom: 0,
            padding: 0,
            transition: { opacity: { duration: 0.2 }, height: { duration: 0.3 } },
          }}
          transition={springs.gentle}
          style={{
            ...rowStyle,
            marginBottom: 8,
          }}
          role="listitem"
          aria-roledescription="suggested transaction"
          aria-label={`Suggested: ${entry.label}, $${entry.amount.toFixed(2)}. Confirm, dismiss, or edit.`}
        >
          {/* Category emoji */}
          <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden>
            {emojiForCategory(entry.category)}
          </span>

          {/* Label & subtitle */}
          <div style={labelContainerStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={labelStyle}>{entry.label}</p>
              <span style={badgeStyle} role="status" aria-label="Suggested transaction">Suggested</span>
            </div>
            <p style={subtitleStyle}>
              Expected today · {entry.category}
            </p>
          </div>

          {/* Amount */}
          <span style={amountStyle}>
            ~${entry.amount.toFixed(2)}
          </span>

          {/* Action buttons */}
          <div style={actionsStyle}>
            <motion.button
              onClick={handleConfirm}
              whileTap={{ scale: 0.85 }}
              transition={springs.snappy}
              style={confirmBtnStyle}
              aria-label={`Confirm ${entry.label}`}
              title="Confirm"
            >
              ✓
            </motion.button>
            <motion.button
              onClick={() => onEdit(entry)}
              whileTap={{ scale: 0.85 }}
              transition={springs.snappy}
              style={editBtnStyle}
              aria-label={`Edit ${entry.label}`}
              title="Edit"
            >
              ✎
            </motion.button>
            <motion.button
              onClick={handleDismiss}
              whileTap={{ scale: 0.85 }}
              transition={springs.snappy}
              style={dismissBtnStyle}
              aria-label={`Dismiss ${entry.label}`}
              title="Dismiss"
            >
              ✕
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
