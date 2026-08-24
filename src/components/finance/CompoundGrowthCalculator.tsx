"use client"
import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { ChartFrame } from '@/components/ui/primitives/ChartFrame'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { progressBar, chartLabel, chartValueLabel, chartMotion } from '@/styles/chartTokens'
import { computeCombinedSavingsInputs } from '@/lib/savingsAccountUtils'
import { isLearningEnabled } from '@/lib/educationPreferences'
import type { CompoundGrowthResult } from '@/types'
import type { SavingsAccount } from '@/types/folio'

interface CompoundGrowthCalculatorProps {
  onBack: () => void
  /** When provided, shows a "Use my portfolio" chip to pre-fill inputs from combined accounts. */
  savingsAccounts?: SavingsAccount[]
}

export function CompoundGrowthCalculator({ onBack, savingsAccounts }: CompoundGrowthCalculatorProps) {
  const [initialAmount,       setInitialAmount]       = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [annualReturn,        setAnnualReturn]        = useState('7')
  const [years,               setYears]               = useState('10')

  // Compute combined inputs for pre-fill (only when accounts are available)
  const combinedInputs = useMemo(
    () => savingsAccounts && savingsAccounts.length > 0
      ? computeCombinedSavingsInputs(savingsAccounts)
      : null,
    [savingsAccounts]
  )

  const canPrefill = combinedInputs !== null &&
    (combinedInputs.totalBalance > 0 || combinedInputs.totalMonthlyContribution > 0)

  const handlePrefill = () => {
    if (!combinedInputs) return
    setInitialAmount(String(Math.round(combinedInputs.totalBalance)))
    setMonthlyContribution(String(Math.round(combinedInputs.totalMonthlyContribution)))
    setAnnualReturn(String((combinedInputs.weightedAnnualReturn * 100).toFixed(1)))
  }

  const result = useMemo<CompoundGrowthResult | null>(() => {
    const principal = parseFloat(initialAmount) || 0
    const monthly   = parseFloat(monthlyContribution) || 0
    const rate      = (parseFloat(annualReturn) || 0) / 100
    const periods   = parseInt(years) || 0
    if (periods <= 0 || (principal <= 0 && monthly <= 0)) return null

    const monthlyRate  = rate / 12
    const totalMonths  = periods * 12
    let balance = principal
    const yearlyBreakdown: { year: number; balance: number }[] = []
    for (let month = 1; month <= totalMonths; month++) {
      balance = balance * (1 + monthlyRate) + monthly
      if (month % 12 === 0) yearlyBreakdown.push({ year: month / 12, balance: Math.round(balance) })
    }
    const totalContributions = principal + monthly * totalMonths
    return {
      finalAmount:         Math.round(balance),
      totalContributions:  Math.round(totalContributions),
      totalInterest:       Math.round(balance - totalContributions),
      yearlyBreakdown,
    }
  }, [initialAmount, monthlyContribution, annualReturn, years])

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/[^0-9.]/g, ''))
  }

  const displayRows = result
    ? result.yearlyBreakdown.filter((_, i) =>
        i % Math.ceil(result.yearlyBreakdown.length / 6) === 0 ||
        i === result.yearlyBreakdown.length - 1
      )
    : []

  return (
    <div className="pb-20 px-5 pt-10">
      <button
        onClick={onBack}
        aria-label="Go back"
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
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div style={{ marginBottom: spacing.lg }}>
        <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Calculator</p>
        <h1 style={{ fontSize: 28, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)' }}>Compound Growth</h1>
      </div>

      <GlassCard elevation="low" style={{ padding: 20, marginBottom: spacing.lg }}>
        {/* Pre-fill from portfolio chip */}
        {canPrefill && (
          <div style={{ marginBottom: spacing.md, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={handlePrefill}
              aria-label="Pre-fill calculator with your combined savings portfolio values"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: 'var(--sub)',
                background: 'var(--accent-100)',
                border: '1px solid var(--accent-200)',
                borderRadius: radius.full,
                padding: '7px 14px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-400)'
                e.currentTarget.style.background = 'var(--accent-200)'
                e.currentTarget.style.color = 'var(--text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-200)'
                e.currentTarget.style.background = 'var(--accent-100)'
                e.currentTarget.style.color = 'var(--sub)'
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m4-8h2m4 0h2m-6 4h2m4 0h2" />
              </svg>
              Use my portfolio
            </button>
          </div>
        )}

        {/* Starting Amount */}
        <div style={{ paddingBottom: 16, marginBottom: spacing.md, borderBottom: '1px solid var(--line)' }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>Starting Amount</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.xs }}>
            <span style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }} aria-hidden="true">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1000"
              value={initialAmount}
              onChange={handleChange(setInitialAmount)}
              aria-label="Starting amount in dollars"
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

        {/* Monthly Contribution */}
        <div style={{ paddingBottom: 16, marginBottom: spacing.md, borderBottom: '1px solid var(--line)' }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>Monthly Contribution</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.xs }}>
            <span style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }} aria-hidden="true">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="100"
              value={monthlyContribution}
              onChange={handleChange(setMonthlyContribution)}
              aria-label="Monthly contribution in dollars"
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

        {/* Annual Return + Years */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md }}>
          <div>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>Annual Return</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="7"
                value={annualReturn}
                onChange={handleChange(setAnnualReturn)}
                aria-label="Annual return percentage"
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
              <span style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }} aria-hidden="true">%</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>Years</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="10"
              value={years}
              onChange={handleChange(setYears)}
              aria-label="Number of years"
              style={{
                width: '100%',
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

      {result && (
        <div style={{ animation: 'slide-up 0.3s ease-out' }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.md }}>Projection</p>

          <GlassCard elevation="medium" glow="healthy" style={{ padding: 24, marginBottom: spacing.md }}>
            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>Future Value</p>
            <p style={{ fontSize: 40, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--success)' }}>
              ${result.finalAmount.toLocaleString()}
            </p>
          </GlassCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm, marginBottom: 24 }}>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--text)' }}>${result.totalContributions.toLocaleString()}</p>
              <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>contributed</p>
            </GlassCard>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--success)' }}>${result.totalInterest.toLocaleString()}</p>
              <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>from growth</p>
            </GlassCard>
          </div>

          {/* What this means for you — personalized insight panel */}
          {isLearningEnabled() && (
          <GlassCard elevation="low" style={{ padding: 16, marginBottom: spacing.lg, borderLeft: '2px solid var(--success)' }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--text)', marginBottom: 4 }}>
              💡 What this means for you
            </p>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--sub)', lineHeight: 1.5 }}>
              {(() => {
                const principal = parseFloat(initialAmount) || 0
                const monthly = parseFloat(monthlyContribution) || 0
                const yrs = parseInt(years) || 0
                if (principal > 0 && monthly > 0) {
                  return `At this rate, your $${principal.toLocaleString()} investment plus $${monthly.toLocaleString()}/mo will grow to $${result.finalAmount.toLocaleString()} in ${yrs} year${yrs !== 1 ? 's' : ''} — that\u2019s $${result.totalInterest.toLocaleString()} of free money from compound growth.`
                }
                if (principal > 0) {
                  return `Your $${principal.toLocaleString()} grows to $${result.finalAmount.toLocaleString()} in ${yrs} year${yrs !== 1 ? 's' : ''} — $${result.totalInterest.toLocaleString()} earned without lifting a finger.`
                }
                return `Contributing $${monthly.toLocaleString()}/mo turns into $${result.finalAmount.toLocaleString()} over ${yrs} year${yrs !== 1 ? 's' : ''}. That\u2019s $${result.totalInterest.toLocaleString()} your money earned for you.`
              })()}
            </p>
          </GlassCard>
          )}

          {/* Growth chart */}
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.sm }}>Year by Year</p>
          {/* Screen reader text summary for the chart */}
          <span id="compound-growth-chart-summary" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
            {`Compound growth chart: final value $${result.finalAmount.toLocaleString()} after ${years} years, with $${result.totalContributions.toLocaleString()} contributed and $${result.totalInterest.toLocaleString()} from growth.`}
          </span>
          <ChartFrame
            type="bar"
            state="loaded"
            height={Math.max(200, displayRows.length * 50)}
            aria-label="Compound growth year-by-year bar chart"
            aria-describedby="compound-growth-chart-summary"
          >
            <div style={{ padding: 16 }}>
              {displayRows.map((row, idx) => (
                <div
                  key={row.year}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingTop: idx === 0 ? 0 : 10,
                    paddingBottom: 10,
                    borderBottom: idx === displayRows.length - 1 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <span style={{ ...chartLabel, width: 48 }}>YR {row.year}</span>
                  <div style={{ flex: 1, height: progressBar.heightCompact, background: progressBar.track, borderRadius: progressBar.borderRadius, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(row.balance / result.finalAmount) * 100}%`,
                        background: progressBar.fill,
                        borderRadius: progressBar.borderRadius,
                        transition: chartMotion.barGrow,
                      }}
                    />
                  </div>
                  <span style={{ ...chartValueLabel, width: 80, textAlign: "end" }}>
                    ${row.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ChartFrame>
        </div>
      )}
    </div>
  )
}
