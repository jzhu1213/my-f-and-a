"use client"

import { FONT_FAMILY } from "@/styles/typography"
import type { PeriodContext } from "@/lib/budgetPeriod"

// ============================================================================
// Props
// ============================================================================

export interface PeriodContextIndicatorProps {
  /** Computed period context from budgetPeriod utilities */
  periodContext: PeriodContext
}

// ============================================================================
// Component
// ============================================================================

/**
 * PeriodContextIndicator — a tiny, informational label below the hero that
 * shows the user's current position within their budget period.
 *
 * Examples:
 * - "Week 2 of 4"
 * - "Day 8 of 14"
 * - "3 weeks left in term"
 *
 * Design: subtle, not blocking, purely awareness. Matches the existing
 * hero secondary element pattern (12px, centered, muted color).
 *
 * **Validates: Requirements 18.5**
 */
export function PeriodContextIndicator({ periodContext }: PeriodContextIndicatorProps) {
  return (
    <div
      role="status"
      aria-label={`Budget period: ${periodContext.label}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 8,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {periodContext.label}
      </span>
    </div>
  )
}
