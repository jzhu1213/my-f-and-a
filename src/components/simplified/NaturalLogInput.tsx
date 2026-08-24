"use client"

/**
 * NaturalLogInput — free-text quick log with confirm-before-save.
 *
 * Provides a text input where users can type natural phrases like
 * "5 coffee", "20 groceries venmo", "$12.50 lunch" and get a parsed
 * preview before confirming. Falls back to the normal ExpenseSheet
 * if parsing is ambiguous.
 *
 * Task 166.1
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { TransactionCategory } from "@/types"
import type { QuickTransaction } from "@/types/folio"
import type { FundingSource } from "@/lib/fundingSources"
import type { CategorizationRule } from "@/lib/categorizationRules"
import { parseNaturalLog } from "@/lib/naturalLogParser"
import type { ParseResult } from "@/lib/naturalLogParser"
import { getCategoryEmoji } from "@/lib/vocabulary"
import { BUDGET_CATEGORIES } from "@/types"
import { springs } from "@/lib/animations"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

export interface NaturalLogInputProps {
  /** Available funding sources for matching in parsed input */
  fundingSources?: FundingSource[]
  /** User-defined categorization rules */
  categorizationRules?: CategorizationRule[]
  /** Callback when a parsed expense is confirmed */
  onLogExpense: (transaction: QuickTransaction) => void
  /** Callback when parsing is ambiguous — open the full expense sheet */
  onFallbackToSheet?: (partial?: { amount?: number; note?: string }) => void
}

// ============================================================================
// Helpers
// ============================================================================

function categoryLabel(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.label ?? category
}

// ============================================================================
// Component
// ============================================================================

