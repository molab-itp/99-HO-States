import Foundation
import Supabase

/// Reads `public.profiles` (see `supabase/schemas/10_profiles.sql`).
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

    /// Marks the current user as active now, so the list reflects app opens and not just fresh
    /// sign-ins (a persisted session skips sign-in entirely).
    func touchLastSeen() async throws {
        try await client.rpc("touch_last_seen").execute()
    }
}
