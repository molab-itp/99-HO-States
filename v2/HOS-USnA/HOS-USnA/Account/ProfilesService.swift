// The calls v2 needs from v06/HOS-Lobby/HOS_Lobby/Services/ProfilesService.swift, plus
// `publicURL` from v06's ProfilePhotoService; keep v06 as the source of truth.
import Foundation
import Supabase

/// Keeps the current user's `public.profiles` row (see `v06/supabase/schemas/10_profiles.sql`)
/// up to date, so v2 users show up in the v06/v07 lobby like anyone else.
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

    /// A public URL for a path in the `avatars` bucket (see `v06/supabase/schemas/30_profile_photos.sql`).
    func publicURL(for path: String?) -> URL? {
        guard let path else { return nil }
        return try? client.storage.from("avatars").getPublicURL(path: path)
    }

    /// Records that the current user is about to sign out, which other clients show as a
    /// "signed out" banner. Call it while the session is still valid.
    func markSignedOut() async throws {
        try await client.rpc("mark_signed_out").execute()
    }

    /// Marks the current user as active now, so the lobby reflects app opens and not just fresh
    /// sign-ins (a persisted session skips sign-in entirely).
    func touchLastSeen() async throws {
        try await client.rpc("touch_last_seen").execute()
    }
}
