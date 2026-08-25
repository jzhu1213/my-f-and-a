/**
 * Schema barrel — exports all Zod schemas and validation utilities.
 * Task 520.1
 */

export { TransactionSchema, TransactionCategorySchema, TransactionTypeSchema, AccountTypeSchema, ImportCandidateFieldsSchema } from './transaction'
export type { ValidatedTransaction } from './transaction'

export { BudgetSchema } from './budget'
export type { ValidatedBudget } from './budget'

export { GoalSchema, GoalParticipantSchema } from './goal'
export type { ValidatedGoal } from './goal'

export { DebtSchema, DebtTypeSchema } from './debt'
export type { ValidatedDebt } from './debt'

export { SavingsAccountSchema, SavingsAccountTypeSchema } from './savingsAccount'
export type { ValidatedSavingsAccount } from './savingsAccount'

export { ReimbursementSchema, ReimbursementDirectionSchema } from './reimbursement'
export type { ValidatedReimbursement } from './reimbursement'

export { RecurringBillSchema } from './recurringBill'
export type { ValidatedRecurringBill } from './recurringBill'

export { SinkingFundSchema } from './sinkingFund'
export type { ValidatedSinkingFund } from './sinkingFund'

export { StreakDataSchema } from './streak'
export type { ValidatedStreakData } from './streak'

export { ChallengeSchema, ChallengeDataSchema, ChallengeTypeSchema } from './challenge'
export type { ValidatedChallenge, ValidatedChallengeData } from './challenge'

export { UserPreferencesSchema, HeroMeaningSchema } from './userPreferences'
export type { ValidatedUserPreferences } from './userPreferences'

export { validateArray, validateSingle } from './validate'
export type { ValidateArrayResult } from './validate'
