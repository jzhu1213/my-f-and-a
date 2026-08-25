/**
 * Zod schema for SavingsAccount.
 * Task 520.1
 */

import { z } from 'zod'

export const SavingsAccountTypeSchema = z.enum([
  'hysa', 'roth_ira', '401k', 'brokerage', 'savings', 'other',
])

export const SavingsAccountSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: SavingsAccountTypeSchema,
  name: z.string().min(1),
  balance: z.number(),
  monthlyContribution: z.number().nonnegative(),
  expectedAnnualReturn: z.number(),
  createdAt: z.string().min(1),
})

export type ValidatedSavingsAccount = z.infer<typeof SavingsAccountSchema>
