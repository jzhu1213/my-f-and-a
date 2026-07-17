/**
 * Feature modules barrel export.
 *
 * Each feature folder encapsulates a cohesive domain:
 *   - daily-allowance  → Core "can I afford this?" calculation & display
 *   - quick-log        → One-tap expense logging with smart suggestions
 *   - celebrations     → Positive reinforcement animations & milestones
 *   - contextual-tips  → Inline tips, nudges, and educational content
 *   - theme            → Visual design system (warm/dark, glass, motion)
 *   - onboarding       → First-time setup flow
 *
 * Import from individual features for tree-shaking:
 *   import { computeDailyAllowance } from '@/features/daily-allowance'
 *   import { QuickLogArea } from '@/features/quick-log'
 */

export * from './daily-allowance'
export * from './quick-log'
export * from './celebrations'
export * from './contextual-tips'
export * from './theme'
export * from './onboarding'
