// Port of v2's Account/AppStateHistory.swift: Export/Import for `AccountSheet`, kept as a history
// in `public.app_state` (see `v06/supabase/schemas/20_app_state.sql`). Every export inserts a new
// row keyed by user and date, `key = "history/<UTC time>"`, rather than overwriting one row; rows
// are never updated or deleted here, so any earlier export can be rolled back to later. Same
// `app` and JSON shape as v2 (see `AppModelContext`'s `snapshot`), so an export from either app
// imports into the other.
import { unwrap } from './profilesService.js';

/** Shared with v2/v07 (see v06's `AppStateStore`). */
const APP = 'ho-states';
const KEY_PREFIX = 'history/';
/** Bump when the snapshot changes incompatibly, and upgrade old rows on read. */
const SCHEMA_VERSION = 1;

/** Adds `snapshot` as a new history row; `user_id` is filled in from the session's JWT. */
export async function exportAppState(client, snapshot) {
  const key = KEY_PREFIX + new Date().toISOString();
  unwrap(await client.from('app_state').insert({ app: APP, key, data: snapshot, schema_version: SCHEMA_VERSION }));
}

/**
 * The most recent export by this user from any device, as `{ key, snapshot, savedAt }` (`savedAt`
 * a Date, stamped by the database), or `null` if there's none.
 */
export async function latestAppState(client) {
  const rows = unwrap(
    await client
      .from('app_state')
      .select('app,key,data,schema_version,updated_at')
      .eq('app', APP)
      .like('key', `${KEY_PREFIX}%`)
      .order('updated_at', { ascending: false })
      .limit(1),
  );
  const row = rows[0];
  return row ? { key: row.key, snapshot: row.data, savedAt: new Date(row.updated_at) } : null;
}
