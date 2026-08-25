/**
 * Zod schema for Reimbursement.
 * Task 520.1
 */

import { z } from 'zod'

export const ReimbursementDirectionSchema = z.enum(['owed_to_me', 'owed_by_me'])

export const ReimbursementSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  personName: z.string().min(1),
  direction: ReimbursementDirectionSchema,
  amount: z.number().nonnegative(),
  note: z.string(),
  settled: z.boolean(),
  settledAt: z.string().nullable(),
  createdAt: z.string().min(1),
  linkedTransactionId: z.string().optional(),
  settledViaSourceId: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().positive().optional(),
  originalAmount: z.number().nonnegative().optional(),
})

export type ValidatedReimbursement = z.infer<typeof ReimbursementSchema>
