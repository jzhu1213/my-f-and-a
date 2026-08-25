/**
 * Zod schema for Goal.
 * Task 520.1
 */

import { z } from 'zod'

export const GoalParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contributedAmount: z.number().nonnegative(),
  joinedAt: z.string().min(1),
})

export const GoalSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  targetAmount: z.number().nonnegative(),
  currentAmount: z.number().nonnegative(),
  emoji: z.string().min(1),
  createdAt: z.string().min(1),
  type: z.enum(['savings', 'emergency_fund', 'shared']).optional(),
  targetDate: z.string().optional(),
  isShared: z.boolean().optional(),
  participants: z.array(GoalParticipantSchema).optional(),
  shareToken: z.string().optional(),
  linkedAccountId: z.string().optional(),
})

export type ValidatedGoal = z.infer<typeof GoalSchema>
