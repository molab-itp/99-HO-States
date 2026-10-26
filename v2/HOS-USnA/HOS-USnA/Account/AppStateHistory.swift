import Foundation
import Supabase

/// Export/import for `AccountView`, kept as a history in `public.app_state` (see
/// `v06/supabase/schemas/20_app_state.sql`): every export inserts a new row keyed by user and
/// date, `key = "history/<UTC time>"`, rather than overwriting one row. Rows are never updated or
/// deleted here, so any earlier export can be rolled back to later. No migration needed: the
/// table's key is already (user_id, app, key). `key = 'default'` is left for live sync (stage 2 in
/// `Log-v2-signon.md`), and v07 reads only that key, so these rows don't affect it.
struct AppStateHistory {
    let client: SupabaseClient

    /// Shared with v05/v07 (see v06's `AppStateStore`).
    static let app = "ho-states"
    static let keyPrefix = "history/"
    /// Bump when `AppModel.Snapshot` changes incompatibly, and upgrade old rows on read.
    static let schemaVersion = 1

    struct Entry {
        let key: String
        let snapshot: AppModel.Snapshot
        /// Stamped by the database on insert, so it doesn't depend on the device's clock.
        let savedAt: Date
    }

    private struct Row: Codable {
        let app: String
        let key: String
        let data: AppModel.Snapshot
        let schemaVersion: Int
        /// Left out when inserting; the column defaults to `now()`.
        var updatedAt: Date?

        enum CodingKeys: String, CodingKey {
            case app, key, data
            case schemaVersion = "schema_version"
            case updatedAt = "updated_at"
        }
    }

    /// Adds `snapshot` as a new history row; `user_id` is filled in from the session's JWT.
    func export(_ snapshot: AppModel.Snapshot) async throws {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let key = Self.keyPrefix + formatter.string(from: .now)
        try await client
            .from("app_state")
            .insert(Row(app: Self.app, key: key, data: snapshot, schemaVersion: Self.schemaVersion))
            .execute()
    }

    /// The most recent export by this user from any device, or `nil` if there's none.
    func latest() async throws -> Entry? {
        let rows: [Row] = try await client
            .from("app_state")
            .select("app,key,data,schema_version,updated_at")
            .eq("app", value: Self.app)
            .like("key", pattern: Self.keyPrefix + "%")
            .order("updated_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first.map { Entry(key: $0.key, snapshot: $0.data, savedAt: $0.updatedAt ?? .distantPast) }
    }
}
