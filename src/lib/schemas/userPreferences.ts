/**
 * Zod schema for UserPreferences — settings stored in localStorage.
 * Task 520.1
 */

import { z } from 'zod'

export const HeroMeaningSchema = z.enum(['allowance', 'spent_today', 'spent_week', 'balance'])

export const UserPreferencesSchema = z.object({
  /** Which hero meaning is currently active */
  heroMeaning: HeroMeaningSchema.optional(),
  /** IDs of dismissed tips */
  dismissedTips: z.array(z.string()).optional(),
  /** Whether reduced motion is preferred */
  reducedMotion: z.boolean().optional(),
  /** Whether celebrations are enabled */
  celebrationsEnabled: z.boolean().optional(),
  /** Whether the user has seen the welcome flow */
  hasSeenWelcome: z.boolean().optional(),
  /** Last viewed month in history screen */
  lastViewedMonth: z.string().optional(),
  /** Whether carryover is enabled */
  carryoverEnabled: z.boolean().optional(),
  /** Home currency code */
  homeCurrency: z.string().optional(),
})

export type ValidatedUserPreferences = z.infer<typeof UserPreferencesSchema>
