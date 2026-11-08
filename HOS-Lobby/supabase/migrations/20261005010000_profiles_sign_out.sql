-- Sign-out events: the app calls `mark_signed_out()` just before it signs out, and the change to
-- `profiles.last_sign_out_at` reaches other clients over Realtime as a "signed out" banner. What
-- `supabase db diff` would generate from schemas/10_profiles.sql.

alter table public.profiles
  add column last_sign_out_at timestamptz;

create or replace function public.mark_signed_out()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles set last_sign_out_at = now() where id = (select auth.uid());
$$;
