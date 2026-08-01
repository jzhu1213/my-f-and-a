/**
 * Allowance Domain — everything related to computing and presenting the user's
 * daily spending allowance, term-based budgeting, weekend modes, and spend-down.
 *
 * Re-exports from the parent-level utility files so consumers can import from
 * `@/lib/allowance` as a cohesive module while preserving backward compatibility
 * with existing `@/lib/<file>` imports.
 */

export * from '../dailyAllowanceUtils'
export * from '../termAllowance'
export * from '../weekendAllowance'
export * from '../spendDown'
export * from '../spendingModes'
export * from '../affordabilityUtils'
