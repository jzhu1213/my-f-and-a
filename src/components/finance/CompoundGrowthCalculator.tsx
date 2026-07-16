"use client"
import { useState, useMemo } from 'react'
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
        className="flex items-center gap-2 text-xs font-mono tracking-widest text-t-muted hover:text-t-text transition-colors uppercase mb-8"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        back
      </button>

      <div className="mb-6">
        <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-1">Calculator</p>
        <h1 className="text-2xl font-mono text-t-text">Compound Growth</h1>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        {/* Starting Amount */}
        <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Starting Amount</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-mono text-t-muted">$</span>
            <input type="text" inputMode="decimal" placeholder="1000" value={initialAmount}
              onChange={handleChange(setInitialAmount)}
              className="flex-1 bg-transparent text-xl font-mono text-t-text outline-none border-b" style={{ borderColor: 'var(--line)' }} />
          </div>
        </div>

        {/* Monthly Contribution */}
        <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Monthly Contribution</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-mono text-t-muted">$</span>
            <input type="text" inputMode="decimal" placeholder="100" value={monthlyContribution}
              onChange={handleChange(setMonthlyContribution)}
              className="flex-1 bg-transparent text-xl font-mono text-t-text outline-none border-b" style={{ borderColor: 'var(--line)' }} />
          </div>
        </div>

        {/* Annual Return + Years */}
        <div className="grid grid-cols-2 gap-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Annual Return</p>
            <div className="flex items-baseline gap-1">
              <input type="text" inputMode="decimal" placeholder="7" value={annualReturn}
                onChange={handleChange(setAnnualReturn)}
                className="flex-1 bg-transparent text-xl font-mono text-t-text outline-none border-b" style={{ borderColor: 'var(--line)' }} />
              <span className="text-sm font-mono text-t-muted">%</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">Years</p>
            <input type="text" inputMode="numeric" placeholder="10" value={years}
              onChange={handleChange(setYears)}
              className="w-full bg-transparent text-xl font-mono text-t-text outline-none border-b" style={{ borderColor: 'var(--line)' }} />
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-6 animate-slide-up">
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-4">Projection</p>

          <div className="mb-4 px-4 py-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-1">Future Value</p>
            <p className="text-4xl font-mono" style={{ color: 'var(--green)' }}>
              ${result.finalAmount.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px mb-6" style={{ background: 'var(--border)' }}>
            <div className="px-4 py-4" style={{ background: 'var(--surface)' }}>
              <p className="text-xl font-mono text-t-text">${result.totalContributions.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-t-muted tracking-wider mt-1 uppercase">contributed</p>
            </div>
            <div className="px-4 py-4" style={{ background: 'var(--surface)' }}>
              <p className="text-xl font-mono" style={{ color: 'var(--green)' }}>${result.totalInterest.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-t-muted tracking-wider mt-1 uppercase">from growth</p>
            </div>
          </div>

          {/* Growth chart */}
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Year by Year</p>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {displayRows.map(row => (
              <div key={row.year} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-[10px] font-mono text-t-muted w-12">YR {row.year}</span>
                <div className="flex-1 h-[2px]" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${(row.balance / result.finalAmount) * 100}%`,
                      background: 'var(--green)',
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono text-t-muted w-20 text-right">
                  ${row.balance.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
