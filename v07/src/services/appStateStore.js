// Port of AppStateStore.swift: syncs one app's state as a JSON document in `public.app_state`
// (see `v06/supabase/schemas/20_app_state.sql`). Changing the state's fields is a client-only
// change; the database never needs a migration for it.
//
// Not used by this app. Like the Swift one, it's the ready-to-copy client for v05, e.g.
// `appStateStore(client, 'ho-states')` with `save` called wherever the localStorage blob is
// written today. v2 uses the same `app`, which is what keeps iOS and web in sync.
import { unwrap } from './profilesService.js';

export function appStateStore(client, app, key = 'default') {
  return {
    /** `{ state, schemaVersion }`, or `null` if the signed-in user has never saved state for this app. */
    async load() {
      const rows = unwrap(
        await client.from('app_state').select('app,key,data,schema_version').eq('app', app).eq('key', key).limit(1),
      );
      return rows[0] ? { state: rows[0].data, schemaVersion: rows[0].schema_version } : null;
    },

    /** Insert-or-replace; `user_id` is filled in by the database from the session's JWT. */
    async save(state, schemaVersion = 1) {
      unwrap(
        await client
          .from('app_state')
          .upsert({ app, key, data: state, schema_version: schemaVersion }, { onConflict: 'user_id,app,key' }),
      );
    },
  };
}
