"use client"

/**
 * SettingsRow
 *
 * A reusable settings row component that enforces consistent layout:
 * label + optional description on the left, action (toggle/button) on the right.
 *
 * Provides uniform padding, the faint row separator (task 237.2), and proper
 * flex spacing. Pairs naturally with SettingsToggle.
 *
 * Phase 6 — task 267.1: extracted from the repeated row pattern in SettingsScreen.
 */

import type { CSSProperties, ReactNode } from "react"
import { FONT_FAMILY, pxToRem } from "@/styles/typography"

export interface SettingsRowProps {
  /** Primary label text */
  label: string | ReactNode
  /** Optional secondary description below the label */
  description?: string | ReactNode
  /** Right-side action element (toggle, button, etc.) */
  action?: ReactNode
  /** Whether to show the bottom separator (default: true) */
  separator?: boolean
  /** Optional inline style override for the outer container */
  style?: CSSProperties
}

export function SettingsRow({
  label,
  description,
  action,
  separator = true,
  style,
}: SettingsRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: separator
          ? "1px solid rgba(255, 255, 255, 0.06)"
          : "none",
        ...style,
      }}
    >
      <div style={{ flex: 1, marginRight: action ? 12 : 0 }}>
        {typeof label === "string" ? (
          <span
            style={{
              fontSize: pxToRem(14),
              color: "var(--text)",
              display: "block",
              fontFamily: FONT_FAMILY,
            }}
          >
            {label}
          </span>
        ) : (
          label
        )}
        {description && (
          typeof description === "string" ? (
            <span
              style={{
                fontSize: pxToRem(12),
                color: "var(--sub)",
                lineHeight: 1.4,
                marginTop: 2,
                display: "block",
                fontFamily: FONT_FAMILY,
              }}
            >
              {description}
            </span>
          ) : (
            description
          )
        )}
      </div>
      {action && action}
    </div>
  )
}
