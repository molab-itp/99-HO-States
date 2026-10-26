// Port of ProfilesService.swift: reads and watches `public.profiles` (see
// `v06/supabase/schemas/10_profiles.sql`), and lets admins delete users.

/** supabase-js returns `{ data, error }` rather than throwing. */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Everyone who has ever signed in, most recently active first. */
export async function fetchAll(client) {
  return unwrap(
    await client.from('profiles').select().order('last_seen_at', { ascending: false, nullsFirst: false }),
  );
}

/**
 * Sets the current user's caption (`null` clears it) and returns the updated row. RLS only lets
 * users update their own profile.
 */
export async function updateCaption(client, caption, id) {
  return unwrap(await client.from('profiles').update({ caption }).eq('id', id).select().single());
}

/**
 * Records that the current user is about to sign out, which other clients show as a
 * "signed out" banner. Call it while the session is still valid.
 */
export async function markSignedOut(client) {
  unwrap(await client.rpc('mark_signed_out'));
}

/**
 * Calls `onChange` for every change to `profiles`, with `{ type: 'inserted' | 'updated', profile }`
 * or `{ type: 'deleted', id }` (deletes only carry the row's id), until the returned function is
 * called. Needs the table in the `supabase_realtime` publication (see the schema file).
 * `onStatus` gets `null` once the subscription is live and an error message when it can't be set
 * up or drops; the client reconnects on its own, but changes made while it was offline aren't
 * replayed, so reload after coming back.
 */
export function observeChanges(client, onChange, onStatus) {
  // A fresh name each time: `channel()` hands back an existing channel of the same name, and one
  // that has subscribed can't take new listeners.
  const channel = client
    .channel(`profiles-changes-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
      if (payload.eventType === 'INSERT') onChange({ type: 'inserted', profile: payload.new });
      else if (payload.eventType === 'UPDATE') onChange({ type: 'updated', profile: payload.new });
      else if (payload.eventType === 'DELETE' && payload.old?.id) onChange({ type: 'deleted', id: payload.old.id });
    })
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') onStatus(null);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatus(error?.message ?? (status === 'TIMED_OUT' ? 'The connection timed out.' : "Couldn't connect."));
      }
    });
  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Marks the current user as active now, so the list reflects app opens and not just fresh
 * sign-ins (a persisted session skips sign-in entirely).
 */
export async function touchLastSeen(client) {
  unwrap(await client.rpc('touch_last_seen'));
}

/**
 * Whether the current user is in `public.admins` (see `v06/supabase/schemas/40_admins.sql`).
 * Only decides whether to show the Delete action; the Edge Function checks again.
 */
export async function isAdmin(client) {
  return unwrap(await client.rpc('is_admin')) === true;
}

/**
 * Deletes another user's account, photos and data through the `delete-user` Edge Function
 * (`v06/supabase/functions/delete-user`). Admins only. Every client, this one included, then
 * gets the `profiles` delete over Realtime.
 */
export async function deleteUser(client, id) {
  const { error } = await client.functions.invoke('delete-user', { body: { user_id: id } });
  if (!error) return;
  // The function explains itself in `{"error": "…"}`; the SDK's own message is only that the
  // status wasn't 2xx. `context` is the Response, for an HTTP error.
  const response = error.context;
  if (typeof response?.json === 'function') {
    const message = (await response.json().catch(() => null))?.error;
    throw new Error(message ?? `Deleting the user failed (HTTP ${response.status}).`);
  }
  throw error;
}
