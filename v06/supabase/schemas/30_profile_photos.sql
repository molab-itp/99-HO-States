-- Profile photos: the `avatars` Storage bucket and who may write to it.
--
-- Each user owns the folder named after their id: `avatars/<user id>/<random>-full.jpg` (full
-- resolution) and `…-thumb.jpg` (256px square, for the users list). `profiles.photo_path` and
-- `profiles.photo_thumb_path` point at the current pair. Every upload gets fresh file names, so
-- CDN and device caches never serve a stale photo; the app deletes the previous pair afterwards.
--
-- The bucket is public: anyone with a file's URL can fetch it without signing in, and the random
-- file names make the URLs hard to guess. That keeps `AsyncImage` simple (no signed URLs to
-- refresh). Make it private and switch to `createSignedURL` if photos ever need to stay private.
--
-- NOTE: `supabase db diff` doesn't see the `storage` schema (bucket rows or policies on
-- `storage.objects`), like the `auth.users` trigger in 10_profiles.sql. Edit here, then hand-copy
-- the change into a new migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 52428800, array['image/jpeg']) -- 50 MiB
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own profile photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Public buckets serve files without this; the API needs it to list and delete objects.
create policy "Users can read their own profile photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can delete their own profile photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
