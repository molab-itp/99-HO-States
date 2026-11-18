// Port of ShakesService.swift: reads and writes `public.shake_sessions` and the `shake_totals`
// view (see `HOS-Lobby/supabase/schemas/50_shakes.sql`).
import { unwrap } from './profilesService.js';

const SESSION_COLUMNS = 'id,user_id,shake_count,duration_ms,started_at';

/** Every user who has shaken, most shakes first. */
export async function fetchTotals(client) {
  return unwrap(await client.from('shake_totals').select().order('total_shakes', { ascending: false }));
}

/** One user's bursts, newest first. */
export async function fetchHistory(client, userID, limit = 500) {
  return unwrap(
    await client
      .from('shake_sessions')
      .select(SESSION_COLUMNS)
      .eq('user_id', userID)
      .order('started_at', { ascending: false })
      .limit(limit),
  );
}

/**
 * Records a burst `{ shake_count, duration_ms, started_at }` for the signed-in user; `user_id`
 * comes from the session's JWT.
 */
export async function record(client, session) {
  return unwrap(await client.from('shake_sessions').insert(session).select(SESSION_COLUMNS).single());
}

/** RLS only lets users delete their own. */
export async function deleteSession(client, id) {
  unwrap(await client.from('shake_sessions').delete().eq('id', id));
}

/**
 * Calls `onChange` whenever any `shake_sessions` row is inserted or deleted, until the returned
 * function is called. The caller reloads, since the totals are computed by the view. `onStatus`
 * works as in `profilesService.observeChanges`.
 */
export function observeChanges(client, onChange, onStatus) {
  const channel = client
    .channel(`shake-sessions-changes-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shake_sessions' }, () => onChange())
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
