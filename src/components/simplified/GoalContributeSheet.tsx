"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { BottomSheet } from "@/components/ui/BottomSheet"
import type { Goal } from "@/types"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { shadows, fills, colorRamp, HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Config
// ============================================================================

/** Quick-add chips tuned for small, frequent student contributions. */
const QUICK_AMOUNTS = [10, 25, 50, 100]

const MAX_AMOUNT = 99999

interface GoalContributeSheetProps {
  /** Whether the sheet is visible. Drives enter/exit animation. */
  isOpen: boolean
  /** The goal being contributed to. */
  goal: Goal | null
  /** Close the sheet without contributing. */
  onClose: () => void
  /** Add to a goal's saved amount. Resolves to the updated goal, or null on failure. */
  onContribute: (id: string, amount: number) => Promise<Goal | null> | void
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// ============================================================================
// GoalContributeSheet
// ============================================================================

/**
 * GoalContributeSheet — warm, glass bottom sheet for adding money to a goal.
 * Shares the ExpenseSheet / IncomeSheet visual language (Inter font,
 * `--surface` glass panel, framer-motion slide-up + backdrop, reduced-motion
 * aware). Offers quick-add chips plus a custom amount entry, and shows the
 * goal's current progress for context.
 *
 * Submission awaits the contribute handler so optimistic updates upstream stay
 * reversible: a null result is treated as a persistence failure, the sheet
 * stays open, and an inline error is shown so the user can retry.
 *
 * Validates: Requirements 12.4
 */
export function GoalContributeSheet({ isOpen, goal, onClose, onContribute }: GoalContributeSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Retain the last non-null goal so its details stay rendered while the sheet
  // animates out (the parent nulls `goal` the moment it closes).
  const [displayGoal, setDisplayGoal] = useState<Goal | null>(goal)
  useEffect(() => {
    if (goal) setDisplayGoal(goal)
  }, [goal])

  // Reset entry state each time the sheet opens.
  useEffect(() => {
    if (!isOpen) return
    setAmount("")
    setSubmitting(false)
    setError(null)
  }, [isOpen])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parts = raw.split(".")
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > MAX_AMOUNT) return
    setAmount(raw)
    setError(null)
  }, [])

  const parsed = parseFloat(amount)
  const canSubmit = !!parsed && parsed > 0 && parsed <= MAX_AMOUNT && !submitting

  const handleSubmit = useCallback(async () => {
    const value = parseFloat(amount)
    if (!value || value <= 0 || value > MAX_AMOUNT || !displayGoal) {
      setError("Enter an amount above $0.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await Promise.resolve(onContribute(displayGoal.id, value))

      // A null result means the optimistic update was reverted upstream —
      // keep the sheet open so the user can retry.
      if (result === null) {
        setSubmitting(false)
        setError("Couldn't add that. Check your connection and try again.")
        return
      }

      onClose()
    } catch {
      setSubmitting(false)
      setError("Something went wrong. Please try again.")
    }
  }, [amount, displayGoal, onContribute, onClose])

  // ── Progress context ────────────────────────────────────────────────────
  const pct = displayGoal && displayGoal.targetAmount > 0
    ? Math.min(Math.round((displayGoal.currentAmount / displayGoal.targetAmount) * 100), 100)
    : 0
  const remaining = displayGoal ? Math.max(0, displayGoal.targetAmount - displayGoal.currentAmount) : 0

  return (
    <BottomSheet
      isOpen={isOpen && !!displayGoal}
      onClose={onClose}
      ariaLabel={displayGoal ? `Add money to ${displayGoal.name}` : "Add money to goal"}
      preventClose={submitting}
    >
      {displayGoal && (
        <div style={{ padding: "0 24px 32px" }}>
              {/* ── Goal header + progress ─────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
                  <span style={{ fontSize: typography.headline.fontSize, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
                    {displayGoal.emoji}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        fontSize: 17,
                        fontWeight: fontWeights.bold,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayGoal.name}
                    </h2>
                    <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      ${formatAmount(displayGoal.currentAmount)}
                      <span style={{ color: "var(--muted)" }}> / ${formatAmount(displayGoal.targetAmount)}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  aria-label="Close"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: radius.full,
                    background: "var(--fill-04)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress bar */}
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${displayGoal.name} progress: ${pct} percent`}
                style={{
                  height: 8,
                  width: "100%",
                  borderRadius: radius.full,
                  background: "var(--fill-06)",
                  overflow: "hidden",
                  marginBottom: spacing.xs,
                }}
              >
                <motion.div
                  initial={{ scaleX: prefersReducedMotion ? pct / 100 : 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={prefersReducedMotion ? timings.fast : springs.gentle}
                  style={{ width: "100%", height: "100%", borderRadius: radius.full, background: "var(--accent)", transformOrigin: "left center" }}
                />
              </div>
              <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.lg, fontVariantNumeric: "tabular-nums" }}>
                {remaining > 0 ? `$${formatAmount(remaining)} to go` : "Goal reached 🎉"}
              </p>

              {/* ── Quick-add chips ────────────────────────────────── */}
              <p style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", marginBottom: 10 }}>Quick add</p>
              <div style={{ display: "flex", gap: spacing.xs, marginBottom: HORIZONTAL_PADDING }}>
                {QUICK_AMOUNTS.map(q => {
                  const active = amount === String(q)
                  return (
                    <motion.button
                      key={q}
                      type="button"
                      onClick={() => { setAmount(String(q)); setError(null) }}
                      whileTap={{ scale: prefersReducedMotion ? 1 : 0.96 }}
                      transition={springs.snappy}
                      aria-label={`Add $${q}`}
                      aria-pressed={active}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.semibold,
                        fontFamily: FONT_FAMILY,
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        color: active ? "var(--text)" : "var(--sub)",
                        ...(active
                          ? {
                              background: colorRamp.accent[100],
                              border: `1.5px solid ${colorRamp.accent[400]}`,
                              boxShadow: shadows.glowAccent,
                            }
                          : {
                              background: fills[3],
                              border: `1px solid ${fills[6]}`,
                            }),
                      }}
                    >
                      ${q}
                    </motion.button>
                  )
                })}
              </div>

              {/* ── Custom amount ──────────────────────────────────── */}
              <p style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", marginBottom: spacing.xs }}>Or enter an amount</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: error ? 12 : 28 }}>
                <span style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.light, color: "var(--muted)" }}>$</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={handleAmountChange}
                  onKeyDown={e => {
                    if (e.key === "Enter" && canSubmit) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  aria-label="Contribution amount"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    outline: "none",
                    fontSize: typography.title.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    padding: "4px 0 6px",
                    caretColor: "var(--text)",
                    minWidth: 0,
                  }}
                />
              </div>

              {/* ── Inline error (persistence failure / validation) ── */}
              {error && (
                <p role="alert" style={{ fontSize: typography['body-sm'].fontSize, color: "var(--error)", marginBottom: HORIZONTAL_PADDING, lineHeight: 1.5 }}>
                  {error}
                </p>
              )}

              {/* ── Add button ─────────────────────────────────────── */}
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Add money to goal"
                whileTap={canSubmit && !prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.bouncy}
                style={{
                  width: "100%",
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: canSubmit
                    ? `linear-gradient(135deg, ${colorRamp.accent[500]} 0%, ${colorRamp.accent[600]} 100%)`
                    : "var(--dim)",
                  color: canSubmit ? "var(--text)" : "var(--muted)",
                  fontFamily: FONT_FAMILY,
                  fontSize: 17,
                  fontWeight: fontWeights.semibold,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? shadows.glowAccentStrong : "none",
                }}
              >
                {submitting ? "Adding…" : parsed > 0 ? `Add $${formatAmount(parsed)}` : "Add money"}
              </motion.button>
            </div>
      )}
    </BottomSheet>
  )
}
