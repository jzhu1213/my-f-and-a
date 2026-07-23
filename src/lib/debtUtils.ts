import type { Debt } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'

/**
 * Pure utility functions for debt calculations.
 *
 * All functions handle edge cases (zero balance, zero APR, payment too low)
 * and return stable values (Infinity when payoff is impossible, 0 for zero balances).
 */

/**
 * Computes monthly interest charge for a given balance and APR.
 * @param balance Current debt balance
 * @param apr Annual percentage rate (e.g., 6.5 for 6.5%)
 * @returns Monthly interest in dollars
 */
export function getMonthlyInterest(balance: number, apr: number): number {
  if (balance <= 0 || apr <= 0) return 0
  return balance * (apr / 100) / 12
}

/**
 * Estimates the number of months to pay off a debt.
 * Uses the standard amortization formula for fixed monthly payments.
 * @returns Number of months to pay off, or Infinity if payment <= monthly interest
 */
export function getPayoffMonths(balance: number, apr: number, monthlyPayment: number): number {
  if (balance <= 0) return 0
  if (monthlyPayment <= 0) return Infinity

  // Zero APR — simple division
  if (apr <= 0) {
    return Math.ceil(balance / monthlyPayment)
  }

  const monthlyRate = apr / 100 / 12
  const monthlyInterest = balance * monthlyRate

  // Payment doesn't cover interest — will never pay off
  if (monthlyPayment <= monthlyInterest) return Infinity

  // Standard payoff formula: n = -log(1 - (r * B) / P) / log(1 + r)
  const months = -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate)

  return Math.ceil(months)
}

/**
 * Calculates total interest paid over the payoff period.
 * @returns Total interest in dollars, or Infinity if debt can't be paid off
 */
export function getTotalInterestPaid(balance: number, apr: number, monthlyPayment: number): number {
  if (balance <= 0 || apr <= 0) return 0
  if (monthlyPayment <= 0) return Infinity

  const months = getPayoffMonths(balance, apr, monthlyPayment)
  if (months === Infinity) return Infinity

  const totalPaid = monthlyPayment * months
  // Adjust for partial last payment
  return Math.max(0, totalPaid - balance)
}

/**
 * Sums all debt balances.
 */
export function getTotalDebtBalance(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.balance, 0)
}

/**
 * Sums all minimum monthly payments.
 */
export function getTotalMinimumPayments(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.minimumPayment, 0)
}

/**
 * Returns debts sorted by APR descending (avalanche method priority).
 * Higher-rate debts come first.
 */
export function sortDebtsByInterestRate(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => b.apr - a.apr)
}

/**
 * Converts debts into FixedExpense entries so their minimum payments
 * are treated as fixed monthly obligations in the daily allowance calculation.
 * Only debts with a positive balance are marked active.
 */
export function debtsToFixedExpenses(debts: Debt[]): FixedExpense[] {
  return debts.map(debt => ({
    id: `debt-${debt.id}`,
    userId: debt.userId,
    category: 'other' as const,
    label: `${debt.name} (min. payment)`,
    amount: debt.minimumPayment,
    dueDay: 1,
    recurringId: `debt-${debt.id}`,
    isActive: debt.balance > 0,
  }))
}
