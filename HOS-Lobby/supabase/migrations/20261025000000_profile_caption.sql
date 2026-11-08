-- Profile captions: a short line the user writes about themselves, shown under their name in the
-- list. What `supabase db diff` would generate from schemas/10_profiles.sql.

alter table public.profiles
  add column caption text check (char_length(caption) <= 100);
