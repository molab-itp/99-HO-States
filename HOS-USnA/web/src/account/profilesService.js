// Port of v2's Account/ProfilesService.swift (and Profile.swift): the calls v2 needs from v07's
// profilesService.js, plus `publicURL` from its profilePhotoService.js and `profileName` from
// models/profile.js; keep v07 as the source of truth. Keeps the current user's `public.profiles`
// row up to date, so v05 users show up in the v06/v07 lobby like anyone else, and lists everyone
// for the Account screen's Other Users. A profile is a `profiles` row as supabase-js returns it.

/** supabase-js returns `{ data, error }` rather than throwing. */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Everyone who has ever signed in, most recently active first. */
export async function fetchAllProfiles(client) {
  return unwrap(
    await client.from('profiles').select().order('last_seen_at', { ascending: false, nullsFirst: false }),
  );
}

/** A public URL for a path in the `avatars` bucket (see `v06/supabase/schemas/30_profile_photos.sql`). */
export function publicURL(client, path) {
  if (!path) return null;
  return client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Guests have no email, so a slice of their id tells them apart in the list. */
export function profileName(profile) {
  return (
    profile.display_name ??
    profile.email ??
    // Uppercase to match v06, where `UUID.uuidString` is.
    (profile.is_anonymous ? `Guest ${profile.id.slice(0, 4).toUpperCase()}` : 'Unknown user')
  );
}

/**
 * Records that the current user is about to sign out, which other clients show as a
 * "signed out" banner. Call it while the session is still valid.
 */
export async function markSignedOut(client) {
  unwrap(await client.rpc('mark_signed_out'));
}

/**
 * Marks the current user as active now, so the lobby reflects app opens and not just fresh
 * sign-ins (a persisted session skips sign-in entirely).
 */
export async function touchLastSeen(client) {
  unwrap(await client.rpc('touch_last_seen'));
}
