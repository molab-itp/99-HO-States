import Foundation
import Supabase

/// Reads and writes `public.shake_sessions` and the `shake_totals` view (see
/// `supabase/schemas/50_shakes.sql`).
struct ShakesService {
    let client: SupabaseClient

    /// Every user who has shaken, most shakes first.
    func fetchTotals() async throws -> [ShakeTotals] {
        try await client
            .from("shake_totals")
            .select()
            .order("total_shakes", ascending: false)
            .execute()
            .value
    }

    /// One user's bursts, newest first.
    func fetchHistory(userID: UUID, limit: Int = 500) async throws -> [ShakeSession] {
        try await client
            .from("shake_sessions")
            .select("id,user_id,shake_count,duration_ms,started_at")
            .eq("user_id", value: userID)
            .order("started_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    /// Records a burst for the signed-in user; `user_id` comes from the session's JWT.
    @discardableResult
    func record(_ session: NewShakeSession) async throws -> ShakeSession {
        try await client
            .from("shake_sessions")
            .insert(session)
            .select("id,user_id,shake_count,duration_ms,started_at")
            .single()
            .execute()
            .value
    }

    /// RLS only lets users delete their own.
    func delete(id: UUID) async throws {
        try await client.from("shake_sessions").delete().eq("id", value: id).execute()
    }

    /// Deletes every burst of the given users, which drops them from `shake_totals`. RLS lets
    /// admins delete anyone's; anyone else only clears their own (other rows are skipped silently).
    func clearStats(userIDs: [UUID]) async throws {
        guard !userIDs.isEmpty else { return }
        try await client
            .from("shake_sessions")
            .delete()
            .in("user_id", values: userIDs.map(\.uuidString))
            .execute()
    }

    /// Calls `onChange` whenever any `shake_sessions` row is inserted or deleted, until the task
    /// is cancelled. The caller reloads, since the totals are computed by the view.
    func observeChanges(_ onChange: @MainActor () -> Void) async throws {
        let channel = client.channel("shake-sessions-changes")
        let actions = channel.postgresChange(AnyAction.self, schema: "public", table: "shake_sessions")
        try await channel.subscribeWithError()
        for await _ in actions {
            await onChange()
        }
        await client.removeChannel(channel)
    }
}
