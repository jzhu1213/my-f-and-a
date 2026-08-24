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
import { typography, FONT_FAMILY, TABULAR_NUMS, fontWeights } from '@/styles/typography'
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
  /** Called when user swipes past 40% to delete (Req 14.11). */
  onDelete?: () => void
  /** Called when user activates edit action (Req 14.6). */
  onEdit?: () => void
  /** Whether the row is in inline-edit mode. */
  editing?: boolean
  /** Content shown when in inline-edit mode. */
  editContent?: React.ReactNode
  /**
   * Use compact vertical padding (8px) to meet the Timeline Surface
   * row height constraint of 56–72px with ≤8px vertical padding (Req 14.3).
   * Default row uses 12px vertical padding.
   */
  compact?: boolean
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
  onDelete,
  onEdit,
  editing = false,
  editContent,
  compact = false,
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
    fontWeight: fontWeights.semibold,
    lineHeight: typography.body.lineHeight,
    color: getAmountColor(amount),
    flexShrink: 0,
    textAlign: "end",
  }

  return (
    <ListRow
      variant={swipeable ? "swipeable" : "default"}
      onPress={onPress}
      revealContent={revealContent}
      onReveal={onReveal}
      onDelete={onDelete}
      onEdit={onEdit}
      editing={editing}
      editContent={editContent}
      style={{
        gap: spacingScale["12"],
        ...(compact ? { padding: `${spacingScale["8"]} ${spacingScale["16"]}`, minHeight: "56px" } : {}),
      }}
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
