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
    /// The uncropped photo, set only while `photoPath` is a crop of it.
    let photoOriginalPath: String?
    /// A short line the user writes about themselves; at most `Profile.captionLimit` characters.
    let caption: String?
    let isAnonymous: Bool
    let createdAt: Date
    let lastSignInAt: Date?
    let lastSeenAt: Date?
    let lastSignOutAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, email
        case displayName = "display_name"
        case avatarURLString = "avatar_url"
        case photoPath = "photo_path"
        case photoThumbPath = "photo_thumb_path"
        case photoOriginalPath = "photo_original_path"
        case caption
        case isAnonymous = "is_anonymous"
        case createdAt = "created_at"
        case lastSignInAt = "last_sign_in_at"
        case lastSeenAt = "last_seen_at"
        case lastSignOutAt = "last_sign_out_at"
    }

    /// Matches the `char_length` check on `profiles.caption`.
    static let captionLimit = 100

    /// Guests have no email, so a slice of their id tells them apart in the list.
    var name: String {
        displayName ?? email ?? (isAnonymous ? "Guest \(id.uuidString.prefix(4))" : "Unknown user")
    }
    var avatarURL: URL? { avatarURLString.flatMap(URL.init(string:)) }
}
