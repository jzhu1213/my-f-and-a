# Folio Data Model

This document describes the Supabase tables powering Folio, how they relate to each
other, and how the TypeScript type surface maps onto the underlying database schema.

All tables use Row-Level Security (RLS) keyed on `user_id` matching the authenticated
Supabase Auth user. Column names in the database use `snake_case`; the app converts
them to `camelCase` via mapper functions in `src/lib/supabaseData.ts`.

---

## Table Overview

```
profiles ──────────────── 1 user identity + preferences
transactions ──────────── many expenses and income events per user
budgets ───────────────── monthly spending limits per category
goals ─────────────────── savings targets
sinking_funds ─────────── reserves for known future costs
allocations ───────────── income split records (spend/save/invest/set-aside)
savings_accounts ──────── tracked external savings/investment accounts
debts ─────────────────── tracked liabilities (student loans, credit cards, etc.)
reimbursements ────────── IOUs owed to/by the user
funding_sources ───────── payment methods (debit, cash, credit, wallets, borrowed)
pay_schedules ─────────── user's pay cadence + anchor date
lesson_progress ───────── educational lesson completion tracking
```

---

## Entity-Relationship Diagram (Conceptual)

```
┌─────────────┐
│   profiles   │  (1 per auth user)
└──────┬──────┘
       │ user_id (FK on all tables)
       │
       ├─────────────────┬──────────────────┬──────────────────┐
       │                 │                  │                  │
┌──────▼──────┐  ┌───────▼───────┐  ┌──────▼──────┐  ┌───────▼───────┐
│ transactions │  │    budgets    │  │    goals    │  │ sinking_funds │
│              │  │ (per month)   │  │             │  │               │
└──────┬───────┘  └───────────────┘  └─────────────┘  └───────────────┘
       │
       │ fundingSourceId (optional FK)
       │
┌──────▼────────┐
│funding_sources │
└───────────────┘

Other per-user tables (no direct FK to transactions):
  allocations, savings_accounts, debts, reimbursements, pay_schedules, lesson_progress
```

---

## Table Schemas

### `profiles`

User identity and preferences. Created automatically on first sign-in.

| Column                    | Type      | Notes                                        |
|---------------------------|-----------|----------------------------------------------|
| `id`                      | uuid (PK) | Matches Supabase Auth user ID                |
| `name`                    | text      | Display name                                 |
| `email`                   | text      | From auth; duplicated for convenience        |
| `user_type`               | text      | `'student'` · `'gig_worker'` · `'small_business'` |
| `priority`                | text      | `'avoid_overdraft'` · `'pay_debt'` · `'save'` · `'learn_investing'` |
| `has_completed_onboarding`| boolean   | Whether user finished initial setup          |
| `display_name`            | text      | Optional custom display name                 |
| `avatar_url`              | text      | Optional avatar image URL                    |
| `count_credit_immediately`| boolean   | Whether credit card spend counts against today's allowance (default: true) |
| `created_at`              | timestamp | Row creation time                            |

**App type:** `UserProfile` (`src/types/index.ts`)

---

### `transactions`

Every logged income or expense. The primary data source for daily allowance calculation.

| Column           | Type      | Notes                                      |
|------------------|-----------|--------------------------------------------|
| `id`             | uuid (PK) | Auto-generated                             |
| `user_id`        | uuid (FK) | References `profiles.id`                   |
| `date`           | text      | `YYYY-MM-DD` — the financial date          |
| `type`           | text      | `'income'` · `'expense'`                   |
| `amount`         | numeric   | Always positive; direction implied by type |
| `category`       | text      | One of `TransactionCategory` enum values   |
| `note`           | text      | Optional user note (max 60 chars in app)   |
| `is_recurring`   | boolean   | Whether this is a recurring charge         |
| `recurring_id`   | text      | Groups recurring instances together        |
| `account_type`   | text      | `'personal'` · `'gig'` · `'savings'`      |
| `funding_source_id` | uuid  | Optional FK → `funding_sources.id`         |
| `created_at`     | timestamp | Row creation time                          |

**App type:** `Transaction` (`src/types/index.ts`)

**Key relationships:**
- `funding_source_id` links to `funding_sources` to track *how* the user paid
- `recurring_id` groups recurring subscription instances (used by subscription detector)
- `category` aligns with `budgets.category` for per-category tracking

---

### `budgets`

Monthly spending limits per category. One row per user × category × month.

