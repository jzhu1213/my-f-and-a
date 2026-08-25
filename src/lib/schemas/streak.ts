/**
 * Zod schema for StreakData.
 * Task 520.1
 */

import { z } from 'zod'

export const StreakDataSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  totalActiveDays: z.number().int().nonnegative(),
  graceDaysRemaining: z.number().int().nonnegative(),
  lastActiveDate: z.string().nullable(),
  graceDaysUsedThisWeek: z.number().int().nonnegative(),
  zeroSpendDays: z.array(z.string()),
})

export type ValidatedStreakData = z.infer<typeof StreakDataSchema>
