-- ============================================================================
-- Migration 0002: Social Features
-- ============================================================================
-- Profile discovery, friendships, splits, notifications, shared goals,
-- household pools, share links, helper functions, and triggers.
-- Safe to re-run (idempotent).
-- ============================================================================


-- ============================================================================
-- Profile Discovery
-- ============================================================================
alter table public.profiles add column if not exists handle       citext unique;
alter table public.profiles add column if not exists discoverable boolean not null default false;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');

-- Narrow, safe public view for friend search. Bypasses profiles RLS but
-- exposes ONLY these four columns and ONLY for opted-in users.
create or replace view public.public_profiles as
  select id, handle, display_name, avatar_url
  from public.profiles
  where discoverable = true and handle is not null;

grant select on public.public_profiles to anon, authenticated;


-- ============================================================================
-- Friendships
-- ============================================================================
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

create unique index if not exists uniq_friendship_pair on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);

alter table public.friendships enable row level security;

drop policy if exists friendships_party_select on public.friendships;
create policy friendships_party_select on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));

drop policy if exists friendships_insert_as_requester on public.friendships;
create policy friendships_insert_as_requester on public.friendships
  for insert with check (auth.uid() = requester_id);

drop policy if exists friendships_party_update on public.friendships;
create policy friendships_party_update on public.friendships
  for update using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));

drop policy if exists friendships_party_delete on public.friendships;
create policy friendships_party_delete on public.friendships
  for delete using (auth.uid() in (requester_id, addressee_id));


-- ============================================================================
-- Splits (Splitwise-grade)
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

alter table public.splits             enable row level security;
alter table public.split_participants enable row level security;

drop policy if exists splits_owner_all on public.splits;
create policy splits_owner_all on public.splits
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists splits_participant_read on public.splits;
create policy splits_participant_read on public.splits
  for select using (public.is_split_participant(id));

drop policy if exists split_participants_read on public.split_participants;
create policy split_participants_read on public.split_participants
  for select using (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  );

drop policy if exists split_participants_owner_insert on public.split_participants;
create policy split_participants_owner_insert on public.split_participants
  for insert with check (public.is_split_owner(split_id));

drop policy if exists split_participants_update on public.split_participants;
create policy split_participants_update on public.split_participants
  for update using (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  ) with check (
    public.is_split_owner(split_id) or auth.uid() = participant_user_id
  );

drop policy if exists split_participants_owner_delete on public.split_participants;
create policy split_participants_owner_delete on public.split_participants
  for delete using (public.is_split_owner(split_id));


-- ============================================================================
-- Notifications
-- ============================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  type       text not null check (type in (
               'friend_request','friend_accepted','split_added',
               'settle_reminder','settle_confirmed')),
  payload    jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_owner_rw on public.notifications;
create policy notifications_owner_rw on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_owner_delete on public.notifications;
create policy notifications_owner_delete on public.notifications
  for delete using (auth.uid() = user_id);

drop policy if exists notifications_self_insert on public.notifications;
create policy notifications_self_insert on public.notifications
  for insert with check (auth.uid() = user_id);


-- ============================================================================
-- Goal Participants (shared goals)
-- ============================================================================
create table if not exists public.goal_participants (
  id                 uuid primary key default gen_random_uuid(),
  goal_id            uuid not null references public.goals(id) on delete cascade,
  participant_user_id uuid references auth.users(id) on delete set null,
  name               text not null,
  contributed_amount numeric(12,2) not null default 0,
  joined_at          timestamptz not null default now()
);
create index if not exists idx_goal_participants_goal on public.goal_participants(goal_id);

alter table public.goal_participants enable row level security;

drop policy if exists goal_participants_owner_all on public.goal_participants;
create policy goal_participants_owner_all on public.goal_participants
  for all using (public.is_goal_owner(goal_id)) with check (public.is_goal_owner(goal_id));

drop policy if exists goal_participants_self_read on public.goal_participants;
create policy goal_participants_self_read on public.goal_participants
  for select using (auth.uid() = participant_user_id);

drop policy if exists goal_participants_self_update on public.goal_participants;
create policy goal_participants_self_update on public.goal_participants
  for update using (auth.uid() = participant_user_id)
  with check (auth.uid() = participant_user_id);