| Column         | Type      | Notes                                       |
|----------------|-----------|---------------------------------------------|
| `id`           | uuid (PK) | Auto-generated                             |
| `user_id`      | uuid (FK) | References `profiles.id`                   |
| `category`     | text      | Matches `TransactionCategory`              |
| `monthly_limit`| numeric   | Dollar limit for this category this month  |
| `spent`        | numeric   | Tracked spend (may be recomputed from txns)|
| `month`        | text      | `YYYY-MM` partition key                    |

**Unique constraint:** `(user_id, category, month)`

**App type:** `Budget` (`src/types/index.ts`)

**Behavior:**
- Limits are carried forward into a new month automatically via `carryForwardBudgetLimits()`
- Categories with `monthlyLimit = 0` are tracking-only (no cap)
- The `isFixed` field in the app type marks budget entries as fixed obligations (rent, subscriptions) — used by the allowance engine to subtract these before computing the daily discretionary pool

---

### `goals`

Savings targets the user is working toward.

| Column          | Type      | Notes                                 |
|-----------------|-----------|---------------------------------------|
| `id`            | uuid (PK) | Auto-generated                       |
| `user_id`       | uuid (FK) | References `profiles.id`             |
| `name`          | text      | Goal label (e.g. "Emergency Fund")   |
| `target_amount` | numeric   | Dollar target                        |
| `current_amount`| numeric   | Dollars saved so far                 |
| `emoji`         | text      | Display emoji                        |
| `target_date`   | text      | Optional ISO date string             |
| `created_at`    | timestamp | Row creation time                    |

**App type:** `Goal` (`src/types/index.ts`)

**Behavior:**
- Contributions are made via the PaycheckSheet after logging income
- Goal progress triggers celebration events at 25% milestones

---

### `sinking_funds`

Money set aside monthly toward a known future cost so it doesn't spike the daily budget.

| Column           | Type      | Notes                                    |
|------------------|-----------|------------------------------------------|
| `id`             | uuid (PK) | Auto-generated                          |
| `user_id`        | uuid (FK) | References `profiles.id`                |
| `label`          | text      | Friendly name (e.g. "Fall textbooks")   |
| `category`       | text      | Spending category it falls under        |
| `target_amount`  | numeric   | Total cost being saved for              |
| `due_date`       | text      | Optional `YYYY-MM-DD` when needed       |
| `saved_amount`   | numeric   | How much has been set aside so far      |
| `monthly_reserve`| numeric   | Amount to reserve each month            |
| `created_at`     | timestamp | Row creation time                       |

**App type:** `SinkingFund` (`src/lib/sinkingFunds.ts`)

**Behavior:**
- `monthly_reserve` is subtracted from the monthly pool before computing daily allowance
- `computeMonthlyReserve()` dynamically recalculates the reserve based on remaining amount and months until due
- `getTotalMonthlyReserve()` sums reserves across all funds for the allowance engine

---

### `allocations`

Records how each income event was split across the four allocation buckets.

| Column      | Type      | Notes                                  |
|-------------|-----------|----------------------------------------|
| `id`        | uuid (PK) | Auto-generated                        |
| `user_id`   | uuid (FK) | References `profiles.id`              |
| `date`      | text      | `YYYY-MM-DD` of the income event      |
| `spend`     | numeric   | Dollars allocated to spending          |
| `save`      | numeric   | Dollars allocated to savings           |
| `invest`    | numeric   | Dollars allocated to investing         |
| `set_aside` | numeric   | Dollars allocated to set-aside bucket  |
| `created_at`| timestamp | Row creation time                      |

**App type:** `AppAllocation` (`src/lib/supabaseData.ts`), input type `IncomeAllocation` (`src/types/folio.ts`)

**Behavior:**
- Created when the user splits a paycheck via the PaycheckSheet
- Allocation presets define percentage splits (e.g. 50/20/20/10)

---

### `savings_accounts`

External savings and investment accounts tracked for projection purposes.

| Column                  | Type      | Notes                              |
|-------------------------|-----------|------------------------------------|
| `id`                    | uuid (PK) | Auto-generated                    |
| `user_id`              | uuid (FK) | References `profiles.id`          |
| `type`                  | text      | `'hysa'`·`'roth_ira'`·`'401k'`·`'brokerage'`·`'savings'`·`'other'` |
| `name`                  | text      | User-assigned label                |
| `balance`               | numeric   | Current tracked balance            |
| `monthly_contribution`  | numeric   | Planned monthly deposit            |
| `expected_annual_return`| numeric   | Expected % annual return           |
| `created_at`            | timestamp | Row creation time                  |

**App type:** `SavingsAccount` (`src/types/folio.ts`)

---

### `debts`

Tracked liabilities (student loans, credit cards, personal loans, etc.).

