/**
 * Backup & Restore — Full JSON backup export and restore utilities.
 *
 * Exports all user data (Supabase + localStorage) as a versioned JSON file,
 * validates backup files against Zod schemas, and restores data by replacing
 * all existing records.
 *
 * Requirements: 32.7
 * Task: 529.1, 529.2
 */

import { supabase } from './supabaseClient'
import {
  getTransactions,
  getBudgets,
  getGoals,
  getDebts,
  getSavingsAccounts,
  getSinkingFunds,
  getReimbursements,
  getGamificationState,
  getPaySchedule,
  getFundingSources,
  deleteAllUserData,
} from './supabaseData'
import {
  TransactionSchema,
  BudgetSchema,
  GoalSchema,
  DebtSchema,
  SavingsAccountSchema,
  SinkingFundSchema,
  ReimbursementSchema,
  RecurringBillSchema,
  validateArray,
} from './schemas'
import type { Transaction, Budget, Goal } from '@/types'
import type { SavingsAccount, Debt } from '@/types/folio'
import type { SinkingFund } from './sinkingFunds'
import type { Reimbursement } from './reimbursements'
import type { FundingSource } from './fundingSources'
import type { PaySchedule } from './paySchedule'
import type { GamificationState } from './supabaseData'
import type { FixedExpense } from './fixedExpenses'

// ============================================================================
// Types
// ============================================================================

/** The versioned backup envelope structure. */
export interface BackupEnvelope {
  version: 1
  exportedAt: string
  appVersion: string
  data: BackupData
}

/** All user data contained in a backup. */
export interface BackupData {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  debts: Debt[]
  savingsAccounts: SavingsAccount[]
  sinkingFunds: SinkingFund[]
  reimbursements: Reimbursement[]
  fundingSources: FundingSource[]
  paySchedule: PaySchedule | null
  gamification: GamificationState | null
  recurringBills: FixedExpense[]
}

/** Result of validating a backup file before restore. */
export interface BackupValidationResult {
  valid: boolean
  data: BackupData | null
  errors: string[]
  warnings: string[]
}

/** Result of a restore operation. */
export interface RestoreResult {
  success: boolean
  error?: string
  restoredCounts: {
    transactions: number
    budgets: number
    goals: number
    debts: number
    savingsAccounts: number
    sinkingFunds: number
    reimbursements: number
    fundingSources: number
    recurringBills: number
  }
}

// ============================================================================
// Constants
// ============================================================================

const LAST_BACKUP_KEY = 'folio-last-backup-exported'
const RECURRING_BILLS_KEY = 'folio-recurring-bills'

// ============================================================================
// Export
// ============================================================================

/**
 * Fetch all user data and export it as a JSON file download.
 * Records the export timestamp in localStorage for the backup reminder tip.
 */
