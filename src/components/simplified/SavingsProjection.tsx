"use client"

import { useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { computeProjectionHorizons } from '@/lib/compoundGrowthUtils'
import {
  computeRothIraContributionProgress,
  type RothIraContributionProgress,
} from '@/lib/savingsAccountUtils'
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

  // Roth IRA annual contribution progress (159.1) — only relevant for Roth IRAs.
  const rothProgress = useMemo<RothIraContributionProgress | null>(
    () =>
      account.type === 'roth_ira'
        ? computeRothIraContributionProgress(account)
        : null,
    [account]
  )

  // Accessible text summary for projections
  const projectionSummary = useMemo(
    () =>
      `${account.name} projection: current balance $${account.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}. ` +
      projections.map(p => `${p.years} year${p.years === 1 ? '' : 's'}: ${formatCurrency(p.amount)}`).join(', ') + '.',
    [account.name, account.balance, projections]
  )

  const summaryId = `savings-proj-summary-${account.name.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <GlassCard elevation="low" style={{ padding: '16px 18px' }} aria-label={`${account.name} savings projection`} aria-describedby={summaryId}>
      {/* Screen reader text summary */}
      <span id={summaryId} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
        {projectionSummary}
      </span>
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
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.semibold,
            color: 'var(--text)',
            fontFamily: FONT_FAMILY,
          }}
        >
          {account.name}
        </p>
        <p
          style={{
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
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
          gap: spacing.xs,
          marginBottom: hasContributions ? 12 : 0,
        }}
      >
        {projections.map(({ years, amount }) => (
          <div
            key={years}
            style={{
              textAlign: 'center',
              padding: '8px 4px',
              borderRadius: radius.control,
              background: 'var(--fill-03)',
            }}
          >
            <p
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: fontWeights.medium,
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
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: 'var(--success)',
                fontFamily: FONT_FAMILY,
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
            fontSize: typography['body-sm'].fontSize,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
            lineHeight: 1.4,
          }}
        >
          Keep contributing ${account.monthlyContribution.toLocaleString('en-US')}/mo — in 10 years
          you&apos;ll have{' '}
          <span style={{ color: 'var(--success)', fontWeight: fontWeights.medium }}>
            {formatCurrency(projections[2].amount)}
          </span>
        </p>
      )}

      {/* Roth IRA annual contribution tracker (159.1) */}
      {rothProgress && (
        <RothContributionTracker progress={rothProgress} isFirst={!hasContributions} />
      )}
    </GlassCard>
  )
}

// ============================================================================
// RothContributionTracker (internal, 159.1)
// ============================================================================

function formatWholeDollars(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US')
}

/**
 * A compact progress bar toward the annual Roth IRA limit with a warm,
 * non-judgmental line of copy. Rendered only for Roth IRA accounts.
 */
function RothContributionTracker({
  progress,
  isFirst,
}: {
  progress: RothIraContributionProgress
  isFirst: boolean
}) {
  const { contributed, limit, fractionOfLimit, onTrack, message } = progress

  // Green when on pace / maxed; warm amber as a gentle (never alarming) nudge.
  const fillColor = onTrack ? 'var(--success)' : 'var(--warning)'
  const percentLabel = Math.round(fractionOfLimit * 100)

  return (
    <div
      style={{
        marginTop: isFirst ? 0 : 12,
        paddingTop: 12,
        borderTop: '1px solid var(--fill-06)',
      }}
    >
      {/* Label row: title + contributed / limit */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: spacing.xs,
        }}
      >
        <span
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            color: 'var(--muted)',
            fontFamily: FONT_FAMILY,
          }}
        >
          {new Date().getFullYear()} contributions
        </span>
        <span
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.semibold,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatWholeDollars(contributed)} / {formatWholeDollars(limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={percentLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Roth IRA contributions: ${formatWholeDollars(
          contributed
        )} of ${formatWholeDollars(limit)} annual limit, ${percentLabel}%`}
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--fill-06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fractionOfLimit * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: fillColor,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Warm encouragement / gentle nudge */}
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: 'var(--sub)',
          fontFamily: FONT_FAMILY,
          lineHeight: 1.4,
          marginTop: spacing.xs,
        }}
      >
        {message}
      </p>
    </div>
  )
}
