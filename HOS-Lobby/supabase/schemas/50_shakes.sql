-- Shakes: each row is one burst of shaking recorded by the app's Shakes screen: how many shakes
-- it counted and how long the burst lasted. Every signed-in user can read every row, so the app
-- can rank users by shake count and show anyone's detailed history.

create table public.shake_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shake_count integer not null check (shake_count > 0),
  -- From the first shake of the burst to the last.
  duration_ms integer not null check (duration_ms >= 0),
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index shake_sessions_user_started_idx on public.shake_sessions (user_id, started_at desc);

alter table public.shake_sessions enable row level security;

create policy "Signed-in users can read all shake sessions"
  on public.shake_sessions for select
  to authenticated
  using (true);

create policy "Users can insert their own shake sessions"
  on public.shake_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shake sessions"
  on public.shake_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Live updates, so the leaderboard moves while it's open. db diff doesn't see publication
-- membership: hand-copy a change here into a new migration.
alter publication supabase_realtime add table public.shake_sessions;

-- One row per user who has shaken at least once: totals plus their latest burst. The app ranks
-- by `total_shakes`. `security_invoker` so the table's RLS applies to whoever queries it.
create view public.shake_totals
with (security_invoker = true)
as
select
  user_id,
  count(*)::integer as session_count,
  sum(shake_count)::integer as total_shakes,
  sum(duration_ms)::bigint as total_duration_ms,
  (array_agg(shake_count order by started_at desc))[1] as last_shake_count,
  (array_agg(duration_ms order by started_at desc))[1] as last_duration_ms,
  max(started_at) as last_shake_at
from public.shake_sessions
group by user_id;
