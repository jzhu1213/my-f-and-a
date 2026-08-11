-- ============================================================================
-- Migration 0001: Core Tables
-- ============================================================================
-- Extensions, all core tables, indexes, and owner-only RLS policies.
-- Safe to re-run (idempotent).
-- ============================================================================


-- Extensions ----------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- case-insensitive handles


-- ============================================================================
-- Core Tables
-- ============================================================================

-- profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  name                        text,
  email                       text,
  user_type                   text default 'student',
  priority                    text default 'save',
  has_completed_onboarding    boolean default false,
  display_name                text,
  avatar_url                  text,
  count_credit_immediately    boolean,
  setup_date                  text,
  onboarding_path             text,
  onboarding_completed_steps  text[] default '{}',
  onboarding_skipped_steps    text[] default '{}',
  created_at                  timestamptz not null default now()
);

-- transactions --------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  type          text not null check (type in ('income','expense')),
  amount        numeric(12,2) not null,
  category      text not null,
  note          text,
  is_recurring  boolean default false,
  recurring_id  uuid,
  account_type  text default 'personal',
  funding_source_id uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);

-- budgets -------------------------------------------------------------------
create table if not exists public.budgets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  category              text not null,
  monthly_limit         numeric(12,2) not null default 0,
  spent                 numeric(12,2) not null default 0,
  month                 text not null,
  period                text,
  per_transaction_alert numeric(12,2),
  is_fixed              boolean,
  limit_type            text,
  created_at            timestamptz not null default now(),
  constraint budgets_user_category_month_key unique (user_id, category, month)
);
create index if not exists idx_budgets_user on public.budgets(user_id);

-- goals ---------------------------------------------------------------------
create table if not exists public.goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  target_amount     numeric(12,2) not null,
  current_amount    numeric(12,2) not null default 0,
  emoji             text default '🎯',
  target_date       date,
  linked_account_id uuid,
  is_shared         boolean default false,
  share_token       uuid,
  created_at        timestamptz not null default now()
);
create index if not exists idx_goals_user on public.goals(user_id);
create index if not exists idx_goals_share_token on public.goals(share_token);

-- lesson_progress -----------------------------------------------------------
create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     text not null,
  completed     boolean not null default false,
  quiz_score    integer,
  completed_at  timestamptz,
  constraint lesson_progress_user_lesson_key unique (user_id, lesson_id)
);
create index if not exists idx_lesson_progress_user on public.lesson_progress(user_id);

-- savings_accounts ----------------------------------------------------------
create table if not exists public.savings_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  type                   text not null,
  name                   text not null,
  balance                numeric(14,2) not null default 0,
  monthly_contribution   numeric(12,2) not null default 0,
  expected_annual_return numeric(6,4) not null default 0,
  created_at             timestamptz not null default now()
);
create index if not exists idx_savings_accounts_user on public.savings_accounts(user_id);

-- debts ---------------------------------------------------------------------
create table if not exists public.debts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null,
  name             text not null,
  balance          numeric(14,2) not null default 0,
  apr              numeric(6,4) not null default 0,
  minimum_payment  numeric(12,2) not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_debts_user on public.debts(user_id);

-- sinking_funds -------------------------------------------------------------
create table if not exists public.sinking_funds (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null,
  category         text not null,
  target_amount    numeric(12,2) not null default 0,
  due_date         date,
  saved_amount     numeric(12,2) not null default 0,
  monthly_reserve  numeric(12,2) not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_sinking_funds_user on public.sinking_funds(user_id);

-- allocations ---------------------------------------------------------------
create table if not exists public.allocations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  spend      numeric(12,2) not null default 0,
  save       numeric(12,2) not null default 0,
  invest     numeric(12,2) not null default 0,
  set_aside  numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_allocations_user_date on public.allocations(user_id, date);

-- pay_schedules -------------------------------------------------------------
create table if not exists public.pay_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cadence     text not null,
  anchor_date date not null,
  amount      numeric(12,2),
  created_at  timestamptz not null default now(),
  constraint pay_schedules_user_key unique (user_id)
);

-- reimbursements (IOU ledger) -----------------------------------------------
create table if not exists public.reimbursements (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  person_name           text not null,
  direction             text not null check (direction in ('owed_to_me','owed_by_me')),
  amount                numeric(12,2) not null,
  note                  text default '',
  settled               boolean not null default false,
  settled_at            timestamptz,
  linked_transaction_id uuid,
  settled_via_source_id uuid,
  counterparty_user_id  uuid references auth.users(id) on delete set null,
  split_id              uuid,
  created_at            timestamptz not null default now()
);
create index if not exists idx_reimbursements_user on public.reimbursements(user_id);

-- funding_sources -----------------------------------------------------------
create table if not exists public.funding_sources (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  label               text not null,
  emoji               text default '💳',
  kind                text not null,
  reduces_balance_now boolean not null default true,
  snapshot_balance    numeric(14,2),
  created_at          timestamptz not null default now()
);
create index if not exists idx_funding_sources_user on public.funding_sources(user_id);

-- user_sessions (device list) ----------------------------------------------
create table if not exists public.user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  device_id     text not null,
  label         text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  constraint user_sessions_user_device_key unique (user_id, device_id)
);
create index if not exists idx_user_sessions_user on public.user_sessions(user_id);


-- ============================================================================
-- RLS: Enable + Owner-Only Policies
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.transactions     enable row level security;
alter table public.budgets          enable row level security;
alter table public.goals            enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.debts            enable row level security;
alter table public.sinking_funds    enable row level security;
alter table public.allocations      enable row level security;
alter table public.pay_schedules    enable row level security;
alter table public.reimbursements   enable row level security;
alter table public.funding_sources  enable row level security;
alter table public.user_sessions    enable row level security;

-- profiles: owner keyed by id (not user_id)
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists transactions_owner_all on public.transactions;
create policy transactions_owner_all on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists budgets_owner_all on public.budgets;
create policy budgets_owner_all on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists goals_owner_all on public.goals;
create policy goals_owner_all on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lesson_progress_owner_all on public.lesson_progress;
create policy lesson_progress_owner_all on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists savings_accounts_owner_all on public.savings_accounts;
create policy savings_accounts_owner_all on public.savings_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists debts_owner_all on public.debts;
create policy debts_owner_all on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists sinking_funds_owner_all on public.sinking_funds;
create policy sinking_funds_owner_all on public.sinking_funds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists allocations_owner_all on public.allocations;
create policy allocations_owner_all on public.allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pay_schedules_owner_all on public.pay_schedules;
create policy pay_schedules_owner_all on public.pay_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists funding_sources_owner_all on public.funding_sources;
create policy funding_sources_owner_all on public.funding_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_sessions_owner_all on public.user_sessions;
create policy user_sessions_owner_all on public.user_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reimbursements: owner full control + counterparty read/settle
drop policy if exists reimbursements_owner_all on public.reimbursements;
create policy reimbursements_owner_all on public.reimbursements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reimbursements_counterparty_read on public.reimbursements;
create policy reimbursements_counterparty_read on public.reimbursements
  for select using (auth.uid() = counterparty_user_id);

drop policy if exists reimbursements_counterparty_settle on public.reimbursements;
create policy reimbursements_counterparty_settle on public.reimbursements
  for update using (auth.uid() = counterparty_user_id)
  with check (auth.uid() = counterparty_user_id);
