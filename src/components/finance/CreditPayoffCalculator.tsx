"use client"
import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY } from '@/styles/typography'
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
    <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
      <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {prefix && <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)' }}>{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
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
        {suffix && <span style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--muted)' }}>{suffix}</span>}
      </div>
    </div>
  )

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
        <h1 style={{ fontSize: 28, fontFamily: FONT_FAMILY, fontWeight: 600, color: 'var(--text)' }}>Credit Payoff</h1>
      </div>

      <GlassCard elevation="low" style={{ padding: 20, marginBottom: 24 }}>
        <InputRow label="Current Balance" prefix="$" value={balance} onChange={handleChange(setBalance)} placeholder="5000" />
        <InputRow label="APR" suffix="%" value={apr} onChange={handleChange(setApr)} placeholder="18.9" />
        <InputRow label="Monthly Payment" prefix="$" value={monthlyPayment} onChange={handleChange(setMonthlyPayment)} placeholder="200" />
      </GlassCard>

      {result && (
        <div style={{ animation: 'slide-up 0.3s ease-out' }}>
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Result</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'months to payoff', value: result.monthsToPayoff.toString() },
              { label: 'total interest',   value: `$${result.totalInterest.toLocaleString()}` },
              { label: 'total paid',       value: `$${result.totalPaid.toLocaleString()}` },
              { label: 'monthly payment',  value: `$${result.monthlyPayment.toLocaleString()}` },
            ].map(item => (
              <GlassCard key={item.label} elevation="low" style={{ padding: 16 }}>
                <p style={{ fontSize: 24, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text)' }}>{item.value}</p>
                <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.label}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard elevation="low" style={{ padding: 16, borderLeft: '2px solid var(--muted)' }}>
            <p style={{ fontSize: 13, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--sub)' }}>
              Paying ${Math.round(result.monthlyPayment * 1.5)}/mo instead saves ~${Math.round(result.totalInterest * 0.4)} in interest.
            </p>
          </GlassCard>
        </div>
      )}

      {balance && apr && monthlyPayment && !result && (
        <GlassCard elevation="low" glow="over" style={{ padding: 16, borderLeft: '2px solid var(--error)' }}>
          <p style={{ fontSize: 13, fontFamily: FONT_FAMILY, fontWeight: 500, color: 'var(--error)' }}>
            Payment too low — must exceed the monthly interest charge.
          </p>
        </GlassCard>
      )}
    </div>
  )
}