| Column           | Type      | Notes                               |
|------------------|-----------|-------------------------------------|
| `id`             | uuid (PK) | Auto-generated                     |
| `user_id`        | uuid (FK) | References `profiles.id`           |
| `type`           | text      | `'student_loan'`·`'credit_card'`·`'personal_loan'`·`'car_loan'`·`'other'` |
| `name`           | text      | User-assigned label                 |
| `balance`        | numeric   | Outstanding balance                 |
| `apr`            | numeric   | Annual percentage rate (e.g. 6.5)   |
| `minimum_payment`| numeric   | Monthly minimum payment             |
| `created_at`     | timestamp | Row creation time                   |

**App type:** `Debt` (`src/types/folio.ts`)

---

### `reimbursements`

IOU ledger — money owed to or by the user.

| Column                 | Type      | Notes                                  |
|------------------------|-----------|----------------------------------------|
| `id`                   | uuid (PK) | Auto-generated                        |
| `user_id`              | uuid (FK) | References `profiles.id`              |
| `person_name`          | text      | Who owes / is owed                    |
| `direction`            | text      | `'owed_to_me'` · `'owed_by_me'`      |
| `amount`               | numeric   | Dollar amount of the IOU              |
| `note`                 | text      | Context note                          |
| `settled`              | boolean   | Whether the IOU has been resolved     |
| `settled_at`           | timestamp | When it was settled (null if open)    |
| `linked_transaction_id`| uuid      | Optional FK → `transactions.id`       |
| `created_at`           | timestamp | Row creation time                     |

**App type:** `Reimbursement` (`src/lib/reimbursements.ts`)

**Behavior:**
- `getNetBalance()` computes per-person net position
- `getNetSummary()` aggregates total owed to/by the user
- Can be linked to the originating transaction for context

---

### `funding_sources`

Payment methods the user has configured (debit card, cash, credit card, wallets, borrowed).

| Column              | Type      | Notes                                    |
|---------------------|-----------|------------------------------------------|
| `id`                | uuid (PK) | Auto-generated                          |
| `user_id`           | uuid (FK) | References `profiles.id`                |
| `label`             | text      | User-facing name (e.g. "Debit Card")   |
| `emoji`             | text      | Display icon                            |
| `kind`              | text      | `'cash'`·`'debit'`·`'credit'`·`'external_wallet'`·`'borrowed'` |
| `reduces_balance_now`| boolean  | Immediate (true) vs deferred settlement |
| `snapshot_balance`  | numeric   | Optional starting balance for tracking  |
| `created_at`        | timestamp | Row creation time                       |

**App type:** `FundingSource` (`src/lib/fundingSources.ts`)

**Behavior:**
- Referenced by `transactions.funding_source_id`
- `reduces_balance_now` determines whether spending on this source counts against today's allowance immediately (cash/debit) or is deferred (credit)
- `kind = 'borrowed'` excludes the transaction from the user's daily allowance entirely
- `predictFundingSource()` uses frequency, recency, and time-of-day patterns to auto-suggest the likely source

---

### `pay_schedules`

User's pay cadence configuration (one row per user).

| Column       | Type      | Notes                                       |
|--------------|-----------|---------------------------------------------|
| `id`         | uuid (PK) | Auto-generated                             |
| `user_id`    | uuid (FK) | References `profiles.id` (unique)          |
| `cadence`    | text      | `'weekly'`·`'biweekly'`·`'semimonthly'`·`'monthly'`·`'irregular'` |
| `anchor_date`| text      | Known payday date (`YYYY-MM-DD`) to anchor the cadence |
| `amount`     | numeric   | Optional expected paycheck amount           |
| `created_at` | timestamp | Row creation time                           |

**Unique constraint:** `(user_id)` — one schedule per user

**App type:** `PaySchedule` (`src/lib/paySchedule.ts`)

**Behavior:**
- `getNextPayday()` projects the next paycheck date from the anchor + cadence
- `getDaysUntilPayday()` feeds the "safe to spend until payday" calculation
- For `'irregular'` cadence, the rhythm is estimated from trailing income transaction intervals via `estimateIrregularCadenceDays()`

---

### `lesson_progress`

Tracks which educational lessons the user has completed.

| Column        | Type      | Notes                              |
|---------------|-----------|------------------------------------|
| `id`          | uuid (PK) | Auto-generated                    |
| `user_id`     | uuid (FK) | References `profiles.id`          |
| `lesson_id`   | text      | References lesson definitions      |
| `completed`   | boolean   | Whether the lesson is done        |
| `quiz_score`  | numeric   | Score on the lesson quiz           |
| `completed_at`| timestamp | When completed                    |

