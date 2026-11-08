-- Initial migration, hand-assembled from schemas/*.sql (in order) because the CLI's diff needs
-- Docker. From now on, edit schemas/ and let `supabase db diff -f <name>` write migrations.

-- ===== schemas/00_shared.sql =====

-- Shared helpers used by the other schema files. Files in schemas/ are applied in filename order,
-- so anything another file depends on belongs in a lower-numbered file.

-- Generic `before update` trigger body: stamps `updated_at` so clients never have to send it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== schemas/10_profiles.sql =====

-- One row per user who has ever signed in. `auth.users` isn't exposed through the API, so this is
-- the public, RLS-guarded view of "who is signed on" that the app lists.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  -- Bumped by the client (`touch_last_seen()`) each time the app comes to the foreground, since a
  -- persisted session means `last_sign_in_at` only changes on an actual fresh sign-in.
  last_seen_at timestamptz
);

alter table public.profiles enable row level security;

create policy "Signed-in users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Creates the `profiles` row on first sign-in and refreshes it (plus `last_sign_in_at`) on every
-- later one. Email-code sign-in only provides the email; name/avatar are picked up from
-- `raw_user_meta_data` if they're ever set there (e.g. `signInWithOTP(email:data:)`). `security definer` because the
-- trigger fires as the auth service, which can't write `public.profiles` through RLS.
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, last_sign_in_at, last_seen_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.last_sign_in_at,
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

-- NOTE: `supabase db diff` only diffs the schemas you own, so it will NOT pick up this trigger on
-- `auth.users` if you change it. Edit it here (to keep this file the source of truth) and then
-- hand-copy the change into a new migration.
create trigger on_auth_user_signed_in
  after insert or update of last_sign_in_at on auth.users
  for each row execute function public.sync_profile_from_auth_user();

create or replace function public.touch_last_seen()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

-- ===== schemas/20_app_state.sql =====

-- Schemaless per-user app state: the "no migration" half of the architecture.
--
-- Each app stores its state as a JSON document, keyed by (user, app, key). Adding, renaming or
-- dropping a field is a client-only change (Codable in Swift, a plain object in JS), so it never
-- needs a migration. v2's `AppState.json` and v05's localStorage state are already JSON of this
-- shape, so both can sync through one row with `app = 'ho-states'`, which also syncs state
-- between iOS and web.
--
-- Move a field out into its own typed table (via a migration) only once you need to query,
-- aggregate or join it across users, e.g. "most-hearted president across all users".

create table public.app_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  -- Bump from the client when the JSON shape changes incompatibly, and upgrade old documents in
  -- client code on read, so no migration is needed.
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, app, key)
);

alter table public.app_state enable row level security;

create policy "Users can read their own app state"
  on public.app_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own app state"
  on public.app_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own app state"
  on public.app_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own app state"
  on public.app_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger app_state_set_updated_at
  before update on public.app_state
  for each row execute function public.set_updated_at();
