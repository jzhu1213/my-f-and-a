"use client"
import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY } from '@/styles/typography'
import type { CompoundGrowthResult } from '@/types'

interface CompoundGrowthCalculatorProps {
  onBack: () => void
}

export function CompoundGrowthCalculator({ onBack }: CompoundGrowthCalculatorProps) {
  const [initialAmount,       setInitialAmount]       = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [annualReturn,        setAnnualReturn]        = useState('7')
  const [years,               setYears]               = useState('10')

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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          color: 'var(--sub)',
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 99,
          padding: '8px 16px',
          cursor: 'pointer',
          marginBottom: 32,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = 'var(--sub)' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Calculator</p>
        <h1 style={{ fontSize: 28, fontFamily: FONT_FAMILY, fontWeight: 600, color: 'var(--text)' }}>Compound Growth</h1>
      </div>

      <GlassCard elevation="low" style={{ padding: 20, marginBottom: 24 }}>
        {/* Starting Amount */}
        <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Starting Amount</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)' }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1000"
              value={initialAmount}
              onChange={handleChange(setInitialAmount)}
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: 20,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 500,
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
        <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Monthly Contribution</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)' }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="100"
              value={monthlyContribution}
              onChange={handleChange(setMonthlyContribution)}
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: 20,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 500,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Annual Return</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="7"
                value={annualReturn}
                onChange={handleChange(setAnnualReturn)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  fontSize: 20,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 500,
                  color: 'var(--text)',
                  outline: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 4,
                }}
              />
              <span style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)' }}>%</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Years</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="10"
              value={years}
              onChange={handleChange(setYears)}
              style={{
                width: '100%',
                background: 'transparent',
                fontSize: 20,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 500,
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
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Projection</p>

          <GlassCard elevation="medium" glow="healthy" style={{ padding: 24, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Future Value</p>
            <p style={{ fontSize: 40, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--success)' }}>
              ${result.finalAmount.toLocaleString()}
            </p>
          </GlassCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: 20, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--text)' }}>${result.totalContributions.toLocaleString()}</p>
              <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>contributed</p>
            </GlassCard>
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ fontSize: 20, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--success)' }}>${result.totalInterest.toLocaleString()}</p>
              <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>from growth</p>
            </GlassCard>
          </div>

          {/* Growth chart */}
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Year by Year</p>
          <GlassCard elevation="low" style={{ padding: 16 }}>
            {displayRows.map((row, idx) => (
              <div
                key={row.year}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingTop: idx === 0 ? 0 : 10,
                  paddingBottom: 10,
                  borderBottom: idx === displayRows.length - 1 ? 'none' : '1px solid var(--line)',
                }}
              >
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)', width: 48 }}>YR {row.year}</span>
                <div style={{ flex: 1, height: 2, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(row.balance / result.finalAmount) * 100}%`,
                      background: 'var(--success)',
                      transition: 'width 0.7s ease-out',
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--sub)', width: 80, textAlign: 'right' }}>
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
