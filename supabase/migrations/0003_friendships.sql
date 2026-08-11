-- ============================================================================
-- 0003_friendships.sql — Phase 7: friend graph
-- ============================================================================
-- Creates the friendships table with RLS policies ensuring only the two
-- parties involved can see or act on a friendship row.
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- Table: friendships
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','declined','blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);

-- One relationship per unordered pair (prevents duplicate/reverse requests).
create unique index if not exists uniq_friendship_pair on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);

-- Enable RLS
alter table public.friendships enable row level security;

-- Policy: only the two parties can SELECT the row
drop policy if exists friendships_party_select on public.friendships;
create policy friendships_party_select on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));

-- Policy: only the requester can INSERT (you create a request as yourself)
drop policy if exists friendships_insert_as_requester on public.friendships;
create policy friendships_insert_as_requester on public.friendships
  for insert with check (auth.uid() = requester_id);

-- Policy: either party can UPDATE (accept/decline/block)
drop policy if exists friendships_party_update on public.friendships;
create policy friendships_party_update on public.friendships
  for update using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));

-- Policy: either party can DELETE (remove the relationship)
drop policy if exists friendships_party_delete on public.friendships;
create policy friendships_party_delete on public.friendships
  for delete using (auth.uid() in (requester_id, addressee_id));
