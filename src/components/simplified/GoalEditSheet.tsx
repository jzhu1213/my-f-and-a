"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { BottomSheet } from "@/components/ui/BottomSheet"
import type { Goal } from "@/types"
import type { SavingsAccount } from "@/types/folio"
import type { GoalFormData } from "./GoalsScreen"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius, shadows, fills, colorRamp } from "@/styles/shared"

// ============================================================================
// Config
// ============================================================================

/** Curated emoji set for savings goals (warm, student-relevant). */
const EMOJI_OPTIONS = ["🎯", "🏠", "🚗", "✈️", "💰", "📱", "💻", "🎓", "💍", "🎉", "🏖️", "🎮"]

const MAX_TARGET = 999999
const MAX_NAME_LENGTH = 30

interface GoalEditSheetProps {
  /** Whether the sheet is visible. Drives enter/exit animation. */
  isOpen: boolean
  /** "create" opens a blank form; "edit" prefills from `goal`. */
  mode: "create" | "edit"
  /** The goal being edited (ignored in create mode). */
  goal: Goal | null
  /** Available savings/investment accounts to link (optional). */
  savingsAccounts?: SavingsAccount[]
  /** Close the sheet without saving. */
  onClose: () => void
  /** Create a new goal. Resolves to the created goal, or null on failure. */
  onCreate: (data: GoalFormData) => Promise<Goal | null> | void
  /** Update an existing goal. Resolves to the updated goal, or null on failure. */
  onUpdate: (id: string, data: GoalFormData) => Promise<Goal | null> | void
}

// ============================================================================
// Helpers
// ============================================================================

/** Strip HTML tags / entities and cap length, keeping surrounding spaces intact. */
function sanitizeName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .slice(0, MAX_NAME_LENGTH)
}

// ============================================================================
// GoalEditSheet
// ============================================================================

/**
 * GoalEditSheet — warm, glass bottom sheet for creating or editing a savings
 * goal. Matches the visual language of ExpenseSheet / IncomeSheet (Inter font,
 * `--surface` glass panel, framer-motion slide-up with backdrop, reduced-motion
 * aware). Collects a name, emoji, and target amount.
 *
 * Submission awaits the create/update handler so optimistic updates upstream
 * stay reversible: a null result is treated as a persistence failure, the sheet
 * stays open, and an inline error is shown so the user can retry.
 *
 * Validates: Requirements 12.4
 */