**Unique constraint:** `(user_id, lesson_id)`

**App type:** `UserLessonProgress` (`src/types/index.ts`)

---

## Computed / Derived Models (Not Persisted)

These types are computed at runtime from the persisted tables above:

| Type                  | Source Data                           | Purpose                                   |
|-----------------------|---------------------------------------|-------------------------------------------|
| `DailyAllowance`     | budgets + transactions + sinking_funds + fixed expenses | Core "can I afford this?" number |
| `SmartSuggestion`    | transactions (per category)           | Amount suggestions for quick logging      |
| `ContextualTip`      | transactions + budgets + goals        | Behavioral tip selection                  |
| `CelebrationEvent`   | transactions + goals + streaks        | Positive reinforcement triggers           |
| `DetectedSubscription`| transactions (recurringId + heuristic)| Auto-detected recurring charges           |
| `FixedExpense`       | transactions (isRecurring + category) | Recurring bills reserved from daily pool  |
| `BalanceProjection`  | daily allowance + burn rate + pay schedule | Low-balance early warning           |
| `IncomeAllocation`   | user input at paycheck time           | Bucket split before persisting to allocations |

---

## How Tables Feed the Daily Allowance

The daily allowance is the app's core computation. Here's how the tables contribute:

```
  budgets (monthlyLimit per category)
      ↓ sum = totalMonthlyBudget
  sinking_funds (monthlyReserve)
      ↓ subtract from pool
  fixed_expenses / recurring bills (from transactions where isRecurring=true)
      ↓ subtract upcoming unpaid bills
  ──────────────────────────────────
  = discretionary monthly pool

  discretionary pool / effective remaining days = dailyBudget

  transactions (expenses day 1→yesterday vs expected)
      ↓ rollover = saved/overspent, capped ±2× dailyBudget

  transactions (expenses today)
      ↓ spentToday

  dailyBudget + rollover − spentToday = amount (floored at 0)

  funding_sources (kind/reducesBalanceNow)
      ↓ optionally partition spend: credit may not count immediately

  pay_schedules + transactions (income history)
      ↓ feeds "safe to spend until payday" overlay
```

---

## Category Enum

The fixed set of spending categories used across transactions and budgets:

| Value       | Emoji | Label     |
|-------------|-------|-----------|
| `food`      | 🍔    | Food      |
| `rent`      | 🏠    | Rent      |
| `transport` | 🚌    | Transport |
| `school`    | 📚    | School    |
| `fun`       | 🎉    | Social    |
| `other`     | 📦    | Other     |
| `income`    | 💵    | Income    |
| `gig`       | ⚡    | Gig       |

Users can also define `CustomCategory` entries (id, label, emoji) which map to `'other'` for accounting logic.

---

## Naming Conventions

| Database (snake_case)       | App (camelCase)           | File                         |
|-----------------------------|---------------------------|------------------------------|
| `user_id`                   | `userId`                  | All tables                   |
| `monthly_limit`             | `monthlyLimit`            | budgets                      |
| `target_amount`             | `targetAmount`            | goals, sinking_funds         |
| `current_amount`            | `currentAmount`           | goals                        |
| `saved_amount`              | `savedAmount`             | sinking_funds                |
| `monthly_reserve`           | `monthlyReserve`          | sinking_funds                |
| `is_recurring`              | `isRecurring`             | transactions                 |
| `recurring_id`              | `recurringId`             | transactions                 |
| `account_type`              | `accountType`             | transactions                 |
| `funding_source_id`         | `fundingSourceId`         | transactions                 |
| `reduces_balance_now`       | `reducesBalanceNow`       | funding_sources              |
| `snapshot_balance`          | `snapshotBalance`         | funding_sources              |
| `anchor_date`               | `anchorDate`              | pay_schedules                |
| `person_name`               | `personName`              | reimbursements               |
| `settled_at`                | `settledAt`               | reimbursements               |
| `linked_transaction_id`     | `linkedTransactionId`     | reimbursements               |
| `monthly_contribution`      | `monthlyContribution`     | savings_accounts             |
| `expected_annual_return`    | `expectedAnnualReturn`    | savings_accounts             |
| `minimum_payment`           | `minimumPayment`          | debts                        |
| `count_credit_immediately`  | `countCreditImmediately`  | profiles                     |
| `has_completed_onboarding`  | `hasCompletedOnboarding`  | profiles                     |

All conversions happen in the `db*ToApp()` mapper functions at the top of `src/lib/supabaseData.ts`.


---

## Module Map

All utility modules live as flat files under `src/lib/`. Imports use per-file paths:

