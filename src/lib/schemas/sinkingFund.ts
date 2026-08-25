/**
 * Zod schema for SinkingFund.
 * Task 520.1
 */

import { z } from 'zod'
import { TransactionCategorySchema } from './transaction'

export const SinkingFundSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  label: z.string().min(1),
  category: TransactionCategorySchema,
  targetAmount: z.number().nonnegative(),
  dueDate: z.string(), // can be empty string
  savedAmount: z.number().nonnegative(),
  monthlyReserve: z.number().nonnegative(),
  createdAt: z.string().min(1),
})

export type ValidatedSinkingFund = z.infer<typeof SinkingFundSchema>
