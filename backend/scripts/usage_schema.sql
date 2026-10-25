-- Run once in the Supabase SQL editor. One row per charged Gemini-backed action (see limits.py).
create table if not exists usage (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- Per-user limit lookups: count rows for (user, action) since some time
create index if not exists usage_user_action_created_idx on usage (user_id, action, created_at);
-- The global daily cap counts every row since midnight UTC
create index if not exists usage_created_idx on usage (created_at);

-- Only the backend (service-role key) touches this table; with RLS on and no policies, the anon key can't
alter table usage enable row level security;
