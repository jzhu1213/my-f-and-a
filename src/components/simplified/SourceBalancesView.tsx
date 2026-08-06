"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/Card"
import { Icon } from "@/components/ui/Icon"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeader, borderRadius } from "@/styles/shared"
import { computeSourceBalances } from "@/lib/sourceBalances"
import type { FundingSource } from "@/lib/fundingSources"
import type { Transaction } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface SourceBalancesViewProps {
  fundingSources: FundingSource[]
  transactions: Transaction[]
}

// ============================================================================
// SourceBalancesView Component
// ============================================================================

/**
 * SourceBalancesView — a compact, glanceable "Where my money is" grid.
 *
 * Displays a 2-column grid of Card surfaces showing each funding source's
 * computed balance. Lives in the Tools screen under progressive disclosure.
 * Hides entirely if no sources have any meaningful balance data.
 *
 * Uses Tier 3 `Card` for individual balance items (list-level density) and
 * the `sectionHeader` token for the heading.
 */
export function SourceBalancesView({
  fundingSources,
  transactions,
}: SourceBalancesViewProps) {
  const balances = useMemo(
    () => computeSourceBalances(fundingSources, transactions),
    [fundingSources, transactions]
  )

  // Hide entirely if no sources have any balance info
  const hasAnyBalance = useMemo(() => {
    for (const balance of balances.values()) {
      if (
        balance.snapshotBalance !== 0 ||
        balance.totalInflows !== 0 ||
        balance.totalOutflows !== 0
      ) {
        return true
      }
    }
    return false
  }, [balances])

  if (!hasAnyBalance || balances.size === 0) return null

  const balanceEntries = Array.from(balances.values())

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section heading — using shared sectionHeader token */}
      <p style={{ ...sectionHeader, marginBottom: 10 }}>
        Where my money is
      </p>

      {/* 2-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {balanceEntries.map((balance) => (
          <Card
            key={balance.sourceId}
            padding="12px 14px"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Icon chip replacing emoji */}
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: borderRadius.sm,
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                }}
              >
                <Icon name="category:fallback" size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {balance.label}
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: FONT_FAMILY,
                    fontVariantNumeric: "tabular-nums",
                    color:
                      balance.computedBalance < 0
                        ? "var(--error)"
                        : "var(--text)",
                  }}
                >
                  {formatCompactCurrency(balance.computedBalance)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a number as compact currency (no cents for whole numbers, 2 decimals otherwise).
 */
function formatCompactCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  const sign = amount < 0 ? "-" : ""
  const formatted =
    absAmount % 1 === 0
      ? absAmount.toLocaleString("en-US")
      : absAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
  return `${sign}$${formatted}`
}
