"use client"

import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { sectionHeader } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import type { NetObligations } from "@/lib/obligationsUtils"

// ============================================================================
// Types
// ============================================================================

export interface ObligationsSummaryProps {
  obligations: NetObligations
}

// ============================================================================
// Helper: obligation icon chip
// ============================================================================

/**
 * Small tinted icon chip for obligation indicators. Uses warning/success tint
 * to visually distinguish "you owe" from "you're owed".
 */
function ObligationIconChip({
  variant,
}: {
  variant: "owe" | "owed"
}) {
  const color = variant === "owe" ? "var(--warning, var(--error))" : "var(--success)"
  const bgColor =
    variant === "owe"
      ? "color-mix(in srgb, var(--warning, var(--error)) 12%, transparent)"
      : "color-mix(in srgb, var(--success) 12%, transparent)"

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: radius.control,
        background: bgColor,
        color,
      }}
    >
      <Icon
        name={variant === "owe" ? "tool:debt" : "tool:reimbursements"}
        size={16}
      />
    </span>
  )
}

// ============================================================================
// ObligationsSummary Component
// ============================================================================

/**
 * A compact summary card showing net obligations: "You owe" and "You're owed".
 * Only renders if there's at least one non-zero value.
 * Designed to sit in the ToolsScreen progressive-disclosure area.
 *
 * Uses GlassCard (Tier 2) since it is a focal/summary widget, and the
 * sectionHeader token for the heading.
 */
export function ObligationsSummary({ obligations }: ObligationsSummaryProps) {
  const { youOwe, youreOwed } = obligations

  // Don't render if nothing meaningful to show
  if (youOwe === 0 && youreOwed === 0) return null

  return (
    <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: spacing.sm }}>
      <p style={{ ...sectionHeader, marginBottom: 10 }}>
        Net Obligations
      </p>
      <div style={{ display: "flex", gap: spacing.sm }}>
        {youOwe > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <ObligationIconChip variant="owe" />
              <div>
                <p style={{ fontSize: typography.caption.fontSize, color: "var(--sub)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
                  You owe
                </p>
                <p
                  style={{
                    fontSize: typography.subhead.fontSize,
                    fontWeight: fontWeights.bold,
                    color: "var(--warning, var(--error))",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  ${Math.round(youOwe).toLocaleString("en-US")}
                </p>
              </div>
            </div>
          </div>
        )}
        {youreOwed > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <ObligationIconChip variant="owed" />
              <div>
                <p style={{ fontSize: typography.caption.fontSize, color: "var(--sub)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
                  You&apos;re owed
                </p>
                <p
                  style={{
                    fontSize: typography.subhead.fontSize,
                    fontWeight: fontWeights.bold,
                    color: "var(--success)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  ${Math.round(youreOwed).toLocaleString("en-US")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
