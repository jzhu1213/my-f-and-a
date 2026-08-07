"use client"

/**
 * TransactionRow — Composed component
 *
 * A list row (using the ListRow primitive) with:
 * - Category icon on the leading edge
 * - Note text (single line, trailing ellipsis when exceeding width)
 * - Amount on the trailing edge, aligned with tabular-nums
 *
 * Requirements: 16.1, 14.2
 */

import React from "react"
import { ListRow } from "@/components/ui/primitives/ListRow"
import { Icon } from "@/components/ui/Icon"
import { getCategoryIconName } from "@/lib/icons"
import { textColors, colorRamp } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"
import { typography, FONT_FAMILY, TABULAR_NUMS } from "@/styles/typography"
import { radius } from "@/styles/surfaces"
import type { TransactionCategory } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface TransactionRowProps {
  /** Transaction category for the icon. */
  category: TransactionCategory | string
  /** Transaction note/description. */
  note: string
  /** Transaction amount (positive = expense, negative = income). */
  amount: number
  /** Called when the row is tapped. */
  onPress?: () => void
  /** Whether to render as swipeable. */
  swipeable?: boolean
  /** Content revealed on swipe (edit/delete actions). */
  revealContent?: React.ReactNode
  /** Called when swipe reveals actions. */
  onReveal?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function formatTransactionAmount(amount: number): string {
  const prefix = amount >= 0 ? "-$" : "+$"
  const absValue = Math.abs(amount)
  return `${prefix}${absValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getAmountColor(amount: number): string {
  return amount < 0 ? colorRamp.success[500] : textColors.text
}

// ============================================================================
// Component
// ============================================================================

export function TransactionRow({
  category,
  note,
  amount,
  onPress,
  swipeable = false,
  revealContent,
  onReveal,
}: TransactionRowProps) {
  const iconName = getCategoryIconName(category)

  const iconContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: radius.control,
    background: colorRamp.accent[100],
    color: colorRamp.accent[500],
    flexShrink: 0,
  }

  const noteStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
    color: textColors.text,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }

  const amountStyle: React.CSSProperties = {
    ...TABULAR_NUMS,
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    lineHeight: typography.body.lineHeight,
    color: getAmountColor(amount),
    flexShrink: 0,
    textAlign: "right",
  }

  return (
    <ListRow
      variant={swipeable ? "swipeable" : "default"}
      onPress={onPress}
      revealContent={revealContent}
      onReveal={onReveal}
      style={{ gap: spacingScale["12"] }}
    >
      {/* Leading: category icon */}
      <div style={iconContainerStyle}>
        <Icon name={iconName} size={18} />
      </div>

      {/* Middle: note (ellipsis) */}
      <span style={noteStyle}>{note}</span>

      {/* Trailing: amount (tabular-nums aligned) */}
      <span style={amountStyle}>{formatTransactionAmount(amount)}</span>
    </ListRow>
  )
}