-- ============================================================================
-- Household Pools
-- ============================================================================
create table if not exists public.pools (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text default '🏠',
  share_token uuid default gen_random_uuid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_pools_owner on public.pools(owner_id);

create table if not exists public.pool_members (
  id          uuid primary key default gen_random_uuid(),
  pool_id     uuid not null references public.pools(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  name        text not null,
  joined_at   timestamptz not null default now(),
  constraint pool_members_unique unique (pool_id, user_id)
);
create index if not exists idx_pool_members_pool on public.pool_members(pool_id);
create index if not exists idx_pool_members_user on public.pool_members(user_id);

create table if not exists public.pool_entries (
  id          uuid primary key default gen_random_uuid(),
  pool_id     uuid not null references public.pools(id) on delete cascade,
  added_by    uuid references auth.users(id) on delete set null,
  label       text not null,
  amount      numeric(12,2) not null,
  paid_by     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pool_entries_pool on public.pool_entries(pool_id);

alter table public.pools        enable row level security;
alter table public.pool_members enable row level security;
alter table public.pool_entries enable row level security;

drop policy if exists pools_owner_all on public.pools;
create policy pools_owner_all on public.pools
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists pools_member_read on public.pools;
create policy pools_member_read on public.pools
  for select using (public.is_pool_member(id));

drop policy if exists pool_members_owner_all on public.pool_members;
create policy pool_members_owner_all on public.pool_members
  for all using (public.is_pool_owner(pool_id)) with check (public.is_pool_owner(pool_id));

drop policy if exists pool_members_read on public.pool_members;
create policy pool_members_read on public.pool_members
  for select using (public.is_pool_member(pool_id) or public.is_pool_owner(pool_id));

drop policy if exists pool_entries_read on public.pool_entries;
create policy pool_entries_read on public.pool_entries
  for select using (public.is_pool_member(pool_id) or public.is_pool_owner(pool_id));

drop policy if exists pool_entries_member_insert on public.pool_entries;
create policy pool_entries_member_insert on public.pool_entries
  for insert with check (
    (public.is_pool_member(pool_id) or public.is_pool_owner(pool_id))
    and auth.uid() = added_by
  );

drop policy if exists pool_entries_author_update on public.pool_entries;
create policy pool_entries_author_update on public.pool_entries
  for update using (auth.uid() = added_by or public.is_pool_owner(pool_id))
  with check (auth.uid() = added_by or public.is_pool_owner(pool_id));

drop policy if exists pool_entries_author_delete on public.pool_entries;
create policy pool_entries_author_delete on public.pool_entries
  for delete using (auth.uid() = added_by or public.is_pool_owner(pool_id));


-- ============================================================================
-- Share Links (server-side read-only sharing)
-- ============================================================================
create table if not exists public.share_links (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  label          text not null default 'Shared link',
  token          uuid not null default gen_random_uuid() unique,
  scope          jsonb not null default '{"access":"read-only","sections":["status","weekSpending","categories"]}',
  summary        jsonb,
  is_active      boolean not null default true,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_share_links_user  on public.share_links(user_id);
create index if not exists idx_share_links_token on public.share_links(token);

alter table public.share_links enable row level security;

drop policy if exists share_links_owner_all on public.share_links;
create policy share_links_owner_all on public.share_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- Security-Definer Helper Functions
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

create or replace function public.is_goal_owner(p_goal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.goals g where g.id = p_goal_id and g.user_id = auth.uid());
$$;

create or replace function public.is_pool_owner(p_pool_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pools p where p.id = p_pool_id and p.owner_id = auth.uid());
$$;

create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pool_members m
    where m.pool_id = p_pool_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

create or replace function public.create_notification(
  p_recipient uuid,
  p_type      text,
  p_payload   jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_allowed := public.are_friends(auth.uid(), p_recipient)
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p_recipient)
         or (f.requester_id = p_recipient and f.addressee_id = auth.uid())
    )
    or exists (
      select 1 from public.split_participants sp
      join public.splits s on s.id = sp.split_id
      where sp.participant_user_id = p_recipient and s.owner_id = auth.uid()
    );

  if not v_allowed then
    raise exception 'not allowed to notify this user';
  end if;

  insert into public.notifications (user_id, actor_id, type, payload)
  values (p_recipient, auth.uid(), p_type, coalesce(p_payload, '{}'))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, jsonb) to authenticated;

create or replace function public.get_shared_summary(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_summary jsonb;
begin
  update public.share_links
     set last_viewed_at = now()
   where token = p_token
     and is_active = true
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning summary into v_summary;

  return v_summary;
end;
$$;

grant execute on function public.get_shared_summary(uuid) to anon, authenticated;


-- ============================================================================
-- Triggers
-- ============================================================================

create or replace function public.stamp_friendship_response()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_friendship_response on public.friendships;
create trigger trg_friendship_response
  before update on public.friendships
  for each row execute function public.stamp_friendship_response();
