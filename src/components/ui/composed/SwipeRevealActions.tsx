"use client"

/**
 * SwipeRevealActions — Pre-built reveal panel for swipeable list rows.
 *
 * Provides edit and delete action buttons behind the row content,
 * revealed when the user drags a swipeable ListRow horizontally.
 *
 * - Edit: accent-tinted icon button, activates inline edit expansion
 * - Delete: error-tinted icon button, triggers removal with undo affordance
 *
 * Keyboard accessible: both actions are focusable when revealed (Req 7.7).
 *
 * Requirements: 14.5, 14.6, 14.11
 */

import React from "react"
import { Icon } from "@/components/ui/Icon"
import { colorRamp, textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"
import { radius } from "@/styles/surfaces"

// ============================================================================
// Types
// ============================================================================

export interface SwipeRevealActionsProps {
  /** Called when user activates edit. */
  onEdit?: () => void
  /** Called when user activates delete. */
  onDelete?: () => void
  /** Whether the row is in the revealed state (affects tabIndex). */
  revealed?: boolean
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacingScale["8"],
}

const buttonBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  borderRadius: radius.control,
  border: "none",
  cursor: "pointer",
  transition: "opacity 0.15s ease-out",
}

// ============================================================================
// Component
// ============================================================================

export function SwipeRevealActions({
  onEdit,
  onDelete,
  revealed = false,
}: SwipeRevealActionsProps) {
  return (
    <div style={containerStyle}>
      {/* Edit button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit?.()
        }}
        aria-label="Edit transaction"
        tabIndex={revealed ? 0 : -1}
        className="focus-ring"
        style={{
          ...buttonBase,
          background: colorRamp.accent[200],
          color: colorRamp.accent[700],
        }}
      >
        <Icon name="action:edit" size={18} />
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
        }}
        aria-label="Delete transaction"
        tabIndex={revealed ? 0 : -1}
        className="focus-ring"
        style={{
          ...buttonBase,
          background: colorRamp.error[200],
          color: colorRamp.error[700],
        }}
      >
        <Icon name="action:delete" size={18} />
      </button>
    </div>
  )
}
