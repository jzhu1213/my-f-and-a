'use client'

// ============================================================================
// RateDisplay — shows the current exchange rate for a currency pair
// ============================================================================
//
// Task 421.3 — Rate display component (Group 122: Multi-currency foundation).
//
// A small, reusable component that displays the current exchange rate for a
// currency pair: "1 USD = 0.92 EUR (updated today)". Used in travel mode
// settings and the expense sheet when logging in a foreign currency.
//
// Requirements: 24.1

import React, { useEffect, useState } from 'react'
import { getRate, getCacheInfo, getOverride } from '@/lib/exchangeRates'
import { normalizeCode, getCurrencySymbol } from '@/lib/currencyUtils'
import { FONT_FAMILY, pxToRem } from '@/styles/typography'
import { fills, borderRadius, colorRamp } from '@/styles/shared'

// ============================================================================
// Types
// ============================================================================

export interface RateDisplayProps {
  /** Source currency code (e.g. "USD"). */
  from: string
  /** Target currency code (e.g. "EUR"). */
  to: string
  /** Optional: base currency for rate fetching. Defaults to home currency. */
  base?: string
  /** Optional: compact mode hides the timestamp. */
  compact?: boolean
  /** Optional: additional inline styles for the container. */
  style?: React.CSSProperties
}

// ============================================================================
// Helpers
// ============================================================================

function formatRateDate(lastFetched: number | null): string {
  if (!lastFetched) return ''

  const now = new Date()
  const fetched = new Date(lastFetched)
  const diffMs = now.getTime() - fetched.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'updated just now'
  if (diffHours < 24 && fetched.getDate() === now.getDate()) return 'updated today'
  if (diffHours < 48) return 'updated yesterday'
  return `updated ${fetched.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function formatRate(rate: number, to: string): string {
  const code = normalizeCode(to)
  // Zero-decimal currencies get 0 decimal places, others get 2–4 depending on size
  const digits = rate < 0.01 ? 6 : rate < 1 ? 4 : 2
  return rate.toFixed(digits)
}

// ============================================================================
// Component
// ============================================================================

export function RateDisplay({ from, to, base, compact = false, style }: RateDisplayProps) {
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOverride, setIsOverride] = useState(false)

  const f = normalizeCode(from)
  const t = normalizeCode(to)

  useEffect(() => {
    if (!f || !t || f === t) {
      setRate(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const result = await getRate(f, t, base)
      if (!cancelled) {
        setRate(result)
        setIsOverride(!!getOverride(f, t))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [f, t, base])

  // Don't render anything if same currency or missing codes
  if (!f || !t || f === t) return null

  const cacheInfo = getCacheInfo()
  const timestamp = formatRateDate(cacheInfo.lastFetched)

  // Container styles
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: compact ? '4px 10px' : '6px 12px',
    borderRadius: borderRadius.full,
    background: fills[4],
    border: `1px solid ${fills[8]}`,
    fontFamily: FONT_FAMILY,
    fontSize: pxToRem(12),
    fontWeight: 500,
    color: 'var(--sub)',
    lineHeight: 1.4,
    ...style,
  }

  const rateValueStyle: React.CSSProperties = {
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  }

  const overrideBadgeStyle: React.CSSProperties = {
    fontSize: pxToRem(10),
    fontWeight: 600,
    color: colorRamp.accent[500],
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  }

  const timestampStyle: React.CSSProperties = {
    fontSize: pxToRem(11),
    color: 'var(--muted)',
    fontWeight: 400,
  }

  if (loading) {
    return (
      <span style={containerStyle} aria-label={`Loading exchange rate for ${f} to ${t}`}>
        <span style={{ color: 'var(--muted)' }}>…</span>
      </span>
    )
  }

  if (rate === null) {
    return (
      <span style={containerStyle} aria-label={`Exchange rate unavailable for ${f} to ${t}`}>
        <span style={{ color: 'var(--muted)' }}>
          {getCurrencySymbol(f)} → {getCurrencySymbol(t)} unavailable
        </span>
      </span>
    )
  }

  return (
    <span
      style={containerStyle}
      aria-label={`1 ${f} equals ${formatRate(rate, t)} ${t}${isOverride ? ' (custom rate)' : ''}`}
    >
      <span style={rateValueStyle}>
        1 {f} = {formatRate(rate, t)} {t}
      </span>
      {isOverride && <span style={overrideBadgeStyle}>custom</span>}
      {!compact && timestamp && (
        <span style={timestampStyle}>({timestamp})</span>
      )}
    </span>
  )
}
