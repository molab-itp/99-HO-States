-- One row per user who has ever signed in. `auth.users` isn't exposed through the API, so this is
-- the public, RLS-guarded view of "who is signed on" that the app lists.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  -- Guests from "Continue as Guest" (`signInAnonymously()`). They're real users with their own
  -- id and `app_state`; adding an email later keeps both.
  is_anonymous boolean not null default false,
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

-- Creates the `profiles` row on first sign-in and refreshes it on every later one, and when a
-- guest adds an email. Email sign-in only provides the email; name/avatar are picked up from
-- `raw_user_meta_data` if they're ever set there (e.g. `signInWithOTP(email:data:)`). `security definer` because the
-- trigger fires as the auth service, which can't write `public.profiles` through RLS.
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_anonymous, last_sign_in_at, last_seen_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    coalesce(new.is_anonymous, false),
    new.last_sign_in_at,
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    is_anonymous = excluded.is_anonymous,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

-- NOTE: `supabase db diff` only diffs the schemas you own, so it will NOT pick up this trigger on
-- `auth.users` if you change it. Edit it here (to keep this file the source of truth) and then
-- hand-copy the change into a new migration.
create trigger on_auth_user_signed_in
  after insert or update of email, is_anonymous, last_sign_in_at on auth.users
  for each row execute function public.sync_profile_from_auth_user();

create or replace function public.touch_last_seen()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;