export function NaturalLogInput({
  fundingSources,
  categorizationRules,
  onLogExpense,
  onFallbackToSheet,
}: NaturalLogInputProps) {
  const [input, setInput] = useState("")
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { prefersReducedMotion } = useReducedMotion()

  // Debounced parsing — parse as user types
  useEffect(() => {
    if (!input.trim()) {
      setParseResult(null)
      setIsConfirming(false)
      return
    }

    // Small delay so we don't parse on every keystroke
    const timer = setTimeout(() => {
      const result = parseNaturalLog(input, fundingSources, categorizationRules)
      setParseResult(result)
    }, 150)

    return () => clearTimeout(timer)
  }, [input, fundingSources, categorizationRules])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim()) return

      const result = parseNaturalLog(input, fundingSources, categorizationRules)

      if (result.status === "success") {
        // Show confirmation state
        setParseResult(result)
        setIsConfirming(true)
      } else {
        // Ambiguous — fall back to the normal sheet
        if (onFallbackToSheet) {
          onFallbackToSheet({
            amount: result.partial?.amount,
            note: result.partial?.note,
          })
        }
        setInput("")
        setParseResult(null)
      }
    },
    [input, fundingSources, categorizationRules, onFallbackToSheet]
  )

  const handleConfirm = useCallback(() => {
    if (parseResult?.status !== "success") return

    const { parsed } = parseResult
    const transaction: QuickTransaction = {
      category: parsed.category,
      amount: parsed.amount,
      note: parsed.note || undefined,
    }
    onLogExpense(transaction)

    // Reset state
    setInput("")
    setParseResult(null)
    setIsConfirming(false)
  }, [parseResult, onLogExpense])

  const handleCancel = useCallback(() => {
    setIsConfirming(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isConfirming) {
          setIsConfirming(false)
        } else {
          setInput("")
          setParseResult(null)
        }
      }
    },
    [isConfirming]
  )

  // Determine if we should show the inline preview
  const showPreview = parseResult?.status === "success" && input.trim().length > 0
  const showAmbiguous =
    parseResult?.status === "ambiguous" &&
    input.trim().length > 2 &&
    parseResult.reason !== "Empty input"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      {/* Input bar */}
      <form onSubmit={handleSubmit} style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            background: "var(--fill-04)",
            border: "1px solid var(--fill-10)",
            borderRadius: radius.full,
            padding: "0 16px",
            transition: "border-color 0.2s",
            ...(input.trim().length > 0
              ? { borderColor: "var(--accent-400)" }
              : {}),
          }}
        >
          <span
            style={{ fontSize: typography.body.fontSize, opacity: 0.6 }}
            aria-hidden="true"
          >
            ⚡
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Quick log — try "5 coffee" or "uber 8"'
            aria-label="Natural language expense input"
            aria-describedby={
              showPreview
                ? "nl-preview"
                : showAmbiguous
                  ? "nl-ambiguous"
                  : undefined
            }
            style={{
              flex: 1,
              height: 48,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.regular,
              fontFamily: FONT_FAMILY,
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {input.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setInput("")
                setParseResult(null)
                setIsConfirming(false)
                inputRef.current?.focus()
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontSize: typography.body.fontSize,
                cursor: "pointer",
                padding: 4,
                lineHeight: 1,
              }}
              aria-label="Clear input"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* Parsed preview / confirmation */}
      <AnimatePresence mode="wait">
        {isConfirming && parseResult?.status === "success" && (
          <motion.div
            key="confirm"
            id="nl-preview"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={springs.snappy}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
              padding: "12px 16px",
              background: "var(--accent-100)",
              border: "1px solid var(--accent-300)",
              borderRadius: radius.control,
            }}
            role="status"
            aria-live="polite"
          >
            {/* Parsed summary */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">
                {getCategoryEmoji(parseResult.parsed.category)}
              </span>
              <span
                style={{
                  fontSize: typography.subhead.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: "var(--text)",
                  fontFamily: FONT_FAMILY,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${parseResult.parsed.amount % 1 === 0
                  ? parseResult.parsed.amount
                  : parseResult.parsed.amount.toFixed(2)}
              </span>
              <span
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--sub)",
                  fontWeight: fontWeights.medium,
                }}
              >
                {categoryLabel(parseResult.parsed.category)}
              </span>
              {parseResult.parsed.note && (
                <span
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    color: "var(--muted)",
                    fontStyle: "italic",
                  }}
                >
                  {parseResult.parsed.note}
                </span>
              )}
            </div>

            {/* Confirm / Cancel buttons */}
            <div style={{ display: "flex", gap: spacing.xs }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  flex: 1,
                  height: 40,
                  background: "transparent",
                  border: "1px solid var(--fill-12)",
                  borderRadius: radius.control,
                  color: "var(--sub)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  flex: 2,
                  height: 40,
                  background: "var(--accent-300)",
                  border: "1px solid var(--accent-400)",
                  borderRadius: radius.control,
                  color: "var(--text)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.semibold,
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                }}
                aria-label="Confirm and log expense"
              >
                Log it ✓
              </button>
            </div>
          </motion.div>
        )}

        {showPreview && !isConfirming && (
          <motion.div
            key="preview"
            id="nl-preview"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={springs.snappy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
              padding: "8px 14px",
              background: "var(--fill-03)",
              borderRadius: radius.control,
              fontSize: typography['body-sm'].fontSize,
              color: "var(--sub)",
            }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">
              {getCategoryEmoji(parseResult.parsed.category)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: fontWeights.medium }}>
              ${parseResult.parsed.amount % 1 === 0
                ? parseResult.parsed.amount
                : parseResult.parsed.amount.toFixed(2)}
            </span>
            <span style={{ color: "var(--muted)" }}>
              {categoryLabel(parseResult.parsed.category)}
            </span>
            {parseResult.parsed.note && (
              <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                · {parseResult.parsed.note}
              </span>
            )}
            <span
              style={{
                marginInlineStart:  "auto",
                fontSize: typography.caption.fontSize,
                color: "var(--muted)",
                opacity: 0.7,
              }}
            >
              ↵ to confirm
            </span>
          </motion.div>
        )}

        {showAmbiguous && !isConfirming && (
          <motion.div
            key="ambiguous"
            id="nl-ambiguous"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={springs.snappy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
              padding: "8px 14px",
              background: "var(--warning-100)",
              borderRadius: radius.control,
              fontSize: typography['body-sm'].fontSize,
              color: "var(--muted)",
            }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">💡</span>
            <span>{parseResult.reason}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
