/**
 * Feature: Daily Allowance
 *
 * The core "can I afford this?" calculation and its hero display.
 * This barrel re-exports from the canonical source locations so consumers
 * can import from `@/features/daily-allowance` while underlying files
 * still live in their original places. Once the simplified app is fully
 * integrated and old code removed, the implementations can be physically
 * moved here.
 */

// Components
export { DailyAllowanceHero } from '@/components/simplified/DailyAllowanceHero'
export { AllowanceRing } from '@/components/simplified/AllowanceRing'

// Utilities
export {
  computeDailyAllowance,
  getStatus,
  generateEncouragingMessage,
} from '@/lib/dailyAllowanceUtils'

// Types
export type { DailyAllowance, AllowanceStatus } from '@/types/folio'
