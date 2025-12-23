"use client"
import { useState, useMemo } from 'react'
import type { CompoundGrowthResult } from '@/types'

interface CompoundGrowthCalculatorProps {
  onBack: () => void
}

export function CompoundGrowthCalculator({ onBack }: CompoundGrowthCalculatorProps) {
  const [initialAmount, setInitialAmount] = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [annualReturn, setAnnualReturn] = useState('7')
  const [years, setYears] = useState('10')
  
  const result = useMemo<CompoundGrowthResult | null>(() => {
    const principal = parseFloat(initialAmount) || 0
    const monthly = parseFloat(monthlyContribution) || 0
    const rate = (parseFloat(annualReturn) || 0) / 100
    const periods = parseInt(years) || 0
    
    if (periods <= 0 || (principal <= 0 && monthly <= 0)) return null
    
    const monthlyRate = rate / 12
    const totalMonths = periods * 12
    
    // Compound growth formula with monthly contributions
    let balance = principal
    const yearlyBreakdown: { year: number; balance: number }[] = []
    
    for (let month = 1; month <= totalMonths; month++) {
      balance = balance * (1 + monthlyRate) + monthly
      
      if (month % 12 === 0) {
        yearlyBreakdown.push({
          year: month / 12,
          balance: Math.round(balance),
        })
      }
    }
    
    const totalContributions = principal + (monthly * totalMonths)
    const totalInterest = balance - totalContributions
    
    return {
      finalAmount: Math.round(balance),
      totalContributions: Math.round(totalContributions),
      totalInterest: Math.round(totalInterest),
      yearlyBreakdown,
    }
  }, [initialAmount, monthlyContribution, annualReturn, years])
  
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
          <span className="text-3xl">📈</span>
          <h1 className="text-2xl font-heading font-bold">Compound Growth</h1>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Starting Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1000"
                value={initialAmount}
                onChange={handleInputChange(setInitialAmount)}
                className="input-folio pl-8"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Monthly Contribution
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="100"
                value={monthlyContribution}
                onChange={handleInputChange(setMonthlyContribution)}
                className="input-folio pl-8"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
                Annual Return
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="7"
                  value={annualReturn}
                  onChange={handleInputChange(setAnnualReturn)}
                  className="input-folio pr-8"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">%</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
                Years
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="10"
                value={years}
                onChange={handleInputChange(setYears)}
                className="input-folio"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Results */}
      {result && (
        <div className="glass-card-solid p-6 bg-sage/10 dark:bg-sage/20 stagger-1">
          <h2 className="text-lg font-heading font-bold mb-4">Your Growth Projection</h2>
          
          <div className="text-center p-6 rounded-xl bg-white/50 dark:bg-black/20 mb-4">
            <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-1">
              Future Value
            </p>
            <p className="text-4xl font-mono font-bold text-sage-dark dark:text-sage">
              ${result.finalAmount.toLocaleString()}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-black/20">
              <p className="text-xl font-mono font-bold">
                ${result.totalContributions.toLocaleString()}
              </p>
              <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                your contributions
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-black/20">
              <p className="text-xl font-mono font-bold text-sage-dark dark:text-sage">
                ${result.totalInterest.toLocaleString()}
              </p>
              <p className="text-xs text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                earned from growth
              </p>
            </div>
          </div>
          
          {/* Simple Growth Chart */}
          <div className="mt-4">
            <p className="text-sm font-medium mb-3">Growth Over Time</p>
            <div className="space-y-2">
              {result.yearlyBreakdown.filter((_, idx) => idx % Math.ceil(result.yearlyBreakdown.length / 5) === 0 || idx === result.yearlyBreakdown.length - 1).map((year) => (
                <div key={year.year} className="flex items-center gap-3">
                  <span className="text-xs w-12 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
                    Year {year.year}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-sage to-sage-dark rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(year.balance / result.finalAmount) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono w-20 text-right">
                    ${year.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Tip */}
          <div className="mt-4 p-3 rounded-lg bg-sage/20 border-l-4 border-sage">
            <p className="text-sm">
              💡 <strong>The power of time:</strong> Starting 5 years earlier could grow your money to{' '}
              <strong>${Math.round(result.finalAmount * 1.5).toLocaleString()}</strong>!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

