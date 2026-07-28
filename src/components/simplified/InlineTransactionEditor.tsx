"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import type { Transaction, TransactionCategory } from "@/types"
import { getCategoryEmoji } from "@/lib/vocabulary"

// ============================================================================
// InlineTransactionEditor
// ============================================================================

export interface InlineTransactionEditorProps {
  /** The transaction being edited */
  transaction: Transaction
  /** Called with the updated fields */
  onSave: (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string }
  ) => Promise<Transaction | null>
  /** Called when user cancels or finishes editing */
  onClose: () => void
}

const CATEGORY_OPTIONS: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: "food", emoji: getCategoryEmoji("food"), label: "Food" },
  { category: "transport", emoji: getCategoryEmoji("transport"), label: "Transport" },
  { category: "fun", emoji: getCategoryEmoji("fun"), label: "Fun" },
  { category: "school", emoji: getCategoryEmoji("school"), label: "School" },
  { category: "rent", emoji: getCategoryEmoji("rent"), label: "Rent" },
  { category: "other", emoji: getCategoryEmoji("other"), label: "Other" },
]

const MAX_AMOUNT = 99999

/**
 * InlineTransactionEditor — a compact, inline editor that expands within
 * the transaction list. Shows amount input, category emoji buttons, optional
 * note, and a save button. No full-screen overlay — feels as fast as logging.
 *
 * Requirements: fast, forgiving corrections
 */
export function InlineTransactionEditor({
  transaction,
  onSave,
  onClose,
}: InlineTransactionEditorProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<TransactionCategory>(transaction.category)
  const [note, setNote] = useState(transaction.note ?? "")
  const [isSaving, setIsSaving] = useState(false)

  // Populate with transaction values
  useEffect(() => {
    setAmount(
      transaction.amount % 1 === 0
        ? String(transaction.amount)
        : transaction.amount.toFixed(2)
    )
    setCategory(transaction.category)
    setNote(transaction.note ?? "")
    // Auto-focus amount input after a brief delay for animation
    setTimeout(() => amountRef.current?.focus(), 100)
  }, [transaction])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parts = raw.split(".")
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > MAX_AMOUNT) return
    setAmount(raw)
  }, [])

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;/gi, " ")
      .slice(0, 60)
    setNote(sanitized)
  }, [])

  const handleSave = useCallback(async () => {
    if (isSaving) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > MAX_AMOUNT) return

    setIsSaving(true)
    await onSave(transaction.id, {
      amount: parsed,
      category,
      note: note.trim() || undefined,
    })
    setIsSaving(false)
    onClose()
  }, [amount, category, note, isSaving, transaction.id, onSave, onClose])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT && !isSaving
  })()

  const animationVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: timings.fast },
        exit: { opacity: 0, transition: timings.fast },
      }
    : {
        hidden: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
        visible: {
          opacity: 1,
          height: "auto",
          marginTop: 0,
          marginBottom: 0,
          transition: { opacity: timings.fast, height: springs.snappy },
        },
        exit: {
          opacity: 0,
          height: 0,
          marginTop: 0,
          marginBottom: 0,
          transition: { opacity: timings.fast, height: timings.normal },
        },
      }

  return (
    <AnimatePresence>
      <motion.div
        key={`inline-editor-${transaction.id}`}
        variants={animationVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ overflow: "hidden" }}
      >
        <div
          role="form"
          aria-label="Quick edit transaction"
          style={{
            padding: "12px 16px",
            background: "rgba(129, 140, 248, 0.04)",
            borderTop: "1px solid rgba(129, 140, 248, 0.15)",
            borderBottom: "1px solid rgba(129, 140, 248, 0.15)",
          }}
        >
          {/* Amount row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                fontSize: 18,
                fontFamily: "Inter, sans-serif",
                fontWeight: 300,
                color: transaction.type === "income" ? "var(--success)" : "var(--sub)",
              }}
            >
              $
            </span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault()
                  handleSave()
                }
                if (e.key === "Escape") {
                  onClose()
                }
              }}
              aria-label="Edit amount"
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--line)",
                outline: "none",
                fontSize: 24,
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                color: "var(--text)",
                width: "100%",
                maxWidth: 140,
                caretColor: "var(--text)",
                padding: "4px 0",
              }}
            />
          </div>

          {/* Category emoji row (only for expenses) */}
          {transaction.type === "expense" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
              role="group"
              aria-label="Category"
            >
              {CATEGORY_OPTIONS.map((cat) => {
                const selected = category === cat.category
                return (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setCategory(cat.category)}
                    aria-label={cat.label}
                    aria-pressed={selected}
                    style={{
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      border: selected
                        ? "1.5px solid rgba(129, 140, 248, 0.5)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: selected
                        ? "rgba(129, 140, 248, 0.12)"
                        : "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      transition: "all 0.12s ease",
                    }}
                  >
                    {cat.emoji}
                  </button>
                )
              })}
            </div>
          )}

          {/* Note input */}
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={handleNoteChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault()
                  handleSave()
                }
                if (e.key === "Escape") {
                  onClose()
                }
              }}
              maxLength={60}
              aria-label="Edit note"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--line)",
                outline: "none",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                color: "var(--text)",
                padding: "6px 0",
                caretColor: "var(--text)",
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit}
              aria-label="Save changes"
              style={{
                flex: 1,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: canSubmit
                  ? "linear-gradient(135deg, #a78bfa, #7c3aed)"
                  : "var(--dim)",
                color: canSubmit ? "#fff" : "var(--muted)",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel editing"
              style={{
                height: 36,
                padding: "0 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--sub)",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 10,
                border: "1px solid var(--line)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
