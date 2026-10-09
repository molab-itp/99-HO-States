import Foundation
import Supabase

/// Uploads and removes profile photos in the `avatars` bucket and points `profiles.photo_path` /
/// `photo_thumb_path` at them (see `supabase/schemas/30_profile_photos.sql`).
struct ProfilePhotoService {
    static let bucket = "avatars"

    let client: SupabaseClient

    private var storage: StorageFileApi { client.storage.from(Self.bucket) }

    /// The bucket is public, so the URL works in `AsyncImage` without auth headers.
    func publicURL(for path: String?) -> URL? {
        guard let path else { return nil }
        return try? storage.getPublicURL(path: path)
    }

    /// Uploads both images under fresh names, switches the profile to them, then deletes the
    /// previous pair. A failure before the profile update leaves the old photo in place.
    func upload(_ photo: ProfilePhoto, replacing profile: Profile) async throws {
        // Storage policies compare the folder with `auth.uid()::text`, which is lowercase.
        let base = "\(profile.id.uuidString.lowercased())/\(UUID().uuidString.lowercased())"
        let fullPath = "\(base)-full.jpg"
        let thumbPath = "\(base)-thumb.jpg"
        // The file names never change content, so caches can keep them for a year.
        let options = FileOptions(cacheControl: "31536000", contentType: "image/jpeg")

        try await storage.upload(fullPath, data: photo.full, options: options)
        try await storage.upload(thumbPath, data: photo.thumb, options: options)
        do {
            try await setPhotoPaths(PhotoPaths(full: fullPath, thumb: thumbPath), for: profile.id)
        } catch {
            _ = try? await storage.remove(paths: [fullPath, thumbPath])
            throw error
        }
        await removeFiles(of: profile)
    }

    func remove(from profile: Profile) async throws {
        try await setPhotoPaths(PhotoPaths(full: nil, thumb: nil), for: profile.id)
        await removeFiles(of: profile)
    }

    /// Best effort: a leftover file only costs storage, so a failure here isn't shown.
    private func removeFiles(of profile: Profile) async {
        let paths = [profile.photoPath, profile.photoThumbPath].compactMap { $0 }
        guard !paths.isEmpty else { return }
        _ = try? await storage.remove(paths: paths)
    }

    private func setPhotoPaths(_ paths: PhotoPaths, for id: UUID) async throws {
        try await client
            .from("profiles")
            .update(paths)
            .eq("id", value: id)
            .execute()
    }

    /// Encodes `nil` as `null` (rather than leaving the key out) so removing a photo clears it.
    private struct PhotoPaths: Encodable {
        let full: String?
        let thumb: String?

        enum CodingKeys: String, CodingKey {
            case full = "photo_path"
            case thumb = "photo_thumb_path"
        }

        func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(full, forKey: .full)
            try container.encode(thumb, forKey: .thumb)
        }
    }
}
