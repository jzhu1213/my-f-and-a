"use client"
import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { getPayoffMonths, getTotalInterestPaid } from '@/lib/debtUtils'
import { isLearningEnabled } from '@/lib/educationPreferences'
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
    <div style={{ paddingBottom: 16, marginBottom: spacing.md, borderBottom: '1px solid var(--line)' }}>
      <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.xs }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.xs }}>
        {prefix && <span style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }}>{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
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
        {suffix && <span style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }}>{suffix}</span>}
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

      <div style={{ marginBottom: spacing.lg }}>
        <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Calculator</p>
        <h1 style={{ fontSize: 28, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)' }}>Credit Payoff</h1>
      </div>

      {/* Tracked debts summary */}
      {debtResults.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.sm }}>Your Debts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {debtResults.map(({ debt, payoffResult }) => (
              <GlassCard
                key={debt.id}
                elevation="low"
                style={{ padding: spacing.md, cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s' }}
                onClick={() => handleSelectDebt(debt)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs }}>
                  <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--text)' }}>{debt.name}</p>
                  <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)' }}>${debt.balance.toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)' }}>
                    {debt.apr}% APR Â· ${debt.minimumPayment}/mo
                  </p>
                  <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--sub)' }}>
                    {payoffResult.monthsToPayoff === Infinity
                      ? 'Won\u2019t pay off'
                      : `${payoffResult.monthsToPayoff} mo Â· $${payoffResult.totalInterest.toLocaleString()} interest`}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: spacing.xs, textAlign: 'center' }}>
            Tap a debt to explore payoff scenarios below
          </p>
        </div>
      )}

      <GlassCard elevation="low" style={{ padding: 20, marginBottom: spacing.lg }}>
        <InputRow label="Current Balance" prefix="$" value={balance} onChange={handleChange(setBalance)} placeholder="5000" />
        <InputRow label="APR" suffix="%" value={apr} onChange={handleChange(setApr)} placeholder="18.9" />
        <InputRow label="Monthly Payment" prefix="$" value={monthlyPayment} onChange={handleChange(setMonthlyPayment)} placeholder="200" />
      </GlassCard>

      {result && (
        <div style={{ animation: 'slide-up 0.3s ease-out' }}>
          <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: spacing.md }}>Result</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm, marginBottom: 16 }}>
            {[
              { label: 'months to payoff', value: result.monthsToPayoff.toString() },
              { label: 'total interest',   value: `$${result.totalInterest.toLocaleString()}` },
              { label: 'total paid',       value: `$${result.totalPaid.toLocaleString()}` },
              { label: 'monthly payment',  value: `$${result.monthlyPayment.toLocaleString()}` },
            ].map(item => (
              <GlassCard key={item.label} elevation="low" style={{ padding: 16 }}>
                <p style={{ fontSize: typography.headline.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--text)' }}>{item.value}</p>
                <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.label}</p>
              </GlassCard>
            ))}
          </div>

          {isLearningEnabled() && (
          <GlassCard elevation="low" style={{ padding: spacing.md, borderLeft: '2px solid var(--muted)' }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--sub)' }}>
              Paying ${Math.round(result.monthlyPayment * 1.5)}/mo instead saves ~${Math.round(result.totalInterest * 0.4)} in interest.
            </p>
          </GlassCard>
          )}

          {/* What this means for you â€” personalized insight panel */}
          {isLearningEnabled() && (
          <GlassCard elevation="low" style={{ padding: spacing.md, marginTop: spacing.sm, borderLeft: '2px solid var(--success)' }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--text)', marginBottom: 4 }}>
              ðŸ“š What this means for you
            </p>
            <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.regular, color: 'var(--sub)', lineHeight: 1.5 }}>
              {(() => {
                const b = parseFloat(balance)
                const interestRatio = result.totalInterest / b
                if (interestRatio >= 0.8) {
                  return `You\u2019d pay $${result.totalInterest.toLocaleString()} in interest alone â€” almost as much as what you owe. Paying even a little more each month can save hundreds.`
                }
                if (interestRatio >= 0.4) {
                  return `On top of your $${b.toLocaleString()} balance, you\u2019ll pay $${result.totalInterest.toLocaleString()} in interest over ${result.monthsToPayoff} months. That\u2019s real money that could go toward your goals instead.`
                }
                return `You\u2019ll be debt-free in ${result.monthsToPayoff} months with $${result.totalInterest.toLocaleString()} in interest. Not bad â€” staying consistent is what makes the difference.`
              })()}
            </p>
          </GlassCard>
          )}
        </div>
      )}

      {balance && apr && monthlyPayment && !result && (
        <GlassCard elevation="low" glow="over" style={{ padding: spacing.md, borderLeft: '2px solid var(--error)' }}>
          <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.medium, color: 'var(--error)' }}>
            Payment too low â€” must exceed the monthly interest charge.
          </p>
        </GlassCard>
      )}
    </div>
  )
}
