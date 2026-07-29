"use client"

import { useMemo } from "react"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
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
 * Displays a 2-column grid of GlassCards showing each funding source's
 * computed balance. Lives in the Tools screen under progressive disclosure.
 * Hides entirely if no sources have any meaningful balance data.
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
    <div style={{ marginBottom: 20 }}>
      {/* Section heading */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--sub)",
          fontFamily: FONT_FAMILY,
          marginBottom: 10,
        }}
      >
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
          <GlassCard
            key={balance.sourceId}
            elevation="low"
            style={{ padding: "12px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">
                {balance.emoji}
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
          </GlassCard>
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
