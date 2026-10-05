import Foundation
import Supabase

/// Reads and watches `public.profiles` (see `supabase/schemas/10_profiles.sql`).
struct ProfilesService {
    let client: SupabaseClient

    /// Everyone who has ever signed in, most recently active first.
    func fetchAll() async throws -> [Profile] {
        try await client
            .from("profiles")
            .select()
            .order("last_seen_at", ascending: false, nullsFirst: false)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> Profile {
        try await client
            .from("profiles")
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    /// A live change to one `profiles` row, from Supabase Realtime.
    enum Change: Sendable {
        case inserted(Profile)
        case updated(Profile)
        /// Deletes only carry the row's id.
        case deleted(UUID)
    }

    /// Calls `onChange` for every change to `profiles` until the task is cancelled. Needs the
    /// table in the `supabase_realtime` publication (see the schema file). Throws if the
    /// subscription can't be set up; after that the client reconnects on its own, but changes
    /// made while it was offline aren't replayed, so reload after coming back.
    func observeChanges(_ onChange: @MainActor (Change) -> Void) async throws {
        let channel = client.channel("profiles-changes")
        let actions = channel.postgresChange(AnyAction.self, schema: "public", table: "profiles")
        try await channel.subscribeWithError()
        for await action in actions {
            switch action {
            case .insert(let insert):
                if let profile = try? insert.decodeRecord(as: Profile.self, decoder: AnyJSON.decoder) {
                    await onChange(.inserted(profile))
                }
            case .update(let update):
                if let profile = try? update.decodeRecord(as: Profile.self, decoder: AnyJSON.decoder) {
                    await onChange(.updated(profile))
                }
            case .delete(let delete):
                if let id = delete.oldRecord["id"]?.stringValue.flatMap(UUID.init(uuidString:)) {
                    await onChange(.deleted(id))
                }
            }
        }
        await client.removeChannel(channel)
    }

    /// Marks the current user as active now, so the list reflects app opens and not just fresh
    /// sign-ins (a persisted session skips sign-in entirely).
    func touchLastSeen() async throws {
        try await client.rpc("touch_last_seen").execute()
    }
}
