"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import type { Goal } from "@/types"
import type { GoalFormData } from "./GoalsScreen"

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
export function GoalEditSheet({ isOpen, mode, goal, onClose, onCreate, onUpdate }: GoalEditSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0])
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
    } else {
      setName("")
      setTargetAmount("")
      setSelectedEmoji(EMOJI_OPTIONS[0])
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
      setError("Add a name and a target amount above $0.")
      return
    }

    const payload: GoalFormData = { name: cleanName, targetAmount: target, emoji: selectedEmoji }

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
        setError("Couldn't save that. Check your connection and try again.")
        return
      }

      onClose()
    } catch {
      setSubmitting(false)
      setError("Something went wrong. Please try again.")
    }
  }, [name, targetAmount, selectedEmoji, sheetMode, goal, onCreate, onUpdate, onClose])

  // ── Animation variants (shared language with ExpenseSheet/IncomeSheet) ──
  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: timings.fast },
        exit: { opacity: 0, transition: timings.fast },
      }
    : {
        hidden: { y: "100%" },
        visible: { y: 0, transition: springs.gentle },
        exit: { y: "100%", transition: timings.normal },
      }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: timings.fast },
    exit: { opacity: 0, transition: timings.fast },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="goal-edit-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={submitting ? undefined : onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0, 0, 0, 0.6)",
            }}
          />

          {/* Sheet */}
          <motion.div
            key="goal-edit-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheetMode === "edit" ? "Edit goal" : "New goal"}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: "fixed",
              insetInline: 0,
              bottom: 0,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              maxHeight: "90vh",
              overflowY: "auto",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {/* Handle */}
            <div className="sheet-handle" />

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
                    borderRadius: 999,
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
                              background: "rgba(129, 140, 248, 0.08)",
                              border: "1.5px solid rgba(129, 140, 248, 0.4)",
                              boxShadow: "0 0 12px rgba(129, 140, 248, 0.15)",
                            }
                          : {
                              background: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid rgba(255, 255, 255, 0.06)",
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
                  fontFamily: "Inter, sans-serif",
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
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    outline: "none",
                    fontSize: 32,
                    fontWeight: 600,
                    fontFamily: "Inter, sans-serif",
                    color: "var(--text)",
                    padding: "4px 0 6px",
                    caretColor: "var(--text)",
                    minWidth: 0,
                  }}
                />
              </div>

              {/* ── Inline error (persistence failure / validation) ── */}
              {error && (
                <p role="alert" style={{ fontSize: 13, color: "var(--error)", marginBottom: 20, lineHeight: 1.5 }}>
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
                    ? "linear-gradient(135deg, rgba(129, 140, 248, 1) 0%, rgba(99, 102, 241, 1) 100%)"
                    : "var(--dim)",
                  color: canSubmit ? "#fff" : "var(--muted)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 17,
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? "0 4px 16px rgba(129, 140, 248, 0.3)" : "none",
                }}
              >
                {submitting ? "Saving…" : sheetMode === "edit" ? "Save goal" : "Create goal"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
