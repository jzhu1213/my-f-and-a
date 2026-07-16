"use client"
import { useState, useMemo } from 'react'
import type { CreditPayoffResult } from '@/types'

interface CreditPayoffCalculatorProps {
  onBack: () => void
}

export function CreditPayoffCalculator({ onBack }: CreditPayoffCalculatorProps) {
  const [balance,        setBalance]        = useState('')
  const [apr,            setApr]            = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')

  const result = useMemo<CreditPayoffResult | null>(() => {
    const b = parseFloat(balance)
    const a = parseFloat(apr) / 100 / 12
    const p = parseFloat(monthlyPayment)
    if (!b || !a || !p || p <= b * a) return null
    const months       = Math.ceil(Math.log(p / (p - b * a)) / Math.log(1 + a))
    const totalPaid    = p * months
    const totalInterest = totalPaid - b
    return {
      monthsToPayoff: months,
      totalInterest:  Math.round(totalInterest * 100) / 100,
      totalPaid:      Math.round(totalPaid * 100) / 100,
      monthlyPayment: p,
    }
  }, [balance, apr, monthlyPayment])

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/[^0-9.]/g, ''))
  }

  const InputRow = ({ label, prefix, suffix, value, onChange, placeholder }: {
    label: string; prefix?: string; suffix?: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string
  }) => (
    <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        {prefix && <span className="text-lg font-mono text-t-muted">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="flex-1 bg-transparent text-xl font-mono text-t-text outline-none border-b"
          style={{ borderColor: 'var(--line)' }}
        />
        {suffix && <span className="text-sm font-mono text-t-muted">{suffix}</span>}
      </div>
    </div>
  )

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
        <h1 className="text-2xl font-mono text-t-text">Credit Payoff</h1>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <InputRow label="Current Balance" prefix="$" value={balance} onChange={handleChange(setBalance)} placeholder="5000" />
        <InputRow label="APR" suffix="%" value={apr} onChange={handleChange(setApr)} placeholder="18.9" />
        <InputRow label="Monthly Payment" prefix="$" value={monthlyPayment} onChange={handleChange(setMonthlyPayment)} placeholder="200" />
      </div>

      {result && (
        <div className="mt-6 animate-slide-up">
          <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-4">Result</p>
          <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)' }}>
            {[
              { label: 'months to payoff', value: result.monthsToPayoff.toString() },
              { label: 'total interest',   value: `$${result.totalInterest.toLocaleString()}` },
              { label: 'total paid',       value: `$${result.totalPaid.toLocaleString()}` },
              { label: 'monthly payment',  value: `$${result.monthlyPayment.toLocaleString()}` },
            ].map(item => (
              <div key={item.label} className="px-4 py-4" style={{ background: 'var(--surface)' }}>
                <p className="text-2xl font-mono text-t-text">{item.value}</p>
                <p className="text-[10px] font-mono text-t-muted tracking-wider mt-1 uppercase">{item.label}</p>
              </div>
            ))}
          </div>

          <div
            className="mt-4 px-4 py-3"
            style={{ borderLeft: '2px solid var(--muted)', background: 'var(--surface)' }}
          >
            <p className="text-xs text-t-muted">
              Paying ${Math.round(result.monthlyPayment * 1.5)}/mo instead saves ~${Math.round(result.totalInterest * 0.4)} in interest.
            </p>
          </div>
        </div>
      )}

      {balance && apr && monthlyPayment && !result && (
        <div
          className="mt-6 px-4 py-3"
          style={{ borderLeft: '2px solid var(--red)', background: 'var(--surface)' }}
        >
          <p className="text-xs font-mono text-t-red">Payment too low — must exceed the monthly interest charge.</p>
        </div>
      )}
    </div>
  )
}
