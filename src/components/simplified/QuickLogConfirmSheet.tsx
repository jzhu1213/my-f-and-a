"use client"

/**
 * QuickLogConfirmSheet — confirm-before-save UI for captures that arrive from
 * outside the app (OS share sheet or an assistant / shortcut deep link).
 *
 * Task 180.1 — "Capture from anywhere".
 *
 * Flow:
 *  1. An external entry point lands on the app with free text (see
 *     `lib/quickCapture.ts` + the `share_target`/`shortcuts` manifest entries).
 *  2. That text is run through the shared `naturalLogParser` (task 166.1) — the
 *     SAME parser the in-app quick-log input uses, so behaviour stays identical.
 *  3. On a confident parse we show this sheet pre-filled with the parsed values.
 *     Nothing is ever persisted automatically — the user must tap "Log it".
 *  4. If the parse is ambiguous we fall back to the normal ExpenseSheet via
 *     `onEditInSheet`, carrying over whatever partial values we did extract.
 *
 * This keeps external capture safe (no silent writes) and consistent with the
 * warm, shame-free tone of the rest of Folio.
 */

import { useMemo, useEffect, useCallback } from "react"
import type { TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { FundingSource } from "@/lib/fundingSources"
import type { CategorizationRule } from "@/lib/categorizationRules"
import { parseNaturalLog } from "@/lib/naturalLogParser"
import type { QuickCaptureSource } from "@/lib/quickCapture"
import { getCategoryEmoji } from "@/lib/vocabulary"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

export interface QuickLogConfirmData {
  amount: number
  category: TransactionCategory
  note?: string
  fundingSourceId?: string
}

export interface QuickLogConfirmSheetProps {
  /** Whether the sheet is visible. */
  isOpen: boolean
  /** Raw text captured from the external entry point (already normalized). */
  rawText: string
  /** Which surface the capture came from — tunes the copy. */
  source: QuickCaptureSource
  /** Funding sources for matching payment methods in the parsed text. */
  fundingSources?: FundingSource[]
  /** User-defined categorization rules applied during parsing. */
  categorizationRules?: CategorizationRule[]
  /** Called when the user explicitly confirms the parsed expense. */
  onConfirm: (data: QuickLogConfirmData) => void
  /**
   * Called when parsing is ambiguous, or when the user chooses to edit — the
   * parent should open the normal ExpenseSheet, optionally pre-filled with any
   * partial values we managed to extract.
   */
  onEditInSheet: (partial?: { amount?: number; note?: string }) => void
  /** Close the sheet without saving. */
  onClose: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function categoryLabel(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.label ?? category
}

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

// ============================================================================
// Component
// ============================================================================

export function QuickLogConfirmSheet({
  isOpen,
  rawText,
  source,
  fundingSources,
  categorizationRules,
  onConfirm,
  onEditInSheet,
  onClose,
}: QuickLogConfirmSheetProps) {
  // Parse the captured text with the SAME parser the in-app quick log uses.
  // Recomputed when the text or the reference data changes so a late-loading
  // funding-source list still gets a chance to match.
  const result = useMemo(
    () => parseNaturalLog(rawText, fundingSources, categorizationRules),
    [rawText, fundingSources, categorizationRules]
  )

  // Ambiguous parse → hand off to the full ExpenseSheet with any partial values.
  // Done in an effect (not during render) so we don't setState-in-render.
  useEffect(() => {
    if (!isOpen) return
    if (result.status === "ambiguous") {
      onEditInSheet({
        amount: result.partial?.amount,
        note: result.partial?.note,
      })
    }
  }, [isOpen, result, onEditInSheet])

  const handleConfirm = useCallback(() => {
    if (result.status !== "success") return
    const { parsed } = result
    onConfirm({
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note || undefined,
      fundingSourceId: parsed.fundingSourceId,
    })
  }, [result, onConfirm])

  const handleEdit = useCallback(() => {
    if (result.status === "success") {
      onEditInSheet({ amount: result.parsed.amount, note: result.parsed.note })
    } else {
      onEditInSheet()
    }
  }, [result, onEditInSheet])

  // Only render the confirmation chrome for a confident parse. Ambiguous parses
  // are handed off above and never show this sheet.
  if (result.status !== "success") return null

  const { parsed } = result
  const fundingSource = parsed.fundingSourceId
    ? fundingSources?.find(s => s.id === parsed.fundingSourceId)
    : undefined

  const headline =
    source === "share" ? "Log this from what you shared?" : "Quick log — look right?"

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} ariaLabel="Confirm quick log">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: HORIZONTAL_PADDING,
          padding: "8px 20px 20px",
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Heading — warm, non-committal: we always confirm before saving */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2
            style={{
              margin: 0,
              fontSize: typography.subhead.fontSize,
              fontWeight: fontWeights.semibold,
              color: "var(--text)",
            }}
          >
            {headline}
          </h2>
          <p style={{ margin: 0, fontSize: typography['body-sm'].fontSize, color: "var(--sub)" }}>
            Nothing&apos;s saved yet — check it over first.
          </p>
        </div>

        {/* Parsed summary card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.md,
            padding: "16px 18px",
            background: "var(--accent-100)",
            border: "1px solid var(--accent-300)",
            borderRadius: radius.control,
          }}
        >
          <span style={{ fontSize: typography.title.fontSize, lineHeight: 1 }} aria-hidden="true">
            {getCategoryEmoji(parsed.category)}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span
              style={{
                fontSize: typography.headline.fontSize,
                fontWeight: fontWeights.bold,
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${formatAmount(parsed.amount)}
            </span>
            <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", fontWeight: fontWeights.medium }}>
              {categoryLabel(parsed.category)}
              {parsed.note ? ` · ${parsed.note}` : ""}
            </span>
            {fundingSource && (
              <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)" }}>
                {fundingSource.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions — explicit confirm required before anything is persisted */}
        <div style={{ display: "flex", gap: spacing.sm }}>
          <button
            type="button"
            onClick={handleEdit}
            style={{
              flex: 1,
              height: 48,
              background: "transparent",
              border: "1px solid var(--fill-12)",
              borderRadius: radius.control,
              color: "var(--sub)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
            }}
          >
            Edit details
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              flex: 2,
              height: 48,
              background: "var(--accent-300)",
              border: "1px solid var(--accent-400)",
              borderRadius: radius.control,
              color: "var(--text)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
            }}
            aria-label="Confirm and log this expense"
          >
            Log it ✓
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
