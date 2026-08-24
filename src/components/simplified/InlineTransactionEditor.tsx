"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import type { Transaction, TransactionCategory } from "@/types"
import { CategoryIcon } from "@/components/ui/CategoryIcon"
import { fills, colorRamp } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { TagInput } from "./TagInput"
import { getTagsForTransaction } from "@/lib/tagUtils"
import { ReceiptAttachment } from "./ReceiptAttachment"
import { spacing, typography, fontWeights } from '@/styles/typography'

// ============================================================================
// InlineTransactionEditor
// ============================================================================

export interface InlineTransactionEditorProps {
  /** The transaction being edited */
  transaction: Transaction
  /** Called with the updated fields */
  onSave: (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string; tags?: string[] }
  ) => Promise<Transaction | null>
  /** Called when user cancels or finishes editing */
  onClose: () => void
}

const CATEGORY_OPTIONS: { category: TransactionCategory; label: string }[] = [
  { category: "food", label: "Food" },
  { category: "transport", label: "Transport" },
  { category: "fun", label: "Fun" },
  { category: "school", label: "School" },
  { category: "rent", label: "Rent" },
  { category: "other", label: "Other" },
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
  const [tags, setTags] = useState<string[]>(transaction.tags ?? getTagsForTransaction(transaction.id) ?? [])
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
    setTags(transaction.tags ?? getTagsForTransaction(transaction.id) ?? [])
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
      tags: tags.length > 0 ? tags : undefined,
    })
    setIsSaving(false)
    onClose()
  }, [amount, category, note, tags, isSaving, transaction.id, onSave, onClose])

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
            background: colorRamp.accent[50],
            borderTop: `1px solid ${colorRamp.accent[200]}`,
            borderBottom: `1px solid ${colorRamp.accent[200]}`,
          }}
        >
          {/* Amount row */}
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, marginBottom: 10 }}>
            <span
              style={{
                fontSize: typography.subhead.fontSize,
                fontFamily: "Inter, sans-serif",
                fontWeight: fontWeights.light,
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
                fontSize: typography.headline.fontSize,
                fontFamily: "Inter, sans-serif",
                fontWeight: fontWeights.semibold,
                color: "var(--text)",
                width: "100%",
                maxWidth: 140,
                caretColor: "var(--text)",
                padding: "4px 0",
              }}
            />
          </div>

          {/* Category selector row (only for expenses) */}
          {transaction.type === "expense" && (
            <div
              style={{
                display: "flex",
                gap: spacing.xs,
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
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.control,
                      border: selected
                        ? `1.5px solid ${colorRamp.accent[400]}`
                        : `1px solid ${fills[8]}`,
                      background: selected
                        ? colorRamp.accent[200]
                        : "transparent",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.12s ease",
                    }}
                  >
                    <CategoryIcon
                      category={cat.category}
                      size={28}
                      iconSize={14}
                    />
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
                fontSize: typography['body-sm'].fontSize,
                fontFamily: "Inter, sans-serif",
                color: "var(--text)",
                padding: "6px 0",
                caretColor: "var(--text)",
              }}
            />
          </div>

          {/* Tags (optional, task 130.1) */}
          <div style={{ marginBottom: 10 }}>
            <TagInput
              tags={tags}
              onChange={setTags}
              collapsible
            />
          </div>

          {/* Receipt (optional, task 130.2) */}
          <div style={{ marginBottom: 10 }}>
            <ReceiptAttachment
              transactionId={transaction.id}
              receiptUrl={transaction.receiptUrl}
              compact
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: spacing.xs }}>
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
                  ? "var(--gradient-action)"
                  : "var(--dim)",
                color: canSubmit ? "var(--color-canvas)" : "var(--muted)",
                fontFamily: "Inter, sans-serif",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                borderRadius: radius.control,
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
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                borderRadius: radius.control,
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
