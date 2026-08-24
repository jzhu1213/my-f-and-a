"use client"

/**
 * FocusTrapContainer — wrapper that applies focus trapping to plain-div
 * full-screen overlays that don't use DepthSurfaceTransition.
 *
 * Provides:
 * - Focus trap (Tab/Shift+Tab cycles within)
 * - Focus restoration on unmount
 * - Auto-focus first focusable element on mount
 * - role="dialog" + aria-modal for accessibility
 *
 * Usage:
 *   <FocusTrapContainer aria-label="Budget Settings">
 *     <BudgetSettings ... />
 *   </FocusTrapContainer>
 *
 * Requirements: 511.1 (focus trap for plain-div overlays)
 */

import { type ReactNode } from "react"
import { useFocusTrap } from "@/hooks/useFocusTrap"

export interface FocusTrapContainerProps {
  children: ReactNode
  /** Accessible label for the dialog container. */
  "aria-label"?: string
  /** Additional className (optional). */
  className?: string
  /** Inline styles for the container (optional). */
  style?: React.CSSProperties
}

export function FocusTrapContainer({
  children,
  "aria-label": ariaLabel,
  className,
  style,
}: FocusTrapContainerProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true)

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}
