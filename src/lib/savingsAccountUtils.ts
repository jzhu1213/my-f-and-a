import type { SavingsAccount, SavingsAccountType } from '@/types/folio'
import { SAVINGS_ACCOUNT_TYPES } from '@/types/folio'

/**
 * Compute the total balance across all savings/investment accounts.
 */
export function computeTotalSavingsBalance(accounts: SavingsAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0)
}

/**
 * Compute the total monthly contributions across all accounts.
 */
export function computeMonthlyContributions(accounts: SavingsAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.monthlyContribution, 0)
}

/**
 * Get the metadata entry for a given savings account type.
 * Falls back to the 'other' type if not found.
 */
export function getAccountTypeMetadata(type: SavingsAccountType) {
  return (
    SAVINGS_ACCOUNT_TYPES.find(entry => entry.type === type) ??
    SAVINGS_ACCOUNT_TYPES[SAVINGS_ACCOUNT_TYPES.length - 1]
  )
}
