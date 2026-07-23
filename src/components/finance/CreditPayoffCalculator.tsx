"use client"
import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY } from '@/styles/typography'
import { getPayoffMonths, getTotalInterestPaid } from '@/lib/debtUtils'
import type { CreditPayoffResult } from '@/types'
import type { Debt } from '@/types/folio'

interface CreditPayoffCalculatorProps {
  onBack: () => void
  debts?: Debt[]
}

export function CreditPayoffCalculator({ onBack, debts }: CreditPayoffCalculatorProps) {
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

  /** Compute payoff info for each tracked debt */
  const debtResults = useMemo(() => {
    if (!debts || debts.length === 0) return []
    return debts.map((debt) => {
      const months = getPayoffMonths(debt.balance, debt.apr, debt.minimumPayment)
      const totalInterest = getTotalInterestPaid(debt.balance, debt.apr, debt.minimumPayment)
      const totalPaid = months === Infinity ? Infinity : debt.minimumPayment * months
      const payoffResult: CreditPayoffResult = {
        monthsToPayoff: months,
        totalInterest: months === Infinity ? Infinity : Math.round(totalInterest * 100) / 100,
        totalPaid: months === Infinity ? Infinity : Math.round(totalPaid * 100) / 100,
        monthlyPayment: debt.minimumPayment,
      }
      return { debt, payoffResult }
    })
  }, [debts])

  /** Pre-fill the calculator inputs from a tracked debt */
  const handleSelectDebt = (debt: Debt) => {
    setBalance(debt.balance.toString())
    setApr(debt.apr.toString())
    setMonthlyPayment(debt.minimumPayment.toString())
  }

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
        {prefix && <span style={{ fontSize: 18, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)' }}>{prefix}</span>}
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
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: 'var(--text)',
            outline: 'none',
            border: 'none',
            borderBottom: '1px solid var(--line)',
            paddingBottom: 4,
          }}
        />
        {suffix && <span style={{ fontSize: 14, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)' }}>{suffix}</span>}
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

      {/* Tracked debts summary */}
      {debtResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Your Debts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {debtResults.map(({ debt, payoffResult }) => (
              <GlassCard
                key={debt.id}
                elevation="low"
                style={{ padding: 16, cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s' }}
                onClick={() => handleSelectDebt(debt)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <p style={{ fontSize: 15, fontFamily: FONT_FAMILY, fontWeight: 500, color: 'var(--text)' }}>{debt.name}</p>
                  <p style={{ fontSize: 15, fontFamily: FONT_FAMILY, fontWeight: 600, color: 'var(--text)' }}>${debt.balance.toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)' }}>
                    {debt.apr}% APR · ${debt.minimumPayment}/mo
                  </p>
                  <p style={{ fontSize: 12, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--sub)' }}>
                    {payoffResult.monthsToPayoff === Infinity
                      ? 'Won\u2019t pay off'
                      : `${payoffResult.monthsToPayoff} mo · $${payoffResult.totalInterest.toLocaleString()} interest`}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
          <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 400, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
            Tap a debt to explore payoff scenarios below
          </p>
        </div>
      )}

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
                <p style={{ fontSize: 24, fontFamily: FONT_FAMILY, fontWeight: 600, color: 'var(--text)' }}>{item.value}</p>
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
