-- Profile photos: a full-resolution photo plus a thumbnail per user, stored in the `avatars`
-- bucket. The columns are what `supabase db diff` would generate from schemas/10_profiles.sql.
-- The storage part is hand-copied from schemas/30_profile_photos.sql, since db diff doesn't see
-- the `storage` schema.

alter table public.profiles
  add column photo_path text,
  add column photo_thumb_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 52428800, array['image/jpeg']) -- 50 MiB
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own profile photos" on storage.objects;
create policy "Users can upload their own profile photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can read their own profile photos" on storage.objects;
create policy "Users can read their own profile photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can delete their own profile photos" on storage.objects;
create policy "Users can delete their own profile photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
