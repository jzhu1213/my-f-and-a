"use client"

import { useState, useMemo, useCallback } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { computeInvestmentProjection } from '@/lib/investmentExplorerUtils'
import type { InvestmentProjection } from '@/lib/investmentExplorerUtils'
import { HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

interface InvestmentExplorerScreenProps {
  onBack: () => void
}

// ============================================================================
// Constants
// ============================================================================

const HORIZONS = [1, 5, 10, 30] as const

// ============================================================================
// Component
// ============================================================================

export function InvestmentExplorerScreen({ onBack }: InvestmentExplorerScreenProps) {
  // ── State ──────────────────────────────────────────────────────
  const [monthlyContribution, setMonthlyContribution] = useState(200)
  const [annualReturn, setAnnualReturn] = useState(7)
  const [startingBalance, setStartingBalance] = useState(0)
  const [years, setYears] = useState<number>(10)

  // ── Projection ─────────────────────────────────────────────────
  const projection: InvestmentProjection | null = useMemo(() => {
    if (monthlyContribution <= 0 && startingBalance <= 0) return null
    if (years <= 0) return null
    return computeInvestmentProjection(monthlyContribution, annualReturn, startingBalance, years)
  }, [monthlyContribution, annualReturn, startingBalance, years])

  // ── Handlers ───────────────────────────────────────────────────
  const handleContributionSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMonthlyContribution(Number(e.target.value))
  }, [])

  const handleReturnSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAnnualReturn(Number(e.target.value))
  }, [])

  const handleStartingInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '')
    setStartingBalance(Number(val) || 0)
  }, [])

  // ── SVG Chart ──────────────────────────────────────────────────
  const chartPath = useMemo(() => {
    if (!projection || projection.monthlyPoints.length < 2) return null

    const points = projection.monthlyPoints
    const maxBalance = points[points.length - 1].balance || 1
    const width = 320
    const height = 140
    const padY = 12

    // Build SVG path
    const coords = points
      .filter((_, i) => {
        // Downsample for performance: show every Nth point
        const step = Math.max(1, Math.floor(points.length / 60))
        return i % step === 0 || i === points.length - 1
      })
      .map((p) => {
        const x = (p.month / (points.length - 1)) * width
        const y = height - padY - ((p.balance / maxBalance) * (height - padY * 2))
        return { x, y }
      })

    if (coords.length < 2) return null

    const pathD = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ')

    // Area fill path (closes at bottom)
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`

    return { pathD, areaD, width, height }
  }, [projection])

  return (
    <div style={{ paddingBottom: 80, paddingInlineStart: 20, paddingInlineEnd: 20, paddingTop: 40 }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: typography['body-sm'].fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: fontWeights.medium,
          color: 'var(--sub)',
          background: 'transparent',
          border: '1px solid var(--fill-10)',
          borderRadius: radius.full,
          padding: '8px 16px',
          cursor: 'pointer',
          marginBottom: spacing.xl,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--fill-15)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--fill-10)'; e.currentTarget.style.color = 'var(--sub)' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
          Explorer
        </p>
        <h1 style={{ fontSize: 28, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)', marginBottom: spacing.xs }}>
          What If I Invest?
        </h1>
        <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, color: 'var(--sub)', lineHeight: 1.5 }}>
          See how putting away a little each month could grow over time.
        </p>
      </div>

      {/* Controls */}
      <GlassCard elevation="low" style={{ padding: 20, marginBottom: HORIZONTAL_PADDING }}>
        {/* Monthly Contribution Slider */}
        <div style={{ marginBottom: HORIZONTAL_PADDING }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs }}>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Monthly Contribution
            </p>
            <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              ${monthlyContribution.toLocaleString()}/mo
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={2000}
            step={25}
            value={monthlyContribution}
            onChange={handleContributionSlider}
            aria-label="Monthly contribution amount"
            style={{ width: '100%', accentColor: 'var(--success)' }}
          />
        </div>

        {/* Annual Return Slider */}
        <div style={{ marginBottom: HORIZONTAL_PADDING }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs }}>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Expected Annual Return
            </p>
            <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {annualReturn}%
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={annualReturn}
            onChange={handleReturnSlider}
            aria-label="Expected annual return percentage"
            style={{ width: '100%', accentColor: 'var(--success)' }}
          />
        </div>

        {/* Starting Balance Input */}
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>
            Starting Balance (optional)
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.xs }}>
            <span style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }}>$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={startingBalance === 0 ? '' : String(startingBalance)}
              onChange={handleStartingInput}
              aria-label="Starting investment balance"
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: typography.subhead.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: 'var(--text)',
                outline: 'none',
                border: 'none',
                borderBottom: '1px solid var(--line)',
                paddingBottom: 4,
              }}
            />
          </div>
        </div>
      </GlassCard>

      {/* Horizon Chips */}
      <div style={{ display: 'flex', gap: spacing.xs, marginBottom: HORIZONTAL_PADDING, flexWrap: 'wrap' }}>
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => setYears(h)}
            aria-label={`Set projection to ${h} year${h > 1 ? 's' : ''}`}
            aria-pressed={years === h}
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: fontWeights.medium,
              color: years === h ? 'var(--text)' : 'var(--sub)',
              background: years === h ? 'var(--accent-200)' : 'transparent',
              border: `1px solid ${years === h ? 'var(--accent-300)' : 'var(--fill-10)'}`,
              borderRadius: radius.full,
              padding: '8px 16px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {h} yr{h > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      {/* Results */}
      {projection && (
        <div>
          {/* Warm copy */}
          <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, color: 'var(--sub)', marginBottom: spacing.md, lineHeight: 1.5 }}>
            If you put away <span style={{ color: 'var(--text)', fontWeight: fontWeights.semibold }}>${monthlyContribution.toLocaleString()}</span> each month
            at <span style={{ color: 'var(--text)', fontWeight: fontWeights.semibold }}>{annualReturn}%</span> annual return…
          </p>

          {/* Future Value Hero Card */}
          <GlassCard elevation="medium" glow="healthy" style={{ padding: spacing.lg, marginBottom: 16 }}>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>
              In {years} year{years > 1 ? 's' : ''} you could have
            </p>
            <p style={{ fontSize: 36, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
              ${projection.summary.finalAmount.toLocaleString()}
            </p>
          </GlassCard>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm, marginBottom: 24 }}>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                ${projection.summary.totalContributions.toLocaleString()}
              </p>
              <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                contributed
              </p>
            </GlassCard>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                ${projection.summary.totalInterest.toLocaleString()}
              </p>
              <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                from growth
              </p>
            </GlassCard>
          </div>

          {/* Growth Curve SVG */}
          {chartPath && (
            <div style={{ marginBottom: spacing.lg }}>
              <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.sm }}>
                Growth Curve
              </p>
              <GlassCard elevation="low" style={{ padding: spacing.md, overflow: 'hidden' }}>
                <svg
                  viewBox={`0 0 ${chartPath.width} ${chartPath.height}`}
                  width="100%"
                  height={chartPath.height}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Investment growth curve from $${(startingBalance || 0).toLocaleString()} to $${projection.summary.finalAmount.toLocaleString()} over ${years} years`}
                  style={{ display: 'block' }}
                >
                  {/* Gradient fill under the curve */}
                  <defs>
                    <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path
                    d={chartPath.areaD}
                    fill="url(#growth-fill)"
                  />
                  <path
                    d={chartPath.pathD}
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {/* X-axis labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <span style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)' }}>Now</span>
                  <span style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)' }}>{years} yr{years > 1 ? 's' : ''}</span>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Year-by-year breakdown (condensed) */}
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.sm }}>
            Milestones
          </p>
          <GlassCard elevation="low" style={{ padding: 16 }}>
            {projection.summary.yearlyBreakdown
              .filter((_, i) =>
                i % Math.ceil(projection.summary.yearlyBreakdown.length / 6) === 0 ||
                i === projection.summary.yearlyBreakdown.length - 1
              )
              .map((row, idx, arr) => (
                <div
                  key={row.year}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingTop: idx === 0 ? 0 : 10,
                    paddingBottom: 10,
                    borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <span style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', width: 48 }}>
                    YR {row.year}
                  </span>
                  <div style={{ flex: 1, height: 2, background: 'var(--line)', borderRadius: radius.full, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(row.balance / projection.summary.finalAmount) * 100}%`,
                        background: 'var(--success)',
                        transition: 'width 0.7s ease-out',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--sub)', width: 80, textAlign: "end", fontVariantNumeric: 'tabular-nums' }}>
                    ${row.balance.toLocaleString()}
                  </span>
                </div>
              ))}
          </GlassCard>
        </div>
      )}
    </div>
  )
}
