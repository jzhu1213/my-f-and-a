# Folio Development Guidelines

## Project
Personal finance app for college students. Core question: **"Can I afford this today?"**
Branch: `feature/warm-onboarding`

## Stack
Next.js App Router · React · TypeScript · Supabase · Vercel · Tailwind CSS · framer-motion · canvas-confetti · Radix primitives · Vitest/fast-check (existing tests only)

## Architecture Snapshot
- **Primary nav (dock):** Home · History · Tools · Settings
- **Overlays (full-screen):** BudgetSettings · GoalsScreen · SinkingFundsScreen · SubscriptionAuditScreen · RecurringBillsScreen · LessonsScreen
- **Sheets:** ExpenseSheet · IncomeSheet · PaycheckSheet · EditTransactionSheet · RefundSheet · ProfileSheet
- **Tools tab** (progressive disclosure): CompoundGrowthCalculator · CreditPayoffCalculator · SavingsProjection · SubscriptionAudit · SinkingFunds · Learn
- **Data hook:** `useHomeData(userId)` — single source of truth for transactions, budgets, goals, allowance, sinkingFunds, debts
- **Allowance calc:** `computeDailyAllowance()` in `src/lib/dailyAllowanceUtils.ts` — income source priority: budget limits → actual income txns → estimate; fallback $50/day for zero-setup users (`isEstimated: true`)
- **No onboarding gate** (task 66): new users land directly on HomeScreen; tutorial accessible from Settings only

## Product Principles (short form)
1. **Daily Allowance First** — every decision supports answering "can I afford this?" in <1s
2. **Radical Simplicity** — fewer screens, hide complexity behind progressive disclosure
3. **Zero required setup** — app delivers value immediately; budget limits/goals are enhancements not gates
4. **One-tap logging** — smart defaults, optimistic UI, minimal required input
5. **Warmth over brutalism** — soft dark purple bg, Inter font, rounded surfaces, non-judgmental copy
6. **Flexible by default** — works for variable income, irregular spending, incomplete data

## Decision Test
Before adding/changing anything: *would a typical sophomore use this in a normal week?*
- Yes → primary nav/settings
- No → Tools tab or progressive disclosure

## Implementation Rules
- **No new tests** unless explicitly requested; run existing with `npm run typecheck && npm run build && npm run test:run`
- **Validate before reporting done** — typecheck → build → targeted tests
- **Keep changes focused** to the current task; no unrelated refactors
- **Pure utility functions** for business logic (allowance calc, suggestions, tips, celebration triggers)
- **Local state** unless shared app-wide; React context only for auth/theme/toast/session
- **TypeScript strict** — explicit types, no `any`, export from `src/types/`
- **No secrets** in code/logs/commits; use env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Optimistic UI** with reversible rollback on persistence failure
- **Supabase** — never hardcode keys; no production data modifications without explicit instruction

## Styling
- Warm theme: bg `#1a1a2e`, surface `#25253a`, Inter font, border-radius 8/12/16px
- `GlassCard` for surfaces, `GradientMesh` for backgrounds, `AmbientGlow` for status lighting
- Shared style tokens in `src/styles/shared.ts` and `src/styles/typography.ts`
- Status colors: success `#4ade80`, warning `#fbbf24`, error `#f87171`
- Shame-free copy: prefer "A little tight today — tomorrow resets." over "You overspent!"

## Git
- Branch: `feature/warm-onboarding` — push there, never directly to main
- Commit style: `Add daily allowance calculation` / `Simplify theme system`
- No force push without explicit approval
- Never commit `.env`, `.env.local`, `.next`, `node_modules`, secrets

## Accessibility
- ARIA labels on all interactive elements; `aria-current="page"` on active nav
- Respect `prefers-reduced-motion` in all animations and celebrations
- WCAG AA contrast in both warm and dark themes
