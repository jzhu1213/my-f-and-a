# Folio — Supabase Schema

This directory contains the canonical SQL schema for Folio's Supabase backend.

## Structure

```
supabase/
├── schema.sql          ← Flattened current-state reference (single file)
├── migrations/
│   ├── 0001_core.sql   ← Extensions, core tables, indexes, owner-only RLS
│   └── 0002_social.sql ← Profile discovery, friends, splits, notifications,
│                          shared goals, pools, share links, helper functions
└── README.md           ← This file
```

## `schema.sql`

The **flattened current-state reference**. This single file represents the complete database schema as it exists today. It's the quickest way to stand up a fresh Supabase project from scratch — just paste and run top to bottom.

When new migrations are added, `schema.sql` is updated to reflect the new current state.

## `migrations/`

Ordered, append-only migration files. Each migration is numbered sequentially and contains the DDL for a logical group of changes. Future schema changes should be added as new numbered files (e.g., `0003_feature_x.sql`).

Migrations are designed to be applied in order on a fresh database, or individually on an existing one.

## Applying the Schema

### Option A: Fresh setup (Supabase SQL Editor)

1. Open your Supabase project dashboard → SQL Editor
2. Paste the entire contents of `schema.sql`
3. Click **Run**

### Option B: Incremental migrations (Supabase SQL Editor)

1. Open SQL Editor
2. Run each file in `migrations/` in numeric order
3. Each migration is additive — only run new ones you haven't applied yet

### Option C: Supabase CLI

```bash
# If using the Supabase CLI with a linked project:
supabase db push
```

## Safety

All statements are **idempotent** — safe to re-run:

- Tables use `create table if not exists`
- Indexes use `create index if not exists`
- Columns use `add column if not exists`
- Policies use `drop policy if exists` before `create policy`
- Functions use `create or replace function`
- Triggers use `drop trigger if exists` before `create trigger`

Re-running a migration on an already-migrated database is a no-op.

## RLS Pattern

Every table has Row Level Security enabled:

- **Most tables**: `auth.uid() = user_id` (owner-only access)
- **profiles**: `auth.uid() = id` (keyed by auth user ID directly)
- **Social tables** (friendships, splits, pools): Party-based access using security-definer helper functions to avoid RLS recursion

## Environment Variables

The schema does not contain any hardcoded URLs or keys. The application connects via:

- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anonymous/public key

See `.env.example` in the project root.
