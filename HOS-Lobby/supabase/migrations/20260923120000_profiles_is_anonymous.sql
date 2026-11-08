-- Guest (anonymous) sign-in support: flag guests in `profiles` and keep the row in sync when a
-- guest later adds an email.
-- The column is what `supabase db diff` would generate from schemas/10_profiles.sql. The trigger
-- part is hand-copied, since db diff doesn't see triggers on `auth.users`.

alter table public.profiles
  add column is_anonymous boolean not null default false;

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

drop trigger if exists on_auth_user_signed_in on auth.users;

create trigger on_auth_user_signed_in
  after insert or update of email, is_anonymous, last_sign_in_at on auth.users
  for each row execute function public.sync_profile_from_auth_user();
