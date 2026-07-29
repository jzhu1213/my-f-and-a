"use client"

import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import type { NetObligations } from "@/lib/obligationsUtils"

// ============================================================================
// Types
// ============================================================================

export interface ObligationsSummaryProps {
  obligations: NetObligations
}

// ============================================================================
// ObligationsSummary Component
// ============================================================================

/**
 * A compact summary card showing net obligations: "You owe" and "You're owed".
 * Only renders if there's at least one non-zero value.
 * Designed to sit in the ToolsScreen progressive-disclosure area.
 */
export function ObligationsSummary({ obligations }: ObligationsSummaryProps) {
  const { youOwe, youreOwed } = obligations

  // Don't render if nothing meaningful to show
  if (youOwe === 0 && youreOwed === 0) return null

  return (
    <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: 16 }}>
      <p
        style={{
          fontSize: 11,
          color: "var(--sub)",
          marginBottom: 10,
          fontFamily: FONT_FAMILY,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Net Obligations
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        {youOwe > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }} aria-hidden="true">📤</span>
              <div>
                <p style={{ fontSize: 11, color: "var(--sub)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
                  You owe
                </p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }} aria-hidden="true">📥</span>
              <div>
                <p style={{ fontSize: 11, color: "var(--sub)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
                  You&apos;re owed
                </p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
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
