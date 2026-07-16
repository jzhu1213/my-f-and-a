# Property-Based Testing for Folio Simplification

This directory contains property-based tests using [fast-check](https://github.com/dubzzz/fast-check) for the Folio Simplification feature.

## Overview

Property-based testing (PBT) verifies that functions satisfy universal properties across a wide range of inputs, rather than testing specific examples. This helps catch edge cases and ensures correctness across the entire input space.

## Structure

- **`arbitraries.ts`** - Contains fast-check generators (arbitraries) for all Folio types
- **`arbitraries.test.ts`** - Tests to verify the generators produce valid data
- **Property test files** - Organized by feature area (e.g., `dailyAllowance.properties.ts`)

## Available Arbitraries

### Basic Types
- `arbTransactionCategory()` - Generates valid transaction categories
- `arbTransactionType()` - Generates 'income' or 'expense'
- `arbAccountType()` - Generates 'personal', 'gig', or 'savings'
- `arbAllowanceStatus()` - Generates 'healthy', 'caution', 'warning', or 'over'

### Money Amounts
- `arbMoneyAmount()` - Generates amounts from $0.01 to $9,999.99
- `arbSmallAmount()` - Generates amounts from $0.01 to $100.00
- `arbBudgetAmount()` - Generates amounts from $10 to $5,000

### Complex Types
- `arbTransaction()` - Generates complete Transaction objects
- `arbQuickTransaction()` - Generates QuickTransaction objects
- `arbBudget()` - Generates Budget objects
- `arbBudgetSet()` - Generates array of budgets (one per category)
- `arbDailyAllowance()` - Generates DailyAllowance objects
- `arbSmartSuggestion()` - Generates SmartSuggestion objects
- `arbContextualTip()` - Generates ContextualTip objects
- `arbCelebrationEvent()` - Generates CelebrationEvent objects
- `arbOnboardingResult()` - Generates OnboardingResult objects

### Dates and Times
- `arbDate(minDate?, maxDate?)` - Generates Date objects in a range
- `arbDateString(minDate?, maxDate?)` - Generates YYYY-MM-DD strings
- `arbISOString(minDate?, maxDate?)` - Generates ISO timestamp strings

## Usage Example

```typescript
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { arbBudgetSet, arbTransaction } from './arbitraries'
import { computeDailyAllowance } from '@/lib/budgetUtils'

describe('Daily Allowance Properties', () => {
  it('should always return non-negative amount', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        fc.array(arbTransaction()),
        fc.date(),
        (budgets, transactions, currentDate) => {
          const allowance = computeDailyAllowance(budgets, transactions, currentDate)
          expect(allowance.amount).toBeGreaterThanOrEqual(0)
        }
      )
    )
  })

  it('should cap rollover to ±2 days budget', () => {
    fc.assert(
      fc.property(
        arbBudgetSet(),
        fc.array(arbTransaction()),
        fc.date(),
        (budgets, transactions, currentDate) => {
          const allowance = computeDailyAllowance(budgets, transactions, currentDate)
          const maxRollover = allowance.dailyBudget * 2
          expect(Math.abs(allowance.rollover)).toBeLessThanOrEqual(maxRollover)
        }
      )
    )
  })
})
```

## Writing Property Tests

### 1. Identify Universal Properties

Look for invariants that should always hold:
- **Non-negativity**: "Amount should never be negative"
- **Bounds**: "Rollover should be capped to ±2 days"
- **Consistency**: "Status should match the calculated percentage"
- **Idempotence**: "Calculating twice gives same result"

### 2. Use Appropriate Arbitraries

Choose generators that match your input constraints:
- Use `arbSmallAmount()` for daily spending (not `arbMoneyAmount()`)
- Use `arbBudgetSet()` for complete budget configurations
- Use `arbDateString()` for date-based filtering

### 3. Add Preconditions When Needed

Use `fc.pre()` to filter inputs:
```typescript
fc.property(arbBudget(), (budget) => {
  fc.pre(budget.monthlyLimit > 0) // Only test with positive budgets
  // ... test logic
})
```

### 4. Keep Properties Simple

Each property test should verify ONE universal rule. Write multiple small tests rather than one complex test.

## Running Tests

```bash
# Run all tests
npm test

# Run only property tests
npm test properties

# Run with UI
npm run test:ui

# Run in watch mode
npm test -- --watch
```

## Debugging Failing Tests

When a property test fails, fast-check provides a counterexample:

```
Property failed after 42 tests
{ budgets: [...], transactions: [...], currentDate: ... }
Shrunk 15 times. Got minimal failing example:
{ budgets: [{ monthlyLimit: 100, ... }], transactions: [], currentDate: ... }
```

Use this minimal example to:
1. Understand the failing case
2. Add it as a unit test
3. Fix the bug
4. Verify the property passes

## References

- [fast-check Documentation](https://github.com/dubzzz/fast-check/tree/main/documentation)
- [Property-Based Testing Guide](https://github.com/dubzzz/fast-check/blob/main/documentation/Guides.md)
- [Vitest Documentation](https://vitest.dev/)
