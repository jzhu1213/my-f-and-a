/**
 * Zod schema for Transaction and related types.
 * Task 520.1
 */

import { z } from 'zod'

export const TransactionCategorySchema = z.enum([
  'food', 'drinks', 'rent', 'transport', 'school',
  'fun', 'health', 'subscriptions', 'gig', 'income', 'other',
])

export const TransactionTypeSchema = z.enum(['income', 'expense'])

export const AccountTypeSchema = z.enum(['personal', 'gig', 'savings'])

export const TransactionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative(),
  type: TransactionTypeSchema,
  category: TransactionCategorySchema,
  note: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringId: z.string().optional(),
  accountType: AccountTypeSchema,
  createdAt: z.string().min(1),
  fundingSourceId: z.string().optional(),
  scheduled: z.boolean().optional(),
  tags: z.array(z.string().max(20)).max(5).optional(),
  receiptUrl: z.string().optional(),
  incomeStreamId: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().positive().optional(),
})

export type ValidatedTransaction = z.infer<typeof TransactionSchema>

/**
 * Partial schema for validating import candidates before full insertion.
 * Only requires the fields available at parse time.
 */
export const ImportCandidateFieldsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative(),
  type: TransactionTypeSchema,
  category: TransactionCategorySchema,
  description: z.string(),
})
