import Foundation

/// A row of `public.profiles`.
struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let email: String?
    let displayName: String?
    let avatarURLString: String?
    /// Paths in the `avatars` bucket; turn them into URLs with `ProfilePhotoService.publicURL`.
    let photoPath: String?
    let photoThumbPath: String?
    let isAnonymous: Bool
    let createdAt: Date
    let lastSignInAt: Date?
    let lastSeenAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, email
        case displayName = "display_name"
        case avatarURLString = "avatar_url"
        case photoPath = "photo_path"
        case photoThumbPath = "photo_thumb_path"
        case isAnonymous = "is_anonymous"
        case createdAt = "created_at"
        case lastSignInAt = "last_sign_in_at"
        case lastSeenAt = "last_seen_at"
    }

    /// Guests have no email, so a slice of their id tells them apart in the list.
    var name: String {
        displayName ?? email ?? (isAnonymous ? "Guest \(id.uuidString.prefix(4))" : "Unknown user")
    }
    var avatarURL: URL? { avatarURLString.flatMap(URL.init(string:)) }
}
