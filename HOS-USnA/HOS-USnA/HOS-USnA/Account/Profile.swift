// Cut down from v06/HOS-Lobby/HOS_Lobby/Models/Profile.swift; keep v06 as the source of truth.
import Foundation

/// A row of `public.profiles`, with just the columns the Account view shows.
struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let email: String?
    let displayName: String?
    let avatarURLString: String?
    /// Path in the `avatars` bucket; turn it into a URL with `ProfilesService.publicURL`.
    let photoThumbPath: String?
    let caption: String?
    let isAnonymous: Bool

    enum CodingKeys: String, CodingKey {
        case id, email
        case displayName = "display_name"
        case avatarURLString = "avatar_url"
        case photoThumbPath = "photo_thumb_path"
        case caption
        case isAnonymous = "is_anonymous"
    }

    /// Guests have no email, so a slice of their id tells them apart in the list.
    var name: String {
        displayName ?? email ?? (isAnonymous ? "Guest \(id.uuidString.prefix(4))" : "Unknown user")
    }
    var avatarURL: URL? { avatarURLString.flatMap(URL.init(string:)) }
}
