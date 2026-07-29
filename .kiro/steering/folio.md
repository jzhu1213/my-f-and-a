# Folio Development Guidelines

## What Folio Is

A pocket money app for college students and young adults. The core question it answers: **"Can I afford this today?"**

Folio wins by being simpler, warmer, and faster than other budgeting apps — not by having more features.

## Product Principles

1. **Daily Allowance first** — every screen supports the user knowing their spending room today
2. **One-tap logging** — smart defaults, common amounts, category shortcuts, minimal required input
3. **Progressive disclosure** — advanced tools (goals, sinking funds, debt, lessons, calculators) live behind the Tools/Settings tabs, never clutter the home screen
4. **Warm and encouraging** — no shame, no jargon, friendly copy, soft purple aesthetic
5. **Flexible defaults** — works immediately without setup; adapts to variable income and irregular habits

## Architecture Overview

```
src/app/page.tsx          → Root routing, overlay state, nav switching
src/hooks/useHomeData.ts  → All data fetching + mutations + memoized allowance
src/lib/dailyAllowanceUtils.ts → Core allowance calc, status, messages
src/lib/suggestionUtils.ts     → Smart amount suggestions
src/lib/celebrationEngine.ts   → Celebration triggers
src/lib/tipUtils.ts            → Contextual tip selection
src/lib/supabaseData.ts        → All Supabase CRUD
src/styles/shared.ts           → Layout constants, shared style objects
src/styles/typography.ts       → Type scale (Inter, rem-based)
src/types/folio.ts             → Domain types (DailyAllowance, SmartSuggestion, etc.)
src/types/index.ts             → Transaction, Budget, Goal, TransactionCategory
```

### Component Tree

```
AppShell (top bar + 4-tab dock: home, history, tools, settings)
├── HomeScreen
│   ├── DailyAllowanceHero → AllowanceRing
│   ├── QuickLogArea → SuggestionChip
│   ├── ContextualTipCard
│   ├── CelebrationOverlay
│   └── SwipeableTransactionRow → InlineTransactionEditor
├── HistoryScreen
├── ToolsScreen (advanced features, opt-in)
└── SettingsScreen
    ├── BudgetSettings
    ├── GoalsScreen
    ├── RecurringBillsScreen
    ├── SinkingFundsScreen
    ├── SubscriptionAuditScreen
    └── DebtScreen
```

### Navigation

- `activeNav`: `'home' | 'history' | 'tools' | 'settings'`
- Full-screen overlays: budgets, goals, sinking funds, subscription audit, recurring bills, debt, reimbursements, learn, calculators
- Bottom sheets: expense, income, paycheck allocation, edit transaction, refund, profile

### Daily Allowance Calculation

```
incomeSource priority: budget limits → actual income txns → estimate ($50/day fallback)
dailyBudget = (monthlyPool - fixedExpenses - sinkingFundReserves) / effectiveDays
rollover = expectedSpend(day1→yesterday) - actualSpend, capped ±2×dailyBudget
amount = max(0, dailyBudget + rollover - spentToday)
```

## Tech Stack

- Next.js 14 App Router, React, TypeScript (strict)
- Tailwind CSS + CSS custom properties (globals.css)
- Supabase (auth + PostgreSQL with RLS)
- framer-motion for animations
- canvas-confetti for celebrations
- Vercel deployment

## Implementation Rules

### Code Style
- Inter font everywhere (no monospace for UI text; use `fontVariantNumeric: tabular-nums` for numbers)
- Warm purple theme by default (`--bg: #12121f`, `--surface: #1a1a2e`)
- Border radius: 8px buttons, 12px cards, 16px sheets
- All inline styles use constants from `src/styles/shared.ts` and `src/styles/typography.ts`
- Explicit TypeScript interfaces for all props and shared data

### State Management
- `useHomeData` hook is the single data layer for the main app — do not duplicate fetching logic
- React Context only for auth, theme, toast
- Local component state for UI-only concerns (sheet open/close, form values)

### Supabase
- Never hardcode URLs or keys — use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optimistic UI updates with graceful offline fallback via `src/lib/offlineQueue.ts`
- Budget carry-forward runs on mount via `carryForwardBudgetLimits`

### Performance
- Memoize daily allowance (recalc only when budgets/transactions/currentDay change)
- Smart suggestions calculated on category selection, not every render
- Cache hydration from localStorage for instant home screen
- Lazy load advanced tool screens

### Validation
- Run `npm run typecheck` and `npm run build` after changes
- Do not create new test files unless explicitly asked

### UX Copy
- Encouraging, short, human, non-judgmental
- Good: "A little tight today — tomorrow resets" / "Nice, you've got room left"
- Bad: "You overspent" / "Budget failed" / "Bad spending"

### Accessibility
- All interactive elements: clear labels, keyboard access, sufficient contrast
- Animations respect `prefers-reduced-motion`
- WCAG 2.1 AA contrast verified (see globals.css comment block)

## What NOT to Do

- Do not add features to the home screen — it should stay: hero + quick log + recent + 1 tip
- Do not introduce new state libraries or architectural patterns
- Do not use monospace fonts for financial amounts or body text
- Do not use pure black (#000) as background — use the warm purple tokens
- Do not force setup/onboarding before showing value (new users land on home immediately)
- Do not create shame-based warnings or copy
- Do not expose secrets in code, logs, or commits
