-- Cropped profile photos: `photo_original_path` keeps the uncropped photo while `photo_path` is a
-- crop of it, so the app can re-crop or restore it. What `supabase db diff` would generate from
-- schemas/10_profiles.sql.

alter table public.profiles
  add column photo_original_path text;
