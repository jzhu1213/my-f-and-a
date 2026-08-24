"use client"

import { useMemo } from "react"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  computeCombinedSavingsInputs,
  computeCombinedProjectionHorizons,
} from "@/lib/savingsAccountUtils"
import type { SavingsAccount } from "@/types/folio"
import { HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { formatCurrency as formatCurrencyCentral } from "@/lib/currencyUtils"

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
  return formatCurrencyCentral(amount, 'USD', { fractionDigits: 0 })
}

function formatFull(amount: number): string {
  return formatCurrencyCentral(amount, 'USD', { fractionDigits: 0 })
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

  // Accessible text summary for screen readers
  const summaryText = `Combined growth outlook across ${accounts.length} account${accounts.length > 1 ? 's' : ''}: ` +
    `total balance ${formatFull(inputs.totalBalance)}, ` +
    `contributing ${formatFull(inputs.totalMonthlyContribution)} per month, ` +
    `blended return ${blendedReturnPct}% per year. ` +
    horizons.map(h => `${h.years} year${h.years === 1 ? '' : 's'}: ${formatFull(h.amount)}`).join(', ') + '.'

  return (
    <GlassCard
      elevation="medium"
      glow="celebration"
      style={{ padding: "18px 18px 16px", marginBottom: HORIZONTAL_PADDING }}
      aria-label="Combined growth outlook"
      aria-describedby="combined-growth-summary"
    >
      {/* Screen reader text summary */}
      <span id="combined-growth-summary" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
        {summaryText}
      </span>
      {/* Section label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        }}
      >
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.semibold,
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
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.medium,
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
          gap: spacing.xs,
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
              borderRadius: radius.control,
              background: "var(--fill-04)",
            }}
          >
            <p
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: fontWeights.medium,
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
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.bold,
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
            fontSize: typography['body-sm'].fontSize,
            color: "var(--sub)",
            fontFamily: FONT_FAMILY,
            lineHeight: 1.45,
          }}
        >
          Together you&apos;re adding{" "}
          <span style={{ color: "var(--text)", fontWeight: fontWeights.medium }}>
            {formatFull(inputs.totalMonthlyContribution)}/mo
          </span>{" "}
          across every account — on this path that&apos;s about{" "}
          <span style={{ color: "var(--success)", fontWeight: fontWeights.semibold }}>
            {formatCurrency(tenYear)}
          </span>{" "}
          in 10 years. Every bit adds up.
        </p>
      )}
    </GlassCard>
  )
}
