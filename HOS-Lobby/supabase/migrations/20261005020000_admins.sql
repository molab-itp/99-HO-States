-- Admins: the `admins` table and `is_admin()`, which the `delete-user` Edge Function and the app
-- use to decide who may delete other users' accounts. What `supabase db diff` would generate from
-- schemas/40_admins.sql.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS with no policies, and no grants to the client roles: only the Edge Function (as
-- `service_role`, which bypasses RLS) and `is_admin()` below can read it.
alter table public.admins enable row level security;

revoke all on public.admins from anon, authenticated;
grant select on public.admins to service_role;

-- Whether the calling user is an admin, so the app knows to show the Delete action. It only
-- decides what the UI shows: the Edge Function does its own check. `security definer` because
-- the caller can't read `admins`.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
