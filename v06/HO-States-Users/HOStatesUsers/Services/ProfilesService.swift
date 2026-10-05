import Foundation
import Supabase

/// Reads and watches `public.profiles` (see `supabase/schemas/10_profiles.sql`), and lets admins
/// delete users.
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

    /// Records that the current user is about to sign out, which other clients show as a
    /// "signed out" banner. Call it while the session is still valid.
    func markSignedOut() async throws {
        try await client.rpc("mark_signed_out").execute()
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

    /// Whether the current user is in `public.admins` (see `supabase/schemas/40_admins.sql`).
    /// Only decides whether to show the Delete action; the Edge Function checks again.
    func isAdmin() async throws -> Bool {
        try await client.rpc("is_admin").execute().value
    }

    /// Deletes another user's account, photos and data through the `delete-user` Edge Function
    /// (`supabase/functions/delete-user`). Admins only. Every client, this one included, then
    /// gets the `profiles` delete over Realtime.
    func deleteUser(id: UUID) async throws {
        do {
            try await client.functions.invoke(
                "delete-user", options: FunctionInvokeOptions(body: ["user_id": id.uuidString]))
        } catch FunctionsError.httpError(let code, let data) {
            // The function explains itself in `{"error": "…"}`; the SDK's own message is only
            // the status code.
            let message = (try? JSONDecoder().decode(DeleteUserFailure.self, from: data))?.error
            throw DeleteUserError(message: message ?? "Deleting the user failed (HTTP \(code)).")
        }
    }

    struct DeleteUserError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private struct DeleteUserFailure: Decodable {
        let error: String
    }
}
