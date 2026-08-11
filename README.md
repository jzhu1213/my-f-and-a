# Folio

https://folio-beige-zeta.vercel.app/

A pocket money app for college students and young adults. Folio answers one question: **"Can I afford this today?"**

It calculates a daily allowance from your income, bills, and saving goals — then makes logging spending as fast as a single tap.

## Features

- **Daily Allowance** — see your spending room for today, updated live as you log
- **One-tap logging** — smart category chips, recent-amount suggestions, minimal friction
- **Timeline** — day-grouped transaction history with swipe-to-edit/delete
- **Tools** — goals, sinking funds, debt tracker, subscription audit, calculators
- **Offline-first** — log and browse without connectivity; syncs when back online
- **Shareable pages** — public read-only links for goals, pools, and support pages

## Tech Stack

- **Framework** — Next.js 14 (App Router)
- **Language** — TypeScript (strict)
- **Styling** — Tailwind CSS + CSS custom properties (design token system)
- **Animation** — Framer Motion (spring-based)
- **Backend** — Supabase (Auth + Postgres with RLS)
- **Deployment** — Vercel

## Project Structure

```
src/
├── app/                    # Pages and API routes
├── components/
│   ├── ui/
│   │   ├── primitives/     # 19 token-driven UI primitives
│   │   └── composed/       # Multi-primitive compositions (Hero, Dock, etc.)
│   └── simplified/         # Feature sheets (expense, income, paycheck, refund)
├── hooks/                  # Data, gesture, scroll, and motion hooks
├── lib/                    # Core logic (allowance calc, animations, gestures)
├── styles/                 # Typed token accessors (color, type, spacing, motion)
└── types/                  # Domain types
```

## Design System

All visual values flow from a single token system defined in `globals.css` and exposed as typed accessors under `src/styles/`. The palette is a warm purple-tinted dark theme — no pure black, no per-component color overrides.

Key foundations:
- 10-tier type scale (80px display → 11px caption), fluid `clamp()` for large tiers
- 5-tier elevation system (canvas → overlay) with controlled blur
- 6 spring presets driving 11 named motion variants
- 4px spacing grid, 480px content column, 44px minimum hit targets

## Database Setup

Folio uses [Supabase](https://supabase.com) (Postgres + Auth + RLS). The canonical schema lives in `supabase/schema.sql`.

### Tables

profiles, transactions, budgets, goals, sinking_funds, allocations, savings_accounts, debts, reimbursements, funding_sources, pay_schedules, lesson_progress, user_sessions, friendships, splits, split_participants, notifications, goal_participants, pools, pool_members, pool_entries, share_links

### Option A: Fresh setup (Supabase SQL Editor)

1. Open your Supabase project dashboard → **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

That's it — the file creates all tables, indexes, RLS policies, and functions in one pass.

### Option B: Incremental migrations

Run the files in `supabase/migrations/` in numeric order:

```sql
-- 0001_core.sql    → Extensions, core tables, indexes, owner-only RLS
-- 0002_social.sql  → Friends, splits, notifications, shared goals, pools, share links
```

Only run migrations you haven't applied yet. Each file is additive.

### Option C: Supabase CLI

```bash
supabase db push
```

### Safety

All statements are **idempotent** — safe to re-run. Tables use `CREATE TABLE IF NOT EXISTS`, indexes use `CREATE INDEX IF NOT EXISTS`, policies are dropped before re-creation, and functions use `CREATE OR REPLACE`.

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set these in `.env.local` (see `.env.example`). The app uses safe placeholder fallbacks at build time so builds never fail due to missing vars.

### Further Reading

See [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) for detailed schema documentation (table purposes, column descriptions, RLS patterns, and relationships).

## License

MIT