```ts
import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
import { getTotalMonthlyReserve } from '@/lib/sinkingFunds'
```

### Cross-Cutting Utilities

| File | Purpose |
|------|---------|
| `suggestionUtils.ts` | Smart amount suggestions — reads transactions, categories, and spending patterns |
| `reimbursements.ts` | IOU ledger — standalone feature with its own data model |

### Set-Aside / Reserve Deduplication Notes

The set-aside layer was audited during this task:

- **`setAside.ts`** is the single source of truth for "money reserved from spending." It reconciles allocations, sinking funds, goals, and emergency fund into one `SetAsideBreakdown` with clearly separated FLOW (this month) vs. BALANCE (accumulated stock) facets.
- **`taxSetAside.ts`** handles a distinct concern: computing the suggested tax reserve for gig/1099 income at a configurable rate. It does NOT overlap with `setAside.ts`.
- **`sinkingFunds.ts`** owns the SinkingFund model and reserve math. `setAside.ts` imports `getTotalMonthlyReserve` from it — no duplication.
- **`allocationUtils.ts`** provides `computeTotalSetAside` for the allocation-bucket slice only, with a clear doc comment pointing callers to `setAside.ts` for the full picture.

No deduplication was required — each file has a distinct, well-documented responsibility.

---

## Phase 2/3 Runtime Types (Not Persisted)

These types were added in Phases 2 and 3 and exist only at runtime (computed from
persisted tables or held in localStorage). They complement the "Computed / Derived
Models" section above.

| Type | File | Purpose |
|------|------|---------|
| `MerchantEntry` | `src/lib/merchantMemory.ts` | note→category→amount association stored in localStorage (LRU, max 100). Used for merchant pre-fill on repeat entries. |
| `HabitPrediction` | `src/lib/habitEngine.ts` | A single predicted expense (category, amount, note) with confidence. Used internally by the habit engine. |
| `HabitChip` | `src/lib/habitEngine.ts` | A rendered chip suggestion with label and frequency. Drives the QuickLog area's smart chips. |
| `TimeSlot` | `src/lib/habitEngine.ts` | Time-of-day bucket: `early_morning` · `morning` · `midday` · `afternoon` · `evening` · `night`. |
| `UndoEntry` | `src/lib/undoStack.ts` | A reversible destructive action with expiry timer. At most one pending entry at a time. Supports: delete, edit, bulk delete, bulk recategorize, refund. |
| `UndoActionType` | `src/lib/undoStack.ts` | Union: `'delete_transaction'` · `'edit_transaction'` · `'bulk_delete'` · `'bulk_recategorize'` · `'refund'` |
| `SpendingMode` | `src/lib/spendingModes.ts` | User's display preference: `'tracker'` · `'guided'` · `'structured'`. Controls budget signal intensity. localStorage only. |
| `OverLimitResponse` | `src/lib/spendingModes.ts` | What to show when over daily allowance: `'quiet'` · `'gentle'` · `'headsup'`. Shame-free by design. |
| `SetAsideBreakdown` | `src/lib/setAside.ts` | Fully reconciled view of money reserved: monthly flow (allocationSetAside + sinkingFundReserve) and accumulated balance (goalsSaved + sinkingFundSaved). |
| `TaxSetAsideResult` | `src/lib/taxSetAside.ts` | Suggested gig-income tax reserve with rate and friendly rationale. |
| `SinkingFundSummary` | `src/lib/sinkingFunds.ts` | Aggregate stats across all sinking funds: counts, totals, funded status. |
| Transaction tags | `src/lib/tagUtils.ts` | Free-text labels (max 5 per transaction, max 20 chars each). Stored in localStorage keyed by transaction ID until DB migration adds a column. |
| Receipt references | `src/lib/receiptStorage.ts` | Per-transaction receipt photo URLs. Stored in Supabase Storage (`receipts` bucket) with localStorage fallback for offline/instant access. |

### How New Runtime Types Feed the App

```
  merchantMemory (MerchantEntry)
      ↓ pre-fills category + amount when note matches known merchant
  habitEngine (HabitPrediction, HabitChip)
      ↓ drives QuickLog smart chips by time-of-day pattern
  undoStack (UndoEntry)
      ↓ enables "Undo" toast for any destructive action
  spendingModes (SpendingMode, OverLimitResponse)
      ↓ shapes how over-budget signals are displayed (never blocks logging)
  setAside (SetAsideBreakdown)
      ↓ single computation consumed by HomeScreen, Tools, and savings views
  tagUtils (tags) + receiptStorage (receipts)
      ↓ enrich transaction detail view with user annotations
```
