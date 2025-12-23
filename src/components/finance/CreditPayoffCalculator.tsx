"use client"
import { useState, useMemo } from 'react'
import type { CreditPayoffResult } from '@/types'

interface CreditPayoffCalculatorProps {
  onBack: () => void
}

export function CreditPayoffCalculator({ onBack }: CreditPayoffCalculatorProps) {
  const [balance, setBalance] = useState('')
  const [apr, setApr] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  
  const result = useMemo<CreditPayoffResult | null>(() => {
    const b = parseFloat(balance)
    const a = parseFloat(apr) / 100 / 12 // Monthly rate
    const p = parseFloat(monthlyPayment)
    
    if (!b || !a || !p || p <= b * a) return null
    
    // Calculate months to payoff
    const months = Math.ceil(
      Math.log(p / (p - b * a)) / Math.log(1 + a)
    )
    
    const totalPaid = p * months
    const totalInterest = totalPaid - b
    
    return {
      monthsToPayoff: months,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      monthlyPayment: p,
    }
  }, [balance, apr, monthlyPayment])
  
  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '')
    setter(value)
  }
  
  return (
    <div className="pb-32 px-4 pt-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      
      <div className="glass-card-solid p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">💳</span>
          <h1 className="text-2xl font-heading font-bold">Credit Payoff Calculator</h1>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Current Balance
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="5000"
                value={balance}
                onChange={handleInputChange(setBalance)}
                className="input-folio pl-8"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              APR (Annual %)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="18.9"
                value={apr}
                onChange={handleInputChange(setApr)}
                className="input-folio pr-8"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">%</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Monthly Payment
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="200"
                value={monthlyPayment}
                onChange={handleInputChange(setMonthlyPayment)}
                className="input-folio pl-8"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Results */}
      {result && (
        <div className="glass-card-solid p-6 bg-peach/10 dark:bg-peach/20 stagger-1">
          <h2 className="text-lg font-heading font-bold mb-4">Your Payoff Plan</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-black/20">
              <p className="text-3xl font-mono font-bold text-peach-dark dark:text-peach">
                {result.monthsToPayoff}
              </p>
              <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                months to payoff
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-black/20">
              <p className="text-3xl font-mono font-bold text-peach-dark dark:text-peach">
                ${result.totalInterest.toLocaleString()}
              </p>
              <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                total interest
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white/50 dark:bg-black/20 text-center">
            <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-1">
              Total you'll pay
            </p>
            <p className="text-2xl font-mono font-bold">
              ${result.totalPaid.toLocaleString()}
            </p>
          </div>
          
          {/* Tip */}
          <div className="mt-4 p-3 rounded-lg bg-sage/20 border-l-4 border-sage">
            <p className="text-sm">
              💡 <strong>Tip:</strong> Paying ${Math.round(result.monthlyPayment * 1.5)} instead would save you{' '}
              <strong>${Math.round(result.totalInterest * 0.4)}</strong> in interest!
            </p>
          </div>
        </div>
      )}
      
      {balance && apr && monthlyPayment && !result && (
        <div className="glass-card-solid p-6 bg-peach/20 text-center">
          <p className="text-peach-dark dark:text-peach font-medium">
            ⚠️ Payment too low to pay off balance. Increase your monthly payment above the interest charge.
          </p>
        </div>
      )}
    </div>
  )
}

