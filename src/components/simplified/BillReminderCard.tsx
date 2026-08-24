"use client"

import { motion } from "framer-motion"
import { GlassCard } from "@/components/ui/GlassCard"
import { springs } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { formatMoney } from '@/lib/localeFormat'
import { fills } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { BillPreFill, VariableBillInfo, BillConfirmation } from "@/lib/billReminders"

// ============================================================================
// Types
// ============================================================================

export interface BillReminderCardProps {
  /** Pre-fill data for the upcoming bill */
  preFill: BillPreFill | null
  /** Variable bill info (if applicable) */
  variableInfo: VariableBillInfo | null
  /** Bill label */
  label: string
  /** Bill category */
  category: TransactionCategory
  /** Days until due */
  daysUntilDue: number
  /** Called when user confirms the pre-filled amount */
  onConfirm: (amount: number) => void
  /** Called when user wants to edit the amount before confirming */
  onEdit: (suggestedAmount: number) => void
  /** Called when user dismisses the reminder */
  onDismiss: () => void
}

export interface BillConfirmationCardProps {
  /** The confirmation prompt data */
  confirmation: BillConfirmation
  /** Called when user confirms they paid — opens log flow with pre-filled data */
  onLogPayment: (billId: string, amount: number) => void
  /** Called when user dismisses ("Got it, won't ask again") */
  onDismiss: (billId: string) => void
}

// ============================================================================
// Helpers
// ============================================================================

function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? "💼"
}

function getDueLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "Due today"
  if (daysUntilDue === 1) return "Due tomorrow"
  return `Due in ${daysUntilDue} days`
}

// ============================================================================
// BillReminderCard — Pre-fill with one-tap confirm (415.1 + 415.2)
// ============================================================================

/**
 * BillReminderCard — shows an upcoming bill with pre-filled amount.
 * For variable bills, includes the range context (usually $X–Y, last month was $Z).
 * User can confirm with one tap or edit the amount.
 *
 * Requirements: 23.6
 */
export function BillReminderCard({
  preFill,
  variableInfo,
  label,
  category,
  daysUntilDue,
  onConfirm,
  onEdit,
  onDismiss,
}: BillReminderCardProps) {
  const suggestedAmount = preFill?.suggestedAmount ?? 0
  const emoji = emojiForCategory(category)
  const dueLabel = getDueLabel(daysUntilDue)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={springs.gentle}
    >
      <GlassCard elevation="low" glow="caution" style={{ padding: "16px 18px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: 8 }}>
          <span style={{ fontSize: typography.subhead.fontSize }}>{emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              color: "var(--text)",
              margin: 0,
              fontFamily: FONT_FAMILY,
            }}>
              {label}
            </p>
            <p style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--sub)",
              margin: 0,
              fontFamily: FONT_FAMILY,
            }}>
              {dueLabel}
            </p>
          </div>
          {/* Dismiss button */}
          <motion.button
            onClick={onDismiss}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: "4px 6px",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: typography.body.fontSize,
              color: "var(--muted)",
              lineHeight: 1,
            }}
            aria-label={`Dismiss ${label} reminder`}
          >
            ✕
          </motion.button>
        </div>

        {/* Variable bill range context */}
        {variableInfo && (
          <p style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--sub)",
            margin: "0 0 10px 0",
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.4,
          }}>
            Usually ${variableInfo.min}–${variableInfo.max}, last month was ${variableInfo.lastAmount}
          </p>
        )}

        {/* Pre-filled amount + actions */}
        {preFill && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
            {/* Confirm button — one-tap */}
            <motion.button
              onClick={() => onConfirm(suggestedAmount)}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 16px",
                background: "var(--success)",
                border: "none",
                borderRadius: radius.full,
                color: "var(--text)",
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
                cursor: "pointer",
              }}
              aria-label={`Confirm ${label} payment of $${suggestedAmount}`}
            >
              ✓ Log ${formatAmount(suggestedAmount)}
            </motion.button>

            {/* Edit amount button */}
            <motion.button
              onClick={() => onEdit(suggestedAmount)}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              style={{
                padding: "10px 14px",
                background: fills[6],
                border: `1px solid ${fills[10]}`,
                borderRadius: radius.full,
                color: "var(--sub)",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
              }}
              aria-label={`Edit amount for ${label}`}
            >
              Edit
            </motion.button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// BillConfirmationCard — Post-due-date follow-up (415.3)
// ============================================================================

/**
 * BillConfirmationCard — gentle check-in when a bill's due date passed
 * without a matching transaction being logged.
 *
 * "Looks like [bill] was due — want to log it?"
 * One per bill per month, dismissible ("Got it, won't ask again").
 *
 * Requirements: 23.6
 */
export function BillConfirmationCard({
  confirmation,
  onLogPayment,
  onDismiss,
}: BillConfirmationCardProps) {
  const emoji = emojiForCategory(confirmation.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={springs.gentle}
    >
      <GlassCard elevation="low" style={{ padding: "16px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm, marginBottom: 10 }}>
          <span style={{ fontSize: typography.subhead.fontSize, marginTop: 1 }}>{emoji}</span>
          <p style={{
            flex: 1,
            fontSize: typography.body.fontSize,
            color: "var(--text)",
            margin: 0,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.5,
          }}>
            {confirmation.message}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
          {/* Log it button */}
          <motion.button
            onClick={() => onLogPayment(confirmation.billId, confirmation.expectedAmount)}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: fills[6],
              border: `1px solid ${fills[10]}`,
              borderRadius: radius.full,
              color: "var(--text)",
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.semibold,
              fontFamily: FONT_FAMILY,
              fontVariantNumeric: "tabular-nums",
              cursor: "pointer",
            }}
            aria-label={`Log payment for ${confirmation.label}`}
          >
            Log ${formatAmount(confirmation.expectedAmount)}
          </motion.button>

          {/* Dismiss */}
          <motion.button
            onClick={() => onDismiss(confirmation.billId)}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={{
              padding: "10px 14px",
              background: "none",
              border: "none",
              borderRadius: radius.full,
              color: "var(--muted)",
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.medium,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
            aria-label={`Dismiss reminder for ${confirmation.label}`}
          >
            Got it, won&apos;t ask again
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// Utilities
// ============================================================================

function formatAmount(amount: number): string {
  return formatMoney(amount)
}
