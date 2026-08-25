/**
 * Zod schema for Debt.
 * Task 520.1
 */

import { z } from 'zod'

export const DebtTypeSchema = z.enum([
  'student_loan', 'credit_card', 'personal_loan', 'car_loan', 'other',
])

export const DebtSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: DebtTypeSchema,
  name: z.string().min(1),
  balance: z.number().nonnegative(),
  apr: z.number().nonnegative(),
  minimumPayment: z.number().nonnegative(),
  createdAt: z.string().min(1),
})

export type ValidatedDebt = z.infer<typeof DebtSchema>
