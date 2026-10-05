-- Live updates: send `profiles` row changes to signed-in clients over Supabase Realtime, so the
-- app can announce users being created, signing in and being deleted. Hand-copied from
-- schemas/10_profiles.sql, since db diff doesn't see publication membership.

alter publication supabase_realtime add table public.profiles;
