/**
 * Zod schema for RecurringBill (FixedExpense).
 * Task 520.1
 */

import { z } from 'zod'
import { TransactionCategorySchema } from './transaction'

export const RecurringBillSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  category: TransactionCategorySchema,
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  recurringId: z.string().min(1),
  isActive: z.boolean(),
})

export type ValidatedRecurringBill = z.infer<typeof RecurringBillSchema>
