'use client'

import { useMemo } from 'react'
import { typography, FONT_FAMILY, spacing } from '@/styles/typography'
import { borderRadius, glassSurface } from '@/styles/shared'
import type { Transaction } from '@/types'
import type { IncomeStream } from '@/types/folio'
import {
  computeHustleProfit,
  type DateRange,
  type HustleProfitSummary,
} from '@/lib/hustleProfitUtils'
import type { CSSProperties } from 'react'

// ============================================================================
// Props
// ============================================================================

interface HustleProfitCardProps {
  /** The income stream to show profit for. */
  stream: IncomeStream
  /** All transactions (the component filters internally). */
  transactions: Transaction[]
  /** Optional date range to scope the profit calculation. */
  dateRange?: DateRange
}

// ============================================================================
// Styles
// ============================================================================

const cardStyle: CSSProperties = {
  ...glassSurface,
  padding: spacing.md,
  borderRadius: borderRadius.lg,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  marginBottom: spacing.md,
}

const streamNameStyle: CSSProperties = {
  ...typography.headline,
  color: 'var(--text)',
  margin: 0,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing.xxs}px 0`,
}

const labelStyle: CSSProperties = {
  ...typography.body,
  color: 'var(--sub)',
}

const valueStyle: CSSProperties = {
  ...typography.body,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text)',
}

const dividerStyle: CSSProperties = {
  border: 'none',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  margin: `${spacing.sm}px 0`,
}

const profitLabelStyle: CSSProperties = {
  ...typography.caption,
  color: 'var(--sub)',
  marginBottom: spacing.xxs,
}

const profitValueStyle: CSSProperties = {
  ...typography.title,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: FONT_FAMILY,
}

const indicatorStyle: CSSProperties = {
  ...typography.caption,
  marginTop: spacing.xxs,
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Returns a warm, non-judgmental label for the profit/loss state.
 * Avoids shame-based messaging per Folio guidelines.
 */
function getProfitIndicator(summary: HustleProfitSummary): {
  label: string
  color: string
} {
  if (summary.netProfit > 0) {
    return { label: 'Growing ↑', color: 'var(--success, #4ade80)' }
  }
  if (summary.netProfit === 0) {
    return { label: 'Breaking even', color: 'var(--sub, #9ca3af)' }
  }
  // Loss — frame warmly as "investing in growth"
  return { label: 'Investing in growth', color: 'var(--warning, #fbbf24)' }
}

// ============================================================================
// Component
// ============================================================================

/**
 * HustleProfitCard — displays profit summary for a specific income stream.
 *
 * Shows: stream name, total revenue, total expenses, net profit, and a
 * warm profit/loss indicator. Lives in the Tools/Settings area (progressive
 * disclosure), never on the home screen.
 */
export function HustleProfitCard({
  stream,
  transactions,
  dateRange,
}: HustleProfitCardProps) {
  const summary = useMemo(
    () => computeHustleProfit(transactions, stream, dateRange),
    [transactions, stream, dateRange]
  )

  const { label: indicatorLabel, color: indicatorColor } =
    getProfitIndicator(summary)

  const profitColor =
    summary.netProfit >= 0
      ? 'var(--success, #4ade80)'
      : 'var(--warning, #fbbf24)'

  return (
    <div style={cardStyle} role="region" aria-label={`Profit summary for ${stream.name}`}>
      {/* Header */}
      <div style={headerStyle}>
        {stream.emoji && <span aria-hidden="true">{stream.emoji}</span>}
        <h3 style={streamNameStyle}>{stream.name}</h3>
      </div>

      {/* Revenue */}
      <div style={rowStyle}>
        <span style={labelStyle}>Revenue</span>
        <span style={{ ...valueStyle, color: 'var(--success, #4ade80)' }}>
          {formatCurrency(summary.revenue)}
        </span>
      </div>

      {/* Expenses */}
      <div style={rowStyle}>
        <span style={labelStyle}>
          Expenses{summary.expenseCount > 0 ? ` (${summary.expenseCount})` : ''}
        </span>
        <span style={{ ...valueStyle, color: 'var(--sub)' }}>
          −{formatCurrency(summary.expenses)}
        </span>
      </div>

      <hr style={dividerStyle} />

      {/* Net Profit */}
      <div style={profitLabelStyle}>Net profit</div>
      <div style={{ ...profitValueStyle, color: profitColor }}>
        {summary.netProfit < 0 ? '−' : ''}
        {formatCurrency(summary.netProfit)}
      </div>

      {/* Indicator */}
      <div style={{ ...indicatorStyle, color: indicatorColor }}>
        {indicatorLabel}
      </div>
    </div>
  )
}
