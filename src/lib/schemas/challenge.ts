/**
 * Zod schema for Challenge and ChallengeData.
 * Task 520.1
 */

import { z } from 'zod'
import { TransactionCategorySchema } from './transaction'

export const ChallengeTypeSchema = z.enum([
  'spending_limit', 'no_spend_category', 'logging_consistency', 'savings', 'custom',
])

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  type: ChallengeTypeSchema,
  targetValue: z.number().nonnegative(),
  duration: z.number().int().min(3).max(14),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean(),
  progress: z.number(),
  isComplete: z.boolean(),
  category: TransactionCategorySchema.optional(),
})

export const ChallengeDataSchema = z.object({
  challenges: z.array(ChallengeSchema),
  lastSuggestionWeek: z.number().int(),
})

export type ValidatedChallenge = z.infer<typeof ChallengeSchema>
export type ValidatedChallengeData = z.infer<typeof ChallengeDataSchema>
