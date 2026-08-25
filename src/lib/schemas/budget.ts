/**
 * Zod schema for Budget.
 * Task 520.1
 */

import { z } from 'zod'
import { TransactionCategorySchema } from './transaction'

export const BudgetSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  category: TransactionCategorySchema,
  monthlyLimit: z.number().nonnegative(),
  spent: z.number(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  isFixed: z.boolean().optional(),
  limitType: z.enum(['soft', 'hard']).optional(),
  period: z.enum(['monthly', 'weekly', 'payday_aligned', 'semester']).optional(),
  perTransactionAlert: z.number().nonnegative().optional(),
})

export type ValidatedBudget = z.infer<typeof BudgetSchema>
