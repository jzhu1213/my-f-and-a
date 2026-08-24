"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory, Transaction } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import {
  detectRecurrences,
  mergeWithBills,
  getMonthlyRecurrenceTotal,
  type DetectedRecurrence,
  type MergedRecurrence,
  type RecurrenceFrequency,
  type RecurrenceStatus,
} from "@/lib/recurrenceDetector"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  sectionHeader,
  borderRadius,
} from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { formatCurrency } from "@/lib/currencyUtils"

// ============================================================================
// Types
// ============================================================================

export interface RecurrenceManagementScreenProps {
  transactions: Transaction[]
  bills: FixedExpense[]
  onClose: () => void
  /** Called when the user confirms a discovery — creates a new recurring bill */
  onConfirmRecurrence?: (recurrence: MergedRecurrence) => Promise<void>
  /** Called when the user dismisses a discovery */
  onDismissRecurrence?: (recurrenceId: string) => void
  /** Called when the user pauses a recurrence */
  onPauseRecurrence?: (recurrenceId: string) => void
  /** When true, renders inline without position:fixed wrapper and header (for embedding in RecurringScreen) */
  embedded?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? "💼"
}

function frequencyLabel(freq: RecurrenceFrequency): string {
  switch (freq) {
    case "weekly": return "Weekly"
    case "biweekly": return "Every 2 weeks"
    case "monthly": return "Monthly"
  }
}

