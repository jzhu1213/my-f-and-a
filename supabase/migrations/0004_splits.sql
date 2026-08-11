-- ============================================================================
-- 0004_splits.sql — Phase 7: splits (Splitwise-grade)
-- ============================================================================
-- Creates the `splits` and `split_participants` tables with RLS policies.
-- Also creates the two security-definer helper functions (`is_split_owner`,
-- `is_split_participant`) needed by the policies to avoid infinite RLS
-- recursion between the two tables.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ============================================================================
-- Helper functions (SECURITY DEFINER) — must exist before policies reference them
-- ============================================================================

create or replace function public.is_split_owner(p_split_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.splits s where s.id = p_split_id and s.owner_id = auth.uid());
$$;

create or replace function public.is_split_participant(p_split_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.split_participants sp
    where sp.split_id = p_split_id and sp.participant_user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Table: splits
-- ============================================================================

create table if not exists public.splits (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  linked_transaction_id uuid,
  total_amount          numeric(12,2) not null,
  type                  text not null default 'expense' check (type in ('expense','income')),
  split_method          text not null default 'even'
                          check (split_method in ('even','custom','percent','shares')),
  note                  text default '',
  settled               boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists idx_splits_owner on public.splits(owner_id);

-- ============================================================================
-- Table: split_participants
-- ============================================================================

create table if not exists public.split_participants (
  id                  uuid primary key default gen_random_uuid(),
  split_id            uuid not null references public.splits(id) on delete cascade,
  participant_user_id uuid references auth.users(id) on delete set null,
  participant_name    text not null,
  share_amount        numeric(12,2) not null default 0,
  is_payer            boolean not null default false,
  settled             boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_split_participants_split on public.split_participants(split_id);
create index if not exists idx_split_participants_user  on public.split_participants(participant_user_id);

-- ============================================================================
-- RLS: splits
-- ============================================================================

alter table public.splits enable row level security;

-- Owner has full CRUD on their own splits
drop policy if exists splits_owner_all on public.splits;
create policy splits_owner_all on public.splits
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A linked participant can READ splits they're part of
drop policy if exists splits_participant_read on public.splits;
create policy splits_participant_read on public.splits
  for select using (public.is_split_participant(id));

-- ============================================================================
-- RLS: split_participants
-- ============================================================================

alter table public.split_participants enable row level security;

-- Owner or the participant themselves can READ participant rows
drop policy if exists split_participants_read on public.split_participants;
create policy split_participants_read on public.split_participants
  for select using (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  );

-- Only the split owner can INSERT participant rows
drop policy if exists split_participants_owner_insert on public.split_participants;
create policy split_participants_owner_insert on public.split_participants
  for insert with check (public.is_split_owner(split_id));

-- Owner can update any participant; a linked participant can update their own row
-- (e.g. to mark their `settled` flag)
drop policy if exists split_participants_update on public.split_participants;
create policy split_participants_update on public.split_participants
  for update using (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  ) with check (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  );

-- Only the split owner can DELETE participant rows
drop policy if exists split_participants_owner_delete on public.split_participants;
create policy split_participants_owner_delete on public.split_participants
  for delete using (public.is_split_owner(split_id));
