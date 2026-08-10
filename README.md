# Folio

A pocket money app for college students and young adults. Folio answers one question: **"Can I afford this today?"**

It calculates a daily allowance from your income, bills, and saving goals — then makes logging spending as fast as a single tap.

## Features

- **Daily Allowance** — see your spending room for today, updated live as you log
- **One-tap logging** — smart category chips, recent-amount suggestions, minimal friction
- **Timeline** — day-grouped transaction history with swipe-to-edit/delete
- **Tools** — goals, sinking funds, debt tracker, subscription audit, calculators
- **Offline-first** — log and browse without connectivity; syncs when back online
- **Shareable pages** — public read-only links for goals, pools, and support pages

## Quick Start

```bash
npm install
npm run dev
```

Create `.env.local` (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Type-check without emitting |
| `npm run validate` | Typecheck + build (pre-commit runs this) |
| `npm test` | Run tests (Vitest) |

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

## License

MIT