function confidenceBadge(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: "Very likely", color: "var(--success, #4ade80)" }
  if (confidence >= 0.6) return { label: "Likely", color: "var(--accent)" }
  return { label: "Maybe", color: "var(--muted, #6b7280)" }
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[month - 1]} ${day}`
}

// ============================================================================
// Styles
// ============================================================================

const screenStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "var(--bg)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  fontFamily: FONT_FAMILY,
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid var(--border)",
  position: "sticky",
  top: 0,
  background: "var(--bg)",
  zIndex: 10,
}

const contentStyle: React.CSSProperties = {
  padding: "20px",
  maxWidth: 480,
  margin: "0 auto",
}

const cardStyle: React.CSSProperties = {
  padding: "14px 16px",
  marginBottom: 10,
  borderRadius: borderRadius.md,
}

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: radius.control,
  padding: "6px 12px",
  fontSize: typography['body-sm'].fontSize,
  fontWeight: fontWeights.medium,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  cursor: "pointer",
}

// ============================================================================
// RecurrenceManagementScreen Component
// ============================================================================

/**
 * RecurrenceManagementScreen — shows all detected recurrences: confirmed
 * (user-verified or linked to a bill) and suggested (auto-detected).
 * Users can confirm, dismiss, edit amount/frequency, or pause.
 *
 * Validates: Requirements 23.1
 */
export function RecurrenceManagementScreen({
  transactions,
  bills,
  onClose,
  onConfirmRecurrence,
  onDismissRecurrence,
  onPauseRecurrence,
  embedded = false,
}: RecurrenceManagementScreenProps) {
  // ── Local state for dismissed/paused items (persisted in parent via callbacks) ──
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set())
  const [localPaused, setLocalPaused] = useState<Set<string>>(new Set())
  const [localConfirmed, setLocalConfirmed] = useState<Set<string>>(new Set())

  // ── Detection + merge ──────────────────────────────────────────────────────
  const merged = useMemo(() => {
    const detected = detectRecurrences(transactions)
    return mergeWithBills(detected, bills)
  }, [transactions, bills])

  // Apply local state overrides
  const processedRecurrences = useMemo(() => {
    return merged.map(r => {
      if (localDismissed.has(r.id)) return { ...r, status: 'dismissed' as RecurrenceStatus }
      if (localPaused.has(r.id)) return { ...r, status: 'paused' as RecurrenceStatus }
      if (localConfirmed.has(r.id)) return { ...r, status: 'confirmed' as RecurrenceStatus }
      return r
    })
  }, [merged, localDismissed, localPaused, localConfirmed])

  const confirmed = processedRecurrences.filter(r => r.status === 'confirmed')
  const suggested = processedRecurrences.filter(r => r.status === 'suggested')
  const paused = processedRecurrences.filter(r => r.status === 'paused')

  const monthlyTotal = getMonthlyRecurrenceTotal(processedRecurrences)

  // ── Action handlers ────────────────────────────────────────────────────────
  function handleConfirm(recurrence: MergedRecurrence) {
    setLocalConfirmed(prev => new Set(prev).add(recurrence.id))
    onConfirmRecurrence?.(recurrence)
  }

  function handleDismiss(recurrenceId: string) {
    setLocalDismissed(prev => new Set(prev).add(recurrenceId))
    onDismissRecurrence?.(recurrenceId)
  }

  function handlePause(recurrenceId: string) {
    setLocalPaused(prev => new Set(prev).add(recurrenceId))
    onPauseRecurrence?.(recurrenceId)
  }

  function handleResume(recurrenceId: string) {
    setLocalPaused(prev => {
      const next = new Set(prev)
      next.delete(recurrenceId)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const embeddedStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={springs.gentle}
      style={embedded ? embeddedStyle : screenStyle}
      role={embedded ? undefined : "dialog"}
      aria-label="Recurring Expenses"
    >
      {/* Header — hidden when embedded */}
      {!embedded && (
      <div style={headerStyle}>
        <h1 style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)", margin: 0 }}>
          Recurring Expenses
        </h1>
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            fontSize: typography.body.fontSize,
            color: "var(--sub)",
            cursor: "pointer",
            padding: "4px 8px",
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Close"
        >
          ✕
        </motion.button>
      </div>
      )}
      <div style={contentStyle}>
        {/* Summary card */}
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.lg }}>
          <p style={sectionHeader}>Predicted Monthly Total</p>
          <p style={{
            fontSize: typography.headline.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}>
            {formatCurrency(Math.round(monthlyTotal), 'USD', { fractionDigits: 0 })}
            <span style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.regular, color: "var(--sub)", marginInlineStart: 3 }}>
              /mo
            </span>
          </p>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 4 }}>
            {confirmed.length} confirmed · {suggested.length} suggested
          </p>
        </GlassCard>

        {/* Confirmed section */}
        {confirmed.length > 0 && (
          <section aria-label="Confirmed recurring expenses" style={{ marginBottom: 28 }}>
            <h2 style={{ ...sectionHeader, marginBottom: spacing.sm }}>Confirmed</h2>
            {confirmed.map(r => (
              <RecurrenceCard
                key={r.id}
                recurrence={r}
                onPause={() => handlePause(r.id)}
              />
            ))}
          </section>
        )}

        {/* Suggested (new discoveries) section */}
        {suggested.length > 0 && (
          <section aria-label="Suggested recurring expenses" style={{ marginBottom: 28 }}>
            <h2 style={{ ...sectionHeader, marginBottom: spacing.sm }}>Discovered</h2>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.sm, lineHeight: 1.4 }}>
              We spotted these patterns in your spending. Confirm to track them, or dismiss if they're not recurring.
            </p>
            {suggested.map(r => (
              <RecurrenceCard
                key={r.id}
                recurrence={r}
                onConfirm={() => handleConfirm(r)}
                onDismiss={() => handleDismiss(r.id)}
                showDiscoveryCopy
              />
            ))}
          </section>
        )}

        {/* Paused section */}
        {paused.length > 0 && (
          <section aria-label="Paused recurring expenses" style={{ marginBottom: 28 }}>
            <h2 style={{ ...sectionHeader, marginBottom: spacing.sm }}>Paused</h2>
            {paused.map(r => (
              <RecurrenceCard
                key={r.id}
                recurrence={r}
                onResume={() => handleResume(r.id)}
                isPaused
              />
            ))}
          </section>
        )}

        {/* Empty state */}
        {confirmed.length === 0 && suggested.length === 0 && paused.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: typography.title.fontSize, marginBottom: spacing.xs }}>🔍</p>
            <p style={{ fontSize: typography.body.fontSize, color: "var(--text)", fontWeight: fontWeights.medium, marginBottom: 4 }}>
              No recurring patterns detected yet
            </p>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.4 }}>
              Keep logging expenses and we'll spot patterns automatically — usually takes about 3 months of data.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================================
// RecurrenceCard sub-component
// ============================================================================

interface RecurrenceCardProps {
  recurrence: MergedRecurrence
  onConfirm?: () => void
  onDismiss?: () => void
  onPause?: () => void
  onResume?: () => void
  showDiscoveryCopy?: boolean
  isPaused?: boolean
}

function RecurrenceCard({
  recurrence,
  onConfirm,
  onDismiss,
  onPause,
  onResume,
  showDiscoveryCopy,
  isPaused,
}: RecurrenceCardProps) {
  const badge = confidenceBadge(recurrence.confidence)

  return (
    <GlassCard elevation="low" style={cardStyle}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <span style={{ fontSize: typography.subhead.fontSize }}>{emojiForCategory(recurrence.category)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            color: "var(--text)",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {recurrence.label}
          </p>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: 0, marginTop: 2 }}>
            {frequencyLabel(recurrence.frequency)} · Next: {formatDateShort(recurrence.nextOccurrence)}
          </p>
        </div>
        <div style={{ textAlign: "end" }}>
          <p style={{
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.semibold,
            color: "var(--text)",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}>
            ~${recurrence.predictedAmount.toFixed(0)}
          </p>
          {recurrence.amountTolerance > 0 && (
            <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", margin: 0, marginTop: 1 }}>
              ±${recurrence.amountTolerance.toFixed(0)}
            </p>
          )}
        </div>
      </div>

      {/* Confidence badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: spacing.xs }}>
        <span style={{
          fontSize: typography.caption.fontSize,
          fontWeight: fontWeights.medium,
          color: badge.color,
          background: `${badge.color}15`,
          padding: "2px 8px",
          borderRadius: radius.control,
        }}>
          {badge.label}
        </span>
        <span style={{ fontSize: typography.caption.fontSize, color: "var(--muted)" }}>
          {recurrence.occurrenceCount} occurrences
        </span>
      </div>

      {/* Discovery copy */}
      {showDiscoveryCopy && recurrence.discoveryCopy && (
        <p style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--sub)",
          marginTop: spacing.xs,
          lineHeight: 1.4,
          fontStyle: "italic",
        }}>
          {recurrence.discoveryCopy}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: spacing.xs, marginTop: 10 }}>
        {onConfirm && (
          <motion.button
            onClick={onConfirm}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              ...actionBtnStyle,
              background: "var(--accent)",
              borderColor: "var(--accent)",
              color: "var(--text)",
            }}
            aria-label={`Confirm ${recurrence.label} as recurring`}
          >
            ✓ Confirm
          </motion.button>
        )}
        {onDismiss && (
          <motion.button
            onClick={onDismiss}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={actionBtnStyle}
            aria-label={`Dismiss ${recurrence.label}`}
          >
            Dismiss
          </motion.button>
        )}
        {onPause && (
          <motion.button
            onClick={onPause}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={actionBtnStyle}
            aria-label={`Pause tracking ${recurrence.label}`}
          >
            Pause
          </motion.button>
        )}
        {onResume && isPaused && (
          <motion.button
            onClick={onResume}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              ...actionBtnStyle,
              background: "var(--accent)",
              borderColor: "var(--accent)",
              color: "var(--text)",
            }}
            aria-label={`Resume tracking ${recurrence.label}`}
          >
            Resume
          </motion.button>
        )}
      </div>
    </GlassCard>
  )
}
