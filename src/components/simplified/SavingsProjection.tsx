"use client"

import { useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, MONO_FAMILY } from '@/styles/typography'
import { computeProjectionHorizons } from '@/lib/compoundGrowthUtils'
import type { SavingsAccount } from '@/types/folio'

// ============================================================================
// Types
// ============================================================================

export interface SavingsProjectionProps {
  account: SavingsAccount
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
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// ============================================================================
// SavingsProjection Component
// ============================================================================

/**
 * SavingsProjection — compact card showing projected growth at 1/5/10/30 years.
 *
 * Accepts a SavingsAccount and displays:
 * - Account name & current balance
 * - Projected values at each horizon
 * - A friendly "keep it up" message
 *
 * Uses the warm visual design system (GlassCard, Inter font, green for growth).
 */
export function SavingsProjection({ account }: SavingsProjectionProps) {
  const projections = useMemo(
    () =>
      computeProjectionHorizons(
        account.balance,
        account.monthlyContribution,
        account.expectedAnnualReturn / 100
      ),
    [account.balance, account.monthlyContribution, account.expectedAnnualReturn]
  )

  const hasContributions = account.monthlyContribution > 0

  return (
    <GlassCard elevation="low" style={{ padding: '16px 18px' }}>
      {/* Header: account name + current balance */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: FONT_FAMILY,
          }}
        >
          {account.name}
        </p>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--sub)',
            fontFamily: MONO_FAMILY,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ${account.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Projection horizons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: hasContributions ? 12 : 0,
        }}
      >
        {projections.map(({ years, amount }) => (
          <div
            key={years}
            style={{
              textAlign: 'center',
              padding: '8px 4px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--muted)',
                fontFamily: FONT_FAMILY,
                marginBottom: 4,
                letterSpacing: '0.02em',
              }}
            >
              {years}yr
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--success)',
                fontFamily: MONO_FAMILY,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCurrency(amount)}
            </p>
          </div>
        ))}
      </div>

      {/* Friendly message */}
      {hasContributions && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
            lineHeight: 1.4,
          }}
        >
          Keep contributing ${account.monthlyContribution.toLocaleString('en-US')}/mo — in 10 years
          you&apos;ll have{' '}
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>
            {formatCurrency(projections[2].amount)}
          </span>
        </p>
      )}
    </GlassCard>
  )
}