export function GoalEditSheet({ isOpen, mode, goal, savingsAccounts, onClose, onCreate, onUpdate }: GoalEditSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0])
  const [targetDate, setTargetDate] = useState("")
  const [linkedAccountId, setLinkedAccountId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Snapshot the mode so the header keeps reading correctly during the exit
  // animation (props may reset to defaults the moment the sheet closes).
  const [sheetMode, setSheetMode] = useState<"create" | "edit">(mode)

  // Prefill (edit) or reset (create) whenever the sheet opens.
  useEffect(() => {
    if (!isOpen) return
    setSheetMode(mode)
    setSubmitting(false)
    setError(null)
    if (mode === "edit" && goal) {
      setName(goal.name)
      setTargetAmount(goal.targetAmount > 0 ? String(goal.targetAmount) : "")
      setSelectedEmoji(goal.emoji || EMOJI_OPTIONS[0])
      setTargetDate(goal.targetDate || "")
      setLinkedAccountId(goal.linkedAccountId || "")
    } else {
      setName("")
      setTargetAmount("")
      setSelectedEmoji(EMOJI_OPTIONS[0])
      setTargetDate("")
      setLinkedAccountId("")
    }
    // Focus the name field once the sheet has settled.
    const t = setTimeout(() => nameRef.current?.focus(), 140)
    return () => clearTimeout(t)
  }, [isOpen, mode, goal])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(sanitizeName(e.target.value))
    setError(null)
  }, [])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parts = raw.split(".")
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > MAX_TARGET) return
    setTargetAmount(raw)
    setError(null)
  }, [])

  const trimmedName = name.trim()
  const parsedTarget = parseFloat(targetAmount)
  const canSubmit =
    trimmedName.length > 0 && !!parsedTarget && parsedTarget > 0 && parsedTarget <= MAX_TARGET && !submitting

  const handleSubmit = useCallback(async () => {
    const cleanName = name.trim()
    const target = parseFloat(targetAmount)
    if (!cleanName || !target || target <= 0 || target > MAX_TARGET) {
      setError("Give your goal a name and a target amount above $0")
      return
    }

    const payload: GoalFormData = { name: cleanName, targetAmount: target, emoji: selectedEmoji, targetDate: targetDate || undefined, linkedAccountId: linkedAccountId || undefined }

    setSubmitting(true)
    setError(null)
    try {
      const result =
        sheetMode === "edit" && goal
          ? await Promise.resolve(onUpdate(goal.id, payload))
          : await Promise.resolve(onCreate(payload))

      // A null result signals a persistence failure upstream reverted the
      // optimistic update — keep the sheet open so the user can retry.
      if (result === null) {
        setSubmitting(false)
        setError("Couldn't save — check your connection and try again")
        return
      }

      onClose()
    } catch {
      setSubmitting(false)
      setError("Something went wrong. Please try again.")
    }
  }, [name, targetAmount, selectedEmoji, sheetMode, goal, onCreate, onUpdate, onClose])

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      ariaLabel={sheetMode === "edit" ? "Edit goal" : "New goal"}
      preventClose={submitting}
    >
      <div style={{ padding: "0 24px 32px" }}>
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            {sheetMode === "edit" ? "Edit goal" : "New goal"}
          </h2>
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
              borderRadius: borderRadius.full,
              background: "rgba(255,255,255,0.04)",
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

              {/* ── Emoji picker ───────────────────────────────────── */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>Pick an icon</p>
              <div
                role="radiogroup"
                aria-label="Goal icon"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {EMOJI_OPTIONS.map(emoji => {
                  const selected = selectedEmoji === emoji
                  return (
                    <motion.button
                      key={emoji}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Icon ${emoji}`}
                      onClick={() => setSelectedEmoji(emoji)}
                      whileTap={{ scale: prefersReducedMotion ? 1 : 0.92 }}
                      transition={springs.snappy}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 0",
                        fontSize: 22,
                        lineHeight: 1,
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        ...(selected
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
                      {emoji}
                    </motion.button>
                  )
                })}
              </div>

              {/* ── Name ───────────────────────────────────────────── */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>What are you saving for?</p>
              <input
                ref={nameRef}
                type="text"
                placeholder="Emergency fund, new laptop…"
                value={name}
                onChange={handleNameChange}
                maxLength={MAX_NAME_LENGTH}
                aria-label="Goal name"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--line)",
                  outline: "none",
                  fontSize: 16,
                  fontFamily: FONT_FAMILY,
                  color: "var(--text)",
                  padding: "10px 0",
                  marginBottom: 24,
                  caretColor: "var(--text)",
                }}
              />

              {/* ── Target amount ──────────────────────────────────── */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Target amount</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: error ? 12 : 28 }}>
                <span style={{ fontSize: 24, fontWeight: 300, color: "var(--muted)" }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={targetAmount}
                  onChange={handleAmountChange}
                  onKeyDown={e => {
                    if (e.key === "Enter" && canSubmit) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  aria-label="Target amount"
                  aria-invalid={!!error}
                  aria-describedby={error ? "goal-edit-error" : undefined}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    outline: "none",
                    fontSize: 32,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    padding: "4px 0 6px",
                    caretColor: "var(--text)",
                    minWidth: 0,
                  }}
                />
              </div>

              {/* ── Target date (optional) ─────────────────────────── */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
                Target date <span style={{ fontWeight: 400 }}>(optional)</span>
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => { setTargetDate(e.target.value); setError(null) }}
                  min={new Date().toISOString().split("T")[0]}
                  aria-label="Target date"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    outline: "none",
                    fontSize: 15,
                    fontFamily: FONT_FAMILY,
                    color: targetDate ? "var(--text)" : "var(--muted)",
                    padding: "10px 0",
                    caretColor: "var(--text)",
                    colorScheme: "dark",
                  }}
                />
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => setTargetDate("")}
                    aria-label="Clear target date"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.full,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* ── Link to investment account (optional, progressive disclosure) ── */}
              {savingsAccounts && savingsAccounts.length > 0 && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
                    Back with an account <span style={{ fontWeight: 400 }}>(optional)</span>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 10, lineHeight: 1.4 }}>
                    Link an investment account so progress grows automatically.
                  </p>
                  <select
                    value={linkedAccountId}
                    onChange={e => { setLinkedAccountId(e.target.value); setError(null) }}
                    aria-label="Linked investment account"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 14,
                      fontFamily: FONT_FAMILY,
                      color: linkedAccountId ? "var(--text)" : "var(--muted)",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      outline: "none",
                      marginBottom: 28,
                      cursor: "pointer",
                      appearance: "none",
                      WebkitAppearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' fill='none' stroke='%23888' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                    }}
                  >
                    <option value="">None</option>
                    {savingsAccounts.map(acct => (
                      <option key={acct.id} value={acct.id}>
                        {acct.name} — ${acct.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* ── Inline error (persistence failure / validation) ── */}
              {error && (
                <p id="goal-edit-error" role="alert" aria-live="assertive" style={{ fontSize: 13, color: "var(--error)", marginBottom: 20, lineHeight: 1.5 }}>
                  {error}
                </p>
              )}

              {/* ── Save button ────────────────────────────────────── */}
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label={sheetMode === "edit" ? "Save goal" : "Create goal"}
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
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? shadows.glowAccentStrong : "none",
                }}
              >
                {submitting ? "Saving…" : sheetMode === "edit" ? "Save goal" : "Create goal"}
              </motion.button>
            </div>
    </BottomSheet>
  )
}
