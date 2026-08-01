"use client"

import { useMemo } from "react"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  computeCombinedSavingsInputs,
  computeCombinedProjectionHorizons,
} from "@/lib/savingsAccountUtils"
import type { SavingsAccount } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface CombinedGrowthOutlookProps {
  accounts: SavingsAccount[]
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 10_000) {
    return `$${Math.round(amount / 1000)}k`
  }
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function formatFull(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

// ============================================================================
// CombinedGrowthOutlook Component (153.1)
// ============================================================================

/**
 * CombinedGrowthOutlook — a single growth outlook that aggregates every
 * savings & investment account into one trajectory.
 *
 * Sums balances and monthly contributions, blends the expected return, and
 * projects the combined portfolio at 1 / 5 / 10 / 30-year horizons using the
 * shared compound-growth calculator. Shown as a header section above the
 * per-account cards so the whole picture reads first.
 */
export function CombinedGrowthOutlook({ accounts }: CombinedGrowthOutlookProps) {
  const inputs = useMemo(
    () => computeCombinedSavingsInputs(accounts),
    [accounts]
  )

  const horizons = useMemo(
    () => computeCombinedProjectionHorizons(accounts),
    [accounts]
  )

  // Nothing to project without balances or contributions.
  if (
    accounts.length === 0 ||
    (inputs.totalBalance <= 0 && inputs.totalMonthlyContribution <= 0)
  ) {
    return null
  }

  const blendedReturnPct = (inputs.weightedAnnualReturn * 100).toFixed(1)
  const tenYear = horizons.find((h) => h.years === 10)?.amount ?? 0
  const hasContributions = inputs.totalMonthlyContribution > 0

  return (
    <GlassCard
      elevation="medium"
      glow="celebration"
      style={{ padding: "18px 18px 16px", marginBottom: 20 }}
    >
      {/* Section label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--sub)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: FONT_FAMILY,
          }}
        >
          Combined growth outlook
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--muted)",
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={`Blended expected return ${blendedReturnPct} percent per year`}
        >
          ~{blendedReturnPct}%/yr blended
        </span>
      </div>

      {/* Combined projection horizons */}
      <div
        role="list"
        aria-label="Combined projected balance across all accounts"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginBottom: hasContributions ? 14 : 0,
        }}
      >
        {horizons.map(({ years, amount }) => (
          <div
            key={years}
            role="listitem"
            aria-label={`In ${years} year${years === 1 ? "" : "s"}, about ${formatFull(amount)}`}
            style={{
              textAlign: "center",
              padding: "10px 4px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.04)",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
                marginBottom: 4,
                letterSpacing: "0.02em",
              }}
            >
              {years}yr
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--success)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrency(amount)}
            </p>
          </div>
        ))}
      </div>

      {/* Encouraging combined message */}
      {hasContributions && (
        <p
          style={{
            fontSize: 12,
            color: "var(--sub)",
            fontFamily: FONT_FAMILY,
            lineHeight: 1.45,
          }}
        >
          Together you&apos;re adding{" "}
          <span style={{ color: "var(--text)", fontWeight: 500 }}>
            {formatFull(inputs.totalMonthlyContribution)}/mo
          </span>{" "}
          across every account — on this path that&apos;s about{" "}
          <span style={{ color: "var(--success)", fontWeight: 600 }}>
            {formatCurrency(tenYear)}
          </span>{" "}
          in 10 years. Every bit adds up.
        </p>
      )}
    </GlassCard>
  )
}
