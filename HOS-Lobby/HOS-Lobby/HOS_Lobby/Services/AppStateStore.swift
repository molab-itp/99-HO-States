import Foundation
import Supabase

/// Syncs one app's `Codable` state as a JSON document in `public.app_state` (see
/// `supabase/schemas/20_app_state.sql`). Changing `AppState`'s fields is a client-only change; the
/// database never needs a migration for it.
///
/// Intended for v2 (and mirrored in v05 via supabase-js): e.g.
/// `AppStateStore<PersistedAppState>(client: client, app: "ho-states")`, with `save` called from
/// the same `scenePhase == .background` hook that writes `AppState.json` today.
struct AppStateStore<AppState: Codable & Sendable> {
    let client: SupabaseClient
    /// Shared by every client of the same app (iOS + web), which is what syncs them.
    let app: String
    var key = "default"

    private struct Row: Codable, Sendable {
        let app: String
        let key: String
        let data: AppState
        let schemaVersion: Int

        enum CodingKeys: String, CodingKey {
            case app, key, data
            case schemaVersion = "schema_version"
        }
    }

    /// `nil` if the signed-in user has never saved state for this app.
    func load() async throws -> (state: AppState, schemaVersion: Int)? {
        let rows: [Row] = try await client
            .from("app_state")
            .select("app,key,data,schema_version")
            .eq("app", value: app)
            .eq("key", value: key)
            .limit(1)
            .execute()
            .value
        return rows.first.map { ($0.data, $0.schemaVersion) }
    }

    /// Insert-or-replace; `user_id` is filled in by the database from the session's JWT.
    func save(_ state: AppState, schemaVersion: Int = 1) async throws {
        try await client
            .from("app_state")
            .upsert(Row(app: app, key: key, data: state, schemaVersion: schemaVersion),
                    onConflict: "user_id,app,key")
            .execute()
    }
}
