-- ============================================================================
-- Migration 0006: Analytics Events
-- ============================================================================
-- Privacy-respecting, anonymous event collector for usage analytics.
-- No PII stored. Insert-only via RLS (authenticated users can write but not read).
-- ============================================================================

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,
  properties  jsonb,
  session_id  text,
  created_at  timestamptz not null default now()
);

-- Index on event name for querying patterns
create index if not exists idx_analytics_events_event
  on public.analytics_events (event);

-- Index on created_at for time-range queries
create index if not exists idx_analytics_events_created_at
  on public.analytics_events (created_at);

-- Enable Row Level Security
alter table public.analytics_events enable row level security;

-- Insert-only policy: authenticated users can insert but not read/update/delete.
-- This ensures analytics data cannot be exfiltrated via the client.
create policy "Authenticated users can insert analytics events"
  on public.analytics_events
  for insert
  to authenticated
  with check (true);

-- No SELECT, UPDATE, or DELETE policies — data is write-only from the client.
-- Only service-role (admin) access can read the data for dashboards.
