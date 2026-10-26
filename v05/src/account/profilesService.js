// Port of v2's Account/ProfilesService.swift: the two calls v2 needs from v07's
// profilesService.js; keep v07 as the source of truth. Keeps the current user's
// `public.profiles` row up to date, so v05 users show up in the v06/v07 lobby like anyone else.

/** supabase-js returns `{ data, error }` rather than throwing. */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
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