export async function exportFullBackup(userId: string): Promise<void> {
  // Fetch all data from Supabase in parallel
  const [
    transactions,
    budgets,
    goals,
    debts,
    savingsAccounts,
    sinkingFunds,
    reimbursements,
    fundingSources,
    paySchedule,
    gamification,
  ] = await Promise.all([
    getTransactions(userId),
    getBudgets(userId),
    getGoals(userId),
    getDebts(userId),
    getSavingsAccounts(userId),
    getSinkingFunds(userId),
    getReimbursements(userId),
    getFundingSources(userId),
    getPaySchedule(userId),
    getGamificationState(userId),
  ])

  // Fetch recurring bills from localStorage
  let recurringBills: FixedExpense[] = []
  try {
    const raw = localStorage.getItem(RECURRING_BILLS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FixedExpense[]
      recurringBills = parsed.filter((b) => b.userId === userId || b.userId === '')
    }
  } catch {
    // Best-effort — localStorage might be empty or corrupted
  }

  const envelope: BackupEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    data: {
      transactions,
      budgets,
      goals,
      debts,
      savingsAccounts,
      sinkingFunds,
      reimbursements,
      fundingSources,
      paySchedule,
      gamification,
      recurringBills,
    },
  }

  // Trigger download
  const jsonStr = JSON.stringify(envelope, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const stamp = new Date().toISOString().split('T')[0]
  const filename = `folio-backup-${stamp}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)

  // Record that the user has exported a backup
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  } catch {
    // Best-effort
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Read and validate a backup JSON file against schemas.
 * Returns validation results with quarantined items listed as warnings.
 */
export async function validateBackupFile(file: File): Promise<BackupValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Read file content
  let text: string
  try {
    text = await file.text()
  } catch {
    return { valid: false, data: null, errors: ['Could not read the file.'], warnings: [] }
  }

  // Parse JSON
  let envelope: unknown
  try {
    envelope = JSON.parse(text)
  } catch {
    return { valid: false, data: null, errors: ['File is not valid JSON.'], warnings: [] }
  }

  // Validate envelope structure
  if (typeof envelope !== 'object' || envelope === null) {
    return { valid: false, data: null, errors: ['Invalid backup format.'], warnings: [] }
  }

  const env = envelope as Record<string, unknown>

  if (env.version !== 1) {
    errors.push(`Unsupported backup version: ${env.version ?? 'missing'}`)
    return { valid: false, data: null, errors, warnings }
  }

  if (typeof env.data !== 'object' || env.data === null) {
    errors.push('Backup file is missing the data section.')
    return { valid: false, data: null, errors, warnings }
  }

  const raw = env.data as Record<string, unknown>

  // Validate each data section against schemas
  const txResult = validateArray(
    Array.isArray(raw.transactions) ? raw.transactions : [],
    TransactionSchema,
    'backup:transactions'
  )
  if (txResult.quarantined.length > 0) {
    warnings.push(`${txResult.quarantined.length} transaction(s) failed validation and will be skipped.`)
  }

  const budgetResult = validateArray(
    Array.isArray(raw.budgets) ? raw.budgets : [],
    BudgetSchema,
    'backup:budgets'
  )
  if (budgetResult.quarantined.length > 0) {
    warnings.push(`${budgetResult.quarantined.length} budget(s) failed validation and will be skipped.`)
  }

  const goalResult = validateArray(
    Array.isArray(raw.goals) ? raw.goals : [],
    GoalSchema,
    'backup:goals'
  )
  if (goalResult.quarantined.length > 0) {
    warnings.push(`${goalResult.quarantined.length} goal(s) failed validation and will be skipped.`)
  }

  const debtResult = validateArray(
    Array.isArray(raw.debts) ? raw.debts : [],
    DebtSchema,
    'backup:debts'
  )
  if (debtResult.quarantined.length > 0) {
    warnings.push(`${debtResult.quarantined.length} debt(s) failed validation and will be skipped.`)
  }

  const savingsResult = validateArray(
    Array.isArray(raw.savingsAccounts) ? raw.savingsAccounts : [],
    SavingsAccountSchema,
    'backup:savingsAccounts'
  )
  if (savingsResult.quarantined.length > 0) {
    warnings.push(`${savingsResult.quarantined.length} savings account(s) failed validation and will be skipped.`)
  }

  const sinkingResult = validateArray(
    Array.isArray(raw.sinkingFunds) ? raw.sinkingFunds : [],
    SinkingFundSchema,
    'backup:sinkingFunds'
  )
  if (sinkingResult.quarantined.length > 0) {
    warnings.push(`${sinkingResult.quarantined.length} sinking fund(s) failed validation and will be skipped.`)
  }

  const reimbResult = validateArray(
    Array.isArray(raw.reimbursements) ? raw.reimbursements : [],
    ReimbursementSchema,
    'backup:reimbursements'
  )
  if (reimbResult.quarantined.length > 0) {
    warnings.push(`${reimbResult.quarantined.length} reimbursement(s) failed validation and will be skipped.`)
  }

  const billsResult = validateArray(
    Array.isArray(raw.recurringBills) ? raw.recurringBills : [],
    RecurringBillSchema,
    'backup:recurringBills'
  )
  if (billsResult.quarantined.length > 0) {
    warnings.push(`${billsResult.quarantined.length} recurring bill(s) failed validation and will be skipped.`)
  }

  // Funding sources — no schema yet, pass through with basic shape check
  const fundingSources = Array.isArray(raw.fundingSources)
    ? (raw.fundingSources as FundingSource[]).filter(
        (fs) => typeof fs === 'object' && fs !== null && typeof fs.id === 'string' && typeof fs.label === 'string'
      )
    : []

  const data: BackupData = {
    transactions: txResult.valid as Transaction[],
    budgets: budgetResult.valid as Budget[],
    goals: goalResult.valid as Goal[],
    debts: debtResult.valid as Debt[],
    savingsAccounts: savingsResult.valid as SavingsAccount[],
    sinkingFunds: sinkingResult.valid as SinkingFund[],
    reimbursements: reimbResult.valid as Reimbursement[],
    fundingSources,
    paySchedule: (raw.paySchedule as PaySchedule) ?? null,
    gamification: (raw.gamification as GamificationState) ?? null,
    recurringBills: billsResult.valid as FixedExpense[],
  }

  // A backup is "valid" as long as we can parse the envelope and at least some data is present
  const hasAnyData =
    data.transactions.length > 0 ||
    data.budgets.length > 0 ||
    data.goals.length > 0 ||
    data.recurringBills.length > 0

  if (!hasAnyData && errors.length === 0) {
    warnings.push('The backup appears to be empty — no records found.')
  }

  return { valid: errors.length === 0, data, errors, warnings }
}

// ============================================================================
// Restore
// ============================================================================

/**
 * Restore all user data from a validated backup.
 * This REPLACES all existing data — deletes current data first, then inserts backup data.
 */
export async function restoreFromBackup(
  userId: string,
  backup: BackupData
): Promise<RestoreResult> {
  const counts = {
    transactions: 0,
    budgets: 0,
    goals: 0,
    debts: 0,
    savingsAccounts: 0,
    sinkingFunds: 0,
    reimbursements: 0,
    fundingSources: 0,
    recurringBills: 0,
  }

  // Step 1: Delete all existing data
  const deleteResult = await deleteAllUserData(userId)
  if (!deleteResult.success) {
    return {
      success: false,
      error: deleteResult.error ?? 'Failed to clear existing data before restore.',
      restoredCounts: counts,
    }
  }

  // Step 2: Insert backup data (order matters for foreign keys)

  // Funding sources first (transactions may reference them)
  if (backup.fundingSources.length > 0) {
    const rows = backup.fundingSources.map((fs) => ({
      id: fs.id,
      user_id: userId,
      label: fs.label,
      emoji: fs.emoji,
      kind: fs.kind,
      reduces_balance_now: fs.reducesBalanceNow,
      snapshot_balance: fs.snapshotBalance ?? 0,
    }))
    const { error } = await supabase.from('funding_sources').insert(rows)
    if (error) {
      console.error('Restore: funding_sources insert failed:', error)
    } else {
      counts.fundingSources = rows.length
    }
  }

  // Goals (before transactions that might reference goal IDs)
  if (backup.goals.length > 0) {
    const rows = backup.goals.map((g) => ({
      id: g.id,
      user_id: userId,
      name: g.name,
      target_amount: g.targetAmount,
      current_amount: g.currentAmount,
      emoji: g.emoji ?? '🎯',
      created_at: g.createdAt ?? new Date().toISOString(),
      target_date: g.targetDate ?? null,
    }))
    const { error } = await supabase.from('goals').insert(rows)
    if (error) {
      console.error('Restore: goals insert failed:', error)
    } else {
      counts.goals = rows.length
    }
  }

  // Budgets
  if (backup.budgets.length > 0) {
    const rows = backup.budgets.map((b) => ({
      id: b.id,
      user_id: userId,
      category: b.category,
      monthly_limit: b.monthlyLimit,
      spent: b.spent,
      month: b.month,
    }))
    const { error } = await supabase.from('budgets').insert(rows)
    if (error) {
      console.error('Restore: budgets insert failed:', error)
    } else {
      counts.budgets = rows.length
    }
  }

  // Transactions
  if (backup.transactions.length > 0) {
    // Insert in batches of 500 to avoid payload limits
    const batchSize = 500
    for (let i = 0; i < backup.transactions.length; i += batchSize) {
      const batch = backup.transactions.slice(i, i + batchSize)
      const rows = batch.map((tx) => ({
        id: tx.id,
        user_id: userId,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        note: tx.note ?? null,
        is_recurring: tx.isRecurring ?? false,
        account_type: tx.accountType ?? 'personal',
        ...(tx.fundingSourceId ? { funding_source_id: tx.fundingSourceId } : {}),
      }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) {
        console.error(`Restore: transactions batch ${i} insert failed:`, error)
      } else {
        counts.transactions += rows.length
      }
    }
  }

  // Debts
  if (backup.debts.length > 0) {
    const rows = backup.debts.map((d) => ({
      id: d.id,
      user_id: userId,
      type: d.type,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimum_payment: d.minimumPayment,
      created_at: d.createdAt ?? new Date().toISOString(),
    }))
    const { error } = await supabase.from('debts').insert(rows)
    if (error) {
      console.error('Restore: debts insert failed:', error)
    } else {
      counts.debts = rows.length
    }
  }

  // Savings accounts
  if (backup.savingsAccounts.length > 0) {
    const rows = backup.savingsAccounts.map((sa) => ({
      id: sa.id,
      user_id: userId,
      type: sa.type,
      name: sa.name,
      balance: sa.balance,
      monthly_contribution: sa.monthlyContribution,
      expected_annual_return: sa.expectedAnnualReturn,
      created_at: sa.createdAt ?? new Date().toISOString(),
    }))
    const { error } = await supabase.from('savings_accounts').insert(rows)
    if (error) {
      console.error('Restore: savings_accounts insert failed:', error)
    } else {
      counts.savingsAccounts = rows.length
    }
  }

  // Sinking funds
  if (backup.sinkingFunds.length > 0) {
    const rows = backup.sinkingFunds.map((sf) => ({
      id: sf.id,
      user_id: userId,
      label: sf.label,
      category: sf.category,
      target_amount: sf.targetAmount,
      due_date: sf.dueDate || null,
      saved_amount: sf.savedAmount,
      monthly_reserve: sf.monthlyReserve,
      created_at: sf.createdAt ?? new Date().toISOString(),
    }))
    const { error } = await supabase.from('sinking_funds').insert(rows)
    if (error) {
      console.error('Restore: sinking_funds insert failed:', error)
    } else {
      counts.sinkingFunds = rows.length
    }
  }

  // Reimbursements
  if (backup.reimbursements.length > 0) {
    const rows = backup.reimbursements.map((r) => ({
      id: r.id,
      user_id: userId,
      person_name: r.personName,
      direction: r.direction,
      amount: r.amount,
      note: r.note,
      settled: r.settled,
      settled_at: r.settledAt,
      created_at: r.createdAt,
      linked_transaction_id: r.linkedTransactionId ?? null,
    }))
    const { error } = await supabase.from('reimbursements').insert(rows)
    if (error) {
      console.error('Restore: reimbursements insert failed:', error)
    } else {
      counts.reimbursements = rows.length
    }
  }

  // Pay schedule
  if (backup.paySchedule) {
    const ps = backup.paySchedule
    const { error } = await supabase.from('pay_schedules').upsert({
      user_id: userId,
      cadence: ps.cadence,
      anchor_date: ps.anchorDate,
      amount: ps.amount ?? null,
    }, { onConflict: 'user_id' })
    if (error) {
      console.error('Restore: pay_schedules upsert failed:', error)
    }
  }

  // Gamification state
  if (backup.gamification) {
    const { error } = await supabase.from('user_gamification').upsert({
      user_id: userId,
      streak_data: backup.gamification.streakData ?? {},
      challenge_progress: backup.gamification.challengeProgress ?? {},
      zero_spend_days: backup.gamification.zeroSpendDays ?? [],
    }, { onConflict: 'user_id' })
    if (error) {
      console.error('Restore: user_gamification upsert failed:', error)
    }
  }

  // Recurring bills → localStorage
  if (backup.recurringBills.length > 0) {
    try {
      const bills = backup.recurringBills.map((b) => ({
        ...b,
        userId: userId,
      }))
      localStorage.setItem(RECURRING_BILLS_KEY, JSON.stringify(bills))
      counts.recurringBills = bills.length
    } catch {
      console.error('Restore: Could not write recurring bills to localStorage')
    }
  }

  return { success: true, restoredCounts: counts }
}

// ============================================================================
// Backup Reminder Helpers
// ============================================================================

/**
 * Returns whether the user has ever exported a full JSON backup.
 */
export function hasExportedBackup(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(LAST_BACKUP_KEY) !== null
  } catch {
    return true // Assume yes if localStorage unavailable
  }
}

/**
 * Returns the ISO timestamp of the last backup export, or null if never exported.
 */
export function getLastBackupDate(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}
