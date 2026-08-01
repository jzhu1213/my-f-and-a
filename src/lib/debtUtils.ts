import type { Debt } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'

/**
 * Pure utility functions for debt calculations.
 *
 * All functions handle edge cases (zero balance, zero APR, payment too low)
 * and return stable values (Infinity when payoff is impossible, 0 for zero balances).
 */

// ============================================================================
// Multi-debt payoff strategy types
// ============================================================================

export interface DebtPayoffEntry {
  debtId: string
  paidOffMonth: number
}

export interface StrategyResult {
  totalMonths: number
  totalInterestPaid: number
  payoffSchedule: DebtPayoffEntry[]
}

export type StrategyName = 'snowball' | 'avalanche'

export interface StrategyComparison {
  snowball: StrategyResult
  avalanche: StrategyResult
  recommended: StrategyName
  interestSaved: number
}

// ============================================================================
// Multi-debt payoff simulation
// ============================================================================

/**
 * Simulates paying off multiple debts using the snowball method (smallest balance first).
 * Pays minimums on all debts, applies extra payment to the smallest balance.
 * @param debts Array of debts with positive balances
 * @param extraPayment Additional monthly payment beyond all minimums combined
 */
export function simulateSnowball(debts: Debt[], extraPayment: number = 0): StrategyResult {
  const sorted = [...debts].filter(d => d.balance > 0).sort((a, b) => a.balance - b.balance)
  return simulateStrategy(sorted, extraPayment)
}

/**
 * Simulates paying off multiple debts using the avalanche method (highest APR first).
 * Pays minimums on all debts, applies extra payment to the highest-APR debt.
 * @param debts Array of debts with positive balances
 * @param extraPayment Additional monthly payment beyond all minimums combined
 */
export function simulateAvalanche(debts: Debt[], extraPayment: number = 0): StrategyResult {
  const sorted = [...debts].filter(d => d.balance > 0).sort((a, b) => b.apr - a.apr)
  return simulateStrategy(sorted, extraPayment)
}

/**
 * Compares snowball and avalanche strategies and recommends one.
 * @param debts Array of debts
 * @param extraPayment Extra monthly payment beyond minimums
 */
export function compareStrategies(debts: Debt[], extraPayment: number = 0): StrategyComparison {
  const snowball = simulateSnowball(debts, extraPayment)
  const avalanche = simulateAvalanche(debts, extraPayment)

  const interestSaved = Math.abs(snowball.totalInterestPaid - avalanche.totalInterestPaid)

  // Recommend avalanche if it saves meaningful interest (>$25), otherwise snowball for motivation
  const recommended: StrategyName =
    avalanche.totalInterestPaid < snowball.totalInterestPaid && interestSaved > 25
      ? 'avalanche'
      : 'snowball'

  return { snowball, avalanche, recommended, interestSaved }
}

/**
 * Internal simulation engine. Debts should be pre-sorted by priority.
 * The first debt in the array receives the extra payment.
 */
function simulateStrategy(sortedDebts: Debt[], extraPayment: number): StrategyResult {
  if (sortedDebts.length === 0) {
    return { totalMonths: 0, totalInterestPaid: 0, payoffSchedule: [] }
  }

  const balances = sortedDebts.map(d => d.balance)
  const aprs = sortedDebts.map(d => d.apr)
  const minimums = sortedDebts.map(d => d.minimumPayment)
  const ids = sortedDebts.map(d => d.id)

  const payoffSchedule: DebtPayoffEntry[] = []
  let totalInterest = 0
  let month = 0
  const maxMonths = 1200 // 100-year cap to prevent infinite loops

  while (balances.some(b => b > 0) && month < maxMonths) {
    month++

    // Accrue interest
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const monthlyInterest = balances[i] * (aprs[i] / 100) / 12
      balances[i] += monthlyInterest
      totalInterest += monthlyInterest
    }

    // Pay minimums on all active debts
    let freedUp = 0
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const payment = Math.min(minimums[i], balances[i])
      balances[i] -= payment
      if (balances[i] <= 0.01) {
        freedUp += minimums[i] - payment
        balances[i] = 0
        if (!payoffSchedule.find(e => e.debtId === ids[i])) {
          payoffSchedule.push({ debtId: ids[i], paidOffMonth: month })
        }
      }
    }

    // Apply extra payment + freed-up minimums to highest-priority remaining debt
    let extraAvailable = extraPayment + freedUp
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0 || extraAvailable <= 0) continue
      const payment = Math.min(extraAvailable, balances[i])
      balances[i] -= payment
      extraAvailable -= payment
      if (balances[i] <= 0.01) {
        balances[i] = 0
        if (!payoffSchedule.find(e => e.debtId === ids[i])) {
          payoffSchedule.push({ debtId: ids[i], paidOffMonth: month })
        }
      }
    }
  }

  // If any debts remain unpaid, mark them as Infinity
  for (let i = 0; i < balances.length; i++) {
    if (balances[i] > 0 && !payoffSchedule.find(e => e.debtId === ids[i])) {
      payoffSchedule.push({ debtId: ids[i], paidOffMonth: Infinity })
    }
  }

  const totalMonths = payoffSchedule.length > 0
    ? Math.max(...payoffSchedule.map(e => e.paidOffMonth))
    : 0

  return {
    totalMonths,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    payoffSchedule,
  }
}

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
