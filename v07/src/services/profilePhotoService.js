// Port of ProfilePhotoService.swift: uploads, crops and removes profile photos in the `avatars`
// bucket and points `profiles.photo_path` / `photo_thumb_path` / `photo_original_path` at them
// (see `v06/supabase/schemas/30_profile_photos.sql`).
import { unwrap } from './profilesService.js';

const BUCKET = 'avatars';

/** The bucket is public, so the URL works in an `<img>` without auth headers. */
export function publicURL(client, path) {
  if (!path) return null;
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Replaces the profile's photo with a newly picked one. If `photo` is a crop, pass the
 * uncropped JPEG as `original` so it's kept for re-cropping and restoring.
 */
export async function upload(client, photo, original, profile) {
  const base = newBasePath(profile);
  const files = [
    { path: `${base}-full.jpg`, data: photo.full },
    { path: `${base}-thumb.jpg`, data: photo.thumb },
  ];
  if (original) files.push({ path: `${base}-original.jpg`, data: original });
  const paths = { full: files[0].path, thumb: files[1].path, original: original ? files[2].path : null };
  await replacePhoto(client, profile, paths, files);
}

/**
 * Shows `crop` (cut from `originalData`) in place of the current photo. The original stays in
 * the bucket.
 */
export async function applyCrop(client, crop, profile) {
  const base = newBasePath(profile);
  const files = [
    { path: `${base}-full.jpg`, data: crop.full },
    { path: `${base}-thumb.jpg`, data: crop.thumb },
  ];
  const paths = {
    full: files[0].path,
    thumb: files[1].path,
    original: profile.photo_original_path ?? profile.photo_path,
  };
  await replacePhoto(client, profile, paths, files);
}

/** Undoes a crop: the original becomes the photo again. `originalThumb` is its thumbnail. */
export async function restoreOriginal(client, profile, originalThumb) {
  if (!profile.photo_original_path) return;
  const thumbPath = `${newBasePath(profile)}-thumb.jpg`;
  const paths = { full: profile.photo_original_path, thumb: thumbPath, original: null };
  await replacePhoto(client, profile, paths, [{ path: thumbPath, data: originalThumb }]);
}

/** The uncropped photo as a JPEG blob, or `null` if the profile has no photo. */
export async function originalData(client, profile) {
  const path = profile.photo_original_path ?? profile.photo_path;
  if (!path) return null;
  return unwrap(await client.storage.from(BUCKET).download(path));
}

export async function remove(client, profile) {
  await replacePhoto(client, profile, { full: null, thumb: null, original: null }, []);
}

/** A fresh, extension-less object path in the user's folder. */
function newBasePath(profile) {
  return `${profile.id}/${crypto.randomUUID()}`;
}

/**
 * Uploads `files`, switches the profile to `paths`, then deletes the files it no longer points
 * at. A failure before the profile update leaves the old photo in place.
 */
async function replacePhoto(client, profile, paths, files) {
  const storage = client.storage.from(BUCKET);
  // The file names never change content, so caches can keep them for a year.
  const options = { cacheControl: '31536000', contentType: 'image/jpeg' };
  try {
    for (const file of files) {
      unwrap(await storage.upload(file.path, file.data, options));
    }
    // `null` (rather than leaving the key out) clears a path.
    unwrap(
      await client
        .from('profiles')
        .update({ photo_path: paths.full, photo_thumb_path: paths.thumb, photo_original_path: paths.original })
        .eq('id', profile.id),
    );
  } catch (error) {
    if (files.length > 0) await storage.remove(files.map((file) => file.path));
    throw error;
  }

  // Best effort: a leftover file only costs storage, so a failure here isn't shown.
  const kept = [paths.full, paths.thumb, paths.original];
  const stale = [profile.photo_path, profile.photo_thumb_path, profile.photo_original_path].filter(
    (path) => path && !kept.includes(path),
  );
  if (stale.length > 0) await storage.remove(stale);
}
